const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrateAllBatches() {
  console.log('🚀 Migración completa en lotes\n');

  let totalMigrated = 0;
  let totalSkipped = 0;
  let batch = 1;

  while (true) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📦 LOTE ${batch}`);
    console.log('='.repeat(60));

    // Listar carpetas restantes
    const { data: folders, error } = await supabase.storage
      .from('incidencias')
      .list('incidencias', { limit: 500 });

    if (error) {
      console.error('❌ Error:', error.message);
      break;
    }

    const numericFolders = folders.filter(f => f.id === null && /^\d+$/.test(f.name));

    if (numericFolders.length === 0) {
      console.log('\n✅ ¡No quedan carpetas por migrar!');
      break;
    }

    console.log(`📋 Carpetas restantes: ${numericFolders.length}`);
    console.log(`Procesando primeras 50...\n`);

    let batchMigrated = 0;
    let batchSkipped = 0;
    const migratedNums = [];

    // Procesar primeras 50 carpetas
    for (const folder of numericFolders.slice(0, 50)) {
      const num = folder.name;
      process.stdout.write(`${num}... `);

      try {
        const { data: files } = await supabase.storage
          .from('incidencias')
          .list(`incidencias/${num}`, { limit: 100 });

        const actualFiles = files?.filter(f => f.id !== null) || [];

        if (actualFiles.length === 0) {
          process.stdout.write('⏭️  ');
          batchSkipped++;
          continue;
        }

        // Mover archivos
        for (const file of actualFiles) {
          await supabase.storage
            .from('incidencias')
            .move(`incidencias/${num}/${file.name}`, `${num}/${file.name}`);
        }

        process.stdout.write(`✅  `);
        batchMigrated++;
        migratedNums.push(num);

      } catch (err) {
        process.stdout.write(`❌  `);
      }
    }

    console.log(`\n\n💾 Actualizando ${migratedNums.length} URLs en BD...`);

    for (const num of migratedNums) {
      const { data } = await supabase
        .from('incidencias')
        .select('imagen_url')
        .eq('num_solicitud', num)
        .maybeSingle();

      if (data?.imagen_url?.startsWith('incidencias/')) {
        await supabase
          .from('incidencias')
          .update({ imagen_url: data.imagen_url.replace(/^incidencias\//, '') })
          .eq('num_solicitud', num);
        process.stdout.write('.');
      }
    }

    totalMigrated += batchMigrated;
    totalSkipped += batchSkipped;

    console.log(`\n\n📊 Lote ${batch}: ${batchMigrated} migradas, ${batchSkipped} saltadas`);
    batch++;

    // Pequeña pausa entre lotes
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 RESUMEN FINAL');
  console.log('='.repeat(60));
  console.log(`✅ Total migradas: ${totalMigrated}`);
  console.log(`⏭️  Total saltadas (vacías): ${totalSkipped}`);
}

migrateAllBatches().catch(console.error);
