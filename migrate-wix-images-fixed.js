require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Solo usar Supabase client para Storage, NO para base de datos
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
const supabaseClient = createClient(supabaseUrl, supabaseKey);

const DOWNLOADS_PATH = '/Users/mireia/Downloads/Cargas del visitante-2';
const BUCKET_NAME = 'incidencias';

// Lista de archivos con coincidencias exactas (los 28 que encontramos)
const exactMatches = [
  { numSolicitud: '08591', fileName: '20250910_105709.jpg' },
  { numSolicitud: '09794', fileName: 'IMG_20250912_162304[1].jpg' },
  { numSolicitud: '09800', fileName: '1000021510.jpg' },
  { numSolicitud: '15376', fileName: '1000100229.jpg' },
  { numSolicitud: '23999', fileName: '20250904_163120.jpg' },
  { numSolicitud: '25401', fileName: '1000149672.jpg' },
  { numSolicitud: '32787', fileName: 'processed-78EB9493-A2C7-4594-BF17-5F43FBC753E0.jpeg' },
  { numSolicitud: '39688', fileName: 'cable penjant 2025-09-16.jpeg' },
  { numSolicitud: '39835', fileName: '1757514836566769056175081587240.jpg' },
  { numSolicitud: '40741', fileName: 'Captura de pantalla 2025-09-17 102511.png' },
  { numSolicitud: '42143', fileName: '1757510640785.jpg' },
  { numSolicitud: '46536', fileName: '1000100227.jpg' },
  { numSolicitud: '47271', fileName: '17576076177308608672390251643726.jpg' },
  { numSolicitud: '52169', fileName: '1757923325999.jpg' },
  { numSolicitud: '54750', fileName: '17575150581056334708436023246368.jpg' },
  { numSolicitud: '57220', fileName: '1758099948261.jpg' },
  { numSolicitud: '61996', fileName: 'IMG_20250909_164256 (1).jpg' },
  { numSolicitud: '63113', fileName: '1000100559.jpg' },
  { numSolicitud: '63638', fileName: '17575145058992352833059200894325.jpg' },
  { numSolicitud: '69847', fileName: '1000116575.jpg' },
  { numSolicitud: '70220', fileName: '1000100225.jpg' },
  { numSolicitud: '73811', fileName: 'IMG_20250917_175629.jpg' },
  { numSolicitud: '81674', fileName: '1000146607.jpg' },
  { numSolicitud: '84181', fileName: '1757495192162236577715904641166.jpg' },
  { numSolicitud: '85745', fileName: '1000021668.jpg' },
  { numSolicitud: '86223', fileName: '17575137464641216452255004616314.jpg' },
  { numSolicitud: '88826', fileName: '20250917_114120.jpg' },
  { numSolicitud: '95230', fileName: '1000118651.jpg' }
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

    // Obtener URL pública
    const { data: publicUrlData } = supabaseClient.storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath);

    return publicUrlData.publicUrl;
  } catch (error) {
    console.error(`❌ Error en uploadFileToStorage:`, error);
    return null;
  }
}

async function migrateExactMatches() {
  console.log('🚀 Iniciando migración de coincidencias exactas...');
  console.log(`📋 Total de archivos a migrar: ${exactMatches.length}\n`);

  let migrated = 0;
  let failed = 0;
  const results = [];

  for (const { numSolicitud, fileName } of exactMatches) {
    console.log(`\n🔄 Procesando ${numSolicitud}: ${fileName}`);

    try {
      // Verificar que el archivo existe
      const filePath = path.join(DOWNLOADS_PATH, fileName);
      if (!fs.existsSync(filePath)) {
        console.log(`⚠️  Archivo no encontrado: ${fileName}`);
        failed++;
        results.push({ numSolicitud, fileName, status: 'file_not_found' });
        continue;
      }

      // Subir a Storage
      const newUrl = await uploadFileToStorage(filePath, fileName, numSolicitud);
      if (!newUrl) {
        console.log(`❌ Error subiendo ${fileName}`);
        failed++;
        results.push({ numSolicitud, fileName, status: 'upload_failed' });
        continue;
      }

      console.log(`✅ Archivo subido. URL: ${newUrl}`);

      // Generar comando SQL para actualizar manualmente via MCP
      console.log(`📝 Comando SQL para ejecutar:`);
      console.log(`UPDATE incidencias SET imagen_url = '${newUrl}' WHERE num_solicitud = '${numSolicitud}';`);

      migrated++;
      results.push({
        numSolicitud,
        fileName,
        newUrl,
        status: 'uploaded_ready_for_db_update',
        sqlCommand: `UPDATE incidencias SET imagen_url = '${newUrl}' WHERE num_solicitud = '${numSolicitud}';`
      });

      // Pausa para evitar rate limits
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.error(`❌ Error procesando ${numSolicitud}:`, error);
      failed++;
      results.push({ numSolicitud, fileName, status: 'error', error: error.message });
    }
  }

  console.log('\n📊 RESUMEN DE MIGRACIÓN:');
  console.log(`✅ Archivos subidos exitosamente: ${migrated}`);
  console.log(`❌ Errores: ${failed}`);
  console.log(`📋 Total procesados: ${exactMatches.length}\n`);

  // Generar script SQL completo
  console.log('📜 SCRIPT SQL COMPLETO PARA EJECUTAR:');
  console.log('-- Actualizar todas las referencias de imágenes migradas');
  const successfulUploads = results.filter(r => r.status === 'uploaded_ready_for_db_update');

  for (const result of successfulUploads) {
    console.log(result.sqlCommand);
  }

  console.log(`\n-- Total de ${successfulUploads.length} comandos SQL generados`);

  return { migrated, failed, results, successfulUploads };
}

// Ejecutar migración
migrateExactMatches().then(result => {
  console.log('\n🎉 Migración de Storage completada!');
  console.log('📋 Próximo paso: Ejecutar los comandos SQL mostrados arriba usando MCP');
}).catch(error => {
  console.error('❌ Error en migración:', error);
});