require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
const supabaseClient = createClient(supabaseUrl, supabaseKey);

const DOWNLOADS_PATH_2 = '/Users/mireia/Downloads/Cargas del visitante-2';
const DOWNLOADS_PATH_3 = '/Users/mireia/Downloads/Cargas del visitante-3';
const BUCKET_NAME = 'incidencias';

// Los 3 archivos específicos encontrados en visitante-3
const foundFiles = [
  { numSolicitud: '01545', fileName: 'Imagen de WhatsApp 2025-04-14 a las 10.26.47_201a5482.jpg' },
  { numSolicitud: '13108', fileName: 'WhatsApp Image 2025-08-27 at 10.08.12.jpeg' },
  { numSolicitud: '31913', fileName: 'Captura de pantalla 2025-06-02 170342.png' },
  { numSolicitud: '42125', fileName: 'WhatsApp Image 2025-08-27 at 10.08.12 (1).jpeg' }
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
    const storagePath = `${numSolicitud}/${fileName}`;

    console.log(`📤 Subiendo ${fileName} a ${storagePath}`);

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
    console.error('Error extracting filename from Wix URL:', wixUrl, error);
    return null;
  }
}

async function migrateFoundFiles() {
  console.log('🚀 Migrando archivos encontrados en visitante-3...');

  const results = [];

  for (const { numSolicitud, fileName } of foundFiles) {
    console.log(`\n🔄 Procesando ${numSolicitud}: ${fileName}`);

    try {
      const filePath = path.join(DOWNLOADS_PATH_3, fileName);
      if (!fs.existsSync(filePath)) {
        console.log(`⚠️  Archivo no encontrado: ${fileName}`);
        results.push({ numSolicitud, fileName, status: 'file_not_found' });
        continue;
      }

      const newUrl = await uploadFileToStorage(filePath, fileName, numSolicitud);
      if (!newUrl) {
        console.log(`❌ Error subiendo ${fileName}`);
        results.push({ numSolicitud, fileName, status: 'upload_failed' });
        continue;
      }

      console.log(`✅ Archivo subido. URL: ${newUrl}`);
      console.log(`📝 SQL: UPDATE incidencias SET imagen_url = '${newUrl}' WHERE num_solicitud = '${numSolicitud}';`);

      results.push({
        numSolicitud,
        fileName,
        newUrl,
        status: 'success',
        sqlCommand: `UPDATE incidencias SET imagen_url = '${newUrl}' WHERE num_solicitud = '${numSolicitud}';`
      });

      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.error(`❌ Error procesando ${numSolicitud}:`, error);
      results.push({ numSolicitud, fileName, status: 'error', error: error.message });
    }
  }

  return results;
}

async function findMoreExactMatches() {
  console.log('\n🔍 Buscando más coincidencias exactas en visitante-3...');

  // Obtener todos los archivos de visitante-3
  const allFiles3 = fs.readdirSync(DOWNLOADS_PATH_3)
    .filter(file => /\.(jpg|jpeg|png|gif|webp|jfif)$/i.test(file));

  console.log(`📁 Archivos en visitante-3: ${allFiles3.length}`);

  // Obtener todas las URLs Wix restantes (que no fueron migradas)
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, supabaseKey);

  let wixUrls;
  try {
    const { data, error } = await supabase
      .from('incidencias')
      .select('num_solicitud, imagen_url')
      .like('imagen_url', 'wix%')
      .order('num_solicitud');

    if (error) throw error;
    wixUrls = data;
  } catch (error) {
    console.error('Error obteniendo URLs Wix:', error);
    return [];
  }

  console.log(`🔗 URLs Wix restantes: ${wixUrls.length}`);

  const exactMatches = [];
  const processed = new Set(); // Para evitar duplicados

  for (const { num_solicitud, imagen_url } of wixUrls) {
    const wixFileName = extractFileNameFromWixUrl(imagen_url);
    if (!wixFileName || processed.has(wixFileName)) continue;

    processed.add(wixFileName);

    // Buscar coincidencia exacta en visitante-3
    const exactMatch = allFiles3.find(file => file === wixFileName);
    if (exactMatch) {
      console.log(`✅ NUEVA COINCIDENCIA EXACTA: ${num_solicitud} -> ${exactMatch}`);
      exactMatches.push({
        numSolicitud: num_solicitud,
        fileName: exactMatch,
        wixUrl: imagen_url
      });
    }
  }

  console.log(`\n📊 Encontradas ${exactMatches.length} coincidencias exactas adicionales`);
  return exactMatches;
}

async function main() {
  console.log('🎯 MIGRACIÓN EXTENDIDA - VISITANTE-3\n');

  // 1. Migrar los 3 archivos específicos encontrados
  const foundResults = await migrateFoundFiles();
  const successfulFound = foundResults.filter(r => r.status === 'success');

  console.log(`\n✅ Archivos específicos migrados: ${successfulFound.length}/4`);

  // 2. Buscar más coincidencias exactas
  const additionalMatches = await findMoreExactMatches();

  // 3. Migrar coincidencias exactas adicionales
  console.log('\n🚀 Migrando coincidencias exactas adicionales...');
  const additionalResults = [];

  for (const match of additionalMatches.slice(0, 20)) { // Limitar a 20 para no sobrecargar
    console.log(`\n🔄 Procesando ${match.numSolicitud}: ${match.fileName}`);

    try {
      const filePath = path.join(DOWNLOADS_PATH_3, match.fileName);
      const newUrl = await uploadFileToStorage(filePath, match.fileName, match.numSolicitud);

      if (newUrl) {
        console.log(`✅ Migrado: ${match.numSolicitud} -> ${match.fileName}`);
        additionalResults.push({
          ...match,
          newUrl,
          status: 'success',
          sqlCommand: `UPDATE incidencias SET imagen_url = '${newUrl}' WHERE num_solicitud = '${match.numSolicitud}';`
        });
      }

      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      additionalResults.push({ ...match, status: 'error', error: error.message });
    }
  }

  // 4. Generar comandos SQL
  const allSuccessful = [
    ...successfulFound,
    ...additionalResults.filter(r => r.status === 'success')
  ];

  console.log('\n📜 COMANDOS SQL PARA EJECUTAR:');
  for (const result of allSuccessful) {
    console.log(result.sqlCommand);
  }

  console.log(`\n📊 RESUMEN EXTENDIDO:`);
  console.log(`✅ Total migrado exitosamente: ${allSuccessful.length}`);
  console.log(`📁 Archivos específicos: ${successfulFound.length}/4`);
  console.log(`🔍 Coincidencias exactas adicionales: ${additionalResults.filter(r => r.status === 'success').length}`);

  return allSuccessful;
}

main().catch(console.error);