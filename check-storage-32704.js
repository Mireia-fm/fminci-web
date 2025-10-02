const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkStorage() {
  console.log('🔍 Revisando storage para incidencia 32704...\n');

  // Listar archivos en la carpeta 32704
  const { data: files, error } = await supabase.storage
    .from('incidencias')
    .list('32704', {
      limit: 100,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' }
    });

  if (error) {
    console.error('❌ Error al listar archivos:', error.message);
    return;
  }

  console.log('📁 Archivos en incidencias/32704:');
  if (files && files.length > 0) {
    files.forEach(file => {
      console.log(`   - ${file.name} (${(file.metadata?.size / 1024).toFixed(2)} KB)`);
    });
  } else {
    console.log('   (vacía)');
  }

  // También verificar si existe en la raíz con prefijo "incidencias/"
  console.log('\n📁 Revisando carpeta incidencias/32704/ en raíz:');
  const { data: rootFiles, error: rootError } = await supabase.storage
    .from('incidencias')
    .list('incidencias/32704', {
      limit: 100,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' }
    });

  if (rootError) {
    console.log('   ❌ No existe esta ruta:', rootError.message);
  } else if (rootFiles && rootFiles.length > 0) {
    rootFiles.forEach(file => {
      console.log(`   - ${file.name}`);
    });
  } else {
    console.log('   (vacía)');
  }
}

checkStorage().catch(console.error);
