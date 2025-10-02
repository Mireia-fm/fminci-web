require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
const supabaseClient = createClient(supabaseUrl, supabaseKey);

const DOWNLOADS_PATH_2 = '/Users/mireia/Downloads/Cargas del visitante-2';
const BUCKET_NAME = 'incidencias';

// Datos de los comentarios a migrar
const comentariosToMigrate = [
  {
    numSolicitud: '86842',
    comentarioId: 'a693084c-ab1b-4547-ace2-80e2a74e66e0',
    fileName: 'a1c4acbc-54a9-4ac3-8b38-5ef782865207.jfif.jpg',
    originalName: 'a1c4acbc-54a9-4ac3-8b38-5ef782865207.jfif'
  },
  {
    numSolicitud: '31310',
    comentarioId: '0a87de45-3529-43ba-b866-67a30a25930d',
    fileName: 'CRISTAL BIE CALELLA.jfif.jpg',
    originalName: 'CRISTAL BIE CALELLA.jfif'
  }
];

function getContentType(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  const types = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.jfif': 'image/jpeg'
  };
  return types[ext] || 'image/jpeg';
}

async function uploadFileToStorage(filePath, originalName, numSolicitud) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const contentType = getContentType(originalName);

    // Nueva estructura: incidencias/{num_solicitud}/comentarios/{archivo}
    const storagePath = `${numSolicitud}/comentarios/${originalName}`;

    console.log(`📤 Subiendo ${originalName} a ${storagePath}`);
    console.log(`📁 Tamaño: ${(fileBuffer.length / 1024).toFixed(2)} KB`);
    console.log(`🎭 Content-Type: ${contentType}`);

    const { data, error } = await supabaseClient.storage
      .from(BUCKET_NAME)
      .upload(storagePath, fileBuffer, {
        contentType: contentType,
        upsert: true
      });

    if (error) {
      console.error(`❌ Error subiendo ${originalName}:`, error);
      return null;
    }

    const { data: publicUrlData } = supabaseClient.storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath);

    return publicUrlData.publicUrl;
  } catch (error) {
    console.error(`❌ Error en uploadFileToStorage:`, error);
    return null;
  }
}

async function updateComentarioUrl(comentarioId, newUrl) {
  try {
    const { data, error } = await supabaseClient
      .from('comentarios')
      .update({ imagen_url: newUrl })
      .eq('id', comentarioId);

    if (error) {
      console.error(`❌ Error actualizando comentario ${comentarioId}:`, error);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`❌ Error en updateComentarioUrl:`, error);
    return false;
  }
}

async function main() {
  console.log('🎯 MIGRANDO ARCHIVOS DE COMENTARIOS');
  console.log('Estructura: incidencias/{num_solicitud}/comentarios/{archivo}');
  console.log('='.repeat(70));

  const results = [];

  for (const item of comentariosToMigrate) {
    console.log(`\n🔄 Procesando: ${item.numSolicitud} - ${item.originalName}`);
    console.log(`📋 Comentario ID: ${item.comentarioId}`);

    try {
      // Verificar que el archivo existe
      const filePath = path.join(DOWNLOADS_PATH_2, item.fileName);
      if (!fs.existsSync(filePath)) {
        console.log(`❌ Archivo no encontrado: ${item.fileName}`);
        results.push({
          ...item,
          status: 'file_not_found'
        });
        continue;
      }

      console.log(`✅ Archivo encontrado: ${filePath}`);

      // Subir a Storage con nueva estructura
      const newUrl = await uploadFileToStorage(filePath, item.originalName, item.numSolicitud);
      if (!newUrl) {
        console.log(`❌ Error en subida de ${item.originalName}`);
        results.push({
          ...item,
          status: 'upload_failed'
        });
        continue;
      }

      console.log(`✅ Subido a Storage: ${newUrl}`);

      // Actualizar URL en tabla comentarios
      const updateSuccess = await updateComentarioUrl(item.comentarioId, newUrl);
      if (!updateSuccess) {
        console.log(`❌ Error actualizando comentario en BD`);
        results.push({
          ...item,
          newUrl,
          status: 'db_update_failed'
        });
        continue;
      }

      console.log(`✅ Comentario actualizado en BD`);
      console.log(`🎉 MIGRACIÓN EXITOSA: ${item.numSolicitud}/comentarios/${item.originalName}`);

      results.push({
        ...item,
        newUrl,
        status: 'success'
      });

      // Pausa entre migraciones
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.error(`❌ Error procesando ${item.numSolicitud}:`, error);
      results.push({
        ...item,
        status: 'error',
        error: error.message
      });
    }
  }

  // Resumen final
  console.log('\n' + '='.repeat(70));
  console.log('📊 RESUMEN DE MIGRACIÓN DE COMENTARIOS:');
  console.log('='.repeat(70));

  const successful = results.filter(r => r.status === 'success');
  const failed = results.filter(r => r.status !== 'success');

  console.log(`✅ Migrados exitosamente: ${successful.length}`);
  console.log(`❌ Errores: ${failed.length}`);
  console.log(`📋 Total procesados: ${results.length}`);

  if (successful.length > 0) {
    console.log('\n🎉 ARCHIVOS MIGRADOS EXITOSAMENTE:');
    successful.forEach(item => {
      console.log(`   📁 ${item.numSolicitud}/comentarios/${item.originalName}`);
      console.log(`   🔗 ${item.newUrl}`);
    });
  }

  if (failed.length > 0) {
    console.log('\n❌ ERRORES:');
    failed.forEach(item => {
      console.log(`   📄 ${item.numSolicitud} - ${item.originalName}: ${item.status}`);
    });
  }

  return { successful, failed, total: results.length };
}

main().catch(console.error);