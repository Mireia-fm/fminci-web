require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const DOWNLOADS_PATH = '/Users/mireia/Downloads/Cargas del visitante-2';

// Función para extraer el nombre del archivo de una URL Wix
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
    console.error('Error extracting filename from Wix URL:', wixUrl, error);
    return null;
  }
}

// Función para normalizar nombres de archivo para comparación
function normalizeFileName(fileName) {
  return fileName.toLowerCase()
    .replace(/\s+/g, ' ') // Normalizar espacios
    .replace(/[()[\]{}]/g, '') // Remover paréntesis y corchetes
    .replace(/[_-]+/g, '_') // Normalizar guiones y guiones bajos
    .trim();
}

// Función para buscar coincidencias exactas y aproximadas
function findMatches(wixFileName, physicalFiles) {
  if (!wixFileName) return { exact: null, approximate: [] };

  const matches = {
    exact: null,
    approximate: []
  };

  // Buscar coincidencia exacta
  const exactMatch = physicalFiles.find(file => file === wixFileName);
  if (exactMatch) {
    matches.exact = exactMatch;
    return matches;
  }

  // Buscar por nombre sin extensión
  const wixNameOnly = path.parse(wixFileName).name.toLowerCase();
  const wixNormalized = normalizeFileName(wixFileName);

  for (const physicalFile of physicalFiles) {
    const physicalNameOnly = path.parse(physicalFile).name.toLowerCase();
    const physicalNormalized = normalizeFileName(physicalFile);

    // Coincidencia por nombre sin extensión
    if (wixNameOnly === physicalNameOnly) {
      matches.approximate.push({ file: physicalFile, reason: 'same_name_different_ext' });
      continue;
    }

    // Coincidencia normalizada
    if (wixNormalized === physicalNormalized) {
      matches.approximate.push({ file: physicalFile, reason: 'normalized_match' });
      continue;
    }

    // Coincidencia parcial (uno contiene al otro)
    if (wixNormalized.includes(physicalNormalized) || physicalNormalized.includes(wixNormalized)) {
      matches.approximate.push({ file: physicalFile, reason: 'partial_match' });
      continue;
    }

    // Coincidencia por subcadena de al menos 10 caracteres
    const minLength = 10;
    if (wixNameOnly.length >= minLength && physicalNameOnly.length >= minLength) {
      if (wixNameOnly.includes(physicalNameOnly.substring(0, minLength)) ||
          physicalNameOnly.includes(wixNameOnly.substring(0, minLength))) {
        matches.approximate.push({ file: physicalFile, reason: 'substring_match' });
      }
    }
  }

  return matches;
}

async function analyzeMatches() {
  try {
    console.log('🔍 Analizando coincidencias entre archivos Wix e imágenes físicas...\n');

    // Obtener archivos físicos
    const physicalFiles = fs.readdirSync(DOWNLOADS_PATH)
      .filter(file => /\.(jpg|jpeg|png|gif|webp|jfif)$/i.test(file));

    console.log(`📁 Archivos físicos encontrados: ${physicalFiles.length}`);
    console.log(`   - JPG: ${physicalFiles.filter(f => f.toLowerCase().endsWith('.jpg')).length}`);
    console.log(`   - JPEG: ${physicalFiles.filter(f => f.toLowerCase().endsWith('.jpeg')).length}`);
    console.log(`   - PNG: ${physicalFiles.filter(f => f.toLowerCase().endsWith('.png')).length}`);
    console.log(`   - Otros: ${physicalFiles.filter(f => !/\.(jpg|jpeg|png)$/i.test(f)).length}\n`);

    // Obtener incidencias Wix
    const { data: incidencias, error } = await supabase
      .from('incidencias')
      .select('num_solicitud, imagen_url')
      .like('imagen_url', 'wix%')
      .order('num_solicitud');

    if (error) {
      console.error('Error fetching incidencias:', error);
      return;
    }

    console.log(`📊 Incidencias con URLs Wix: ${incidencias.length}\n`);

    let exactMatches = 0;
    let approximateMatches = 0;
    let noMatches = 0;
    let multipleMatches = 0;

    const matchResults = [];
    const uniquePhysicalFiles = new Set();

    for (const incidencia of incidencias) {
      const wixFileName = extractFileNameFromWixUrl(incidencia.imagen_url);
      const matches = findMatches(wixFileName, physicalFiles);

      const result = {
        numSolicitud: incidencia.num_solicitud,
        wixFileName,
        ...matches
      };

      matchResults.push(result);

      if (matches.exact) {
        exactMatches++;
        uniquePhysicalFiles.add(matches.exact);
        console.log(`✅ EXACTA    ${incidencia.num_solicitud}: ${wixFileName} -> ${matches.exact}`);
      } else if (matches.approximate.length > 0) {
        approximateMatches++;
        if (matches.approximate.length > 1) {
          multipleMatches++;
          console.log(`🔀 MÚLTIPLE  ${incidencia.num_solicitud}: ${wixFileName}`);
          matches.approximate.forEach(match => {
            console.log(`              -> ${match.file} (${match.reason})`);
            uniquePhysicalFiles.add(match.file);
          });
        } else {
          const match = matches.approximate[0];
          uniquePhysicalFiles.add(match.file);
          console.log(`≈  APROXIMADA ${incidencia.num_solicitud}: ${wixFileName} -> ${match.file} (${match.reason})`);
        }
      } else {
        noMatches++;
        console.log(`❌ SIN MATCH  ${incidencia.num_solicitud}: ${wixFileName}`);
      }
    }

    console.log('\n📊 RESUMEN DETALLADO:');
    console.log(`✅ Coincidencias exactas: ${exactMatches}`);
    console.log(`≈  Coincidencias aproximadas: ${approximateMatches}`);
    console.log(`🔀 Con múltiples coincidencias: ${multipleMatches}`);
    console.log(`❌ Sin coincidencias: ${noMatches}`);
    console.log(`📋 Total URLs Wix: ${incidencias.length}`);
    console.log(`🗂️  Archivos físicos únicos referenciados: ${uniquePhysicalFiles.size} de ${physicalFiles.length}`);

    // Mostrar archivos físicos no referenciados
    const unreferencedFiles = physicalFiles.filter(file => !uniquePhysicalFiles.has(file));
    if (unreferencedFiles.length > 0) {
      console.log(`\n📄 Archivos físicos NO referenciados por ninguna URL Wix (${unreferencedFiles.length}):`);
      unreferencedFiles.forEach(file => console.log(`   - ${file}`));
    }

    // Calcular porcentajes
    const totalWithMatches = exactMatches + approximateMatches;
    const matchPercentage = ((totalWithMatches / incidencias.length) * 100).toFixed(1);
    const fileUsagePercentage = ((uniquePhysicalFiles.size / physicalFiles.length) * 100).toFixed(1);

    console.log(`\n📈 ESTADÍSTICAS:`);
    console.log(`   - ${matchPercentage}% de URLs Wix tienen alguna coincidencia`);
    console.log(`   - ${fileUsagePercentage}% de archivos físicos están referenciados`);
    console.log(`   - Promedio de ${(uniquePhysicalFiles.size / totalWithMatches).toFixed(2)} incidencias por archivo único`);

  } catch (error) {
    console.error('Error en análisis:', error);
  }
}

analyzeMatches();