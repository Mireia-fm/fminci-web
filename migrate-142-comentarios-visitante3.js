require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
const supabaseClient = createClient(supabaseUrl, supabaseKey);

const DOWNLOADS_PATH_3 = '/Users/mireia/Downloads/Cargas del visitante-3';
const BUCKET_NAME = 'incidencias';
const BATCH_SIZE = 15; // Lotes pequeños para evitar timeouts

function extractFileNameFromWixUrl(wixUrl) {
  try {
    const parts = wixUrl.split('/');
    if (parts.length >= 2) {
      const lastPart = parts[parts.length - 1];
      const fileName = lastPart.split('#')[0];
      return decodeURIComponent(fileName);
    }
    return null;
  } catch (error) {
    return null;
  }
}

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

async function findExactMatches() {
  console.log('🔍 Encontrando coincidencias exactas en visitante-3...');

  // Obtener archivos de visitante-3
  const allFiles3 = fs.readdirSync(DOWNLOADS_PATH_3)
    .filter(file => /\.(jpg|jpeg|png|gif|webp|jfif)$/i.test(file));

  // Obtener comentarios con URLs Wix
  const { data: comentariosWix, error } = await supabaseClient
    .from('comentarios')
    .select(`
      id,
      incidencia_id,
      imagen_url,
      incidencias!inner(num_solicitud)
    `)
    .like('imagen_url', 'wix%')
    .order('id');

  if (error) {
    console.error('Error obteniendo comentarios Wix:', error);
    return [];
  }

  const exactMatches = [];

  for (const comentario of comentariosWix) {
    const wixFileName = extractFileNameFromWixUrl(comentario.imagen_url);
    if (!wixFileName) continue;

    const exactMatch = allFiles3.find(file => file === wixFileName);
    if (exactMatch) {
      exactMatches.push({
        comentarioId: comentario.id,
        numSolicitud: comentario.incidencias.num_solicitud,
        fileName: exactMatch,
        wixUrl: comentario.imagen_url
      });
    }
  }

  console.log(`✅ Encontradas ${exactMatches.length} coincidencias exactas`);
  return exactMatches;
}

async function migrateBatch(matches, batchIndex, totalBatches) {
  console.log(`\n📦 LOTE ${batchIndex}/${totalBatches} (${matches.length} archivos)`);
  console.log('─'.repeat(60));

  const results = [];

  for (const [itemIndex, match] of matches.entries()) {
    const globalIndex = (batchIndex - 1) * BATCH_SIZE + itemIndex + 1;
    const totalFiles = totalBatches * BATCH_SIZE;

    console.log(`\n🔄 [${globalIndex}/?] ${match.numSolicitud} - ${match.fileName}`);

    try {
      // Verificar archivo
      const filePath = path.join(DOWNLOADS_PATH_3, match.fileName);
      if (!fs.existsSync(filePath)) {
        console.log(`❌ Archivo no encontrado`);
        results.push({ ...match, status: 'file_not_found' });
        continue;
      }

      // Subir a Storage
      const newUrl = await uploadFileToStorage(filePath, match.fileName, match.numSolicitud);
      if (!newUrl) {
        console.log(`❌ Error en subida`);
        results.push({ ...match, status: 'upload_failed' });
        continue;
      }

      // Actualizar BD
      const updateSuccess = await updateComentarioUrl(match.comentarioId, newUrl);
      if (!updateSuccess) {
        console.log(`❌ Error actualizando BD`);
        results.push({ ...match, newUrl, status: 'db_update_failed' });
        continue;
      }

      console.log(`✅ Migrado exitosamente`);
      results.push({ ...match, newUrl, status: 'success' });

      // Pausa entre archivos
      await new Promise(resolve => setTimeout(resolve, 300));

    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      results.push({ ...match, status: 'error', error: error.message });
    }
  }

  const successful = results.filter(r => r.status === 'success').length;
  const failed = results.length - successful;
  console.log(`\n📊 Lote ${batchIndex}: ✅${successful} ❌${failed}`);

  return results;
}

async function main() {
  console.log('🎯 MIGRACIÓN MASIVA - 142 COMENTARIOS VISITANTE-3');
  console.log('Estructura: incidencias/{num_solicitud}/comentarios/{archivo}');
  console.log('='.repeat(70));

  try {
    // 1. Encontrar coincidencias exactas
    const exactMatches = await findExactMatches();

    if (exactMatches.length === 0) {
      console.log('❌ No se encontraron coincidencias exactas');
      return;
    }

    // 2. Dividir en lotes
    const batches = [];
    for (let i = 0; i < exactMatches.length; i += BATCH_SIZE) {
      batches.push(exactMatches.slice(i, i + BATCH_SIZE));
    }

    console.log(`\n🚀 Iniciando migración de ${exactMatches.length} archivos en ${batches.length} lotes`);

    // 3. Procesar lotes
    const allResults = [];
    for (let i = 0; i < batches.length; i++) {
      const batchResults = await migrateBatch(batches[i], i + 1, batches.length);
      allResults.push(...batchResults);

      // Pausa entre lotes
      if (i < batches.length - 1) {
        console.log('\n⏳ Esperando 3 segundos antes del siguiente lote...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    // 4. Resumen final
    console.log('\n' + '='.repeat(70));
    console.log('📊 RESUMEN FINAL DE MIGRACIÓN MASIVA:');
    console.log('='.repeat(70));

    const successful = allResults.filter(r => r.status === 'success');
    const failed = allResults.filter(r => r.status !== 'success');

    console.log(`✅ Migrados exitosamente: ${successful.length}`);
    console.log(`❌ Errores: ${failed.length}`);
    console.log(`📋 Total procesados: ${allResults.length}`);

    if (failed.length > 0) {
      console.log('\n❌ ERRORES POR TIPO:');
      const errorTypes = {};
      failed.forEach(item => {
        errorTypes[item.status] = (errorTypes[item.status] || 0) + 1;
      });
      Object.entries(errorTypes).forEach(([type, count]) => {
        console.log(`   ${type}: ${count}`);
      });
    }

    console.log('\n📈 ESTADO FINAL TOTAL DE COMENTARIOS:');
    console.log(`✅ Comentarios migrados en esta sesión: ${successful.length}`);
    console.log(`✅ Total comentarios migrados (incluyendo anteriores): ${6 + successful.length}`);
    console.log(`🎯 Estructura: incidencias/{num_solicitud}/comentarios/{archivo}`);

    return { successful: successful.length, failed: failed.length, total: allResults.length };

  } catch (error) {
    console.error('❌ Error en migración principal:', error);
    throw error;
  }
}

main().catch(console.error);