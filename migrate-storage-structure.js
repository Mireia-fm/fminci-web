const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrateStorageStructure() {
  console.log('🚀 Iniciando migración de estructura de storage...\n');

  // PASO 1: Listar carpetas en incidencias/
  console.log('📋 PASO 1: Identificando carpetas en incidencias/');
  console.log('='.repeat(60));

  const { data: foldersInIncidencias, error: listError } = await supabase.storage
    .from('incidencias')
    .list('incidencias', { limit: 100 });

  if (listError) {
    console.error('❌ Error al listar:', listError.message);
    return;
  }

  const numericFolders = foldersInIncidencias.filter(f => f.id === null && /^\d+$/.test(f.name));
  console.log(`\n✅ Encontradas ${numericFolders.length} carpetas numéricas en incidencias/\n`);
  numericFolders.forEach(f => console.log(`   - incidencias/${f.name}/`));

  if (numericFolders.length === 0) {
    console.log('\n✅ No hay carpetas para migrar. Todo limpio!');
    return;
  }

  // PASO 2: Migrar cada carpeta
  console.log('\n📦 PASO 2: Migrando carpetas a raíz');
  console.log('='.repeat(60));

  const migratedFolders = [];
  const errors = [];

  for (const folder of numericFolders) {
    const numSolicitud = folder.name;
    const oldPath = `incidencias/${numSolicitud}`;
    const newPath = numSolicitud;

    try {
      console.log(`\n📁 Procesando: ${numSolicitud}`);

      // Listar todos los archivos en la carpeta (recursivo)
      const { data: files, error: filesError } = await supabase.storage
        .from('incidencias')
        .list(oldPath, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });

      if (filesError) {
        console.log(`   ❌ Error al listar archivos: ${filesError.message}`);
        errors.push({ numSolicitud, error: filesError.message });
        continue;
      }

      const actualFiles = files.filter(f => f.id !== null);
      console.log(`   Archivos encontrados: ${actualFiles.length}`);

      if (actualFiles.length === 0) {
        console.log(`   ⚠️  Carpeta vacía, saltando...`);
        continue;
      }

      // Mover cada archivo
      for (const file of actualFiles) {
        const oldFilePath = `${oldPath}/${file.name}`;
        const newFilePath = `${newPath}/${file.name}`;

        // Descargar
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('incidencias')
          .download(oldFilePath);

        if (downloadError) {
          console.log(`   ❌ Error descargando ${file.name}: ${downloadError.message}`);
          continue;
        }

        // Subir a nueva ubicación
        const { error: uploadError } = await supabase.storage
          .from('incidencias')
          .upload(newFilePath, fileData, {
            contentType: file.metadata?.mimetype || 'application/octet-stream',
            upsert: true
          });

        if (uploadError) {
          console.log(`   ❌ Error subiendo ${file.name}: ${uploadError.message}`);
          continue;
        }

        // Eliminar archivo antiguo
        const { error: deleteError } = await supabase.storage
          .from('incidencias')
          .remove([oldFilePath]);

        if (deleteError) {
          console.log(`   ⚠️  Advertencia: no se pudo eliminar archivo antiguo ${oldFilePath}`);
        }

        console.log(`   ✅ ${file.name} → ${newFilePath}`);
      }

      migratedFolders.push(numSolicitud);

    } catch (error) {
      console.log(`   ❌ Error inesperado: ${error.message}`);
      errors.push({ numSolicitud, error: error.message });
    }
  }

  // PASO 3: Actualizar URLs en base de datos
  console.log('\n💾 PASO 3: Actualizando URLs en base de datos');
  console.log('='.repeat(60));

  for (const numSolicitud of migratedFolders) {
    try {
      // Obtener URL actual
      const { data: incidencia, error: selectError } = await supabase
        .from('incidencias')
        .select('num_solicitud, imagen_url')
        .eq('num_solicitud', numSolicitud)
        .single();

      if (selectError || !incidencia) {
        console.log(`   ⚠️  ${numSolicitud}: No encontrada en BD`);
        continue;
      }

      const oldUrl = incidencia.imagen_url;
      if (!oldUrl || !oldUrl.startsWith('incidencias/')) {
        console.log(`   ⏭️  ${numSolicitud}: URL ya correcta o vacía`);
        continue;
      }

      // Nueva URL sin prefijo incidencias/
      const newUrl = oldUrl.replace(/^incidencias\//, '');

      const { error: updateError } = await supabase
        .from('incidencias')
        .update({ imagen_url: newUrl })
        .eq('num_solicitud', numSolicitud);

      if (updateError) {
        console.log(`   ❌ ${numSolicitud}: Error actualizando BD - ${updateError.message}`);
      } else {
        console.log(`   ✅ ${numSolicitud}: ${oldUrl} → ${newUrl}`);
      }

    } catch (error) {
      console.log(`   ❌ ${numSolicitud}: Error - ${error.message}`);
    }
  }

  // RESUMEN
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMEN DE MIGRACIÓN\n');
  console.log(`✅ Carpetas migradas exitosamente: ${migratedFolders.length}`);
  console.log(`❌ Errores encontrados: ${errors.length}`);

  if (errors.length > 0) {
    console.log('\nErrores:');
    errors.forEach(e => console.log(`   - ${e.numSolicitud}: ${e.error}`));
  }

  console.log('\n💡 Próximos pasos:');
  console.log('   1. Verificar que la carpeta incidencias/ está vacía');
  console.log('   2. Eliminar carpeta incidencias/ si está vacía');
  console.log('   3. Crear bucket "presupuestos" y migrar contenido');
}

migrateStorageStructure().catch(console.error);
