const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verify() {
  console.log('🔍 Verificando ubicación de imágenes en Storage\n');
  console.log('='.repeat(70));

  // Ejemplos de incidencias para verificar
  const testCases = [
    { num: '52718', expected: '52718/20241105_121137.jpg' },
    { num: '10352', expected: '10352/SEGURO GOTERA VEINA(OLGA).jpg' },
    { num: '49680', expected: '49680/HDMI.jpg' },
    { num: '32704', expected_wrong: 'incidencias/32704/IMG20240903162638.avif', expected_correct: '32704/IMG20240903162638.avif' },
  ];

  console.log('\n📋 EJEMPLOS DE IMÁGENES EN LA RAÍZ (estructura correcta):\n');

  for (const test of testCases.slice(0, 3)) {
    console.log(`📁 Verificando: ${test.num}`);

    // Listar contenido de la carpeta en raíz
    const { data: files, error } = await supabase.storage
      .from('incidencias')
      .list(test.num, { limit: 10 });

    if (error) {
      console.log(`   ❌ Error: ${error.message}`);
      continue;
    }

    console.log(`   📂 Contenido de carpeta ${test.num}/ en RAÍZ:`);
    if (files && files.length > 0) {
      files.forEach(f => {
        const icon = f.id ? '   📄' : '   📂';
        console.log(`${icon} ${f.name} ${f.id ? `(${(f.metadata?.size / 1024).toFixed(1)} KB)` : ''}`);
      });
    } else {
      console.log('   (vacía)');
    }

    // Intentar descargar la imagen
    const { data: imgData, error: dlError } = await supabase.storage
      .from('incidencias')
      .download(test.expected);

    if (dlError) {
      console.log(`   ❌ No se puede descargar: ${test.expected}`);
      console.log(`      Error: ${dlError.message}`);
    } else {
      console.log(`   ✅ CONFIRMADO: Imagen existe en ${test.expected}`);
      console.log(`      Tamaño: ${(imgData.size / 1024).toFixed(2)} KB`);
    }
    console.log('');
  }

  console.log('\n' + '='.repeat(70));
  console.log('📋 EJEMPLO DE IMAGEN EN UBICACIÓN INCORRECTA:\n');

  const wrongCase = testCases[3];
  console.log(`📁 Incidencia: ${wrongCase.num}`);

  // Verificar ubicación INCORRECTA (con prefijo incidencias/)
  console.log(`\n   ❌ Ubicación INCORRECTA: ${wrongCase.expected_wrong}`);
  const { data: wrongImg, error: wrongErr } = await supabase.storage
    .from('incidencias')
    .download(wrongCase.expected_wrong);

  if (!wrongErr) {
    console.log(`      ✓ Archivo existe aquí (${(wrongImg.size / 1024).toFixed(2)} KB)`);
    console.log(`      ⚠️  NECESITA SER MOVIDO`);
  } else {
    console.log(`      Archivo NO existe aquí`);
  }

  // Verificar ubicación CORRECTA (sin prefijo)
  console.log(`\n   ✅ Ubicación CORRECTA: ${wrongCase.expected_correct}`);
  const { data: correctImg, error: correctErr } = await supabase.storage
    .from('incidencias')
    .download(wrongCase.expected_correct);

  if (!correctErr) {
    console.log(`      ✓ Archivo existe aquí (${(correctImg.size / 1024).toFixed(2)} KB)`);
  } else {
    console.log(`      Archivo NO existe aquí`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('📊 RESUMEN DE ESTRUCTURA:\n');
  console.log('✅ CORRECTO:   {num_solicitud}/imagen.jpg');
  console.log('               Ejemplo: 52718/20241105_121137.jpg');
  console.log('');
  console.log('❌ INCORRECTO: incidencias/{num_solicitud}/imagen.jpg');
  console.log('               Ejemplo: incidencias/32704/IMG20240903162638.avif');
  console.log('');
  console.log('🎯 OBJETIVO: Mover todas las imágenes a la estructura correcta');
  console.log('             y eliminar la carpeta incidencias/ del bucket.');
}

verify().catch(console.error);
