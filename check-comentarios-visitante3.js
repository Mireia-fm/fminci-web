require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
const supabaseClient = createClient(supabaseUrl, supabaseKey);

const DOWNLOADS_PATH_3 = '/Users/mireia/Downloads/Cargas del visitante-3';

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

  if (norm1 === norm2) return 100; // Coincidencia exacta

  // Levenshtein distance para similitud parcial
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

async function checkComentariosVisitante3() {
  console.log('🔍 Verificando coincidencias entre visitante-3 y tabla comentarios...\n');

  // Obtener archivos de visitante-3
  const allFiles3 = fs.readdirSync(DOWNLOADS_PATH_3)
    .filter(file => /\.(jpg|jpeg|png|gif|webp|jfif)$/i.test(file));

  console.log(`📁 Archivos en visitante-3: ${allFiles3.length}`);

  // Obtener comentarios con URLs Wix (pendientes)
  const { data: comentariosWix, error: errorWix } = await supabaseClient
    .from('comentarios')
    .select(`
      id,
      incidencia_id,
      imagen_url,
      incidencias!inner(num_solicitud)
    `)
    .like('imagen_url', 'wix%')
    .order('id');

  if (errorWix) {
    console.error('Error obteniendo comentarios Wix:', errorWix);
    return;
  }

  console.log(`🔗 Comentarios con URLs Wix pendientes: ${comentariosWix.length}\n`);

  // Verificar coincidencias
  const coincidenciasExactas = [];
  const coincidenciasAltas = []; // 85%+
  const coincidenciasMedias = []; // 70-84%

  let processedCount = 0;

  for (const comentario of comentariosWix) {
    const wixFileName = extractFileNameFromWixUrl(comentario.imagen_url);
    if (!wixFileName) continue;

    processedCount++;
    process.stdout.write(`\r🔄 Procesando ${processedCount}/${comentariosWix.length}: ${comentario.incidencias.num_solicitud}`);

    const numSolicitud = comentario.incidencias.num_solicitud;

    // Buscar coincidencia exacta primero
    const exactMatch = allFiles3.find(file => file === wixFileName);
    if (exactMatch) {
      coincidenciasExactas.push({
        comentarioId: comentario.id,
        numSolicitud: numSolicitud,
        wixFileName: wixFileName,
        matchedFile: exactMatch,
        wixUrl: comentario.imagen_url,
        similarity: 100,
        tipo: 'exacta'
      });
      continue;
    }

    // Buscar coincidencias por similitud
    let bestMatch = null;
    let bestSimilarity = 0;

    for (const file of allFiles3) {
      const similarity = calculateSimilarity(wixFileName, file);

      if (similarity > bestSimilarity && similarity >= 70) {
        bestSimilarity = similarity;
        bestMatch = file;
      }
    }

    if (bestMatch) {
      const matchData = {
        comentarioId: comentario.id,
        numSolicitud: numSolicitud,
        wixFileName: wixFileName,
        matchedFile: bestMatch,
        wixUrl: comentario.imagen_url,
        similarity: Math.round(bestSimilarity)
      };

      if (bestSimilarity >= 85) {
        matchData.tipo = 'alta';
        coincidenciasAltas.push(matchData);
      } else {
        matchData.tipo = 'media';
        coincidenciasMedias.push(matchData);
      }
    }
  }

  console.log(`\n\n📊 RESULTADOS - COINCIDENCIAS EN VISITANTE-3:`);
  console.log('='.repeat(80));

  // Mostrar coincidencias exactas
  console.log(`\n🎯 COINCIDENCIAS EXACTAS (100%): ${coincidenciasExactas.length}`);
  if (coincidenciasExactas.length > 0) {
    console.log('─'.repeat(80));
    coincidenciasExactas.forEach(match => {
      console.log(`📄 Comentario ${match.comentarioId} (Incidencia ${match.numSolicitud})`);
      console.log(`   🔗 Wix: ${match.wixFileName}`);
      console.log(`   📁 Archivo: ${match.matchedFile}`);
      console.log('');
    });
  }

  // Mostrar coincidencias altas (85%+)
  console.log(`\n🔥 COINCIDENCIAS ALTAS (85%+): ${coincidenciasAltas.length}`);
  if (coincidenciasAltas.length > 0) {
    console.log('─'.repeat(80));
    coincidenciasAltas.slice(0, 10).forEach(match => { // Solo mostrar top 10
      console.log(`📄 Comentario ${match.comentarioId} (Incidencia ${match.numSolicitud}) - ${match.similarity}%`);
      console.log(`   🔗 Wix: ${match.wixFileName}`);
      console.log(`   📁 Archivo: ${match.matchedFile}`);
      console.log('');
    });
    if (coincidenciasAltas.length > 10) {
      console.log(`   ... y ${coincidenciasAltas.length - 10} más`);
    }
  }

  // Mostrar coincidencias medias (70-84%)
  console.log(`\n🟡 COINCIDENCIAS MEDIAS (70-84%): ${coincidenciasMedias.length}`);
  if (coincidenciasMedias.length > 0) {
    console.log('─'.repeat(80));
    coincidenciasMedias.slice(0, 5).forEach(match => { // Solo mostrar top 5
      console.log(`📄 Comentario ${match.comentarioId} (Incidencia ${match.numSolicitud}) - ${match.similarity}%`);
      console.log(`   🔗 Wix: ${match.wixFileName}`);
      console.log(`   📁 Archivo: ${match.matchedFile}`);
      console.log('');
    });
    if (coincidenciasMedias.length > 5) {
      console.log(`   ... y ${coincidenciasMedias.length - 5} más`);
    }
  }

  // Resumen final
  console.log('\n📈 RESUMEN FINAL:');
  console.log('='.repeat(80));
  console.log(`📁 Total archivos visitante-3: ${allFiles3.length}`);
  console.log(`🔗 Comentarios con URLs Wix analizados: ${comentariosWix.length}`);
  console.log(`🎯 Coincidencias exactas (100%): ${coincidenciasExactas.length}`);
  console.log(`🔥 Coincidencias altas (85%+): ${coincidenciasAltas.length}`);
  console.log(`🟡 Coincidencias medias (70-84%): ${coincidenciasMedias.length}`);

  const totalCoincidencias = coincidenciasExactas.length + coincidenciasAltas.length + coincidenciasMedias.length;
  const sinCoincidencias = comentariosWix.length - totalCoincidencias;
  console.log(`❓ Sin coincidencias significativas: ${sinCoincidencias}`);

  return {
    exactas: coincidenciasExactas,
    altas: coincidenciasAltas,
    medias: coincidenciasMedias,
    totalArchivos: allFiles3.length,
    totalComentarios: comentariosWix.length
  };
}

checkComentariosVisitante3().catch(console.error);