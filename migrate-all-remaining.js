require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
const supabaseClient = createClient(supabaseUrl, supabaseKey);

const DOWNLOADS_PATH_3 = '/Users/mireia/Downloads/Cargas del visitante-3';
const BUCKET_NAME = 'incidencias';

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

async function uploadFileToStorage(filePath, fileName, numSolicitud) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const contentType = getContentType(fileName);
    const storagePath = `${numSolicitud}/${fileName}`;

    const { data, error } = await supabaseClient.storage
      .from(BUCKET_NAME)
      .upload(storagePath, fileBuffer, {
        contentType: contentType,
        upsert: true
      });

    if (error) {
      console.error(`❌ Error subiendo ${fileName}:`, error.message);
      return null;
    }

    const { data: publicUrlData } = supabaseClient.storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath);

    return publicUrlData.publicUrl;
  } catch (error) {
    console.error(`❌ Error en uploadFileToStorage:`, error.message);
    return null;
  }
}

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

async function findAllExactMatches() {
  console.log('🔍 Encontrando TODAS las coincidencias exactas en visitante-3...');

  // Obtener todos los archivos de visitante-3
  const allFiles3 = fs.readdirSync(DOWNLOADS_PATH_3)
    .filter(file => /\.(jpg|jpeg|png|gif|webp|jfif)$/i.test(file));

  console.log(`📁 Total archivos en visitante-3: ${allFiles3.length}`);

  // Obtener todas las URLs Wix restantes
  const { data: wixUrls, error } = await supabaseClient
    .from('incidencias')
    .select('num_solicitud, imagen_url')
    .like('imagen_url', 'wix%')
    .order('num_solicitud');

  if (error) {
    console.error('Error obteniendo URLs Wix:', error);
    return [];
  }

  console.log(`🔗 URLs Wix actuales: ${wixUrls.length}`);

  const exactMatches = [];
  const processed = new Set();

  for (const { num_solicitud, imagen_url } of wixUrls) {
    const wixFileName = extractFileNameFromWixUrl(imagen_url);
    if (!wixFileName || processed.has(wixFileName)) continue;

    processed.add(wixFileName);

    // Buscar coincidencia exacta en visitante-3
    const exactMatch = allFiles3.find(file => file === wixFileName);
    if (exactMatch) {
      exactMatches.push({
        numSolicitud: num_solicitud,
        fileName: exactMatch,
        wixUrl: imagen_url
      });
    }
  }

  console.log(`📊 TODAS las coincidencias exactas encontradas: ${exactMatches.length}`);
  return exactMatches;
}

async function migrateInBatches(matches, batchSize = 10) {
  console.log(`🚀 Migrando ${matches.length} archivos en lotes de ${batchSize}...\n`);

  const results = [];
  const sqlCommands = [];
  let migrated = 0;
  let failed = 0;

  for (let i = 0; i < matches.length; i += batchSize) {
    const batch = matches.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(matches.length / batchSize);

    console.log(`📦 LOTE ${batchNum}/${totalBatches} (${batch.length} archivos)`);

    for (const match of batch) {
      try {
        console.log(`  🔄 ${match.numSolicitud}: ${match.fileName}`);

        const filePath = path.join(DOWNLOADS_PATH_3, match.fileName);
        if (!fs.existsSync(filePath)) {
          console.log(`    ⚠️  Archivo no encontrado`);
          failed++;
          continue;
        }

        const newUrl = await uploadFileToStorage(filePath, match.fileName, match.numSolicitud);

        if (newUrl) {
          console.log(`    ✅ Subido exitosamente`);
          migrated++;
          results.push({
            ...match,
            newUrl,
            status: 'success'
          });
          sqlCommands.push(`UPDATE incidencias SET imagen_url = '${newUrl}' WHERE num_solicitud = '${match.numSolicitud}';`);
        } else {
          console.log(`    ❌ Error en subida`);
          failed++;
        }

        // Pequeña pausa para evitar rate limits
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        console.error(`    ❌ Error: ${error.message}`);
        failed++;
      }
    }

    console.log(`  📊 Lote ${batchNum}: ✅${migrated} ❌${failed}\n`);

    // Pausa entre lotes
    if (i + batchSize < matches.length) {
      console.log('⏳ Esperando 2 segundos antes del siguiente lote...\n');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  return { results, sqlCommands, migrated, failed };
}

async function main() {
  console.log('🎯 MIGRACIÓN COMPLETA - TODOS LOS ARCHIVOS EXACTOS\n');

  try {
    // 1. Encontrar todas las coincidencias exactas
    const allMatches = await findAllExactMatches();

    if (allMatches.length === 0) {
      console.log('ℹ️  No se encontraron más coincidencias exactas para migrar.');
      return;
    }

    // 2. Migrar todos los archivos en lotes
    const { results, sqlCommands, migrated, failed } = await migrateInBatches(allMatches);

    // 3. Generar comandos SQL
    console.log('\n' + '='.repeat(80));
    console.log('📜 COMANDOS SQL PARA EJECUTAR EN MCP:');
    console.log('='.repeat(80));

    // Dividir comandos SQL en grupos de 20 para evitar límites
    const sqlBatches = [];
    for (let i = 0; i < sqlCommands.length; i += 20) {
      sqlBatches.push(sqlCommands.slice(i, i + 20));
    }

    sqlBatches.forEach((batch, index) => {
      console.log(`\n-- LOTE SQL ${index + 1}/${sqlBatches.length}:`);
      batch.forEach(cmd => console.log(cmd));
    });

    console.log('\n' + '='.repeat(80));
    console.log('📊 RESUMEN FINAL COMPLETO:');
    console.log('='.repeat(80));
    console.log(`✅ Total migrado exitosamente: ${migrated}`);
    console.log(`❌ Errores: ${failed}`);
    console.log(`📋 Total procesado: ${allMatches.length}`);
    console.log(`📜 Comandos SQL generados: ${sqlCommands.length}`);
    console.log(`📦 Lotes SQL para ejecutar: ${sqlBatches.length}`);

    // 4. Guardar comandos SQL en archivo
    const sqlContent = sqlCommands.join('\n');
    fs.writeFileSync('./migration-sql-commands.sql', sqlContent);
    console.log(`💾 Comandos SQL guardados en: ./migration-sql-commands.sql`);

    return { migrated, failed, sqlBatches };

  } catch (error) {
    console.error('❌ Error en migración principal:', error);
    throw error;
  }
}

main().catch(console.error);