const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function investigate() {
  console.log('🔍 Investigando carpetas "vacías"...\n');

  const testFolders = ['00450', '12502', '04352'];

  for (const num of testFolders) {
    console.log(`\n📁 incidencias/${num}/`);
    console.log('='.repeat(50));

    // Listar contenido directo
    const { data: direct, error: directErr } = await supabase.storage
      .from('incidencias')
      .list(`incidencias/${num}`, { limit: 100 });

    if (directErr) {
      console.log(`❌ Error: ${directErr.message}`);
      continue;
    }

    console.log(`Contenido directo (${direct?.length || 0}):`);
    if (direct && direct.length > 0) {
      direct.forEach(item => {
        const type = item.id ? '📄 archivo' : '📂 carpeta';
        console.log(`  ${type}: ${item.name}`);
      });

      // Si hay subcarpetas, explorarlas
      const subfolders = direct.filter(f => !f.id);
      for (const folder of subfolders) {
        console.log(`\n  🔽 Explorando subcarpeta: ${folder.name}/`);
        const { data: subContent } = await supabase.storage
          .from('incidencias')
          .list(`incidencias/${num}/${folder.name}`, { limit: 100 });

        if (subContent && subContent.length > 0) {
          subContent.forEach(item => {
            const type = item.id ? '📄' : '📂';
            console.log(`    ${type} ${item.name}`);
          });
        } else {
          console.log(`    (vacía)`);
        }
      }
    } else {
      console.log('  (vacía)');
    }
  }

  // Probar a acceder directamente a una imagen conocida
  console.log(`\n\n📸 Intentando descargar una imagen conocida...`);
  console.log('='.repeat(50));

  const { data: fileData, error: downloadErr } = await supabase.storage
    .from('incidencias')
    .download('10352/SEGURO GOTERA VEINA(OLGA).jpg');

  if (downloadErr) {
    console.log(`❌ Error: ${downloadErr.message}`);
  } else {
    console.log(`✅ Descarga exitosa: ${fileData.size} bytes`);
  }
}

investigate().catch(console.error);
