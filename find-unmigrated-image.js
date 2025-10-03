const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findUnmigratedImage() {
  console.log('🔍 Buscando imagen no migrada en incidencias/\n');
  console.log('='.repeat(70));

  const { data: folders } = await supabase.storage
    .from('incidencias')
    .list('incidencias', { limit: 500 });

  const numericFolders = folders?.filter(f => !f.id && /^\d+$/.test(f.name)) || [];

  console.log(`\n📋 Revisando ${numericFolders.length} carpetas...\n`);

  for (const folder of numericFolders) {
    const num = folder.name;

    const { data: contents } = await supabase.storage
      .from('incidencias')
      .list(`incidencias/${num}`, { limit: 100 });

    if (!contents) continue;

    // Buscar archivos de imagen directos
    const imageFiles = contents.filter(f =>
      f.id && /\.(jpg|jpeg|png|avif|webp|jfif|gif)$/i.test(f.name)
    );

    if (imageFiles.length > 0) {
      console.log(`🖼️  ENCONTRADA: incidencias/${num}/\n`);
      console.log('   Archivos de imagen:');

      for (const img of imageFiles) {
        console.log(`   📄 ${img.name}`);
        console.log(`      Tamaño: ${(img.metadata?.size / 1024).toFixed(2)} KB`);
        console.log(`      Última modificación: ${img.updated_at || img.created_at}`);
      }

      // Verificar si existe en la BD
      const { data: incidencia } = await supabase
        .from('incidencias')
        .select('num_solicitud, imagen_url, fecha_creacion')
        .eq('num_solicitud', num)
        .maybeSingle();

      console.log('\n   📊 Información de la BD:');
      if (incidencia) {
        console.log(`      num_solicitud: ${incidencia.num_solicitud}`);
        console.log(`      imagen_url: ${incidencia.imagen_url || '(NULL)'}`);
        console.log(`      fecha_creacion: ${incidencia.fecha_creacion}`);
      } else {
        console.log(`      ⚠️  No existe en tabla incidencias`);
      }

      // Verificar si ya existe en la raíz
      console.log('\n   🔍 Verificando si existe en raíz...');
      const { data: rootFiles } = await supabase.storage
        .from('incidencias')
        .list(num, { limit: 10 });

      if (rootFiles && rootFiles.length > 0) {
        console.log(`      ✅ SÍ existe carpeta ${num}/ en raíz con:`);
        rootFiles.forEach(f => {
          const icon = f.id ? '📄' : '📂';
          console.log(`         ${icon} ${f.name}`);
        });
      } else {
        console.log(`      ❌ NO existe carpeta ${num}/ en raíz`);
      }

      console.log('\n' + '='.repeat(70));
      console.log('💡 RECOMENDACIÓN:\n');

      if (rootFiles && rootFiles.length > 0) {
        console.log('   - La imagen ya existe en la raíz');
        console.log('   - Probablemente es un duplicado que se puede ignorar');
        console.log('   - O mover para consolidar todo en la raíz');
      } else {
        console.log('   - La imagen NO existe en raíz');
        console.log('   - DEBE ser migrada a la ubicación correcta');
      }

      break;
    }
  }

  console.log('\n✅ Búsqueda completada');
}

findUnmigratedImage().catch(console.error);
