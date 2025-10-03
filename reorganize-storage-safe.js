const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function reorganizeStorage() {
  console.log('🔄 Reorganización segura de Storage (SIN eliminar carpetas)\n');
  console.log('='.repeat(70));

  // PASO 1: Mover imágenes principales de incidencias/{num}/ a {num}/
  console.log('\n📦 PASO 1: Mover imágenes principales a raíz\n');

  const { data: folders } = await supabase.storage
    .from('incidencias')
    .list('incidencias', { limit: 1000 });

  const numericFolders = folders?.filter(f => !f.id && /^\d+$/.test(f.name)) || [];
  console.log(`📋 Carpetas encontradas en incidencias/: ${numericFolders.length}\n`);

  let movedImages = 0;
  let skipped = 0;
  const updatedNums = [];

  for (const folder of numericFolders) {
    const num = folder.name;

    // Listar contenido directo (archivos de imagen)
    const { data: contents } = await supabase.storage
      .from('incidencias')
      .list(`incidencias/${num}`, { limit: 100 });

    if (!contents) continue;

    // Buscar archivos de imagen directos (jpg, jpeg, png, avif, webp)
    const imageFiles = contents.filter(f =>
      f.id && /\.(jpg|jpeg|png|avif|webp|jfif)$/i.test(f.name)
    );

    if (imageFiles.length === 0) {
      skipped++;
      continue;
    }

    // Mover cada imagen
    for (const img of imageFiles) {
      const from = `incidencias/${num}/${img.name}`;
      const to = `${num}/${img.name}`;

      console.log(`📸 ${num}: ${img.name}...`);

      const { error: moveError } = await supabase.storage
        .from('incidencias')
        .move(from, to);

      if (moveError) {
        console.log(`   ❌ Error: ${moveError.message}`);
      } else {
        console.log(`   ✅ Movido a ${to}`);
        movedImages++;
        if (!updatedNums.includes(num)) {
          updatedNums.push(num);
        }
      }
    }
  }

  console.log(`\n📊 Imágenes movidas: ${movedImages}`);
  console.log(`⏭️  Carpetas sin imágenes: ${skipped}`);

  // PASO 2: Actualizar URLs en base de datos
  console.log('\n💾 PASO 2: Actualizando URLs en base de datos\n');
  console.log('='.repeat(70));

  // Obtener todas las incidencias con URLs que empiezan con "incidencias/"
  const { data: incidencias } = await supabase
    .from('incidencias')
    .select('num_solicitud, imagen_url')
    .like('imagen_url', 'incidencias/%');

  console.log(`\n📋 Incidencias con URLs a actualizar: ${incidencias?.length || 0}\n`);

  let updatedUrls = 0;

  if (incidencias) {
    for (const inc of incidencias) {
      const oldUrl = inc.imagen_url;
      const newUrl = oldUrl.replace(/^incidencias\//, '');

      const { error: updateError } = await supabase
        .from('incidencias')
        .update({ imagen_url: newUrl })
        .eq('num_solicitud', inc.num_solicitud);

      if (updateError) {
        console.log(`❌ ${inc.num_solicitud}: Error - ${updateError.message}`);
      } else {
        console.log(`✅ ${inc.num_solicitud}: ${oldUrl} → ${newUrl}`);
        updatedUrls++;
      }
    }
  }

  console.log(`\n📊 URLs actualizadas: ${updatedUrls}`);

  console.log('\n' + '='.repeat(70));
  console.log('✅ PASO 1 Y 2 COMPLETADOS\n');
  console.log('Siguiente: Crear bucket presupuestos y migrar archivos...');
}

reorganizeStorage().catch(console.error);
