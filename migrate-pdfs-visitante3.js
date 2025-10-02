require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
const supabaseClient = createClient(supabaseUrl, supabaseKey);

const DOWNLOADS_PATH_3 = '/Users/mireia/Downloads/Cargas del visitante-3';
const BUCKET_NAME = 'incidencias';
const BATCH_SIZE = 15; // Lotes más grandes para más eficiencia

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

function sanitizeFileName(fileName) {
  return fileName
    .replace(/\[(\d+)\]/g, '_$1_') // [1] -> _1_
    .replace(/[àáâäå]/g, 'a')      // acentos
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[ç]/g, 'c')
    .replace(/[ñ]/g, 'n')
    .replace(/~/g, '_')             // ~ -> _
    .replace(/\s+/g, '_')           // espacios -> _
    .replace(/[^a-zA-Z0-9._-]/g, '_') // otros caracteres especiales
    .replace(/_+/g, '_')            // múltiples _ -> uno solo
    .replace(/^_|_$/g, '');         // quitar _ del inicio/final
}

async function uploadPdfToStorage(filePath, originalFileName, numSolicitud) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const contentType = 'application/pdf';

    // Estructura para comentarios: incidencias/{num_solicitud}/comentarios/{archivo}
    const sanitizedName = sanitizeFileName(originalFileName);
    const storagePath = `${numSolicitud}/comentarios/${sanitizedName}`;

    const { data, error } = await supabaseClient.storage
      .from(BUCKET_NAME)
      .upload(storagePath, fileBuffer, {
        contentType: contentType,
        upsert: true
      });

    if (error) {
      console.error(`❌ Error subiendo ${originalFileName}:`, error);
      return null;
    }

    const { data: publicUrlData } = supabaseClient.storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath);

    return publicUrlData.publicUrl;
  } catch (error) {
    console.error(`❌ Error en uploadPdfToStorage:`, error);
    return null;
  }
}

async function findPdfExactMatches() {
  console.log('🔍 Encontrando PDFs con coincidencias exactas en visitante-3...');

  // Obtener archivos PDF de visitante-3
  const allPdfFiles3 = fs.readdirSync(DOWNLOADS_PATH_3)
    .filter(file => /\.pdf$/i.test(file));

  // Obtener comentarios con documento_url que contengan URLs Wix (excluir los ya migrados)
  const { data: comentariosPdf, error } = await supabaseClient
    .from('comentarios')
    .select(`
      id,
      documento_url,
      autor_email,
      creado_en,
      incidencias!inner(num_solicitud)
    `)
    .like('documento_url', 'wix:document%')
    .order('creado_en');

  if (error) {
    console.error('Error obteniendo comentarios PDF:', error);
    return [];
  }

  const exactMatches = [];

  for (const comentario of comentariosPdf) {
    const wixFileName = extractFileNameFromWixUrl(comentario.documento_url);
    if (!wixFileName) continue;

    const exactMatch = allPdfFiles3.find(file => file === wixFileName);
    if (exactMatch) {
      exactMatches.push({
        comentarioId: comentario.id,
        numSolicitud: comentario.incidencias.num_solicitud,
        fileName: exactMatch,
        originalFileName: wixFileName,
        wixUrl: comentario.documento_url,
        autor: comentario.autor_email,
        fecha: comentario.creado_en,
        sanitizedName: sanitizeFileName(wixFileName)
      });
    }
  }

  console.log(`✅ Encontradas ${exactMatches.length} PDFs con coincidencias exactas`);
  return exactMatches;
}

async function migratePdfBatch(matches, batchIndex, totalBatches) {
  console.log(`\n📦 LOTE ${batchIndex}/${totalBatches} (${matches.length} PDFs)`);
  console.log('─'.repeat(70));

  const results = [];
  const sqlCommands = [];

  for (const [itemIndex, match] of matches.entries()) {
    const globalIndex = (batchIndex - 1) * BATCH_SIZE + itemIndex + 1;

    console.log(`\n🔄 [${globalIndex}/${totalBatches * BATCH_SIZE}] Comentario ${match.comentarioId} (${match.numSolicitud})`);
    console.log(`   📄 PDF: ${match.originalFileName.substring(0, 60)}...`);
    if (match.originalFileName !== match.sanitizedName) {
      console.log(`   ⚠️  Sanitizado: ${match.sanitizedName.substring(0, 60)}...`);
    }

    try {
      // Verificar archivo
      const filePath = path.join(DOWNLOADS_PATH_3, match.fileName);
      if (!fs.existsSync(filePath)) {
        console.log(`❌ Archivo no encontrado`);
        results.push({ ...match, status: 'file_not_found' });
        continue;
      }

      // Subir a Storage
      const newUrl = await uploadPdfToStorage(filePath, match.originalFileName, match.numSolicitud);
      if (!newUrl) {
        console.log(`❌ Error en subida`);
        results.push({ ...match, status: 'upload_failed' });
        continue;
      }

      console.log(`✅ Subido a Storage`);

      // Generar comando SQL
      const sqlCommand = `UPDATE comentarios SET documento_url = '${newUrl}' WHERE id = '${match.comentarioId}';`;
      sqlCommands.push(sqlCommand);

      results.push({
        ...match,
        newUrl,
        status: 'uploaded',
        sqlCommand
      });

      // Pausa breve entre archivos
      await new Promise(resolve => setTimeout(resolve, 200));

    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      results.push({ ...match, status: 'error', error: error.message });
    }
  }

  const successful = results.filter(r => r.status === 'uploaded').length;
  const failed = results.length - successful;
  console.log(`\n📊 Lote ${batchIndex}: ✅${successful} ❌${failed}`);

  return { results, sqlCommands };
}

async function main() {
  console.log('📄 MIGRACIÓN DE PDFs VISITANTE-3 - COINCIDENCIAS EXACTAS');
  console.log('Estructura: incidencias/{num_solicitud}/comentarios/{archivo.pdf}');
  console.log('='.repeat(70));

  try {
    // 1. Encontrar coincidencias exactas
    const exactMatches = await findPdfExactMatches();

    if (exactMatches.length === 0) {
      console.log('❌ No se encontraron PDFs con coincidencias exactas');
      return;
    }

    // 2. Mostrar resumen inicial
    console.log(`\n📊 RESUMEN INICIAL:`);
    console.log(`📄 Total PDFs a migrar: ${exactMatches.length}`);

    const specialCharPdfs = exactMatches.filter(m => m.originalFileName !== m.sanitizedName);
    console.log(`⚠️  PDFs con caracteres especiales: ${specialCharPdfs.length}`);

    if (specialCharPdfs.length > 0) {
      console.log(`\n🔧 ARCHIVOS CON SANITIZACIÓN (primeros 10):`);
      specialCharPdfs.slice(0, 10).forEach(match => {
        console.log(`   ${match.originalFileName.substring(0, 40)}...`);
        console.log(`   -> ${match.sanitizedName.substring(0, 40)}...`);
      });
      if (specialCharPdfs.length > 10) {
        console.log(`   ... y ${specialCharPdfs.length - 10} más`);
      }
    }

    // 3. Dividir en lotes
    const batches = [];
    for (let i = 0; i < exactMatches.length; i += BATCH_SIZE) {
      batches.push(exactMatches.slice(i, i + BATCH_SIZE));
    }

    console.log(`\n🚀 Iniciando migración en ${batches.length} lotes de ${BATCH_SIZE} archivos`);

    // 4. Procesar lotes
    const allResults = [];
    const allSqlCommands = [];

    for (let i = 0; i < batches.length; i++) {
      const { results, sqlCommands } = await migratePdfBatch(batches[i], i + 1, batches.length);
      allResults.push(...results);
      allSqlCommands.push(...sqlCommands);

      // Pausa entre lotes
      if (i < batches.length - 1) {
        console.log('\n⏳ Esperando 2 segundos antes del siguiente lote...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // 5. Resumen final
    const successful = allResults.filter(r => r.status === 'uploaded');
    const failed = allResults.filter(r => r.status !== 'uploaded');

    console.log('\n' + '='.repeat(70));
    console.log('📊 RESUMEN FINAL:');
    console.log('='.repeat(70));
    console.log(`✅ PDFs subidos exitosamente: ${successful.length}`);
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

      // Mostrar algunos archivos con error
      console.log('\n❌ PRIMEROS 5 ERRORES:');
      failed.slice(0, 5).forEach(item => {
        console.log(`   ${item.numSolicitud}: ${item.originalFileName} - ${item.status}`);
      });
    }

    if (allSqlCommands.length > 0) {
      console.log('\n📜 COMANDOS SQL PARA EJECUTAR EN MCP:');
      console.log('='.repeat(70));
      console.log(`Total comandos: ${allSqlCommands.length}`);
      console.log('Los comandos se ejecutarán directamente...');
    }

    // 6. Ejecutar comandos SQL directamente (en lotes de 50)
    if (allSqlCommands.length > 0) {
      console.log('\n🔄 Ejecutando comandos SQL...');

      const sqlBatches = [];
      for (let i = 0; i < allSqlCommands.length; i += 50) {
        sqlBatches.push(allSqlCommands.slice(i, i + 50));
      }

      let totalUpdated = 0;
      for (let i = 0; i < sqlBatches.length; i++) {
        const batch = sqlBatches[i];
        console.log(`\n📦 Ejecutando lote SQL ${i + 1}/${sqlBatches.length} (${batch.length} comandos)`);

        const combinedSql = batch.join('\n');
        try {
          // Usar MCP para ejecutar SQL
          const { data, error } = await supabaseClient.rpc('exec_sql', { sql: combinedSql });

          if (error) {
            console.error(`❌ Error ejecutando lote SQL ${i + 1}:`, error);
          } else {
            totalUpdated += batch.length;
            console.log(`✅ Lote SQL ${i + 1} ejecutado correctamente`);
          }
        } catch (error) {
          console.error(`❌ Error en lote SQL ${i + 1}:`, error.message);
        }

        // Pausa entre lotes SQL
        if (i < sqlBatches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`\n📊 Total comandos SQL ejecutados: ${totalUpdated}/${allSqlCommands.length}`);
    }

    // 7. Guardar SQL en archivo por si acaso
    if (allSqlCommands.length > 0) {
      fs.writeFileSync('./pdfs-visitante3-sql-commands.sql', allSqlCommands.join('\n'));
      console.log(`\n💾 Comandos SQL guardados en: ./pdfs-visitante3-sql-commands.sql`);
    }

    console.log('\n📈 MIGRACIÓN VISITANTE-3 COMPLETADA:');
    console.log(`📄 PDFs migrados: ${successful.length}/${exactMatches.length}`);
    console.log(`🗂️ Estructura: incidencias/{num_solicitud}/comentarios/{archivo.pdf}`);
    console.log(`📋 SQL commands: ${allSqlCommands.length}`);
    console.log(`🔧 Archivos sanitizados: ${specialCharPdfs.length}`);

    return {
      uploaded: successful.length,
      failed: failed.length,
      sqlCommands: allSqlCommands.length,
      specialCharFiles: specialCharPdfs.length,
      totalExpected: exactMatches.length
    };

  } catch (error) {
    console.error('❌ Error en migración de PDFs visitante-3:', error);
    throw error;
  }
}

main().catch(console.error);