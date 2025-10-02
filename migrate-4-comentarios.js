require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
const supabaseClient = createClient(supabaseUrl, supabaseKey);

const DOWNLOADS_PATH_2 = '/Users/mireia/Downloads/Cargas del visitante-2';
const BUCKET_NAME = 'incidencias';

// Los 4 comentarios a migrar
const comentariosToMigrate = [
  {
    comentarioId: '0aabcc3b-059e-483c-9ca4-482039a48cd0',
    numSolicitud: '07555',
    fileName: 'ARMARIO AULA 3 EC GRANOLLERS.jpg'
  },
  {
    comentarioId: '575e170e-6013-40dd-b9e6-ed80891db440',
    numSolicitud: '81650',
    fileName: 'Alfombra EC Sagrada Familia.jpg'
  },
  {
    comentarioId: '589e0447-cfb1-4624-957b-046208c08899',
    numSolicitud: '84910',
    fileName: 'Imagen de WhatsApp 2025-09-17 a las 07.21.12_031f391f - copia.jpg'
  },
  {
    comentarioId: '888dcea6-f506-46a6-b5e2-a08067c72ebd',
    numSolicitud: '90954',
    fileName: 'db0d2f72_154_10_09_2025_7_51_35_269_108.jpg'
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

async function uploadFileToStorage(filePath, fileName, numSolicitud) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const contentType = getContentType(fileName);

    // Estructura: incidencias/{num_solicitud}/comentarios/{archivo}
    const storagePath = `${numSolicitud}/comentarios/${fileName}`;

    console.log(`📤 Subiendo ${fileName} a ${storagePath}`);
    console.log(`📁 Tamaño: ${(fileBuffer.length / 1024).toFixed(2)} KB`);

    const { data, error } = await supabaseClient.storage
      .from(BUCKET_NAME)
      .upload(storagePath, fileBuffer, {
        contentType: contentType,
        upsert: true
      });

    if (error) {
      console.error(`❌ Error subiendo ${fileName}:`, error);
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
  console.log('🎯 MIGRANDO 4 COMENTARIOS CON COINCIDENCIAS EXACTAS');
  console.log('Estructura: incidencias/{num_solicitud}/comentarios/{archivo}');
  console.log('='.repeat(70));

  const results = [];
  let migrados = 0;
  let errores = 0;

  for (const [index, item] of comentariosToMigrate.entries()) {
    console.log(`\n🔄 [${index + 1}/4] Procesando: ${item.numSolicitud} - ${item.fileName}`);
    console.log(`📋 Comentario ID: ${item.comentarioId}`);

    try {
      // Verificar que el archivo existe
      const filePath = path.join(DOWNLOADS_PATH_2, item.fileName);
      if (!fs.existsSync(filePath)) {
        console.log(`❌ Archivo no encontrado: ${item.fileName}`);
        errores++;
        results.push({
          ...item,
          status: 'file_not_found'
        });
        continue;
      }

      console.log(`✅ Archivo encontrado: ${filePath}`);

      // Subir a Storage
      const newUrl = await uploadFileToStorage(filePath, item.fileName, item.numSolicitud);
      if (!newUrl) {
        console.log(`❌ Error en subida de ${item.fileName}`);
        errores++;
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
        errores++;
        results.push({
          ...item,
          newUrl,
          status: 'db_update_failed'
        });
        continue;
      }

      console.log(`✅ Comentario actualizado en BD`);
      console.log(`🎉 MIGRACIÓN EXITOSA: ${item.numSolicitud}/comentarios/${item.fileName}`);

      migrados++;
      results.push({
        ...item,
        newUrl,
        status: 'success'
      });

      // Pausa entre migraciones
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.error(`❌ Error procesando ${item.numSolicitud}:`, error);
      errores++;
      results.push({
        ...item,
        status: 'error',
        error: error.message
      });
    }
  }

  // Resumen final
  console.log('\n' + '='.repeat(70));
  console.log('📊 RESUMEN DE MIGRACIÓN:');
  console.log('='.repeat(70));

  console.log(`✅ Migrados exitosamente: ${migrados}`);
  console.log(`❌ Errores: ${errores}`);
  console.log(`📋 Total procesados: ${comentariosToMigrate.length}`);

  const successful = results.filter(r => r.status === 'success');
  if (successful.length > 0) {
    console.log('\n🎉 ARCHIVOS MIGRADOS EXITOSAMENTE:');
    successful.forEach(item => {
      console.log(`   📁 Incidencia ${item.numSolicitud}: ${item.fileName}`);
      console.log(`   🔗 ${item.newUrl}`);
      console.log('');
    });
  }

  const failed = results.filter(r => r.status !== 'success');
  if (failed.length > 0) {
    console.log('❌ ERRORES:');
    failed.forEach(item => {
      console.log(`   📄 ${item.numSolicitud} - ${item.fileName}: ${item.status}`);
    });
  }

  console.log('\n📈 ESTADO FINAL DE COMENTARIOS:');
  console.log(`✅ Total comentarios migrados: ${migrados + 2} (2 previos + ${migrados} nuevos)`);
  console.log(`🎯 Estructura: incidencias/{num_solicitud}/comentarios/{archivo}`);

  return { migrados, errores, total: results.length };
}

main().catch(console.error);