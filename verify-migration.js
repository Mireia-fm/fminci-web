// Script para verificar que la migración está funcionando correctamente
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function verifyMigration() {
  console.log('🔍 VERIFICANDO MIGRACIÓN...\n');

  try {
    // Verificar archivos específicos subidos desde "Cargas del visitante"
    const urgentIncidencias = ['21193', '56547', '90724', '96605', '34307', '16554'];

    console.log('📋 Verificando incidencias urgentes del CSV:');

    for (const numSolicitud of urgentIncidencias) {
      console.log(`\n🔍 Incidencia ${numSolicitud}:`);

      try {
        // Verificar carpeta de imagenes
        const { data: imagenesFiles, error: imagenesError } = await supabase.storage
          .from('incidencias')
          .list(`incidencias/${numSolicitud}/imagenes`, { limit: 10 });

        if (imagenesError) {
          console.log(`  📁 imagenes/: ${imagenesError.message}`);
        } else if (imagenesFiles && imagenesFiles.length > 0) {
          console.log(`  ✅ imagenes/: ${imagenesFiles.length} archivo(s)`);
          imagenesFiles.forEach(file => {
            console.log(`    - ${file.name}`);
          });
        } else {
          console.log(`  📁 imagenes/: vacía`);
        }

        // Verificar carpeta de presupuestos
        const { data: presupuestosFiles, error: presupuestosError } = await supabase.storage
          .from('incidencias')
          .list(`incidencias/${numSolicitud}/presupuestos`, { limit: 10 });

        if (!presupuestosError && presupuestosFiles && presupuestosFiles.length > 0) {
          console.log(`  ✅ presupuestos/: ${presupuestosFiles.length} archivo(s)`);
          presupuestosFiles.forEach(file => {
            console.log(`    - ${file.name}`);
          });
        }

        // Verificar carpeta de comentarios
        const { data: comentariosFiles, error: comentariosError } = await supabase.storage
          .from('incidencias')
          .list(`incidencias/${numSolicitud}/comentarios`, { limit: 10 });

        if (!comentariosError && comentariosFiles && comentariosFiles.length > 0) {
          console.log(`  ✅ comentarios/: ${comentariosFiles.length} archivo(s)`);
          comentariosFiles.forEach(file => {
            console.log(`    - ${file.name}`);
          });
        }

        // Verificar archivos en la raíz
        const { data: rootFiles, error: rootError } = await supabase.storage
          .from('incidencias')
          .list(`incidencias/${numSolicitud}`, { limit: 10 });

        if (!rootError && rootFiles && rootFiles.length > 0) {
          const actualFiles = rootFiles.filter(file => file.name && !file.name.includes('.emptyFolderPlaceholder'));
          if (actualFiles.length > 0) {
            console.log(`  ✅ raíz/: ${actualFiles.length} archivo(s)`);
            actualFiles.forEach(file => {
              console.log(`    - ${file.name}`);
            });
          }
        }

      } catch (error) {
        console.log(`  ❌ Error verificando ${numSolicitud}: ${error.message}`);
      }
    }

    // Verificar algunas incidencias que deberían tener presupuestos migrados
    console.log('\n\n📋 Verificando presupuestos migrados:');
    const presupuestoIncidencias = ['11619', '22232', '26776', '78572', '07723', '14953'];

    for (const numSolicitud of presupuestoIncidencias) {
      console.log(`\n🔍 Incidencia ${numSolicitud}:`);

      try {
        // Verificar carpeta de presupuestos
        const { data: presupuestosFiles, error: presupuestosError } = await supabase.storage
          .from('incidencias')
          .list(`incidencias/${numSolicitud}/presupuestos`, { limit: 10 });

        if (!presupuestosError && presupuestosFiles && presupuestosFiles.length > 0) {
          console.log(`  ✅ presupuestos/: ${presupuestosFiles.length} archivo(s)`);
          presupuestosFiles.forEach(file => {
            console.log(`    - ${file.name} (${file.updated_at})`);
          });
        } else {
          console.log(`  📁 presupuestos/: vacía`);
        }

        // Verificar carpeta de comentarios
        const { data: comentariosFiles, error: comentariosError } = await supabase.storage
          .from('incidencias')
          .list(`incidencias/${numSolicitud}/comentarios`, { limit: 10 });

        if (!comentariosError && comentariosFiles && comentariosFiles.length > 0) {
          console.log(`  ✅ comentarios/: ${comentariosFiles.length} archivo(s)`);
          comentariosFiles.forEach(file => {
            console.log(`    - ${file.name} (${file.updated_at})`);
          });
        }

      } catch (error) {
        console.log(`  ❌ Error verificando ${numSolicitud}: ${error.message}`);
      }
    }

    // Resumen general de archivos migrados hoy
    console.log('\n\n📊 RESUMEN GENERAL:');

    try {
      const { data: allIncidencias, error } = await supabase.storage
        .from('incidencias')
        .list('incidencias', { limit: 1000 });

      if (!error && allIncidencias) {
        let totalFolders = 0;
        let foldersWithFiles = 0;

        for (const folder of allIncidencias) {
          if (!folder.name || folder.name.includes('.')) continue;

          totalFolders++;

          const { data: folderContents } = await supabase.storage
            .from('incidencias')
            .list(`incidencias/${folder.name}`, { limit: 50 });

          if (folderContents && folderContents.length > 0) {
            const hasRealFiles = folderContents.some(file =>
              file.name &&
              !file.name.includes('.emptyFolderPlaceholder') &&
              !file.name.includes('/')
            );

            const hasSubfolders = folderContents.some(file =>
              file.name && (
                file.name.includes('presupuestos') ||
                file.name.includes('comentarios') ||
                file.name.includes('imagenes')
              )
            );

            if (hasRealFiles || hasSubfolders) {
              foldersWithFiles++;
            }
          }
        }

        console.log(`📁 Total incidencias con carpeta: ${totalFolders}`);
        console.log(`✅ Incidencias con archivos: ${foldersWithFiles}`);
        console.log(`📊 Ratio de migración: ${((foldersWithFiles/totalFolders)*100).toFixed(1)}%`);
      }
    } catch (error) {
      console.log(`❌ Error en resumen: ${error.message}`);
    }

    console.log('\n✅ Verificación completada!');

  } catch (error) {
    console.error('❌ Error durante la verificación:', error.message);
    process.exit(1);
  }
}

verifyMigration();