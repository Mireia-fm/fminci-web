const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function cleanup() {
  console.log('🧹 Limpiando carpeta incidencias/...\n');

  // Listar todas las carpetas en incidencias/
  const { data: folders } = await supabase.storage
    .from('incidencias')
    .list('incidencias', { limit: 1000 });

  const numericFolders = folders?.filter(f => !f.id && /^\d+$/.test(f.name)) || [];
  console.log(`📋 Total de carpetas numéricas: ${numericFolders.length}\n`);

  let deleted = 0;
  let skipped = 0;
  let errors = 0;

  for (const folder of numericFolders) {
    const num = folder.name;
    process.stdout.write(`${num}... `);

    try {
      // Listar TODO el contenido recursivamente
      const filesToDelete = [];

      // Obtener contenido directo
      const { data: contents } = await supabase.storage
        .from('incidencias')
        .list(`incidencias/${num}`, { limit: 100 });

      if (!contents || contents.length === 0) {
        // Carpeta completamente vacía, intentar eliminarla
        process.stdout.write('vacía ');
      } else {
        // Construir lista de archivos a eliminar (recursivo)
        for (const item of contents) {
          if (item.id) {
            // Es archivo directo
            filesToDelete.push(`incidencias/${num}/${item.name}`);
          } else {
            // Es subcarpeta, explorar
            const { data: subItems } = await supabase.storage
              .from('incidencias')
              .list(`incidencias/${num}/${item.name}`, { limit: 100 });

            if (subItems) {
              subItems.forEach(sub => {
                if (sub.id) {
                  filesToDelete.push(`incidencias/${num}/${item.name}/${sub.name}`);
                }
              });
            }
          }
        }
      }

      // Eliminar todos los archivos encontrados
      if (filesToDelete.length > 0) {
        const { error: delError } = await supabase.storage
          .from('incidencias')
          .remove(filesToDelete);

        if (delError) {
          process.stdout.write(`❌ (${delError.message}) `);
          errors++;
        } else {
          process.stdout.write(`✅ (${filesToDelete.length} archivos) `);
          deleted++;
        }
      } else {
        process.stdout.write('✅ ');
        deleted++;
      }

    } catch (err) {
      process.stdout.write(`❌ (${err.message}) `);
      errors++;
    }

    // Nueva línea cada 10 carpetas
    if ((deleted + skipped + errors) % 10 === 0) console.log('');
  }

  console.log(`\n\n📊 RESUMEN:`);
  console.log(`✅ Eliminadas: ${deleted}`);
  console.log(`❌ Errores: ${errors}`);
  console.log('\n💡 Ahora verifica si la carpeta incidencias/ está vacía');
}

cleanup().catch(console.error);
