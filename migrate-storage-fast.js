const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrateFast() {
  console.log('🚀 Migración rápida: incidencias/{num}/ → {num}/\n');

  // Listar carpetas en incidencias/
  const { data: folders, error } = await supabase.storage
    .from('incidencias')
    .list('incidencias', { limit: 200 });

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  const numericFolders = folders.filter(f => f.id === null && /^\d+$/.test(f.name));
  console.log(`📋 Total de carpetas a migrar: ${numericFolders.length}\n`);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;
  const migratedNums = [];

  for (const folder of numericFolders) {
    const num = folder.name;
    process.stdout.write(`📁 ${num}... `);

    try {
      // Listar archivos
      const { data: files } = await supabase.storage
        .from('incidencias')
        .list(`incidencias/${num}`, { limit: 100 });

      const actualFiles = files?.filter(f => f.id !== null) || [];

      if (actualFiles.length === 0) {
        console.log('vacía ⏭️');
        skipped++;
        continue;
      }

      // Mover archivos usando move() en lugar de download/upload
      for (const file of actualFiles) {
        const from = `incidencias/${num}/${file.name}`;
        const to = `${num}/${file.name}`;

        const { error: moveError } = await supabase.storage
          .from('incidencias')
          .move(from, to);

        if (moveError) {
          console.log(`❌ Error: ${moveError.message}`);
          errors++;
          break;
        }
      }

      console.log(`✅ (${actualFiles.length} archivos)`);
      migrated++;
      migratedNums.push(num);

    } catch (err) {
      console.log(`❌ ${err.message}`);
      errors++;
    }
  }

  // Actualizar BD
  console.log(`\n💾 Actualizando ${migratedNums.length} URLs en BD...`);

  for (const num of migratedNums) {
    const { data } = await supabase
      .from('incidencias')
      .select('imagen_url')
      .eq('num_solicitud', num)
      .single();

    if (data?.imagen_url?.startsWith('incidencias/')) {
      const newUrl = data.imagen_url.replace(/^incidencias\//, '');
      await supabase
        .from('incidencias')
        .update({ imagen_url: newUrl })
        .eq('num_solicitud', num);
      process.stdout.write('.');
    }
  }

  console.log(`\n\n📊 RESUMEN:`);
  console.log(`✅ Migradas: ${migrated}`);
  console.log(`⏭️  Saltadas (vacías): ${skipped}`);
  console.log(`❌ Errores: ${errors}`);
}

migrateFast().catch(console.error);
