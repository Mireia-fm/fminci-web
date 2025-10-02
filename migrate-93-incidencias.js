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

    // Estructura para incidencias: incidencias/{num_solicitud}/{archivo}
    const storagePath = `${numSolicitud}/${fileName}`;

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

async function updateIncidenciaUrl(numSolicitud, newUrl) {
  try {
    const { data, error } = await supabaseClient
      .from('incidencias')
      .update({ imagen_url: newUrl })
      .eq('num_solicitud', numSolicitud);

    if (error) {
      console.error(`❌ Error actualizando incidencia ${numSolicitud}:`, error);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`❌ Error en updateIncidenciaUrl:`, error);
    return false;
  }
}

async function findIncidenciasExactMatches() {
  console.log('🔍 Encontrando incidencias con coincidencias exactas en visitante-3...');

  // Obtener archivos de visitante-3
  const allFiles3 = fs.readdirSync(DOWNLOADS_PATH_3)
    .filter(file => /\.(jpg|jpeg|png|gif|webp|jfif)$/i.test(file));

  // Obtener incidencias con URLs Wix
  const { data: incidenciasWix, error } = await supabaseClient
    .from('incidencias')
    .select('num_solicitud, imagen_url')
    .like('imagen_url', 'wix%')
    .order('num_solicitud');

  if (error) {
    console.error('Error obteniendo incidencias Wix:', error);
    return [];
  }

  const exactMatches = [];

  for (const incidencia of incidenciasWix) {
    const wixFileName = extractFileNameFromWixUrl(incidencia.imagen_url);
    if (!wixFileName) continue;

    const exactMatch = allFiles3.find(file => file === wixFileName);
    if (exactMatch) {
      exactMatches.push({
        numSolicitud: incidencia.num_solicitud,
        fileName: exactMatch,
        wixUrl: incidencia.imagen_url
      });
    }
  }

  console.log(`✅ Encontradas ${exactMatches.length} incidencias con coincidencias exactas`);
  return exactMatches;
}

async function migrateBatch(matches, batchIndex, totalBatches) {
  console.log(`\n📦 LOTE ${batchIndex}/${totalBatches} (${matches.length} archivos)`);
  console.log('─'.repeat(60));

  const results = [];

  for (const [itemIndex, match] of matches.entries()) {
    const globalIndex = (batchIndex - 1) * BATCH_SIZE + itemIndex + 1;

    console.log(`\n🔄 [${globalIndex}/93] ${match.numSolicitud} - ${match.fileName}`);

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
      const updateSuccess = await updateIncidenciaUrl(match.numSolicitud, newUrl);
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

async function getProblematicComments() {
  console.log('\n🔍 Analizando comentarios con problemas técnicos...');

  const problematicFiles = [
    '20250528_155358[1].jpg',
    '20250605_183304[1].jpg',
    '20250508_160454[1].jpg',
    'IMAGEN GRAFFITI  EC SABADELL DESPUÉS.jpg'
  ];

  const { data: comentarios, error } = await supabaseClient
    .from('comentarios')
    .select(`
      id,
      imagen_url,
      cuerpo,
      autor_email,
      creado_en,
      incidencias!inner(num_solicitud, ubicacion, descripcion_inicial)
    `)
    .like('imagen_url', 'wix%');

  if (error) {
    console.error('Error obteniendo comentarios:', error);
    return [];
  }

  const problematicComments = [];

  for (const comentario of comentarios) {
    const wixFileName = extractFileNameFromWixUrl(comentario.imagen_url);
    if (wixFileName && problematicFiles.includes(wixFileName)) {
      problematicComments.push({
        comentarioId: comentario.id,
        numSolicitud: comentario.incidencias.num_solicitud,
        fileName: wixFileName,
        problema: wixFileName.includes('[') ? 'Corchetes en nombre' : 'Espacios dobles',
        ubicacion: comentario.incidencias.ubicacion,
        descripcion: comentario.incidencias.descripcion_inicial,
        autor: comentario.autor_email,
        fecha: comentario.creado_en,
        cuerpo: comentario.cuerpo,
        wixUrl: comentario.imagen_url
      });
    }
  }

  return problematicComments;
}

async function main() {
  console.log('🎯 MIGRACIÓN DE 93 INCIDENCIAS CON COINCIDENCIAS EXACTAS');
  console.log('Estructura: incidencias/{num_solicitud}/{archivo}');
  console.log('='.repeat(70));

  try {
    // 1. Encontrar incidencias con coincidencias exactas
    const exactMatches = await findIncidenciasExactMatches();

    if (exactMatches.length === 0) {
      console.log('❌ No se encontraron incidencias con coincidencias exactas');
      return;
    }

    // 2. Dividir en lotes
    const batches = [];
    for (let i = 0; i < exactMatches.length; i += BATCH_SIZE) {
      batches.push(exactMatches.slice(i, i + BATCH_SIZE));
    }

    console.log(`\n🚀 Iniciando migración de ${exactMatches.length} incidencias en ${batches.length} lotes`);

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

    // 4. Resumen de incidencias
    console.log('\n' + '='.repeat(70));
    console.log('📊 RESUMEN MIGRACIÓN INCIDENCIAS:');
    console.log('='.repeat(70));

    const successful = allResults.filter(r => r.status === 'success');
    const failed = allResults.filter(r => r.status !== 'success');

    console.log(`✅ Incidencias migradas exitosamente: ${successful.length}`);
    console.log(`❌ Errores: ${failed.length}`);
    console.log(`📋 Total procesadas: ${allResults.length}`);

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

    // 5. Analizar comentarios problemáticos
    const problematicComments = await getProblematicComments();

    console.log('\n' + '='.repeat(70));
    console.log('🔧 COMENTARIOS CON PROBLEMAS TÉCNICOS:');
    console.log('='.repeat(70));

    if (problematicComments.length > 0) {
      problematicComments.forEach((comment, index) => {
        console.log(`\n💬 COMENTARIO ${index + 1}/${problematicComments.length}:`);
        console.log(`   📋 ID: ${comment.comentarioId}`);
        console.log(`   🎯 Incidencia: ${comment.numSolicitud}`);
        console.log(`   📄 Archivo: ${comment.fileName}`);
        console.log(`   ⚠️  Problema: ${comment.problema}`);
        console.log(`   📍 Ubicación: ${comment.ubicacion}`);
        console.log(`   📝 Descripción: ${comment.descripcion?.substring(0, 100)}...`);
        console.log(`   👤 Autor: ${comment.autor}`);
        console.log(`   📅 Fecha: ${new Date(comment.fecha).toLocaleDateString()}`);
        console.log(`   💭 Comentario: ${comment.cuerpo?.substring(0, 100)}...`);
        console.log(`   🔗 URL Wix: ${comment.wixUrl}`);
      });

      console.log(`\n🔧 SOLUCIONES SUGERIDAS:`);
      console.log(`   1. Archivos con [1]: Renombrar sin corchetes antes de subir`);
      console.log(`   2. Espacios dobles: Normalizar espacios en nombre de archivo`);
      console.log(`   3. Usar función de sanitización de nombres en próximas migraciones`);
    }

    console.log('\n📈 ESTADO FINAL:');
    console.log(`✅ Incidencias migradas: ${successful.length}/93`);
    console.log(`💬 Comentarios problemáticos: ${problematicComments.length}`);

    return {
      incidencias: { successful: successful.length, failed: failed.length, total: allResults.length },
      comentariosProblematicos: problematicComments.length
    };

  } catch (error) {
    console.error('❌ Error en migración principal:', error);
    throw error;
  }
}

main().catch(console.error);