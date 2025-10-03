const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function quickCount() {
  console.log('Contando carpetas vacías en incidencias/...\n');

  const { data } = await supabase.storage
    .from('incidencias')
    .list('incidencias', { limit: 500 });

  const folders = data?.filter(f => !f.id && /^\d+$/.test(f.name)) || [];

  let empty = 0;
  let withContent = 0;

  for (const f of folders) {
    const { data: c } = await supabase.storage
      .from('incidencias')
      .list(`incidencias/${f.name}`, { limit: 1 });

    if (!c || c.length === 0) {
      empty++;
    } else {
      withContent++;
    }
  }

  console.log('📊 RESULTADO:');
  console.log(`Total carpetas en incidencias/: ${folders.length}`);
  console.log(`⚪ Completamente vacías: ${empty}`);
  console.log(`✅ Con contenido: ${withContent}`);
}

quickCount().catch(console.error);
