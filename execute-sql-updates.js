require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
);

async function executeUpdates() {
  console.log('🚀 Ejecutando actualizaciones SQL...\n');

  try {
    // 1. Actualizar estados de "Pendiente valoración" a "Resuelta"
    console.log('1️⃣ Actualizando estados de proveedor...');

    const { data: estadosData, error: estadosError } = await supabase
      .from('proveedor_casos')
      .update({
        estado_proveedor: 'Resuelta',
        actualizado_en: new Date().toISOString()
      })
      .eq('estado_proveedor', 'Pendiente valoración')
      .eq('activo', true)
      .select();

    if (estadosError) {
      console.error('❌ Error actualizando estados:', estadosError);
    } else {
      console.log(`✅ Estados actualizados: ${estadosData?.length || 0} casos`);
    }

    // 2. Verificar estados actuales
    const { data: verificacion } = await supabase
      .from('proveedor_casos')
      .select('estado_proveedor')
      .eq('activo', true);

    if (verificacion) {
      const conteo = verificacion.reduce((acc, caso) => {
        acc[caso.estado_proveedor] = (acc[caso.estado_proveedor] || 0) + 1;
        return acc;
      }, {});

      console.log('\n📊 Estados actuales:');
      Object.entries(conteo).forEach(([estado, total]) => {
        console.log(`   ${estado}: ${total} casos`);
      });
    }

    // 3. Actualizar URLs de documentos específicos
    console.log('\n2️⃣ Actualizando URLs de documentos...');

    const documentos = [
      {
        old: '/visitante-3/25-1227 Fundació la Caixa 60440.1 ELECTRICIDAD 18458 EspaiCaixa Sant Lluís.pdf',
        new: 'https://xgdilpgbpkgaltvkdodi.supabase.co/storage/v1/object/public/documentos/incidencias/18458/comentarios/25-1227_Fundacio_la_Caixa_60440.1_ELECTRICIDAD_18458_EspaiCaixa_Sant_Lluis.pdf',
        solicitud: '18458'
      },
      {
        old: '/visitante-3/25-1204 Fundació la Caixa 60440.1 ELECTRICIDAD 38847 EspaiCaixa Sant Lluís.pdf',
        new: 'https://xgdilpgbpkgaltvkdodi.supabase.co/storage/v1/object/public/documentos/incidencias/38847/comentarios/25-1204_Fundacio_la_Caixa_60440.1_ELECTRICIDAD_38847_EspaiCaixa_Sant_Lluis.pdf',
        solicitud: '38847'
      },
      {
        old: '/visitante-3/25-1007 Centro Santa Mónica 60440.2 AIRE ACONDICIONADO 96510 Centro Santa Mónica (Palma).pdf',
        new: 'https://xgdilpgbpkgaltvkdodi.supabase.co/storage/v1/object/public/documentos/incidencias/96510/comentarios/25-1007_Centro_Santa_Monica_60440.2_AIRE_ACONDICIONADO_96510_Centro_Santa_Monica_(Palma).pdf',
        solicitud: '96510'
      }
    ];

    let documentosActualizados = 0;

    for (const doc of documentos) {
      const { data: docData, error: docError } = await supabase
        .from('staging_comentarios_proveedor')
        .update({ documento_url: doc.new })
        .eq('documento_url', doc.old)
        .select();

      if (docError) {
        console.error(`❌ Error actualizando documento ${doc.solicitud}:`, docError);
      } else {
        const count = docData?.length || 0;
        console.log(`✅ Documento ${doc.solicitud}: ${count} registros actualizados`);
        documentosActualizados += count;
      }
    }

    console.log(`\n📊 Total documentos actualizados: ${documentosActualizados}`);

    // 4. Verificar URLs actualizadas
    const { data: urlsVerificacion } = await supabase
      .from('staging_comentarios_proveedor')
      .select('documento_url')
      .like('documento_url', '%storage/v1/object/public/documentos%')
      .limit(10);

    if (urlsVerificacion && urlsVerificacion.length > 0) {
      console.log('\n📋 Ejemplos de URLs actualizadas:');
      urlsVerificacion.forEach((doc, i) => {
        console.log(`   ${i + 1}. ${doc.documento_url}`);
      });
    }

    console.log('\n🎉 ¡Actualizaciones completadas exitosamente!');

  } catch (error) {
    console.error('💥 Error general:', error);
  }
}

executeUpdates().catch(console.error);