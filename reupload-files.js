// Script para re-subir archivos con ownership correcto
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

// Cliente con service role para leer archivos existentes
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
// Cliente con anon key para re-subir con ownership correcto
const supabaseClient = createClient(supabaseUrl, anonKey);

async function reuploadFiles() {
  console.log('🚀 Iniciando re-subida de archivos con ownership correcto...');

  try {
    // 1. Obtener lista de archivos existentes
    console.log('📋 Obteniendo lista de archivos...');
    const { data: files, error: listError } = await supabaseAdmin.storage
      .from('incidencias')
      .list('incidencias', {
        limit: 1000,
        sortBy: { column: 'name', order: 'asc' }
      });

    if (listError) {
      throw new Error(`Error listando archivos: ${listError.message}`);
    }

    console.log(`📁 Encontradas ${files?.length || 0} carpetas de incidencias`);

    let processedCount = 0;
    let errorCount = 0;

    // 2. Procesar cada carpeta de incidencia
    for (const folder of files || []) {
      if (!folder.name || folder.name.includes('.')) continue; // Solo carpetas

      const folderPath = `incidencias/${folder.name}`;
      console.log(`\n🔍 Procesando carpeta: ${folderPath}/`);

      try {
        // Listar archivos en la carpeta
        const { data: folderFiles, error: folderError } = await supabaseAdmin.storage
          .from('incidencias')
          .list(folderPath, { limit: 10 });

        if (folderError || !folderFiles || folderFiles.length === 0) {
          console.log(`  🗂️ Carpeta vacía o error: ${folderError?.message || 'sin archivos'}`);
          continue;
        }

        // Procesar cada archivo en la carpeta
        for (const file of folderFiles) {
          if (!file.name || file.name.includes('/')) continue; // Solo archivos

          const oldPath = `${folderPath}/${file.name}`;
          const tempPath = `temp_${Date.now()}_${file.name}`;

          console.log(`  📄 Re-subiendo: ${file.name}`);

          try {
            // 1. Descargar archivo existente
            const { data: fileData, error: downloadError } = await supabaseAdmin.storage
              .from('incidencias')
              .download(oldPath);

            if (downloadError) {
              console.error(`    ❌ Error descargando ${oldPath}: ${downloadError.message}`);
              errorCount++;
              continue;
            }

            // 2. Subir archivo con anon key (tendrá ownership correcto)
            const { error: uploadError } = await supabaseClient.storage
              .from('incidencias')
              .upload(tempPath, fileData, {
                cacheControl: '3600',
                upsert: false
              });

            if (uploadError) {
              console.error(`    ❌ Error subiendo temporal ${tempPath}: ${uploadError.message}`);
              errorCount++;
              continue;
            }

            // 3. Eliminar archivo original
            const { error: deleteError } = await supabaseAdmin.storage
              .from('incidencias')
              .remove([oldPath]);

            if (deleteError) {
              console.error(`    ❌ Error eliminando original ${oldPath}: ${deleteError.message}`);
              // Continuar aunque no se pueda eliminar el original
            }

            // 4. Mover temporal al nombre final
            const { error: moveError } = await supabaseAdmin.storage
              .from('incidencias')
              .move(tempPath, oldPath);

            if (moveError) {
              console.error(`    ❌ Error moviendo ${tempPath} a ${oldPath}: ${moveError.message}`);
              errorCount++;
            } else {
              console.log(`    ✅ Re-subido exitosamente: ${oldPath}`);
              processedCount++;
            }

          } catch (error) {
            console.error(`    ❌ Error procesando ${oldPath}: ${error.message}`);
            errorCount++;
          }

          // Pausa para no sobrecargar
          await new Promise(resolve => setTimeout(resolve, 200));
        }

      } catch (error) {
        console.error(`❌ Error procesando carpeta ${folderPath}: ${error.message}`);
        errorCount++;
      }
    }

    // 3. Resumen final
    console.log('\n📊 RESUMEN:');
    console.log(`✅ Archivos re-subidos exitosamente: ${processedCount}`);
    console.log(`❌ Archivos con errores: ${errorCount}`);

    if (errorCount === 0) {
      console.log('\n🎉 ¡Re-subida completada exitosamente!');
      console.log('Todos los archivos ahora deberían ser visibles en la UI de Supabase');
    } else {
      console.log('\n⚠️ Re-subida completada con algunos errores');
    }

  } catch (error) {
    console.error('❌ Error durante la re-subida:', error.message);
    process.exit(1);
  }
}

reuploadFiles();