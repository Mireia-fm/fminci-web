require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
const supabaseClient = createClient(supabaseUrl, supabaseKey);

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

async function checkFileExistsInStorage(numSolicitud, fileName) {
  try {
    const storagePath = `${numSolicitud}/${fileName}`;
    const { data, error } = await supabaseClient.storage
      .from('incidencias')
      .list(numSolicitud, { search: fileName });

    if (error) return false;
    return data && data.some(file => file.name === fileName);
  } catch {
    return false;
  }
}

async function main() {
  console.log('🔍 Generando comandos SQL para archivos ya subidos...\n');

  // Obtener URLs Wix actuales
  const { data: wixUrls, error } = await supabaseClient
    .from('incidencias')
    .select('num_solicitud, imagen_url')
    .like('imagen_url', 'wix%')
    .order('num_solicitud');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`📋 Procesando ${wixUrls.length} URLs Wix...`);

  const sqlCommands = [];
  let found = 0;
  let notFound = 0;

  for (const { num_solicitud, imagen_url } of wixUrls) {
    const fileName = extractFileNameFromWixUrl(imagen_url);
    if (!fileName) continue;

    process.stdout.write(`\r🔄 Verificando ${num_solicitud}...`);

    const exists = await checkFileExistsInStorage(num_solicitud, fileName);
    if (exists) {
      const newUrl = `https://xgdilpgbpkgaltvkdodi.supabase.co/storage/v1/object/public/incidencias/${num_solicitud}/${encodeURIComponent(fileName)}`;
      sqlCommands.push(`UPDATE incidencias SET imagen_url = '${newUrl}' WHERE num_solicitud = '${num_solicitud}';`);
      found++;
    } else {
      notFound++;
    }
  }

  console.log(`\n\n📊 Resultados:`);
  console.log(`✅ Archivos encontrados en Storage: ${found}`);
  console.log(`❌ No encontrados: ${notFound}`);

  if (sqlCommands.length > 0) {
    console.log(`\n📜 COMANDOS SQL (${sqlCommands.length}):`);
    console.log('='.repeat(80));

    // Dividir en lotes de 15
    const batches = [];
    for (let i = 0; i < sqlCommands.length; i += 15) {
      batches.push(sqlCommands.slice(i, i + 15));
    }

    batches.forEach((batch, index) => {
      console.log(`\n-- LOTE ${index + 1}/${batches.length}:`);
      batch.forEach(cmd => console.log(cmd));
    });

    // Guardar en archivo
    const fs = require('fs');
    fs.writeFileSync('./sql-commands-ready.sql', sqlCommands.join('\n'));
    console.log(`\n💾 Comandos guardados en: sql-commands-ready.sql`);
  }

  return { found, sqlCommands: sqlCommands.length };
}

main().catch(console.error);