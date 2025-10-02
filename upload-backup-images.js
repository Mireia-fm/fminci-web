// Script para subir imágenes del backup de Wix a Supabase
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function uploadBackupImages() {
  console.log('🚀 Iniciando subida de imágenes del backup de Wix...');

  const backupFolder = '/Users/mireia/Desktop/imagenes Wix 05.06.2025';

  if (!fs.existsSync(backupFolder)) {
    console.error('❌ La carpeta de backup no existe:', backupFolder);
    process.exit(1);
  }

  try {
    // 1. Obtener lista de archivos
    const files = fs.readdirSync(backupFolder);
    const imageFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.gif'].includes(ext);
    });

    console.log(`📁 Encontradas ${imageFiles.length} imágenes en el backup`);

    // 2. Obtener todas las incidencias para hacer el match por num_solicitud
    console.log('📋 Cargando incidencias de la base de datos...');
    const { data: incidencias, error: incidenciasError } = await supabase
      .from('incidencias')
      .select('id, num_solicitud, imagen_url')
      .order('num_solicitud');

    if (incidenciasError) {
      throw new Error(`Error cargando incidencias: ${incidenciasError.message}`);
    }

    console.log(`📊 Encontradas ${incidencias?.length || 0} incidencias en la base de datos`);

    // 3. Crear mapa de num_solicitud -> incidencia
    const incidenciasMap = new Map();
    incidencias?.forEach(inc => {
      incidenciasMap.set(inc.num_solicitud, inc);
    });

    let uploadedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    let updatedCount = 0;

    // 4. Procesar cada imagen
    for (const fileName of imageFiles) {
      try {
        // Extraer número de solicitud del nombre del archivo
        const numSolicitud = path.basename(fileName, path.extname(fileName));

        console.log(`\n🔍 Procesando: ${fileName} -> num_solicitud: ${numSolicitud}`);

        // Verificar si existe la incidencia
        const incidencia = incidenciasMap.get(numSolicitud);
        if (!incidencia) {
          console.log(`  ⚠️ No se encontró incidencia con num_solicitud: ${numSolicitud}`);
          skippedCount++;
          continue;
        }

        const filePath = path.join(backupFolder, fileName);
        const storagePath = `incidencias/${numSolicitud}/${fileName}`;

        // Verificar si el archivo ya existe en storage
        const { data: existingFile } = await supabase.storage
          .from('incidencias')
          .list(`incidencias/${numSolicitud}`, {
            limit: 10,
            search: fileName
          });

        if (existingFile && existingFile.length > 0) {
          console.log(`  ⏭️ Archivo ya existe en storage: ${storagePath}`);
          skippedCount++;
          continue;
        }

        // Leer el archivo
        const fileBuffer = fs.readFileSync(filePath);
        const mimeType = fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') ? 'image/jpeg' :
                        fileName.endsWith('.png') ? 'image/png' :
                        fileName.endsWith('.gif') ? 'image/gif' : 'image/jpeg';

        console.log(`  📤 Subiendo a: ${storagePath}`);

        // Subir archivo
        const { error: uploadError } = await supabase.storage
          .from('incidencias')
          .upload(storagePath, fileBuffer, {
            contentType: mimeType,
            cacheControl: '3600',
            upsert: true
          });

        if (uploadError) {
          console.error(`  ❌ Error subiendo ${fileName}: ${uploadError.message}`);
          errorCount++;
          continue;
        }

        console.log(`  ✅ Subido exitosamente: ${storagePath}`);
        uploadedCount++;

        // Actualizar imagen_url en la incidencia si no la tiene
        if (!incidencia.imagen_url) {
          const { error: updateError } = await supabase
            .from('incidencias')
            .update({ imagen_url: storagePath })
            .eq('id', incidencia.id);

          if (updateError) {
            console.error(`  ⚠️ Error actualizando imagen_url: ${updateError.message}`);
          } else {
            console.log(`  🔗 Actualizado imagen_url en incidencia`);
            updatedCount++;
          }
        }

        // Pausa para no sobrecargar
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`❌ Error procesando ${fileName}: ${error.message}`);
        errorCount++;
      }
    }

    // 5. Resumen final
    console.log('\n📊 RESUMEN:');
    console.log(`✅ Imágenes subidas exitosamente: ${uploadedCount}`);
    console.log(`⏭️ Imágenes omitidas (ya existían): ${skippedCount}`);
    console.log(`🔗 Incidencias actualizadas con imagen_url: ${updatedCount}`);
    console.log(`❌ Errores: ${errorCount}`);
    console.log(`📁 Total procesadas: ${imageFiles.length}`);

    if (errorCount === 0) {
      console.log('\n🎉 ¡Subida completada exitosamente!');
      console.log('Todas las imágenes del backup están ahora en Supabase');
    } else {
      console.log('\n⚠️ Subida completada con algunos errores');
    }

  } catch (error) {
    console.error('❌ Error durante la subida:', error.message);
    process.exit(1);
  }
}

uploadBackupImages();