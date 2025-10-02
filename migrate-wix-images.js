require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configuración Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

console.log('Supabase URL:', supabaseUrl ? 'Configurada' : 'NO CONFIGURADA');
console.log('Service Role Key:', supabaseKey ? 'Configurada' : 'NO CONFIGURADA');
const supabase = createClient(supabaseUrl, supabaseKey);

const DOWNLOADS_PATH = '/Users/mireia/Downloads/Cargas del visitante-2';
const BUCKET_NAME = 'incidencias';

// Función para extraer el nombre del archivo de una URL Wix
function extractFileNameFromWixUrl(wixUrl) {
  try {
    // Ejemplo: wix:image://v1/218f41_f8b421dd57584b94adf477046c378756~mv2.jpg/shared%20image%20(16).jfif#originWidth=1734&originHeight=2312
    const parts = wixUrl.split('/');
    if (parts.length >= 2) {
      const lastPart = parts[parts.length - 1];
      // Remover parámetros después de #
      const fileName = lastPart.split('#')[0];
      return decodeURIComponent(fileName);
    }
    return null;
  } catch (error) {
    console.error('Error extracting filename from Wix URL:', wixUrl, error);
    return null;
  }
}

// Función para buscar archivo en el directorio con coincidencia EXACTA solamente
function findFileInDirectory(targetFileName, directoryPath) {
  try {
    const files = fs.readdirSync(directoryPath);

    // Solo buscar coincidencia exacta para evitar errores
    const exactMatch = files.find(file => file === targetFileName);
    return exactMatch || null;
  } catch (error) {
    console.error('Error reading directory:', error);
    return null;
  }
}

// Función para subir archivo a Supabase Storage
async function uploadFileToStorage(filePath, fileName, numSolicitud) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const fileExt = path.extname(fileName).toLowerCase();
    const contentType = getContentType(fileExt);

    const storagePath = `${numSolicitud}/${fileName}`;

    console.log(`Subiendo ${fileName} a ${storagePath}`);

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, fileBuffer, {
        contentType: contentType,
        upsert: true
      });

    if (error) {
      console.error('Error uploading file:', error);
      return null;
    }

    // Obtener URL pública
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath);

    return publicUrlData.publicUrl;
  } catch (error) {
    console.error('Error in uploadFileToStorage:', error);
    return null;
  }
}

// Función para determinar content type
function getContentType(extension) {
  const types = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.jfif': 'image/jpeg'
  };
  return types[extension] || 'image/jpeg';
}

// Función para actualizar la referencia en la base de datos
async function updateIncidenciaImageUrl(numSolicitud, newUrl) {
  try {
    console.log(`🔄 Actualizando BD: ${numSolicitud} -> ${newUrl}`);

    const { data, error } = await supabase
      .from('incidencias')
      .update({ imagen_url: newUrl })
      .eq('num_solicitud', numSolicitud)
      .select();

    if (error) {
      console.error(`❌ Error updating database for ${numSolicitud}:`, error.message);
      console.error('Error details:', error);
      return false;
    }

    if (!data || data.length === 0) {
      console.error(`❌ No se encontró incidencia con num_solicitud: ${numSolicitud}`);
      return false;
    }

    console.log(`✅ Actualizada incidencia ${numSolicitud} con nueva URL`);
    return true;
  } catch (error) {
    console.error(`❌ Error in updateIncidenciaImageUrl for ${numSolicitud}:`, error.message);
    return false;
  }
}

// Función principal de migración
async function migrateWixImages() {
  try {
    console.log('🚀 Iniciando migración de imágenes Wix...');

    // Obtener todas las incidencias con URLs Wix
    const { data: incidencias, error } = await supabase
      .from('incidencias')
      .select('num_solicitud, imagen_url')
      .like('imagen_url', 'wix%')
      .order('num_solicitud');

    if (error) {
      console.error('Error fetching incidencias:', error);
      return;
    }

    console.log(`📁 Encontradas ${incidencias.length} incidencias con imágenes Wix`);

    let migrated = 0;
    let failed = 0;
    let notFound = 0;

    for (const incidencia of incidencias) {
      const { num_solicitud, imagen_url } = incidencia;

      console.log(`\n🔄 Procesando ${num_solicitud}...`);

      // Extraer nombre del archivo de la URL Wix
      const fileName = extractFileNameFromWixUrl(imagen_url);
      if (!fileName) {
        console.log(`❌ No se pudo extraer nombre de archivo de: ${imagen_url}`);
        failed++;
        continue;
      }

      console.log(`📄 Buscando archivo: ${fileName}`);

      // Buscar archivo en el directorio
      const foundFile = findFileInDirectory(fileName, DOWNLOADS_PATH);
      if (!foundFile) {
        console.log(`⚠️  No encontrado: ${fileName}`);
        notFound++;
        continue;
      }

      console.log(`✅ Encontrado: ${foundFile}`);

      // Subir archivo a Storage
      const filePath = path.join(DOWNLOADS_PATH, foundFile);
      const newUrl = await uploadFileToStorage(filePath, foundFile, num_solicitud);

      if (!newUrl) {
        console.log(`❌ Error subiendo ${foundFile}`);
        failed++;
        continue;
      }

      // Actualizar referencia en BD
      const updated = await updateIncidenciaImageUrl(num_solicitud, newUrl);
      if (updated) {
        migrated++;
        console.log(`✅ Migrado: ${num_solicitud} -> ${foundFile}`);
      } else {
        failed++;
        console.log(`❌ Error actualizando BD para ${num_solicitud}`);
      }

      // Pausa pequeña para evitar rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n📊 RESUMEN DE MIGRACIÓN:');
    console.log(`✅ Migradas exitosamente: ${migrated}`);
    console.log(`⚠️  Archivos no encontrados: ${notFound}`);
    console.log(`❌ Errores: ${failed}`);
    console.log(`📋 Total procesadas: ${incidencias.length}`);

    // Mostrar archivos no encontrados para revisión manual
    if (notFound > 0) {
      console.log('\n📄 Lista de archivos buscados pero no encontrados:');
      for (const incidencia of incidencias) {
        const fileName = extractFileNameFromWixUrl(incidencia.imagen_url);
        if (fileName && !findFileInDirectory(fileName, DOWNLOADS_PATH)) {
          console.log(`- ${incidencia.num_solicitud}: ${fileName}`);
        }
      }
    }

  } catch (error) {
    console.error('Error en migración principal:', error);
  }
}

// Función para ejecutar en modo dry-run (solo mostrar qué se haría)
async function dryRun() {
  try {
    console.log('🔍 Ejecutando DRY RUN - No se realizarán cambios\n');

    const { data: incidencias, error } = await supabase
      .from('incidencias')
      .select('num_solicitud, imagen_url')
      .like('imagen_url', 'wix%')
      .order('num_solicitud');

    if (error) {
      console.error('Error fetching incidencias:', error);
      return;
    }

    console.log(`📁 Encontradas ${incidencias.length} incidencias con imágenes Wix\n`);

    let canMigrate = 0;
    let notFound = 0;

    for (const incidencia of incidencias) {
      const { num_solicitud, imagen_url } = incidencia;
      const fileName = extractFileNameFromWixUrl(imagen_url);

      if (!fileName) {
        console.log(`❌ ${num_solicitud}: No se puede extraer nombre de archivo`);
        continue;
      }

      const foundFile = findFileInDirectory(fileName, DOWNLOADS_PATH);
      if (foundFile) {
        console.log(`✅ ${num_solicitud}: ${fileName} -> ${foundFile}`);
        canMigrate++;
      } else {
        console.log(`⚠️  ${num_solicitud}: ${fileName} NO ENCONTRADO`);
        notFound++;
      }
    }

    console.log(`\n📊 RESUMEN DRY RUN:`);
    console.log(`✅ Se pueden migrar: ${canMigrate}`);
    console.log(`⚠️  No encontrados: ${notFound}`);
    console.log(`📋 Total: ${incidencias.length}`);

  } catch (error) {
    console.error('Error en dry run:', error);
  }
}

// Verificar argumentos de línea de comandos
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run') || args.includes('-d');

if (isDryRun) {
  dryRun();
} else {
  console.log('⚠️  Ejecutando migración real. Use --dry-run para probar primero.');
  console.log('Presione Ctrl+C para cancelar o espere 5 segundos...\n');
  setTimeout(migrateWixImages, 5000);
}