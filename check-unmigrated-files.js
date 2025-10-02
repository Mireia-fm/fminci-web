require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
const supabaseClient = createClient(supabaseUrl, supabaseKey);

const DOWNLOADS_PATH_2 = '/Users/mireia/Downloads/Cargas del visitante-2';

async function checkMigratedFiles() {
  console.log('🔍 Verificando archivos no migrados de visitante-2...\n');

  // Obtener todos los archivos de visitante-2
  const allFiles2 = fs.readdirSync(DOWNLOADS_PATH_2)
    .filter(file => /\.(jpg|jpeg|png|gif|webp|jfif)$/i.test(file));

  console.log(`📁 Total archivos en visitante-2: ${allFiles2.length}`);

  // Obtener todas las URLs de Supabase Storage
  const { data: supabaseUrls, error } = await supabaseClient
    .from('incidencias')
    .select('num_solicitud, imagen_url')
    .like('imagen_url', 'https://xgdilpgbpkgaltvkdodi.supabase.co/storage%')
    .order('num_solicitud');

  if (error) {
    console.error('Error obteniendo URLs Supabase:', error);
    return;
  }

  console.log(`🔗 URLs migradas a Supabase: ${supabaseUrls.length}`);

  // Extraer nombres de archivos de las URLs de Supabase
  const migratedFileNames = supabaseUrls.map(item => {
    try {
      const url = item.imagen_url;
      const parts = url.split('/');
      const fileName = decodeURIComponent(parts[parts.length - 1]);
      return fileName;
    } catch {
      return null;
    }
  }).filter(name => name !== null);

  console.log(`📋 Archivos únicos migrados: ${new Set(migratedFileNames).size}\n`);

  // Archivos exact matches conocidos (de scripts anteriores)
  const knownExactMatches = [
    '20250910_105709.jpg',
    'IMG_20250912_162304[1].jpg', // Este falló por los corchetes
    '1000021510.jpg',
    '1000100229.jpg',
    '20250904_163120.jpg',
    '1000149672.jpg',
    'processed-78EB9493-A2C7-4594-BF17-5F43FBC753E0.jpeg',
    'cable penjant 2025-09-16.jpeg',
    '1757514836566769056175081587240.jpg',
    'Captura de pantalla 2025-09-17 102511.png',
    '1757510640785.jpg',
    '1000100227.jpg',
    '17576076177308608672390251643726.jpg',
    '1757923325999.jpg',
    '17575150581056334708436023246368.jpg',
    '1758099948261.jpg',
    'IMG_20250909_164256 (1).jpg',
    '1000100559.jpg',
    '17575145058992352833059200894325.jpg',
    '1000116575.jpg',
    '1000100225.jpg',
    'IMG_20250917_175629.jpg',
    '1000146607.jpg',
    '1757495192162236577715904641166.jpg',
    '1000021668.jpg',
    '17575137464641216452255004616314.jpg',
    '20250917_114120.jpg',
    '1000118651.jpg',
    'shared image (14).jfif.jpg' // Este se migró como shared image (14).jfif
  ];

  // Verificar qué archivos conocidos están migrados
  const migratedKnownFiles = knownExactMatches.filter(file =>
    migratedFileNames.some(migrated =>
      migrated === file ||
      migrated === file.replace('.jfif.jpg', '.jfif') || // Caso especial del .jfif
      migrated.includes(file.replace(/\[|\]/g, '')) // Caso especial de corchetes
    )
  );

  console.log('📊 ANÁLISIS DE MIGRACIÓN:');
  console.log('='.repeat(60));
  console.log(`✅ Archivos conocidos migrados: ${migratedKnownFiles.length}/28`);

  const unmigratedKnownFiles = knownExactMatches.filter(file =>
    !migratedKnownFiles.includes(file)
  );

  if (unmigratedKnownFiles.length > 0) {
    console.log(`\n❌ Archivos conocidos NO migrados: ${unmigratedKnownFiles.length}`);
    unmigratedKnownFiles.forEach(file => {
      console.log(`   📄 ${file}`);
    });
  }

  // Archivos completamente desconocidos (no en exact matches)
  const unknownFiles = allFiles2.filter(file =>
    !knownExactMatches.includes(file)
  );

  console.log(`\n📂 ARCHIVOS NO IDENTIFICADOS COMO EXACT MATCHES:`);
  console.log(`Total: ${unknownFiles.length}`);
  console.log('─'.repeat(60));

  unknownFiles.forEach(file => {
    console.log(`📄 ${file}`);
  });

  // Resumen final
  console.log('\n📈 RESUMEN FINAL:');
  console.log('='.repeat(60));
  console.log(`📁 Total archivos visitante-2: ${allFiles2.length}`);
  console.log(`✅ Archivos con exact match conocido: ${knownExactMatches.length}`);
  console.log(`✅ De estos, migrados: ${migratedKnownFiles.length}`);
  console.log(`❌ De estos, pendientes: ${unmigratedKnownFiles.length}`);
  console.log(`❓ Archivos sin identificar: ${unknownFiles.length}`);
  console.log(`🔗 Total URLs migradas en BD: ${supabaseUrls.length}`);

  return {
    totalFiles: allFiles2.length,
    knownExactMatches: knownExactMatches.length,
    migratedKnown: migratedKnownFiles.length,
    unmigratedKnown: unmigratedKnownFiles.length,
    unknownFiles: unknownFiles.length,
    totalMigrated: supabaseUrls.length
  };
}

checkMigratedFiles().catch(console.error);