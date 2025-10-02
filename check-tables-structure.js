require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
);

async function checkTablesStructure() {
  console.log('🔍 Verificando estructura de tablas para URLs de documentos...\n');

  // 1. Verificar tabla staging_comentarios_proveedor
  try {
    const { data: stagingData, error: stagingError } = await supabase
      .from('staging_comentarios_proveedor')
      .select('*')
      .limit(1);

    if (stagingError) {
      console.log('❌ staging_comentarios_proveedor:', stagingError.message);
    } else {
      console.log('✅ staging_comentarios_proveedor existe');
      if (stagingData?.[0]) {
        console.log('   Columnas:', Object.keys(stagingData[0]));
      }
    }
  } catch (err) {
    console.log('❌ Error checking staging_comentarios_proveedor:', err.message);
  }

  // 2. Verificar tabla comentarios_proveedor
  try {
    const { data: comentariosData, error: comentariosError } = await supabase
      .from('comentarios_proveedor')
      .select('*')
      .limit(1);

    if (comentariosError) {
      console.log('❌ comentarios_proveedor:', comentariosError.message);
    } else {
      console.log('✅ comentarios_proveedor existe');
      if (comentariosData?.[0]) {
        console.log('   Columnas:', Object.keys(comentariosData[0]));
      }
    }
  } catch (err) {
    console.log('❌ Error checking comentarios_proveedor:', err.message);
  }

  // 3. Verificar tabla comentarios
  try {
    const { data: comentariosData, error: comentariosError } = await supabase
      .from('comentarios')
      .select('*')
      .limit(1);

    if (comentariosError) {
      console.log('❌ comentarios:', comentariosError.message);
    } else {
      console.log('✅ comentarios existe');
      if (comentariosData?.[0]) {
        console.log('   Columnas:', Object.keys(comentariosData[0]));
      }
    }
  } catch (err) {
    console.log('❌ Error checking comentarios:', err.message);
  }

  // 4. Buscar registros con URLs de visitante-3
  console.log('\n🔍 Buscando documentos con URLs de visitante-3...');

  const tables = ['comentarios', 'comentarios_proveedor', 'staging_comentarios_proveedor'];

  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .like('documento_url', '%visitante-3%')
        .limit(5);

      if (!error && data && data.length > 0) {
        console.log(`\n📋 ${table} (${data.length} encontrados):`);
        data.forEach((item, i) => {
          console.log(`   ${i + 1}. ${item.documento_url}`);
        });
      } else if (error) {
        console.log(`❌ Error en ${table}:`, error.message);
      } else {
        console.log(`   ${table}: 0 documentos encontrados`);
      }
    } catch (err) {
      console.log(`❌ Error checking ${table}:`, err.message);
    }
  }
}

checkTablesStructure().catch(console.error);