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

async function checkComentariosMatches() {
  console.log('🔍 Verificando coincidencias entre visitante-2 y tabla comentarios...\n');

  // Obtener archivos de visitante-2
  const allFiles2 = fs.readdirSync(DOWNLOADS_PATH_2)
    .filter(file => /\.(jpg|jpeg|png|gif|webp|jfif)$/i.test(file));

  console.log(`📁 Archivos en visitante-2: ${allFiles2.length}`);

  // Obtener comentarios con URLs Wix
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

  console.log(`🔗 Comentarios con URLs Wix: ${comentariosWix.length}`);

  // Obtener comentarios ya migrados a Supabase Storage
  const { data: comentariosMigrados, error: errorMigrados } = await supabaseClient
    .from('comentarios')
    .select(`
      id,
      incidencia_id,
      imagen_url,
      incidencias!inner(num_solicitud)
    `)
    .like('imagen_url', 'https://xgdilpgbpkgaltvkdodi.supabase.co/storage%')
    .order('id');

  if (errorMigrados) {
    console.error('Error obteniendo comentarios migrados:', errorMigrados);
    return;
  }

  console.log(`✅ Comentarios ya migrados: ${comentariosMigrados.length}\n`);

  // Verificar coincidencias exactas con archivos de visitante-2
  const coincidenciasExactas = [];
  const coincidenciasParciales = [];

  console.log('📊 ANÁLISIS DE COINCIDENCIAS:');
  console.log('='.repeat(80));

  for (const comentario of comentariosWix) {
    const wixFileName = extractFileNameFromWixUrl(comentario.imagen_url);
    if (!wixFileName) continue;

    const numSolicitud = comentario.incidencias.num_solicitud;

    // Buscar coincidencia exacta
    const exactMatch = allFiles2.find(file => file === wixFileName);
    if (exactMatch) {
      coincidenciasExactas.push({
        comentarioId: comentario.id,
        numSolicitud: numSolicitud,
        wixFileName: wixFileName,
        matchedFile: exactMatch,
        wixUrl: comentario.imagen_url,
        tipo: 'exacta'
      });
      continue;
    }

    // Buscar coincidencia parcial (sin extensión extra)
    const wixWithoutExtraExt = wixFileName.replace(/\.jpg$/, '');
    const partialMatch = allFiles2.find(file =>
      file === wixWithoutExtraExt + '.jpg' ||
      file.replace(/\.jpg$/, '') === wixWithoutExtraExt
    );

    if (partialMatch) {
      coincidenciasParciales.push({
        comentarioId: comentario.id,
        numSolicitud: numSolicitud,
        wixFileName: wixFileName,
        matchedFile: partialMatch,
        wixUrl: comentario.imagen_url,
        tipo: 'parcial'
      });
    }
  }

  // Mostrar resultados
  console.log(`\n🎯 COINCIDENCIAS EXACTAS: ${coincidenciasExactas.length}`);
  if (coincidenciasExactas.length > 0) {
    console.log('─'.repeat(80));
    coincidenciasExactas.forEach(match => {
      console.log(`📄 Comentario ${match.comentarioId} (Incidencia ${match.numSolicitud})`);
      console.log(`   🔗 Wix: ${match.wixFileName}`);
      console.log(`   📁 Archivo: ${match.matchedFile}`);
      console.log('');
    });
  }

  console.log(`\n🔍 COINCIDENCIAS PARCIALES: ${coincidenciasParciales.length}`);
  if (coincidenciasParciales.length > 0) {
    console.log('─'.repeat(80));
    coincidenciasParciales.forEach(match => {
      console.log(`📄 Comentario ${match.comentarioId} (Incidencia ${match.numSolicitud})`);
      console.log(`   🔗 Wix: ${match.wixFileName}`);
      console.log(`   📁 Archivo: ${match.matchedFile}`);
      console.log('');
    });
  }

  // Lista de comentarios ya migrados
  console.log(`\n✅ COMENTARIOS YA MIGRADOS A STORAGE: ${comentariosMigrados.length}`);
  if (comentariosMigrados.length > 0) {
    console.log('─'.repeat(80));
    comentariosMigrados.forEach(comentario => {
      const numSolicitud = comentario.incidencias.num_solicitud;
      const fileName = comentario.imagen_url.split('/').pop();
      console.log(`📄 Comentario ${comentario.id} (Incidencia ${numSolicitud})`);
      console.log(`   📁 Archivo: ${decodeURIComponent(fileName || 'unknown')}`);
      console.log(`   🔗 URL: ${comentario.imagen_url}`);
      console.log('');
    });
  }

  // Resumen final
  console.log('\n📈 RESUMEN FINAL:');
  console.log('='.repeat(80));
  console.log(`📁 Total archivos visitante-2: ${allFiles2.length}`);
  console.log(`🔗 Comentarios con URLs Wix: ${comentariosWix.length}`);
  console.log(`🎯 Coincidencias exactas: ${coincidenciasExactas.length}`);
  console.log(`🔍 Coincidencias parciales: ${coincidenciasParciales.length}`);
  console.log(`✅ Comentarios ya migrados: ${comentariosMigrados.length}`);

  const totalPendientes = comentariosWix.length - coincidenciasExactas.length - coincidenciasParciales.length;
  console.log(`❓ Sin coincidencias: ${totalPendientes}`);

  return {
    exactas: coincidenciasExactas,
    parciales: coincidenciasParciales,
    migrados: comentariosMigrados,
    sinCoincidencias: totalPendientes
  };
}

checkComentariosMatches().catch(console.error);