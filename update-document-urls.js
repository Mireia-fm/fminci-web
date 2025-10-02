require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
);

async function updateDocumentUrls() {
  console.log('🔄 Actualizando URLs de documentos migrados...\n');

  // 1. Primero buscar todos los documentos con rutas de visitante-3
  console.log('🔍 Buscando documentos con rutas de visitante-3...');

  const { data: documentos, error: searchError } = await supabase
    .from('comentarios')
    .select('id, documento_url, incidencia_id')
    .like('documento_url', '%visitante-3%');

  if (searchError) {
    console.error('❌ Error buscando documentos:', searchError);
    return;
  }

  console.log(`📋 Encontrados ${documentos?.length || 0} documentos para actualizar`);

  if (!documentos || documentos.length === 0) {
    console.log('✅ No hay documentos para actualizar');
    return;
  }

  // 2. Mostrar algunos ejemplos
  console.log('\n📄 Ejemplos de documentos encontrados:');
  documentos.slice(0, 5).forEach((doc, i) => {
    console.log(`   ${i + 1}. ID: ${doc.id}, Incidencia: ${doc.incidencia_id}`);
    console.log(`      URL: ${doc.documento_url}`);
  });

  // 3. Para cada documento, crear la nueva URL
  let actualizados = 0;
  let errores = 0;

  console.log('\n🔄 Actualizando URLs...');

  for (const doc of documentos) {
    try {
      // Extraer el nombre del archivo
      const filename = doc.documento_url.split('/').pop();

      // Sanitizar el nombre del archivo
      const sanitizedFilename = filename
        .replace(/[àáâäèéêëìíîïòóôöùúûüçñ\[\]()]/g, (match) => {
          const replacements = {
            'à': 'a', 'á': 'a', 'â': 'a', 'ä': 'a',
            'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e',
            'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i',
            'ò': 'o', 'ó': 'o', 'ô': 'o', 'ö': 'o',
            'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u',
            'ç': 'c', 'ñ': 'n',
            '[': '_', ']': '_', '(': '_', ')': '_'
          };
          return replacements[match] || '_';
        })
        .replace(/\s+/g, '_');

      // Necesitamos obtener el num_solicitud de la incidencia
      const { data: incidencia } = await supabase
        .from('incidencias')
        .select('num_solicitud')
        .eq('id', doc.incidencia_id)
        .single();

      if (!incidencia) {
        console.log(`⚠️  No se encontró incidencia para ID: ${doc.incidencia_id}`);
        continue;
      }

      // Crear nueva URL
      const newUrl = `https://xgdilpgbpkgaltvkdodi.supabase.co/storage/v1/object/public/documentos/incidencias/${incidencia.num_solicitud}/comentarios/${sanitizedFilename}`;

      // Actualizar el registro
      const { error: updateError } = await supabase
        .from('comentarios')
        .update({ documento_url: newUrl })
        .eq('id', doc.id);

      if (updateError) {
        console.error(`❌ Error actualizando documento ID ${doc.id}:`, updateError);
        errores++;
      } else {
        console.log(`✅ Actualizado: ${incidencia.num_solicitud}/${sanitizedFilename}`);
        actualizados++;
      }

    } catch (error) {
      console.error(`❌ Error procesando documento ID ${doc.id}:`, error);
      errores++;
    }
  }

  console.log(`\n📊 Resultado:`);
  console.log(`   ✅ Actualizados: ${actualizados}`);
  console.log(`   ❌ Errores: ${errores}`);
  console.log(`   📋 Total procesados: ${documentos.length}`);

  // 4. Verificar que no quedan documentos con visitante-3
  const { data: restantes } = await supabase
    .from('comentarios')
    .select('id, documento_url')
    .like('documento_url', '%visitante-3%');

  console.log(`\n🔍 Documentos restantes con visitante-3: ${restantes?.length || 0}`);

  if (restantes && restantes.length > 0) {
    console.log('⚠️  Algunos documentos no se actualizaron:');
    restantes.slice(0, 3).forEach((doc, i) => {
      console.log(`   ${i + 1}. ID: ${doc.id} - ${doc.documento_url}`);
    });
  }

  return { actualizados, errores, total: documentos.length };
}

updateDocumentUrls().catch(console.error);