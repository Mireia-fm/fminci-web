const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDoubleIncidencias() {
  console.log('🔍 Investigando carpetas en incidencias/incidencias/\n');
  console.log('='.repeat(70));

  // Listar contenido de incidencias/
  console.log('\n📂 Contenido de incidencias/:\n');

  const { data: level1, error: err1 } = await supabase.storage
    .from('incidencias')
    .list('incidencias', { limit: 10 });

  if (err1) {
    console.error('❌ Error:', err1.message);
    return;
  }

  level1?.forEach(item => {
    const icon = item.id ? '📄' : '📂';
    console.log(`${icon} incidencias/${item.name}`);
  });

  // Verificar si existe incidencias/incidencias/
  console.log('\n\n📂 Verificando incidencias/incidencias/:\n');

  const { data: level2, error: err2 } = await supabase.storage
    .from('incidencias')
    .list('incidencias/incidencias', { limit: 100 });

  if (err2) {
    console.log('❌ No existe esta ruta o error:', err2.message);
  } else if (level2 && level2.length > 0) {
    console.log(`✅ EXISTE! Encontradas ${level2.length} carpetas/archivos:\n`);

    const folders = level2.filter(f => !f.id);
    const files = level2.filter(f => f.id);

    if (folders.length > 0) {
      console.log(`📂 Carpetas (${folders.length}):`);
      folders.slice(0, 20).forEach(f => {
        console.log(`   - ${f.name}/`);
      });
      if (folders.length > 20) {
        console.log(`   ... y ${folders.length - 20} más`);
      }
    }

    if (files.length > 0) {
      console.log(`\n📄 Archivos (${files.length}):`);
      files.slice(0, 10).forEach(f => {
        console.log(`   - ${f.name} (${(f.metadata?.size / 1024).toFixed(2)} KB)`);
      });
    }

    // Revisar algunas carpetas dentro
    console.log('\n\n📋 Ejemplo de contenido en incidencias/incidencias/{num}/:\n');

    const sampleFolder = folders[0]?.name;
    if (sampleFolder) {
      const { data: sample } = await supabase.storage
        .from('incidencias')
        .list(`incidencias/incidencias/${sampleFolder}`, { limit: 10 });

      console.log(`📁 incidencias/incidencias/${sampleFolder}/:`);
      if (sample && sample.length > 0) {
        sample.forEach(s => {
          const icon = s.id ? '   📄' : '   📂';
          console.log(`${icon} ${s.name}`);
        });
      } else {
        console.log('   (vacía)');
      }
    }
  } else {
    console.log('⚪ No existe esta ruta o está vacía');
  }

  // Listar TODAS las carpetas que empiezan con "incidencias"
  console.log('\n\n' + '='.repeat(70));
  console.log('📊 Todas las carpetas que contienen "incidencias" en raíz:\n');

  const { data: root } = await supabase.storage
    .from('incidencias')
    .list('', { limit: 2000 });

  const incidenciasFolders = root?.filter(f =>
    !f.id && f.name.toLowerCase().includes('incidencias')
  ) || [];

  if (incidenciasFolders.length > 0) {
    incidenciasFolders.forEach(f => {
      console.log(`📂 ${f.name}/`);
    });
  } else {
    console.log('No hay carpetas con "incidencias" en el nombre en raíz');
  }

  console.log('\n' + '='.repeat(70));
}

checkDoubleIncidencias().catch(console.error);
