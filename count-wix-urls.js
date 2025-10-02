require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
);

async function countWixUrls() {
  console.log('🔍 CONTEO DE URLs EN LA TABLA COMENTARIOS\n');
  console.log('=' .repeat(60));

  try {
    // 1. Contar URLs de Wix
    const { data: wixUrls, error: wixError } = await supabase
      .from('comentarios')
      .select('id, documento_url', { count: 'exact', head: false })
      .like('documento_url', 'wix:document://%');

    if (wixError) {
      console.error('❌ Error contando URLs de Wix:', wixError);
      return;
    }

    console.log(`📊 URLs con formato Wix: ${wixUrls?.length || 0}`);

    // 2. Contar URLs de Supabase Storage
    const { data: supabaseUrls, error: supabaseError } = await supabase
      .from('comentarios')
      .select('id, documento_url', { count: 'exact', head: false })
      .like('documento_url', '%storage/v1/object/public/documentos%');

    if (supabaseError) {
      console.error('❌ Error contando URLs de Supabase:', supabaseError);
      return;
    }

    console.log(`📊 URLs migradas a Supabase: ${supabaseUrls?.length || 0}`);

    // 3. Contar URLs visitante-3 (que ya no deberían existir)
    const { data: visitante3Urls, error: visitante3Error } = await supabase
      .from('comentarios')
      .select('id, documento_url', { count: 'exact', head: false })
      .like('documento_url', '%visitante-3%');

    if (visitante3Error) {
      console.error('❌ Error contando URLs visitante-3:', visitante3Error);
      return;
    }

    console.log(`📊 URLs visitante-3 restantes: ${visitante3Urls?.length || 0}`);

    // 4. Contar registros con documento_url no nulo
    const { data: allDocs, error: allDocsError } = await supabase
      .from('comentarios')
      .select('id, documento_url', { count: 'exact', head: false })
      .not('documento_url', 'is', null);

    if (allDocsError) {
      console.error('❌ Error contando todos los documentos:', allDocsError);
      return;
    }

    console.log(`📊 Total registros con documento: ${allDocs?.length || 0}`);

    // 5. Contar registros sin documento_url
    const { data: noDocs, error: noDocsError } = await supabase
      .from('comentarios')
      .select('id', { count: 'exact', head: false })
      .is('documento_url', null);

    if (noDocsError) {
      console.error('❌ Error contando registros sin documento:', noDocsError);
      return;
    }

    console.log(`📊 Registros sin documento: ${noDocs?.length || 0}`);

    console.log('\n' + '=' .repeat(60));

    // 6. Mostrar algunos ejemplos de URLs de Wix
    if (wixUrls && wixUrls.length > 0) {
      console.log('\n📄 EJEMPLOS DE URLs CON FORMATO WIX (primeras 10):');
      wixUrls.slice(0, 10).forEach((doc, i) => {
        console.log(`${i + 1}. ${doc.documento_url}`);
      });
    }

    // 7. Mostrar algunos ejemplos de URLs migradas
    if (supabaseUrls && supabaseUrls.length > 0) {
      console.log('\n✅ EJEMPLOS DE URLs MIGRADAS A SUPABASE (primeras 5):');
      supabaseUrls.slice(0, 5).forEach((doc, i) => {
        console.log(`${i + 1}. ${doc.documento_url}`);
      });
    }

    // 8. Resumen
    console.log('\n📊 RESUMEN:');
    const totalDocs = allDocs?.length || 0;
    const pendientesMigrar = wixUrls?.length || 0;
    const migrados = supabaseUrls?.length || 0;
    const porcentajeMigrado = totalDocs > 0 ? ((migrados / totalDocs) * 100).toFixed(1) : '0.0';

    console.log(`   📈 Progreso de migración: ${porcentajeMigrado}%`);
    console.log(`   ⏳ Pendientes de migrar: ${pendientesMigrar}`);
    console.log(`   ✅ Ya migrados: ${migrados}`);
    console.log(`   📁 Total con documento: ${totalDocs}`);

    return {
      wix: pendientesMigrar,
      supabase: migrados,
      visitante3: visitante3Urls?.length || 0,
      total: totalDocs,
      sinDocumento: noDocs?.length || 0
    };

  } catch (error) {
    console.error('💥 Error general:', error);
  }
}

countWixUrls().catch(console.error);