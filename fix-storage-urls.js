// Script para limpiar storage y corregir URLs de incidencias
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function fixStorageAndUrls() {
  console.log('🧹 Limpiando storage y corrigiendo URLs...');

  try {
    // 1. Eliminar archivos placeholder
    console.log('📁 Eliminando archivos placeholder...');
    const { data: folders, error: listError } = await supabase.storage
      .from('incidencias')
      .list('incidencias', { limit: 1000 });

    if (listError) {
      throw new Error(`Error listando carpetas: ${listError.message}`);
    }

    let cleanedCount = 0;

    for (const folder of folders || []) {
      if (!folder.name || folder.name.includes('.')) continue;

      const folderPath = `incidencias/${folder.name}`;
      const { data: files } = await supabase.storage
        .from('incidencias')
        .list(folderPath, { limit: 20 });

      for (const file of files || []) {
        if (file.name === '.emptyFolderPlaceholder') {
          console.log(`  🗑️ Eliminando placeholder en ${folderPath}/`);
          await supabase.storage
            .from('incidencias')
            .remove([`${folderPath}/.emptyFolderPlaceholder`]);
          cleanedCount++;
        }
      }
    }

    console.log(`✅ Eliminados ${cleanedCount} archivos placeholder`);

    // 2. Corregir URLs en la base de datos
    console.log('🔧 Corrigiendo URLs en incidencias...');

    // Obtener incidencias con URLs públicas incorrectas
    const { data: incidencias, error: incidenciasError } = await supabase
      .from('incidencias')
      .select('id, num_solicitud, imagen_url')
      .like('imagen_url', 'https://%/storage/v1/object/public/%');

    if (incidenciasError) {
      throw new Error(`Error cargando incidencias: ${incidenciasError.message}`);
    }

    console.log(`📊 Encontradas ${incidencias?.length || 0} incidencias con URLs públicas`);

    let updatedCount = 0;

    for (const incidencia of incidencias || []) {
      if (!incidencia.imagen_url) continue;

      // Convertir de URL pública a ruta interna
      // De: https://...supabase.co/storage/v1/object/public/incidencias/00171/00171.jpg
      // A: incidencias/00171/00171.jpg
      const oldUrl = incidencia.imagen_url;
      const match = oldUrl.match(/\/storage\/v1\/object\/public\/(.+)$/);

      if (match) {
        const newPath = match[1];
        console.log(`  🔄 ${incidencia.num_solicitud}: ${oldUrl} → ${newPath}`);

        const { error: updateError } = await supabase
          .from('incidencias')
          .update({ imagen_url: newPath })
          .eq('id', incidencia.id);

        if (updateError) {
          console.error(`    ❌ Error actualizando ${incidencia.num_solicitud}: ${updateError.message}`);
        } else {
          console.log(`    ✅ Actualizado correctamente`);
          updatedCount++;
        }
      }

      // Pausa pequeña
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    console.log('📊 RESUMEN:');
    console.log(`🗑️ Archivos placeholder eliminados: ${cleanedCount}`);
    console.log(`🔄 URLs de incidencias corregidas: ${updatedCount}`);
    console.log('✅ ¡Limpieza completada!');

  } catch (error) {
    console.error('❌ Error durante la limpieza:', error.message);
    process.exit(1);
  }
}

fixStorageAndUrls();