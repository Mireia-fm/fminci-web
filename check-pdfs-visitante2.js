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
  const normalize = (str) => str.toLowerCase().replace(/[\s\-_()[.\]]/g, '');
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

async function checkPdfsVisitante2() {
  console.log('🔍 Verificando coincidencias de PDFs entre comentarios y visitante-2...\n');

  // 1. Obtener archivos PDF de visitante-2
  const allFilesPdf2 = fs.readdirSync(DOWNLOADS_PATH_2)
    .filter(file => /\.pdf$/i.test(file));

  console.log(`📁 Archivos PDF en visitante-2: ${allFilesPdf2.length}`);

  // 2. Obtener comentarios con documento_url que contengan URLs Wix
  const { data: comentariosPdf, error } = await supabaseClient
    .from('comentarios')
    .select(`
      id,
      documento_url,
      autor_email,
      creado_en,
      cuerpo,
      incidencias!inner(num_solicitud)
    `)
    .like('documento_url', 'wix:document%')
    .order('creado_en');

  if (error) {
    console.error('Error obteniendo comentarios PDF:', error);
    return;
  }

  console.log(`🔗 Comentarios con PDFs Wix: ${comentariosPdf.length}\n`);

  // 3. Buscar coincidencias
  const coincidenciasExactas = [];
  const coincidenciasAltas = []; // 80%+
  const coincidenciasMedias = []; // 60-79%

  for (const comentario of comentariosPdf) {
    const wixFileName = extractFileNameFromWixUrl(comentario.documento_url);
    if (!wixFileName) continue;

    console.log(`🔄 Procesando: ${comentario.incidencias.num_solicitud} - ${wixFileName}`);

    // Buscar coincidencia exacta
    const exactMatch = allFilesPdf2.find(file => file === wixFileName);
    if (exactMatch) {
      coincidenciasExactas.push({
        comentarioId: comentario.id,
        numSolicitud: comentario.incidencias.num_solicitud,
        wixFileName: wixFileName,
        matchedFile: exactMatch,
        wixUrl: comentario.documento_url,
        similarity: 100,
        tipo: 'exacta',
        autor: comentario.autor_email,
        fecha: comentario.creado_en
      });
      continue;
    }

    // Buscar por similitud
    let bestMatch = null;
    let bestSimilarity = 0;

    for (const file of allFilesPdf2) {
      const similarity = calculateSimilarity(wixFileName, file);

      if (similarity > bestSimilarity && similarity >= 60) {
        bestSimilarity = similarity;
        bestMatch = file;
      }
    }

    if (bestMatch) {
      const matchData = {
        comentarioId: comentario.id,
        numSolicitud: comentario.incidencias.num_solicitud,
        wixFileName: wixFileName,
        matchedFile: bestMatch,
        wixUrl: comentario.documento_url,
        similarity: Math.round(bestSimilarity),
        autor: comentario.autor_email,
        fecha: comentario.creado_en
      };

      if (bestSimilarity >= 80) {
        matchData.tipo = 'alta';
        coincidenciasAltas.push(matchData);
      } else {
        matchData.tipo = 'media';
        coincidenciasMedias.push(matchData);
      }
    }
  }

  console.log(`\n📊 RESULTADOS - COINCIDENCIAS DE PDFs EN VISITANTE-2:`);
  console.log('='.repeat(80));

  // Mostrar coincidencias exactas
  console.log(`\n🎯 COINCIDENCIAS EXACTAS (100%): ${coincidenciasExactas.length}`);
  if (coincidenciasExactas.length > 0) {
    console.log('─'.repeat(80));
    coincidenciasExactas.forEach(match => {
      console.log(`📄 Comentario ${match.comentarioId} (Incidencia ${match.numSolicitud})`);
      console.log(`   🔗 Wix: ${match.wixFileName}`);
      console.log(`   📁 Archivo: ${match.matchedFile}`);
      console.log(`   👤 Autor: ${match.autor}`);
      console.log(`   📅 Fecha: ${new Date(match.fecha).toLocaleDateString()}`);
      console.log('');
    });
  }

  // Mostrar coincidencias altas (80%+)
  console.log(`\n🔥 COINCIDENCIAS ALTAS (80%+): ${coincidenciasAltas.length}`);
  if (coincidenciasAltas.length > 0) {
    console.log('─'.repeat(80));
    coincidenciasAltas.slice(0, 10).forEach(match => {
      console.log(`📄 Comentario ${match.comentarioId} (Incidencia ${match.numSolicitud}) - ${match.similarity}%`);
      console.log(`   🔗 Wix: ${match.wixFileName}`);
      console.log(`   📁 Archivo: ${match.matchedFile}`);
      console.log(`   👤 Autor: ${match.autor}`);
      console.log('');
    });
    if (coincidenciasAltas.length > 10) {
      console.log(`   ... y ${coincidenciasAltas.length - 10} más`);
    }
  }

  // Mostrar coincidencias medias (60-79%)
  console.log(`\n🟡 COINCIDENCIAS MEDIAS (60-79%): ${coincidenciasMedias.length}`);
  if (coincidenciasMedias.length > 0) {
    console.log('─'.repeat(80));
    coincidenciasMedias.slice(0, 5).forEach(match => {
      console.log(`📄 Comentario ${match.comentarioId} (Incidencia ${match.numSolicitud}) - ${match.similarity}%`);
      console.log(`   🔗 Wix: ${match.wixFileName}`);
      console.log(`   📁 Archivo: ${match.matchedFile}`);
      console.log(`   👤 Autor: ${match.autor}`);
      console.log('');
    });
    if (coincidenciasMedias.length > 5) {
      console.log(`   ... y ${coincidenciasMedias.length - 5} más`);
    }
  }

  // Resumen final
  console.log('\n📈 RESUMEN FINAL:');
  console.log('='.repeat(80));
  console.log(`📁 Total archivos PDF visitante-2: ${allFilesPdf2.length}`);
  console.log(`🔗 Comentarios con PDFs Wix analizados: ${comentariosPdf.length}`);
  console.log(`🎯 Coincidencias exactas (100%): ${coincidenciasExactas.length}`);
  console.log(`🔥 Coincidencias altas (80%+): ${coincidenciasAltas.length}`);
  console.log(`🟡 Coincidencias medias (60-79%): ${coincidenciasMedias.length}`);

  const totalCoincidencias = coincidenciasExactas.length + coincidenciasAltas.length + coincidenciasMedias.length;
  const sinCoincidencias = comentariosPdf.length - totalCoincidencias;
  console.log(`❓ Sin coincidencias significativas: ${sinCoincidencias}`);

  return {
    exactas: coincidenciasExactas,
    altas: coincidenciasAltas,
    medias: coincidenciasMedias,
    totalArchivos: allFilesPdf2.length,
    totalComentarios: comentariosPdf.length
  };
}

checkPdfsVisitante2().catch(console.error);