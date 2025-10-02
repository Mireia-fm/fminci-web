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

async function checkUnmigratedFiles() {
  console.log('🔍 Verificando archivos no migrados de visitante-3...\n');

  // 1. Obtener todos los archivos de visitante-3
  const allFiles3 = fs.readdirSync(DOWNLOADS_PATH_3)
    .filter(file => /\.(jpg|jpeg|png|gif|webp|jfif)$/i.test(file));

  console.log(`📁 Total archivos imagen en visitante-3: ${allFiles3.length}`);

  // 2. Obtener archivos ya migrados desde incidencias (URLs Supabase)
  const { data: incidenciasMigradas, error: errorIncidencias } = await supabaseClient
    .from('incidencias')
    .select('num_solicitud, imagen_url')
    .like('imagen_url', 'https://xgdilpgbpkgaltvkdodi.supabase.co/storage%')
    .order('num_solicitud');

  if (errorIncidencias) {
    console.error('Error obteniendo incidencias migradas:', errorIncidencias);
    return;
  }

  // 3. Obtener archivos ya migrados desde comentarios (URLs Supabase)
  const { data: comentariosMigrados, error: errorComentarios } = await supabaseClient
    .from('comentarios')
    .select('id, imagen_url, incidencias!inner(num_solicitud)')
    .like('imagen_url', 'https://xgdilpgbpkgaltvkdodi.supabase.co/storage%')
    .order('id');

  if (errorComentarios) {
    console.error('Error obteniendo comentarios migrados:', errorComentarios);
    return;
  }

  console.log(`🔗 Incidencias migradas a Supabase: ${incidenciasMigradas.length}`);
  console.log(`💬 Comentarios migrados a Supabase: ${comentariosMigrados.length}`);

  // 4. Extraer nombres de archivos migrados
  const archivosMigradosIncidencias = new Set();
  incidenciasMigradas.forEach(item => {
    try {
      const url = item.imagen_url;
      const parts = url.split('/');
      const fileName = decodeURIComponent(parts[parts.length - 1]);
      archivosMigradosIncidencias.add(fileName);
    } catch (error) {
      // Ignorar errores de parsing
    }
  });

  const archivosMigradosComentarios = new Set();
  comentariosMigrados.forEach(item => {
    try {
      const url = item.imagen_url;
      const parts = url.split('/');
      const fileName = decodeURIComponent(parts[parts.length - 1]);
      archivosMigradosComentarios.add(fileName);
    } catch (error) {
      // Ignorar errores de parsing
    }
  });

  const todosMigrados = new Set([...archivosMigradosIncidencias, ...archivosMigradosComentarios]);

  console.log(`📋 Archivos únicos migrados de incidencias: ${archivosMigradosIncidencias.size}`);
  console.log(`💬 Archivos únicos migrados de comentarios: ${archivosMigradosComentarios.size}`);
  console.log(`🎯 Total archivos únicos migrados: ${todosMigrados.size}\n`);

  // 5. Identificar archivos no migrados
  const archivosNoMigrados = allFiles3.filter(archivo => !todosMigrados.has(archivo));

  // 6. Verificar si algunos de los no migrados tienen coincidencias con URLs Wix pendientes
  const { data: incidenciasWix } = await supabaseClient
    .from('incidencias')
    .select('num_solicitud, imagen_url')
    .like('imagen_url', 'wix%');

  const { data: comentariosWix } = await supabaseClient
    .from('comentarios')
    .select('id, imagen_url, incidencias!inner(num_solicitud)')
    .like('imagen_url', 'wix%');

  // Buscar coincidencias con URLs Wix pendientes
  const coincidenciasIncidencias = [];
  const coincidenciasComentarios = [];

  if (incidenciasWix) {
    for (const item of incidenciasWix) {
      const wixFileName = extractFileNameFromWixUrl(item.imagen_url);
      if (wixFileName && archivosNoMigrados.includes(wixFileName)) {
        coincidenciasIncidencias.push({
          numSolicitud: item.num_solicitud,
          fileName: wixFileName,
          tipo: 'incidencia'
        });
      }
    }
  }

  if (comentariosWix) {
    for (const item of comentariosWix) {
      const wixFileName = extractFileNameFromWixUrl(item.imagen_url);
      if (wixFileName && archivosNoMigrados.includes(wixFileName)) {
        coincidenciasComentarios.push({
          numSolicitud: item.incidencias.num_solicitud,
          comentarioId: item.id,
          fileName: wixFileName,
          tipo: 'comentario'
        });
      }
    }
  }

  // 7. Archivos completamente huérfanos
  const archivosConCoincidencias = new Set([
    ...coincidenciasIncidencias.map(c => c.fileName),
    ...coincidenciasComentarios.map(c => c.fileName)
  ]);

  const archivosHuerfanos = archivosNoMigrados.filter(archivo => !archivosConCoincidencias.has(archivo));

  // 8. Mostrar resultados
  console.log('📊 ANÁLISIS DE ARCHIVOS NO MIGRADOS:');
  console.log('='.repeat(80));

  console.log(`\n🔍 ARCHIVOS NO MIGRADOS CON URLS WIX PENDIENTES:`);
  console.log(`📄 Incidencias: ${coincidenciasIncidencias.length}`);
  console.log(`💬 Comentarios: ${coincidenciasComentarios.length}`);
  console.log(`🎯 Total con URLs Wix: ${coincidenciasIncidencias.length + coincidenciasComentarios.length}`);

  if (coincidenciasIncidencias.length > 0) {
    console.log('\n📄 INCIDENCIAS CON ARCHIVOS PENDIENTES (primeros 10):');
    coincidenciasIncidencias.slice(0, 10).forEach(item => {
      console.log(`   ${item.numSolicitud}: ${item.fileName}`);
    });
    if (coincidenciasIncidencias.length > 10) {
      console.log(`   ... y ${coincidenciasIncidencias.length - 10} más`);
    }
  }

  if (coincidenciasComentarios.length > 0) {
    console.log('\n💬 COMENTARIOS CON ARCHIVOS PENDIENTES (primeros 10):');
    coincidenciasComentarios.slice(0, 10).forEach(item => {
      console.log(`   ${item.numSolicitud}: ${item.fileName}`);
    });
    if (coincidenciasComentarios.length > 10) {
      console.log(`   ... y ${coincidenciasComentarios.length - 10} más`);
    }
  }

  console.log(`\n❓ ARCHIVOS HUÉRFANOS (sin URL Wix asociada): ${archivosHuerfanos.length}`);
  if (archivosHuerfanos.length > 0) {
    console.log('Primeros 20 archivos huérfanos:');
    archivosHuerfanos.slice(0, 20).forEach(archivo => {
      console.log(`   📄 ${archivo}`);
    });
    if (archivosHuerfanos.length > 20) {
      console.log(`   ... y ${archivosHuerfanos.length - 20} más`);
    }
  }

  // 9. Resumen final
  console.log('\n📈 RESUMEN FINAL:');
  console.log('='.repeat(80));
  console.log(`📁 Total archivos en visitante-3: ${allFiles3.length}`);
  console.log(`✅ Archivos migrados: ${todosMigrados.size}`);
  console.log(`❌ Archivos NO migrados: ${archivosNoMigrados.length}`);
  console.log(`🎯 Con URLs Wix pendientes: ${coincidenciasIncidencias.length + coincidenciasComentarios.length}`);
  console.log(`❓ Huérfanos (sin URL asociada): ${archivosHuerfanos.length}`);

  const porcentajeMigrado = ((todosMigrados.size / allFiles3.length) * 100).toFixed(1);
  console.log(`📊 Porcentaje migrado: ${porcentajeMigrado}%`);

  return {
    totalArchivos: allFiles3.length,
    migrados: todosMigrados.size,
    noMigrados: archivosNoMigrados.length,
    conWixPendientes: coincidenciasIncidencias.length + coincidenciasComentarios.length,
    huerfanos: archivosHuerfanos.length,
    porcentajeMigrado: parseFloat(porcentajeMigrado)
  };
}

checkUnmigratedFiles().catch(console.error);