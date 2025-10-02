require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
);

async function mostrarEjemplosPdfs() {
  console.log('📋 EJEMPLOS DE PDFs MIGRADOS PARA VERIFICACIÓN\n');
  console.log('=' .repeat(80));

  // Ejemplos específicos de la migración con sus URLs reales
  const ejemplos = [
    {
      solicitud: '06639',
      original: '25-0676 Fundació la Caixa OC_18408 ECB SANT POL DE MAR - 663...',
      sanitizado: '25-0676_Fundacio_la_Caixa_OC_18408_ECB_SANT_POL_DE_MAR_-_663...',
      comentario_id: '0a7ba845-1dbb-4d77-b050-b8c619e33e7c'
    },
    {
      solicitud: '89254',
      original: '25-0678 Fundació la Caixa OC_18388 ECB CONGRES - 89254.pdf',
      sanitizado: '25-0678_Fundacio_la_Caixa_OC_18388_ECB_CONGRES_-_89254.pdf',
      comentario_id: '4d21ae62-5d98-4e0f-9de0-dc5a2128d4b1'
    },
    {
      solicitud: '55675',
      original: '24-1670 OF 18453 ESPAICAIXA CARMEL 55675.pdf',
      sanitizado: '24-1670_OF_18453_ESPAICAIXA_CARMEL_55675.pdf',
      comentario_id: '27b34adf-417b-48de-b675-ee40fd985207'
    },
    {
      solicitud: '27592',
      original: 'OFERTA ESPAI CAIXA MOLLET PAPELERA CON TAPA MAR 25.pdf',
      sanitizado: 'OFERTA_ESPAI_CAIXA_MOLLET_PAPELERA_CON_TAPA_MAR_25.pdf',
      comentario_id: '560fd264-c20e-494e-8708-0e3a4ec58d32'
    },
    {
      solicitud: '24802',
      original: '25-0381 ESPAICAIXA PALAFURGELL-24802.pdf',
      sanitizado: '25-0381_ESPAICAIXA_PALAFURGELL-24802.pdf',
      comentario_id: '79cbe054-2746-49a8-920b-f700c2bf6a53'
    }
  ];

  console.log('🎯 EJEMPLOS PARA VERIFICACIÓN MANUAL:\n');

  for (let i = 0; i < ejemplos.length; i++) {
    const ejemplo = ejemplos[i];
    console.log(`${i + 1}. SOLICITUD: ${ejemplo.solicitud}`);
    console.log(`   📁 Original: ${ejemplo.original}`);
    console.log(`   🔄 Sanitizado: ${ejemplo.sanitizado}`);
    console.log(`   🔗 URL completa:`);

    // Construir la URL completa
    const baseUrl = 'https://xgdilpgbpkgaltvkdodi.supabase.co/storage/v1/object/public/documentos';
    const fullUrl = `${baseUrl}/incidencias/${ejemplo.solicitud}/comentarios/${ejemplo.sanitizado}`;
    console.log(`      ${fullUrl}`);

    console.log(`   💾 ID Comentario: ${ejemplo.comentario_id}`);

    // Verificar si el archivo existe en Storage
    try {
      const { data: fileInfo } = await supabase.storage
        .from('documentos')
        .getPublicUrl(`incidencias/${ejemplo.solicitud}/comentarios/${ejemplo.sanitizado}`);

      console.log(`   ✅ URL generada correctamente`);

      // Test rápido de acceso
      try {
        const response = await fetch(fullUrl, { method: 'HEAD' });
        if (response.status === 200) {
          const size = response.headers.get('content-length');
          console.log(`   📊 Estado: ✅ Accesible (${size ? Math.round(size/1024) + ' KB' : 'sin tamaño'})`);
        } else {
          console.log(`   📊 Estado: ⚠️  HTTP ${response.status} ${response.statusText}`);
        }
      } catch (fetchError) {
        console.log(`   📊 Estado: ❌ Error de acceso: ${fetchError.message}`);
      }

    } catch (error) {
      console.log(`   ❌ Error generando URL: ${error.message}`);
    }

    console.log('');
  }

  console.log('🔍 VERIFICACIÓN EN BASE DE DATOS:\n');

  // Buscar algunos comentarios para verificar que las URLs están actualizadas
  for (const ejemplo of ejemplos.slice(0, 3)) {
    try {
      const { data: comentario } = await supabase
        .from('comentarios')
        .select('id, documento_url, incidencia_id')
        .eq('id', ejemplo.comentario_id)
        .single();

      if (comentario) {
        console.log(`📄 Comentario ${ejemplo.solicitud}:`);
        console.log(`   ID: ${comentario.id}`);
        console.log(`   Incidencia: ${comentario.incidencia_id}`);
        console.log(`   URL BD: ${comentario.documento_url || 'Sin URL'}`);

        if (comentario.documento_url && comentario.documento_url.includes('storage/v1/object/public')) {
          console.log(`   ✅ URL migrada correctamente`);
        } else {
          console.log(`   ⚠️  URL no migrada o diferente`);
        }
        console.log('');
      }
    } catch (error) {
      console.log(`   ❌ Error consultando comentario: ${error.message}\n`);
    }
  }

  console.log('=' .repeat(80));
  console.log('📋 INSTRUCCIONES PARA VERIFICAR:\n');
  console.log('1. Copia cualquiera de las URLs de arriba');
  console.log('2. Pégala en tu navegador');
  console.log('3. Debe descargar el PDF correspondiente');
  console.log('4. Si obtienes un error 400/404, el archivo no se migró correctamente');
  console.log('5. Si descarga, ¡la migración fue exitosa! 🎉');

  return ejemplos;
}

mostrarEjemplosPdfs().catch(console.error);