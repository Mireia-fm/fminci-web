require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
);

async function verifyMigratedPdf() {
  console.log('🔍 Verificando PDFs migrados...\n');

  // 1. Buscar archivos en Storage con la estructura esperada
  const { data: storageFiles, error: storageError } = await supabase.storage
    .from('documentos')
    .list('incidencias', { limit: 20, search: '.pdf' });

  if (storageError) {
    console.error('❌ Error listing storage files:', storageError);
    return;
  }

  console.log(`📁 Archivos en Storage/incidencias: ${storageFiles?.length || 0}`);

  // 2. Explorar subdirectorios
  if (storageFiles && storageFiles.length > 0) {
    const folders = storageFiles.filter(item => !item.name.includes('.'));
    console.log('\n📂 Carpetas encontradas (primeras 5):');

    for (const folder of folders.slice(0, 5)) {
      console.log(`   📁 ${folder.name}/`);

      // Listar contenido de cada carpeta
      const { data: folderContents } = await supabase.storage
        .from('documentos')
        .list(`incidencias/${folder.name}`, { limit: 10 });

      if (folderContents && folderContents.length > 0) {
        folderContents.forEach(file => {
          console.log(`      📄 ${file.name}`);
        });

        // Buscar carpeta comentarios
        const comentariosFolder = folderContents.find(item => item.name === 'comentarios');
        if (comentariosFolder) {
          const { data: comentariosFiles } = await supabase.storage
            .from('documentos')
            .list(`incidencias/${folder.name}/comentarios`, { limit: 5 });

          if (comentariosFiles && comentariosFiles.length > 0) {
            console.log(`      📁 comentarios/ (${comentariosFiles.length} archivos):`);
            comentariosFiles.forEach(file => {
              const url = `https://xgdilpgbpkgaltvkdodi.supabase.co/storage/v1/object/public/documentos/incidencias/${folder.name}/comentarios/${file.name}`;
              console.log(`         📄 ${file.name}`);
              console.log(`         🔗 ${url}`);
            });
          }
        }
      }
      console.log('');
    }
  }

  // 3. Buscar ejemplos específicos de los archivos que migramos
  console.log('\n🔍 Buscando ejemplos específicos de archivos migrados...');

  const ejemplosEsperados = [
    '18458/comentarios/25-1227_Fundacio_la_Caixa_60440.1_ELECTRICIDAD_18458_EspaiCaixa_Sant_Lluis.pdf',
    '38847/comentarios/25-1204_Fundacio_la_Caixa_60440.1_ELECTRICIDAD_38847_EspaiCaixa_Sant_Lluis.pdf',
    '96510/comentarios/25-1007_Centro_Santa_Monica_60440.2_AIRE_ACONDICIONADO_96510_Centro_Santa_Monica_(Palma).pdf'
  ];

  for (const ejemplo of ejemplosEsperados) {
    try {
      const { data: fileInfo, error: fileError } = await supabase.storage
        .from('documentos')
        .getPublicUrl(`incidencias/${ejemplo}`);

      if (fileError) {
        console.log(`❌ Error checking ${ejemplo}:`, fileError);
      } else {
        console.log(`✅ ${ejemplo}`);
        console.log(`   🔗 URL: ${fileInfo.publicUrl}`);

        // Verificar que el archivo realmente existe
        try {
          const response = await fetch(fileInfo.publicUrl, { method: 'HEAD' });
          console.log(`   📊 Status: ${response.status} ${response.statusText}`);
          if (response.headers.get('content-type')) {
            console.log(`   📄 Content-Type: ${response.headers.get('content-type')}`);
          }
          if (response.headers.get('content-length')) {
            const size = parseInt(response.headers.get('content-length') || '0');
            console.log(`   💾 Size: ${(size / 1024).toFixed(1)} KB`);
          }
        } catch (fetchError) {
          console.log(`   ⚠️  Error verificando acceso: ${fetchError.message}`);
        }
      }
      console.log('');
    } catch (error) {
      console.log(`❌ Error procesando ${ejemplo}:`, error);
    }
  }

  return storageFiles;
}

verifyMigratedPdf().catch(console.error);