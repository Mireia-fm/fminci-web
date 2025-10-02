// Script para migrar adjuntos de Wix desde Cargas del visitante-3
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
const wixFolder = '/Users/mireia/Downloads/Cargas del visitante-3';

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

// Función para extraer información del nombre del archivo
function parseFileName(fileName) {
  // Para archivos como "01871.1chkapi14_MASTERCOLD_Co___154_bbbd9667_0.pdf"
  const pdfMatch = fileName.match(/^(\d+)\..*?([a-f0-9]{8})_/);
  if (pdfMatch) {
    return {
      incidenciaNum: pdfMatch[1].padStart(5, '0'),
      hash: pdfMatch[2]
    };
  }

  // Para archivos con números largos como "1000021510.jpg"
  const numMatch = fileName.match(/^(\d{10})\.jpg$/);
  if (numMatch) {
    return {
      incidenciaNum: null,
      hash: null,
      fileName: fileName,
      isPhotoFile: true
    };
  }

  // Para archivos con formato de fecha como "20250213_114447.jpg"
  const dateMatch = fileName.match(/^(\d{8}_\d{6})\.jpg$/);
  if (dateMatch) {
    return {
      incidenciaNum: null,
      hash: null,
      fileName: fileName,
      isPhotoFile: true
    };
  }

  return {
    incidenciaNum: null,
    hash: null,
    fileName: fileName
  };
}

async function migrateWixAttachments() {
  console.log('🚀 Iniciando migración de adjuntos desde Cargas del visitante-3...');

  try {
    // 1. Obtener archivos locales
    console.log('📁 Leyendo archivos locales...');
    const files = fs.readdirSync(wixFolder);
    const mediaFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.pdf', '.doc', '.docx'].includes(ext);
    });

    console.log(`📊 Encontrados ${mediaFiles.length} archivos multimedia`);

    // 2. Obtener incidencias activas (más recientes primero)
    console.log('🔍 Cargando incidencias activas...');
    const { data: incidencias, error: incidenciasError } = await supabase
      .from('incidencias')
      .select('id, num_solicitud, imagen_url, fecha_creacion, estado_cliente')
      .not('estado_cliente', 'in', '("Cerrada","Anulada")')
      .order('fecha_creacion', { ascending: false })
      .limit(300); // Procesar las 300 más recientes

    if (incidenciasError) {
      throw new Error(`Error cargando incidencias: ${incidenciasError.message}`);
    }

    console.log(`📊 Incidencias activas encontradas: ${incidencias?.length || 0}`);

    // 3. Obtener comentarios con URLs de Wix de estas incidencias
    const incidenciaIds = incidencias?.map(i => i.id) || [];

    const { data: comentarios, error: comentariosError } = await supabase
      .from('comentarios')
      .select('id, incidencia_id, imagen_url, documento_url, cuerpo')
      .in('incidencia_id', incidenciaIds)
      .or('imagen_url.like.%wix:%,documento_url.like.%wix:%')
      .limit(600);

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

    // Procesar todos los archivos (PDFs e imágenes)
    const pdfFiles = mediaFiles.filter(f => path.extname(f).toLowerCase() === '.pdf');
    const imageFiles = mediaFiles.filter(f => ['.jpg', '.jpeg', '.png'].includes(path.extname(f).toLowerCase()));

    console.log(`📄 Procesando ${pdfFiles.length} archivos PDF...`);
    console.log(`🖼️ Procesando ${imageFiles.length} archivos de imagen...`);

    // Procesar todos los archivos
    for (const fileName of mediaFiles) {
      try {
        console.log(`\n📄 Procesando: ${fileName}`);
        const fileInfo = parseFileName(fileName);

        let targetIncidencia = null;
        let fileCategory = null;
        let updateTarget = null;

        // Intentar match por hash
        if (fileInfo.hash) {
          if (comentariosMap.has(fileInfo.hash)) {
            const comentario = comentariosMap.get(fileInfo.hash);
            targetIncidencia = incidencias?.find(i => i.id === comentario.incidencia_id);
            fileCategory = comentario.tipo === 'imagen' ? 'comentario_imagen' : 'comentario_documento';
            updateTarget = { tipo: 'comentario', id: comentario.id, campo: comentario.tipo === 'imagen' ? 'imagen_url' : 'documento_url' };
            console.log(`  🎯 Match por hash en comentario: ${targetIncidencia?.num_solicitud} (${comentario.tipo})`);
          }
        }

        // Intentar match por número de incidencia
        if (!targetIncidencia && fileInfo.incidenciaNum) {
          if (incidenciasMap.has(fileInfo.incidenciaNum)) {
            targetIncidencia = incidenciasMap.get(fileInfo.incidenciaNum);

            const isPDF = path.extname(fileName).toLowerCase() === '.pdf';

            if (isPDF) {
              // Para archivos PDF, buscar comentarios que mencionen presupuesto/valoración
              const comentarioPresupuesto = comentarios?.find(c =>
                c.incidencia_id === targetIncidencia.id &&
                (c.cuerpo?.toLowerCase().includes('presupuesto') ||
                 c.cuerpo?.toLowerCase().includes('valorada') ||
                 c.cuerpo?.toLowerCase().includes('adjuntado'))
              );

              if (comentarioPresupuesto) {
                fileCategory = 'comentario_documento';
                updateTarget = { tipo: 'comentario', id: comentarioPresupuesto.id, campo: 'documento_url' };
                console.log(`  🎯 Match por número en comentario de presupuesto: ${targetIncidencia.num_solicitud}`);
              } else {
                fileCategory = 'presupuesto';
                updateTarget = { tipo: 'incidencia', id: targetIncidencia.id };
                console.log(`  🎯 Match por número: ${targetIncidencia.num_solicitud} (${fileCategory})`);
              }
            } else {
              // Para imágenes, usar como imagen principal si no tiene imagen_url
              if (!targetIncidencia.imagen_url) {
                fileCategory = 'imagen_principal';
                updateTarget = { tipo: 'incidencia', id: targetIncidencia.id };
                console.log(`  🎯 Match por número: ${targetIncidencia.num_solicitud} (${fileCategory})`);
              } else {
                fileCategory = 'imagen_adicional';
                updateTarget = null; // Solo subir, no actualizar DB
                console.log(`  🎯 Match por número: ${targetIncidencia.num_solicitud} (imagen adicional)`);
              }
            }
          }
        }

        if (!targetIncidencia) {
          console.log(`  ⚠️ Sin match encontrado`);
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
          case 'comentario_documento':
            storagePath = `incidencias/${targetIncidencia.num_solicitud}/comentarios/${fileName}`;
            break;
          case 'presupuesto':
            storagePath = `incidencias/${targetIncidencia.num_solicitud}/presupuestos/${fileName}`;
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
          case '.pdf':
            mimeType = 'application/pdf';
            break;
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
            mimeType = 'application/octet-stream';
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
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`❌ Error procesando ${fileName}: ${error.message}`);
        errorCount++;
        processedCount++;
      }
    }

    // 6. Resumen final
    console.log('\n📊 RESUMEN:');
    console.log(`📁 Archivos procesados: ${processedCount}`);
    console.log(`🎯 Archivos con match: ${matchedCount}`);
    console.log(`✅ Archivos subidos: ${uploadedCount}`);
    console.log(`❌ Errores: ${errorCount}`);

    if (errorCount === 0) {
      console.log('\n🎉 ¡Migración completada exitosamente!');
    } else {
      console.log('\n⚠️ Migración completada con algunos errores');
    }

  } catch (error) {
    console.error('❌ Error durante la migración:', error.message);
    process.exit(1);
  }
}

migrateWixAttachments();