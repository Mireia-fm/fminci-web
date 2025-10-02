// Script de migración para reorganizar archivos de storage
// Nueva estructura: incidencias/{num_solicitud}/ + comentarios/ + presupuestos/

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateStorageStructure() {
  console.log('🚀 Iniciando migración de estructura de storage...');

  try {
    // 1. Migrar imágenes principales (campo imagen_url)
    await migrateImagenUrl();

    // 2. Migrar adjuntos (tabla adjuntos)
    await migrateAdjuntos();

    console.log('✅ Migración completada exitosamente');
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    process.exit(1);
  }
}

async function migrateImagenUrl() {
  console.log('\n📸 Migrando imágenes principales...');

  // Obtener todas las imágenes con estructura legacy
  const { data: incidencias, error } = await supabase
    .from('incidencias')
    .select('id, num_solicitud, imagen_url')
    .like('imagen_url', '%legacy%');

  if (error) {
    throw new Error(`Error obteniendo incidencias: ${error.message}`);
  }

  console.log(`📋 Encontradas ${incidencias?.length || 0} imágenes para migrar`);

  if (!incidencias?.length) return;

  for (const incidencia of incidencias) {
    try {
      // Extraer el path actual del storage
      const currentPath = incidencia.imagen_url.includes('/storage/v1/object/public/incidencias/')
        ? incidencia.imagen_url.split('/storage/v1/object/public/incidencias/')[1]
        : incidencia.imagen_url;

      // Nuevo path: incidencias/{num_solicitud}/{filename}
      const filename = currentPath.split('/').pop();
      const newPath = `incidencias/${incidencia.num_solicitud}/${filename}`;

      console.log(`📁 Moviendo: ${currentPath} → ${newPath}`);

      // Mover archivo en storage
      const { error: moveError } = await supabase.storage
        .from('incidencias')
        .move(currentPath, newPath);

      if (moveError) {
        console.error(`❌ Error moviendo archivo ${currentPath}:`, moveError);
        continue;
      }

      // Actualizar base de datos
      const { error: updateError } = await supabase
        .from('incidencias')
        .update({ imagen_url: newPath })
        .eq('id', incidencia.id);

      if (updateError) {
        console.error(`❌ Error actualizando BD para ${incidencia.num_solicitud}:`, updateError);
        // Revertir movimiento del archivo si falló la actualización
        await supabase.storage.from('incidencias').move(newPath, currentPath);
        continue;
      }

      console.log(`✅ Migrada imagen para incidencia ${incidencia.num_solicitud}`);

    } catch (error) {
      console.error(`❌ Error procesando incidencia ${incidencia.num_solicitud}:`, error);
    }
  }
}

async function migrateAdjuntos() {
  console.log('\n📎 Migrando adjuntos...');

  // Obtener todos los adjuntos con estructura legacy
  const { data: adjuntos, error } = await supabase
    .from('adjuntos')
    .select(`
      id,
      tipo,
      storage_key,
      incidencia_id,
      incidencias!inner(num_solicitud)
    `)
    .like('storage_key', '%legacy%');

  if (error) {
    throw new Error(`Error obteniendo adjuntos: ${error.message}`);
  }

  console.log(`📋 Encontrados ${adjuntos?.length || 0} adjuntos para migrar`);

  if (!adjuntos?.length) return;

  for (const adjunto of adjuntos) {
    try {
      const currentPath = adjunto.storage_key;
      const filename = currentPath.split('/').pop();
      const numSolicitud = adjunto.incidencias.num_solicitud;

      // Nuevo path: incidencias/{num_solicitud}/comentarios/{filename}
      const newPath = `incidencias/${numSolicitud}/comentarios/${filename}`;

      console.log(`📁 Moviendo adjunto: ${currentPath} → ${newPath}`);

      // Mover archivo en storage
      const { error: moveError } = await supabase.storage
        .from('incidencias')
        .move(currentPath, newPath);

      if (moveError) {
        console.error(`❌ Error moviendo adjunto ${adjunto.id}:`, moveError);
        continue;
      }

      // Actualizar base de datos
      const { error: updateError } = await supabase
        .from('adjuntos')
        .update({ storage_key: newPath })
        .eq('id', adjunto.id);

      if (updateError) {
        console.error(`❌ Error actualizando adjunto ${adjunto.id}:`, updateError);
        // Revertir movimiento del archivo si falló la actualización
        await supabase.storage.from('incidencias').move(newPath, currentPath);
        continue;
      }

      console.log(`✅ Migrado adjunto para incidencia ${numSolicitud}`);

    } catch (error) {
      console.error(`❌ Error procesando adjunto ${adjunto.id}:`, error);
    }
  }
}

// Ejecutar migración
migrateStorageStructure();