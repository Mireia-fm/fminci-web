const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function analyzeStorage() {
  console.log('🔍 Analizando estructura del bucket incidencias...\n');

  // Listar carpetas en raíz
  console.log('📁 CARPETAS EN RAÍZ DEL BUCKET:');
  console.log('=' .repeat(60));
  const { data: rootFolders, error: rootError } = await supabase.storage
    .from('incidencias')
    .list('', {
      limit: 1000,
      offset: 0
    });

  if (rootError) {
    console.error('❌ Error:', rootError.message);
    return;
  }

  const folders = rootFolders.filter(f => f.id === null); // Solo carpetas
  const files = rootFolders.filter(f => f.id !== null); // Solo archivos

  console.log(`\n📂 Carpetas encontradas (${folders.length}):`);
  folders.forEach(folder => {
    console.log(`   - ${folder.name}/`);
  });

  console.log(`\n📄 Archivos sueltos en raíz (${files.length}):`);
  if (files.length > 0) {
    files.slice(0, 10).forEach(file => {
      console.log(`   - ${file.name}`);
    });
    if (files.length > 10) {
      console.log(`   ... y ${files.length - 10} más`);
    }
  }

  // Revisar estructura de algunas carpetas clave
  console.log('\n' + '='.repeat(60));
  console.log('📊 ANÁLISIS DE CARPETAS CLAVE:\n');

  // 1. Carpeta "incidencias/"
  console.log('📁 Carpeta: incidencias/');
  const { data: incidenciasContent } = await supabase.storage
    .from('incidencias')
    .list('incidencias', { limit: 20 });

  if (incidenciasContent) {
    const incFolders = incidenciasContent.filter(f => f.id === null);
    const incFiles = incidenciasContent.filter(f => f.id !== null);
    console.log(`   Subcarpetas: ${incFolders.length}`);
    if (incFolders.length > 0) {
      incFolders.slice(0, 5).forEach(f => console.log(`      - ${f.name}/`));
      if (incFolders.length > 5) console.log(`      ... y ${incFolders.length - 5} más`);
    }
    console.log(`   Archivos directos: ${incFiles.length}`);
  }

  // 2. Carpeta "presupuestos/"
  console.log('\n📁 Carpeta: presupuestos/');
  const { data: presupuestosContent } = await supabase.storage
    .from('incidencias')
    .list('presupuestos', { limit: 20 });

  if (presupuestosContent) {
    const presFolders = presupuestosContent.filter(f => f.id === null);
    const presFiles = presupuestosContent.filter(f => f.id !== null);
    console.log(`   Subcarpetas: ${presFolders.length}`);
    if (presFolders.length > 0) {
      presFolders.slice(0, 5).forEach(f => console.log(`      - ${f.name}/`));
      if (presFolders.length > 5) console.log(`      ... y ${presFolders.length - 5} más`);
    }
    console.log(`   Archivos directos: ${presFiles.length}`);
  }

  // 3. Carpeta "comentarios/"
  console.log('\n📁 Carpeta: comentarios/');
  const { data: comentariosContent } = await supabase.storage
    .from('incidencias')
    .list('comentarios', { limit: 20 });

  if (comentariosContent) {
    const comFolders = comentariosContent.filter(f => f.id === null);
    const comFiles = comentariosContent.filter(f => f.id !== null);
    console.log(`   Subcarpetas: ${comFolders.length}`);
    if (comFolders.length > 0) {
      comFolders.slice(0, 5).forEach(f => console.log(`      - ${f.name}/`));
      if (comFolders.length > 5) console.log(`      ... y ${comFolders.length - 5} más`);
    }
    console.log(`   Archivos directos: ${comFiles.length}`);
  }

  // 4. Revisar si hay carpetas numéricas directamente en raíz (num_solicitud)
  console.log('\n📁 Carpetas numéricas en raíz (ej: 10352/, 12502/, ...):');
  const numericFolders = folders.filter(f => /^\d+$/.test(f.name));
  console.log(`   Total: ${numericFolders.length}`);
  if (numericFolders.length > 0) {
    numericFolders.slice(0, 10).forEach(f => console.log(`      - ${f.name}/`));
    if (numericFolders.length > 10) console.log(`      ... y ${numericFolders.length - 10} más`);
  }

  // Ejemplo de contenido de una carpeta numérica
  if (numericFolders.length > 0) {
    const sampleFolder = numericFolders[0].name;
    console.log(`\n   📂 Ejemplo: contenido de ${sampleFolder}/`);
    const { data: sampleContent } = await supabase.storage
      .from('incidencias')
      .list(sampleFolder, { limit: 10 });
    if (sampleContent) {
      sampleContent.forEach(f => console.log(`      - ${f.name}`));
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('💡 RESUMEN DE ESTRUCTURA ACTUAL:\n');
  console.log('Parece que tienes dos patrones:');
  console.log('1. Carpetas temáticas: presupuestos/, comentarios/, incidencias/');
  console.log('2. Carpetas por num_solicitud directamente en raíz: 10352/, 12502/, ...');
  console.log('\nEstas carpetas numéricas contienen las imágenes principales de incidencias.');
}

analyzeStorage().catch(console.error);
