// Script para verificar qué archivos están en el storage
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !anonKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, anonKey);

async function checkStorage() {
  console.log('🔍 Verificando contenido del storage...');

  try {
    // 1. Listar carpetas principales
    console.log('\n📋 Carpetas principales:');
    const { data: rootFolders, error: rootError } = await supabase.storage
      .from('incidencias')
      .list('', { limit: 100 });

    if (rootError) {
      console.error('❌ Error listando carpetas principales:', rootError);
      return;
    }

    console.log(`Encontradas ${rootFolders?.length || 0} carpetas principales:`);
    rootFolders?.forEach(folder => {
      console.log(`  📁 ${folder.name}`);
    });

    // 2. Verificar algunas carpetas de incidencias específicas
    console.log('\n🔍 Verificando carpetas de incidencias...');
    const testFolders = ['incidencias/00171', 'incidencias/00420', 'incidencias/00619'];

    for (const folderPath of testFolders) {
      console.log(`\n📁 Contenido de ${folderPath}:`);
      try {
        const { data: files, error } = await supabase.storage
          .from('incidencias')
          .list(folderPath, { limit: 10 });

        if (error) {
          console.log(`  ❌ Error: ${error.message}`);
        } else if (files && files.length > 0) {
          files.forEach(file => {
            console.log(`    📄 ${file.name} (${file.metadata?.size || 'tamaño desconocido'} bytes)`);
          });
        } else {
          console.log('    🗂️ Carpeta vacía');
        }
      } catch (error) {
        console.log(`  ❌ Error accediendo a la carpeta: ${error.message}`);
      }
    }

    // 3. Verificar si quedaron archivos en legacy
    console.log('\n🔍 Verificando carpetas legacy...');
    const testLegacyFolders = ['incidencias/00171/legacy', 'incidencias/00420/legacy'];

    for (const folderPath of testLegacyFolders) {
      console.log(`\n📁 Contenido de ${folderPath}:`);
      try {
        const { data: files, error } = await supabase.storage
          .from('incidencias')
          .list(folderPath, { limit: 10 });

        if (error) {
          console.log(`  ❌ Error: ${error.message}`);
        } else if (files && files.length > 0) {
          files.forEach(file => {
            console.log(`    📄 ${file.name}`);
          });
        } else {
          console.log('    🗂️ Carpeta vacía (correcto)');
        }
      } catch (error) {
        console.log(`  ❌ Error accediendo a la carpeta: ${error.message}`);
      }
    }

  } catch (error) {
    console.error('❌ Error durante la verificación:', error);
  }
}

checkStorage();