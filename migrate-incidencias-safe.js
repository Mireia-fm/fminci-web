require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
const supabaseClient = createClient(supabaseUrl, supabaseKey);

const DOWNLOADS_PATH_3 = '/Users/mireia/Downloads/Cargas del visitante-3';
const BUCKET_NAME = 'incidencias';
const BATCH_SIZE = 10;

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
  // Limpiar caracteres especiales para Storage
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

async function uploadFileToStorage(filePath, originalFileName, numSolicitud) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const contentType = getContentType(originalFileName);

    // Sanitizar el nombre para Storage
    const sanitizedName = sanitizeFileName(originalFileName);
    const storagePath = `${numSolicitud}/${sanitizedName}`;

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
    console.error(`❌ Error en uploadFileToStorage:`, error);
    return null;
  }
}

function calculateSimilarity(str1, str2) {
  const normalize = (str) => str.toLowerCase().replace(/[\s\-_()[\]]/g, '');
  const norm1 = normalize(str1);
  const norm2 = normalize(str2);

  if (norm1 === norm2) return 100;

  const matrix = [];
  for (let i = 0; i <= norm1.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= norm2.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= norm1.length; i++) {
    for (let j = 1; j <= norm2.length; j++) {
      if (norm1.charAt(i - 1) === norm2.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  const maxLength = Math.max(norm1.length, norm2.length);
  const distance = matrix[norm1.length][norm2.length];
  const similarity = ((maxLength - distance) / maxLength) * 100;

  return Math.max(0, similarity);
}

async function findIncidenciasMatches() {
  console.log('🔍 Encontrando incidencias con coincidencias en visitante-3...');

  const allFiles3 = fs.readdirSync(DOWNLOADS_PATH_3)
    .filter(file => /\.(jpg|jpeg|png|gif|webp|jfif)$/i.test(file));

  const { data: incidenciasWix, error } = await supabaseClient
    .from('incidencias')
    .select('num_solicitud, imagen_url')
    .like('imagen_url', 'wix%')
    .order('num_solicitud');

  if (error) {
    console.error('Error obteniendo incidencias Wix:', error);
    return { exactMatches: [], highMatches: [] };
  }

  const exactMatches = [];
  const highMatches = [];
  const specialCharFiles = [
    'Sujección cables caido 1.jpg',
    '20250520_161144[1].jpg',
    '20250516_110924[1].jpg',
    'IMG_20250713_194458~2.jpg',
    'Calefacció 20250414_114705.jpg',
    'Sòcol ping pong 20250430_101555.jpg',
    '20250618_110529[1].jpg',
    '20250417_105858[1].jpg',
    '20250424_113048[1].jpg',
    '20250715_194312[1].jpg',
    '20250619_171143[1].jpg',
    '20250502_103554[1].jpg',
    '20250415_103544[1].jpg',
    '20250430_161302[1].jpg'
  ];

  for (const incidencia of incidenciasWix) {
    const wixFileName = extractFileNameFromWixUrl(incidencia.imagen_url);
    if (!wixFileName) continue;

    // Buscar coincidencia exacta
    const exactMatch = allFiles3.find(file => file === wixFileName);
    if (exactMatch) {
      const hasSpecialChars = specialCharFiles.includes(wixFileName);
      exactMatches.push({
        numSolicitud: incidencia.num_solicitud,
        originalFileName: wixFileName,
        fileName: exactMatch,
        wixUrl: incidencia.imagen_url,
        hasSpecialChars,
        sanitizedName: sanitizeFileName(wixFileName)
      });
    } else {
      // Buscar coincidencias con alta similitud para archivos especiales
      let bestMatch = null;
      let bestSimilarity = 0;

      for (const file of allFiles3) {
        const similarity = calculateSimilarity(wixFileName, file);
        if (similarity >= 80 && similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestMatch = file;
        }
      }

      if (bestMatch) {
        highMatches.push({
          numSolicitud: incidencia.num_solicitud,
          originalFileName: wixFileName,
          fileName: bestMatch,
          wixUrl: incidencia.imagen_url,
          similarity: Math.round(bestSimilarity),
          sanitizedName: sanitizeFileName(bestMatch)
        });
      }
    }
  }

  console.log(`✅ Coincidencias exactas: ${exactMatches.length}`);
  console.log(`🔥 Coincidencias 80%+: ${highMatches.length}`);

  return { exactMatches, highMatches };
}

async function migrateBatch(matches, batchIndex, totalBatches, type) {
  console.log(`\n📦 LOTE ${batchIndex}/${totalBatches} - ${type} (${matches.length} archivos)`);
  console.log('─'.repeat(60));

  const results = [];
  const sqlCommands = [];

  for (const [itemIndex, match] of matches.entries()) {
    const globalIndex = (batchIndex - 1) * BATCH_SIZE + itemIndex + 1;

    console.log(`\n🔄 [${globalIndex}] ${match.numSolicitud} - ${match.originalFileName}`);
    if (match.hasSpecialChars) {
      console.log(`   ⚠️  Archivo con caracteres especiales -> ${match.sanitizedName}`);
    }

    try {
      const filePath = path.join(DOWNLOADS_PATH_3, match.fileName);
      if (!fs.existsSync(filePath)) {
        console.log(`❌ Archivo no encontrado`);
        results.push({ ...match, status: 'file_not_found' });
        continue;
      }

      // Subir archivo con nombre sanitizado
      const newUrl = await uploadFileToStorage(filePath, match.originalFileName, match.numSolicitud);
      if (!newUrl) {
        console.log(`❌ Error en subida`);
        results.push({ ...match, status: 'upload_failed' });
        continue;
      }

      console.log(`✅ Subido a Storage`);

      // Generar comando SQL
      const sqlCommand = `UPDATE incidencias SET imagen_url = '${newUrl}' WHERE num_solicitud = '${match.numSolicitud}';`;
      sqlCommands.push(sqlCommand);

      results.push({
        ...match,
        newUrl,
        status: 'uploaded',
        sqlCommand
      });

      await new Promise(resolve => setTimeout(resolve, 500));

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
  console.log('🎯 MIGRACIÓN SEGURA DE INCIDENCIAS - SUBIDA + SQL');
  console.log('Estrategia: 1) Subir archivos, 2) Generar SQL para MCP');
  console.log('='.repeat(70));

  try {
    // 1. Encontrar coincidencias
    const { exactMatches, highMatches } = await findIncidenciasMatches();

    if (exactMatches.length === 0 && highMatches.length === 0) {
      console.log('❌ No se encontraron coincidencias');
      return;
    }

    // 2. Mostrar archivos con caracteres especiales y sus coincidencias
    console.log('\n🔧 ANÁLISIS DE ARCHIVOS CON CARACTERES ESPECIALES:');
    console.log('='.repeat(70));

    const specialCharExact = exactMatches.filter(m => m.hasSpecialChars);
    console.log(`📄 Exactas con caracteres especiales: ${specialCharExact.length}`);
    specialCharExact.forEach(match => {
      console.log(`   ${match.numSolicitud}: ${match.originalFileName} -> ${match.sanitizedName}`);
    });

    if (highMatches.length > 0) {
      console.log(`\n🔥 Coincidencias 80%+ (archivos con caracteres especiales):`);
      highMatches.forEach(match => {
        console.log(`   ${match.numSolicitud} (${match.similarity}%): ${match.originalFileName} -> ${match.fileName}`);
      });
    }

    // 3. Migrar exactas
    const allResults = [];
    const allSqlCommands = [];

    if (exactMatches.length > 0) {
      console.log(`\n🚀 Migrando ${exactMatches.length} coincidencias exactas...`);

      const batches = [];
      for (let i = 0; i < exactMatches.length; i += BATCH_SIZE) {
        batches.push(exactMatches.slice(i, i + BATCH_SIZE));
      }

      for (let i = 0; i < batches.length; i++) {
        const { results, sqlCommands } = await migrateBatch(batches[i], i + 1, batches.length, 'EXACTAS');
        allResults.push(...results);
        allSqlCommands.push(...sqlCommands);

        if (i < batches.length - 1) {
          console.log('\n⏳ Esperando 3 segundos...');
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    }

    // 4. Migrar coincidencias altas (opcional)
    if (highMatches.length > 0 && highMatches.length <= 10) {
      console.log(`\n🔥 Migrando ${highMatches.length} coincidencias 80%+...`);

      const { results, sqlCommands } = await migrateBatch(highMatches, 1, 1, 'ALTA SIMILITUD');
      allResults.push(...results);
      allSqlCommands.push(...sqlCommands);
    }

    // 5. Mostrar comandos SQL
    const successful = allResults.filter(r => r.status === 'uploaded');
    const failed = allResults.filter(r => r.status !== 'uploaded');

    console.log('\n' + '='.repeat(70));
    console.log('📊 RESUMEN FINAL:');
    console.log('='.repeat(70));
    console.log(`✅ Archivos subidos: ${successful.length}`);
    console.log(`❌ Errores: ${failed.length}`);
    console.log(`📋 Total procesados: ${allResults.length}`);

    if (allSqlCommands.length > 0) {
      console.log('\n📜 COMANDOS SQL PARA EJECUTAR EN MCP:');
      console.log('='.repeat(70));

      // Dividir en lotes de 15
      const sqlBatches = [];
      for (let i = 0; i < allSqlCommands.length; i += 15) {
        sqlBatches.push(allSqlCommands.slice(i, i + 15));
      }

      sqlBatches.forEach((batch, index) => {
        console.log(`\n-- LOTE SQL ${index + 1}/${sqlBatches.length}:`);
        batch.forEach(cmd => console.log(cmd));
      });
    }

    // 6. Guardar SQL en archivo
    if (allSqlCommands.length > 0) {
      fs.writeFileSync('./incidencias-sql-commands.sql', allSqlCommands.join('\n'));
      console.log(`\n💾 Comandos SQL guardados en: ./incidencias-sql-commands.sql`);
    }

    return {
      uploaded: successful.length,
      failed: failed.length,
      sqlCommands: allSqlCommands.length,
      specialCharFiles: specialCharExact.length
    };

  } catch (error) {
    console.error('❌ Error en migración:', error);
    throw error;
  }
}

main().catch(console.error);