const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deepCheck() {
  console.log('🔍 Revisión profunda de carpetas en incidencias/\n');

  const { data: folders } = await supabase.storage
    .from('incidencias')
    .list('incidencias', { limit: 500 });

  const numericFolders = folders?.filter(f => !f.id && /^\d+$/.test(f.name)) || [];

  console.log(`📋 Total carpetas: ${numericFolders.length}\n`);

  let foundWithFiles = 0;

  for (const folder of numericFolders) {
    const num = folder.name;

    const { data: contents } = await supabase.storage
      .from('incidencias')
      .list(`incidencias/${num}`, { limit: 100 });

    if (!contents) continue;

    const files = contents.filter(f => f.id);

    if (files.length > 0) {
      foundWithFiles++;
      console.log(`📁 incidencias/${num}/`);
      console.log(`   Archivos directos: ${files.length}`);

      files.forEach(f => {
        console.log(`      📄 ${f.name} (${(f.metadata?.size / 1024).toFixed(2)} KB)`);
      });

      const folders = contents.filter(f => !f.id);
      if (folders.length > 0) {
        console.log(`   Subcarpetas: ${folders.map(f => f.name).join(', ')}`);
      }

      console.log('');
    }
  }

  console.log(`\n📊 Total carpetas con archivos directos: ${foundWithFiles}`);
}

deepCheck().catch(console.error);
