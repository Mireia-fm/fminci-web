require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
const supabaseClient = createClient(supabaseUrl, supabaseKey);

const DOWNLOADS_PATH_2 = '/Users/mireia/Downloads/Cargas del visitante-2';

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

function calculateSimilarity(str1, str2) {
  // Normalizar strings: quitar espacios, convertir a minúsculas
  const normalize = (str) => str.toLowerCase().replace(/[\s\-_()[\]]/g, '');

  const norm1 = normalize(str1);
  const norm2 = normalize(str2);

  // Levenshtein distance
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
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  const maxLength = Math.max(norm1.length, norm2.length);
  const distance = matrix[norm1.length][norm2.length];
  const similarity = ((maxLength - distance) / maxLength) * 100;

  return Math.max(0, similarity);
}

function findCommonSubstrings(str1, str2) {
  const normalize = (str) => str.toLowerCase().replace(/[\s\-_()[\]]/g, '');
  const norm1 = normalize(str1);
  const norm2 = normalize(str2);

  const commonSubstrings = [];

  // Buscar subcadenas comunes de al menos 4 caracteres
  for (let i = 0; i < norm1.length - 3; i++) {
    for (let len = 4; len <= norm1.length - i; len++) {
      const substring = norm1.substring(i, i + len);
      if (norm2.includes(substring) && !commonSubstrings.includes(substring)) {
        commonSubstrings.push(substring);
      }
    }
  }

  // Ordenar por longitud descendente
  return commonSubstrings.sort((a, b) => b.length - a.length);
}

async function find80PercentMatches() {
  console.log('🔍 Buscando coincidencias con 80%+ similitud...\n');

  // Obtener archivos de visitante-2
  const allFiles2 = fs.readdirSync(DOWNLOADS_PATH_2)
    .filter(file => /\.(jpg|jpeg|png|gif|webp|jfif)$/i.test(file));

  console.log(`📁 Archivos en visitante-2: ${allFiles2.length}`);

  // Obtener URLs Wix pendientes
  const { data: wixUrls, error } = await supabaseClient
    .from('incidencias')
    .select('num_solicitud, imagen_url')
    .like('imagen_url', 'wix%')
    .order('num_solicitud');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`🔗 URLs Wix pendientes: ${wixUrls.length}\n`);

  const highSimilarityMatches = [];
  let processedCount = 0;

  for (const { num_solicitud, imagen_url } of wixUrls) {
    const wixFileName = extractFileNameFromWixUrl(imagen_url);
    if (!wixFileName) continue;

    processedCount++;
    process.stdout.write(`\r🔄 Procesando ${processedCount}/${wixUrls.length}: ${num_solicitud}`);

    for (const file of allFiles2) {
      const similarity = calculateSimilarity(wixFileName, file);

      if (similarity >= 80) {
        const commonParts = findCommonSubstrings(wixFileName, file);

        highSimilarityMatches.push({
          numSolicitud: num_solicitud,
          wixFileName: wixFileName,
          matchedFile: file,
          similarity: Math.round(similarity),
          commonParts: commonParts.slice(0, 3) // Top 3 partes comunes
        });
      }
    }
  }

  console.log(`\n\n📊 RESULTADOS - COINCIDENCIAS 80%+:`);
  console.log(`✅ Archivos con coincidencias 80%+: ${highSimilarityMatches.length}`);
  console.log('='.repeat(90));

  // Mostrar resultados ordenados por similitud
  highSimilarityMatches
    .sort((a, b) => b.similarity - a.similarity)
    .forEach(match => {
      console.log(`\n🎯 ${match.numSolicitud} - Similitud: ${match.similarity}%`);
      console.log(`   📄 Wix: ${match.wixFileName}`);
      console.log(`   📁 Archivo: ${match.matchedFile}`);
      if (match.commonParts.length > 0) {
        console.log(`   🔗 Partes comunes: ${match.commonParts.join(', ')}`);
      }
    });

  if (highSimilarityMatches.length === 0) {
    console.log('\n❌ No se encontraron coincidencias con 80%+ de similitud');
    console.log('🔍 Probando con umbral del 70%...\n');

    // Probar con 70%
    const mediumSimilarityMatches = [];

    for (const { num_solicitud, imagen_url } of wixUrls.slice(0, 20)) { // Solo primeros 20 para prueba
      const wixFileName = extractFileNameFromWixUrl(imagen_url);
      if (!wixFileName) continue;

      for (const file of allFiles2) {
        const similarity = calculateSimilarity(wixFileName, file);

        if (similarity >= 70) {
          const commonParts = findCommonSubstrings(wixFileName, file);

          mediumSimilarityMatches.push({
            numSolicitud: num_solicitud,
            wixFileName: wixFileName,
            matchedFile: file,
            similarity: Math.round(similarity),
            commonParts: commonParts.slice(0, 3)
          });
        }
      }
    }

    console.log(`📊 COINCIDENCIAS 70%+ (muestra de 20 incidencias):`);
    mediumSimilarityMatches
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 10) // Top 10
      .forEach(match => {
        console.log(`\n🎯 ${match.numSolicitud} - Similitud: ${match.similarity}%`);
        console.log(`   📄 Wix: ${match.wixFileName}`);
        console.log(`   📁 Archivo: ${match.matchedFile}`);
        if (match.commonParts.length > 0) {
          console.log(`   🔗 Partes comunes: ${match.commonParts.join(', ')}`);
        }
      });
  }

  console.log(`\n📈 ESTADÍSTICAS:`);
  console.log(`- Coincidencias 80%+: ${highSimilarityMatches.length}`);
  console.log(`- Total analizado: ${wixUrls.length} URLs Wix`);

  return highSimilarityMatches;
}

find80PercentMatches().catch(console.error);