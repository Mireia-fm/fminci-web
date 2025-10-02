// Script para migrar adjuntos de "Cargas del visitante" (8 archivos)
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

// Carpeta con archivos descargados de Wix
const wixFolder = '/Users/mireia/Downloads/Cargas del visitante';

// Datos del CSV urgente para hacer match directo
const urgentFiles = {
  'processed-46324624-DCB7-412A-BAB4-768E4AD4ABEA.jpeg': '21193',
  'IMG_20250919_103232.jpg': '56547',
  'IMG_20250919_102507.jpg': '90724',
  '17582990150309008526706766841434.jpg': '96605',
  '17582987415711179325538227797767.jpg': '34307',
  'IMG_20250919_102636.jpg': '16554'
};

// Función para extraer hash de URL de Wix
function extractWixHash(wixUrl) {
  if (!wixUrl) return null;

  // Para URLs tipo: wix:image://v1/d4d53e_61fce6e82a764843a02b07473c327d17~mv2.jpg/nombre.jpg
  const match = wixUrl.match(/\/([a-f0-9]+_[a-f0-9]+)/);
  if (match) return match[1];

  // Para URLs con otros patrones, extraer cualquier hash de 8 caracteres
  const hashMatch = wixUrl.match(/([a-f0-9]{8})/);
  return hashMatch ? hashMatch[1] : null;
}

async function migrateCargas() {
  console.log('🚀 Iniciando migración de "Cargas del visitante" (8 archivos)...');

  try {
    // 1. Obtener archivos locales
    console.log('📁 Leyendo archivos locales...');
    const files = fs.readdirSync(wixFolder);
    const imageFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.jpg', '.jpeg', '.png'].includes(ext);
    });

    console.log(`📊 Encontradas ${imageFiles.length} imágenes`);

    // 2. Obtener incidencias mencionadas en el CSV urgente
    const numsSolicitud = Object.values(urgentFiles);
    console.log(`🔍 Buscando incidencias: ${numsSolicitud.join(', ')}`);

    const { data: incidencias, error: incidenciasError } = await supabase
      .from('incidencias')
      .select('id, num_solicitud, imagen_url, fecha_creacion, estado_cliente')
      .in('num_solicitud', numsSolicitud);

    if (incidenciasError) {
      throw new Error(`Error cargando incidencias: ${incidenciasError.message}`);
    }

    console.log(`📊 Incidencias encontradas: ${incidencias?.length || 0}`);

    // 3. Obtener comentarios con URLs de Wix de estas incidencias
    const incidenciaIds = incidencias?.map(i => i.id) || [];

    const { data: comentarios, error: comentariosError } = await supabase
      .from('comentarios')
      .select('id, incidencia_id, imagen_url, documento_url, cuerpo')
      .in('incidencia_id', incidenciaIds)
      .or('imagen_url.like.%wix:%,documento_url.like.%wix:%');

    if (comentariosError) {
      throw new Error(`Error cargando comentarios: ${comentariosError.message}`);
    }

    console.log(`📊 Comentarios con URLs de Wix: ${comentarios?.length || 0}`);

    // 4. Crear mapas de matching
    console.log('🔗 Creando mapas de matching...');

    const incidenciasMap = new Map();
    incidencias?.forEach(inc => {
      incidenciasMap.set(inc.num_solicitud, inc);
      if (inc.imagen_url && inc.imagen_url.includes('wix:')) {
        const hash = extractWixHash(inc.imagen_url);
        if (hash) incidenciasMap.set(hash, inc);
      }
    });

    const comentariosMap = new Map();
    comentarios?.forEach(com => {
      if (com.imagen_url && com.imagen_url.includes('wix:')) {
        const hash = extractWixHash(com.imagen_url);
        if (hash) comentariosMap.set(hash, { ...com, tipo: 'imagen' });
      }
      if (com.documento_url && com.documento_url.includes('wix:')) {
        const hash = extractWixHash(com.documento_url);
        if (hash) comentariosMap.set(hash, { ...com, tipo: 'documento' });
      }
    });

    // 5. Procesar archivos
    let processedCount = 0;
    let matchedCount = 0;
    let uploadedCount = 0;
    let errorCount = 0;

    console.log(`🖼️ Procesando ${imageFiles.length} imágenes...`);

    for (const fileName of imageFiles) {
      try {
        console.log(`\n🖼️ Procesando: ${fileName}`);

        let targetIncidencia = null;
        let fileCategory = null;
        let updateTarget = null;

        // 1. Primero intentar match directo del CSV urgente
        if (urgentFiles[fileName]) {
          const numSolicitud = urgentFiles[fileName];
          if (incidenciasMap.has(numSolicitud)) {
            targetIncidencia = incidenciasMap.get(numSolicitud);

            // Para imágenes, usar como imagen principal si no tiene imagen_url
            if (!targetIncidencia.imagen_url) {
              fileCategory = 'imagen_principal';
              updateTarget = { tipo: 'incidencia', id: targetIncidencia.id };
              console.log(`  🎯 Match CSV urgente: ${targetIncidencia.num_solicitud} (imagen principal)`);
            } else {
              fileCategory = 'imagen_adicional';
              updateTarget = null; // Solo subir, no actualizar DB
              console.log(`  🎯 Match CSV urgente: ${targetIncidencia.num_solicitud} (imagen adicional)`);
            }
          }
        }

        // 2. Intentar match por hash en comentarios si no hay match directo
        if (!targetIncidencia) {
          // Buscar hash en el nombre del archivo
          const hashMatch = fileName.match(/([a-f0-9]{8})/);
          if (hashMatch) {
            const hash = hashMatch[1];
            if (comentariosMap.has(hash)) {
              const comentario = comentariosMap.get(hash);
              targetIncidencia = incidencias?.find(i => i.id === comentario.incidencia_id);
              fileCategory = comentario.tipo === 'imagen' ? 'comentario_imagen' : 'comentario_documento';
              updateTarget = { tipo: 'comentario', id: comentario.id, campo: comentario.tipo === 'imagen' ? 'imagen_url' : 'documento_url' };
              console.log(`  🎯 Match por hash en comentario: ${targetIncidencia?.num_solicitud} (${comentario.tipo})`);
            }
          }
        }

        if (!targetIncidencia) {
          console.log(`  ⚠️ Sin match encontrado para: ${fileName}`);
          processedCount++;
          continue;
        }

        matchedCount++;

        // Determinar ruta de subida
        let storagePath;
        switch (fileCategory) {
          case 'imagen_principal':
            storagePath = `incidencias/${targetIncidencia.num_solicitud}/${fileName}`;
            break;
          case 'comentario_imagen':
            storagePath = `incidencias/${targetIncidencia.num_solicitud}/comentarios/${fileName}`;
            break;
          case 'imagen_adicional':
            storagePath = `incidencias/${targetIncidencia.num_solicitud}/imagenes/${fileName}`;
            break;
          default:
            storagePath = `incidencias/${targetIncidencia.num_solicitud}/${fileName}`;
        }

        console.log(`  📤 Subiendo a: ${storagePath}`);

        // Verificar si ya existe
        const folderPath = storagePath.substring(0, storagePath.lastIndexOf('/'));
        const { data: existingFile } = await supabase.storage
          .from('incidencias')
          .list(folderPath, {
            limit: 20,
            search: fileName
          });

        if (existingFile && existingFile.length > 0) {
          console.log(`  ⏭️ Archivo ya existe: ${storagePath}`);
          processedCount++;
          continue;
        }

        // Subir archivo
        const filePath = path.join(wixFolder, fileName);
        const fileBuffer = fs.readFileSync(filePath);

        // Determinar tipo MIME
        const ext = path.extname(fileName).toLowerCase();
        let mimeType;
        switch (ext) {
          case '.jpg':
          case '.jpeg':
            mimeType = 'image/jpeg';
            break;
          case '.png':
            mimeType = 'image/png';
            break;
          case '.gif':
            mimeType = 'image/gif';
            break;
          default:
            mimeType = 'image/jpeg';
        }

        const { error: uploadError } = await supabase.storage
          .from('incidencias')
          .upload(storagePath, fileBuffer, {
            contentType: mimeType,
            cacheControl: '3600',
            upsert: true
          });

        if (uploadError) {
          console.error(`  ❌ Error subiendo: ${uploadError.message}`);
          errorCount++;
          continue;
        }

        uploadedCount++;
        console.log(`  ✅ Subido exitosamente`);

        // Actualizar base de datos
        if (updateTarget) {
          if (updateTarget.tipo === 'comentario') {
            const updateData = {};
            updateData[updateTarget.campo] = storagePath;
            await supabase
              .from('comentarios')
              .update(updateData)
              .eq('id', updateTarget.id);
            console.log(`  🔄 Actualizado ${updateTarget.campo} en comentario`);
          } else if (updateTarget.tipo === 'incidencia' && fileCategory === 'imagen_principal') {
            await supabase
              .from('incidencias')
              .update({ imagen_url: storagePath })
              .eq('id', updateTarget.id);
            console.log(`  🔄 Actualizada imagen_url en incidencia`);
          }
        }

        processedCount++;

        // Pausa pequeña
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        console.error(`❌ Error procesando ${fileName}: ${error.message}`);
        errorCount++;
        processedCount++;
      }
    }

    // 6. Resumen final
    console.log('\n📊 RESUMEN CARGAS DEL VISITANTE:');
    console.log(`📁 Archivos procesados: ${processedCount}`);
    console.log(`🎯 Archivos con match: ${matchedCount}`);
    console.log(`✅ Archivos subidos: ${uploadedCount}`);
    console.log(`❌ Errores: ${errorCount}`);

    // 7. Verificación detallada
    console.log('\n🔍 VERIFICACIÓN DETALLADA:');
    for (const fileName of imageFiles) {
      if (urgentFiles[fileName]) {
        const numSolicitud = urgentFiles[fileName];
        const incidencia = incidenciasMap.get(numSolicitud);

        if (incidencia) {
          console.log(`✅ ${fileName} -> Incidencia ${numSolicitud} (${incidencia.estado_cliente})`);

          // Verificar si se subió correctamente
          const expectedPath = `incidencias/${numSolicitud}/${fileName}`;
          const { data: verifyFile } = await supabase.storage
            .from('incidencias')
            .list(`incidencias/${numSolicitud}`, {
              limit: 10,
              search: fileName
            });

          if (verifyFile && verifyFile.length > 0) {
            console.log(`  📤 Confirmado en storage: ${expectedPath}`);
          } else {
            console.log(`  ⚠️ No encontrado en storage`);
          }
        } else {
          console.log(`❌ ${fileName} -> Incidencia ${numSolicitud} NO ENCONTRADA`);
        }
      } else {
        console.log(`🔍 ${fileName} -> Sin match en CSV urgente`);
      }
    }

    if (errorCount === 0) {
      console.log('\n🎉 ¡Migración de Cargas del visitante completada exitosamente!');
    } else {
      console.log('\n⚠️ Migración completada con algunos errores');
    }

  } catch (error) {
    console.error('❌ Error durante la migración:', error.message);
    process.exit(1);
  }
}

migrateCargas();