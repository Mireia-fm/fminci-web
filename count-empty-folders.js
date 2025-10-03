const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function countEmptyFolders() {
  console.log('🔍 Contando carpetas vacías en bucket "incidencias"\n');
  console.log('='.repeat(70));

  // Obtener todas las carpetas en raíz
  const { data: rootFolders } = await supabase.storage
    .from('incidencias')
    .list('', { limit: 2000 });

  const numericFolders = rootFolders?.filter(f => !f.id && /^\d+$/.test(f.name)) || [];
  console.log(`\n📋 Total carpetas numéricas en raíz: ${numericFolders.length}\n`);

  let totallyEmpty = 0;
  let hasOnlySubfolders = 0;
  let hasFiles = 0;
  let errors = 0;

  console.log('Analizando carpetas...\n');

  for (let i = 0; i < numericFolders.length; i++) {
    const folder = numericFolders[i];
    const num = folder.name;

    if (i % 50 === 0) {
      console.log(`Procesadas ${i}/${numericFolders.length}...`);
    }

    try {
      const { data: contents, error } = await supabase.storage
        .from('incidencias')
        .list(num, { limit: 100 });

      if (error) {
        errors++;
        continue;
      }

      if (!contents || contents.length === 0) {
        totallyEmpty++;
      } else {
        const files = contents.filter(f => f.id);
        const folders = contents.filter(f => !f.id);

        if (files.length === 0 && folders.length > 0) {
          hasOnlySubfolders++;
        } else if (files.length > 0) {
          hasFiles++;
        }
      }
    } catch (err) {
      errors++;
    }
  }

  console.log(`\nProcesadas ${numericFolders.length}/${numericFolders.length}... ✅\n`);

  // Ahora contar carpetas en incidencias/
  console.log('='.repeat(70));
  console.log('\n📂 Analizando carpeta "incidencias/"...\n');

  const { data: incidenciasFolders } = await supabase.storage
    .from('incidencias')
    .list('incidencias', { limit: 1000 });

  const incidenciasNumeric = incidenciasFolders?.filter(f => !f.id && /^\d+$/.test(f.name)) || [];
  console.log(`📋 Carpetas numéricas en incidencias/: ${incidenciasNumeric.length}\n`);

  let incidenciasEmpty = 0;
  let incidenciasOnlySubfolders = 0;
  let incidenciasHasFiles = 0;

  for (let i = 0; i < incidenciasNumeric.length; i++) {
    const folder = incidenciasNumeric[i];
    const num = folder.name;

    if (i % 50 === 0) {
      console.log(`Procesadas ${i}/${incidenciasNumeric.length}...`);
    }

    try {
      const { data: contents } = await supabase.storage
        .from('incidencias')
        .list(`incidencias/${num}`, { limit: 100 });

      if (!contents || contents.length === 0) {
        incidenciasEmpty++;
      } else {
        const files = contents.filter(f => f.id);
        const folders = contents.filter(f => !f.id);

        if (files.length === 0 && folders.length > 0) {
          incidenciasOnlySubfolders++;
        } else if (files.length > 0) {
          incidenciasHasFiles++;
        }
      }
    } catch (err) {
      // continuar
    }
  }

  console.log(`\nProcesadas ${incidenciasNumeric.length}/${incidenciasNumeric.length}... ✅\n`);

  // RESULTADOS
  console.log('='.repeat(70));
  console.log('📊 RESULTADOS FINALES\n');
  console.log('='.repeat(70));

  console.log('\n🗂️  CARPETAS EN RAÍZ (ej: 52718/, 10352/):\n');
  console.log(`   Total carpetas:              ${numericFolders.length}`);
  console.log(`   ✅ Con archivos:              ${hasFiles}`);
  console.log(`   📂 Solo subcarpetas:          ${hasOnlySubfolders}`);
  console.log(`   ⚪ Completamente vacías:      ${totallyEmpty}`);
  if (errors > 0) console.log(`   ❌ Errores:                   ${errors}`);

  console.log('\n🗂️  CARPETAS EN incidencias/ (ej: incidencias/52718/):\n');
  console.log(`   Total carpetas:              ${incidenciasNumeric.length}`);
  console.log(`   ✅ Con archivos (imágenes):   ${incidenciasHasFiles}`);
  console.log(`   📂 Solo subcarpetas:          ${incidenciasOnlySubfolders}`);
  console.log(`   ⚪ Completamente vacías:      ${incidenciasEmpty}`);

  console.log('\n💡 INTERPRETACIÓN:\n');
  console.log('   - Carpetas en raíz con archivos: contienen imágenes principales');
  console.log('   - Carpetas con solo subcarpetas: tienen comentarios/presupuestos');
  console.log('   - Carpetas vacías: no tienen contenido útil');
  console.log('\n   - incidencias/ con archivos: imágenes que NO fueron migradas');
  console.log('   - incidencias/ solo subcarpetas: comentarios/presupuestos legacy');

  console.log('\n' + '='.repeat(70));
}

countEmptyFolders().catch(console.error);
