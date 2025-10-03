const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function listTrulyEmptyFolders() {
  console.log('🔍 Buscando carpetas REALMENTE vacías\n');
  console.log('='.repeat(70));

  // Revisar carpetas en raíz
  console.log('\n📋 Revisando carpetas en RAÍZ del bucket:\n');

  const { data: rootFolders } = await supabase.storage
    .from('incidencias')
    .list('', { limit: 2000 });

  const numericRoot = rootFolders?.filter(f => !f.id && /^\d+$/.test(f.name)) || [];

  let emptyInRoot = [];

  for (const folder of numericRoot) {
    const { data: contents } = await supabase.storage
      .from('incidencias')
      .list(folder.name, { limit: 1 });

    if (!contents || contents.length === 0) {
      emptyInRoot.push(folder.name);
    }
  }

  console.log(`✅ Carpetas numéricas en raíz: ${numericRoot.length}`);
  console.log(`⚪ Carpetas completamente vacías: ${emptyInRoot.length}`);

  if (emptyInRoot.length > 0) {
    console.log('\n   Carpetas vacías:');
    emptyInRoot.slice(0, 20).forEach(n => console.log(`   - ${n}/`));
    if (emptyInRoot.length > 20) {
      console.log(`   ... y ${emptyInRoot.length - 20} más`);
    }
  }

  // Revisar carpetas en incidencias/
  console.log('\n\n📋 Revisando carpetas en incidencias/:\n');

  const { data: incFolders } = await supabase.storage
    .from('incidencias')
    .list('incidencias', { limit: 1000 });

  const numericInc = incFolders?.filter(f => !f.id && /^\d+$/.test(f.name)) || [];

  let emptyInIncidencias = [];

  for (const folder of numericInc) {
    const { data: contents } = await supabase.storage
      .from('incidencias')
      .list(`incidencias/${folder.name}`, { limit: 1 });

    if (!contents || contents.length === 0) {
      emptyInIncidencias.push(folder.name);
    }
  }

  console.log(`✅ Carpetas numéricas en incidencias/: ${numericInc.length}`);
  console.log(`⚪ Carpetas completamente vacías: ${emptyInIncidencias.length}`);

  if (emptyInIncidencias.length > 0) {
    console.log('\n   Carpetas vacías:');
    emptyInIncidencias.slice(0, 20).forEach(n => console.log(`   - incidencias/${n}/`));
    if (emptyInIncidencias.length > 20) {
      console.log(`   ... y ${emptyInIncidencias.length - 20} más`);
    }
  }

  // RESUMEN
  console.log('\n' + '='.repeat(70));
  console.log('📊 RESUMEN:\n');
  console.log(`Total carpetas vacías en raíz:         ${emptyInRoot.length}`);
  console.log(`Total carpetas vacías en incidencias/: ${emptyInIncidencias.length}`);

  // Guardar lista para posible eliminación
  if (emptyInRoot.length > 0 || emptyInIncidencias.length > 0) {
    const fs = require('fs');
    const report = {
      timestamp: new Date().toISOString(),
      empty_in_root: emptyInRoot,
      empty_in_incidencias: emptyInIncidencias,
      total: emptyInRoot.length + emptyInIncidencias.length
    };

    fs.writeFileSync('empty-folders-report.json', JSON.stringify(report, null, 2));
    console.log('\n📄 Reporte guardado en: empty-folders-report.json');
  }

  console.log('\n' + '='.repeat(70));
}

listTrulyEmptyFolders().catch(console.error);
