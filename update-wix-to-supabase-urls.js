require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
);

// Función para sanitizar nombres de archivos
function sanitizeFilename(filename) {
  return filename
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
}

async function updateWixToSupabaseUrls() {
  console.log('🔄 MIGRACIÓN MASIVA DE URLs WIX → SUPABASE STORAGE\n');
  console.log('=' .repeat(80));

  try {
    // 1. Obtener todos los comentarios con URLs de Wix
    console.log('🔍 Obteniendo comentarios con URLs de Wix...');
    const { data: wixComments, error: fetchError } = await supabase
      .from('comentarios')
      .select(`
        id,
        documento_url,
        incidencia_id,
        incidencias!inner(num_solicitud)
      `)
      .like('documento_url', 'wix:document://%')
      .order('created_at');

    if (fetchError) {
      console.error('❌ Error obteniendo comentarios:', fetchError);
      return;
    }

    console.log(`📊 Comentarios con URLs de Wix encontrados: ${wixComments?.length || 0}`);

    if (!wixComments || wixComments.length === 0) {
      console.log('✅ No hay URLs de Wix para migrar');
      return;
    }

    // 2. Procesar por lotes
    const BATCH_SIZE = 20;
    const totalBatches = Math.ceil(wixComments.length / BATCH_SIZE);
    let actualizados = 0;
    let errores = 0;
    let noEncontrados = 0;

    console.log(`\n🚀 Procesando ${wixComments.length} comentarios en ${totalBatches} lotes\n`);

    for (let batch = 0; batch < totalBatches; batch++) {
      const start = batch * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, wixComments.length);
      const batchComments = wixComments.slice(start, end);

      console.log(`📦 LOTE ${batch + 1}/${totalBatches} (${batchComments.length} comentarios)`);
      console.log('─'.repeat(60));

      for (let i = 0; i < batchComments.length; i++) {
        const comment = batchComments[i];
        const globalIndex = start + i + 1;

        try {
          // Extraer el nombre del archivo de la URL de Wix
          const wixUrl = comment.documento_url;
          const filename = decodeURIComponent(wixUrl.split('/').pop());
          const sanitizedFilename = sanitizeFilename(filename);
          const numSolicitud = comment.incidencias.num_solicitud;

          console.log(`🔄 [${globalIndex}/${wixComments.length}] Procesando: ${numSolicitud}`);
          console.log(`   📄 Archivo: ${filename}`);

          if (filename !== sanitizedFilename) {
            console.log(`   🔧 Sanitizado: ${sanitizedFilename}`);
          }

          // Verificar si el archivo existe en Storage
          const storagePath = `incidencias/${numSolicitud}/comentarios/${sanitizedFilename}`;

          try {
            const { data: fileExists } = await supabase.storage
              .from('documentos')
              .getPublicUrl(storagePath);

            // Probar acceso al archivo
            const testResponse = await fetch(fileExists.publicUrl, { method: 'HEAD' });

            if (testResponse.status === 200) {
              // El archivo existe, actualizar URL
              const newUrl = fileExists.publicUrl;

              const { error: updateError } = await supabase
                .from('comentarios')
                .update({ documento_url: newUrl })
                .eq('id', comment.id);

              if (updateError) {
                console.log(`   ❌ Error actualizando BD: ${updateError.message}`);
                errores++;
              } else {
                console.log(`   ✅ URL actualizada exitosamente`);
                actualizados++;
              }
            } else {
              console.log(`   ⚠️  Archivo no encontrado en Storage (HTTP ${testResponse.status})`);
              noEncontrados++;
            }

          } catch (storageError) {
            console.log(`   ⚠️  Error verificando Storage: ${storageError.message}`);
            noEncontrados++;
          }

        } catch (error) {
          console.log(`   ❌ Error procesando comentario: ${error.message}`);
          errores++;
        }

        console.log('');
      }

      console.log(`📊 Lote ${batch + 1}: ✅${actualizados - (batch * BATCH_SIZE >= actualizados ? 0 : Math.min(BATCH_SIZE, actualizados - batch * BATCH_SIZE))} ❌${errores - (batch * BATCH_SIZE >= errores ? 0 : Math.min(BATCH_SIZE, errores - batch * BATCH_SIZE))} ⚠️${noEncontrados - (batch * BATCH_SIZE >= noEncontrados ? 0 : Math.min(BATCH_SIZE, noEncontrados - batch * BATCH_SIZE))}`);

      // Pausa entre lotes
      if (batch < totalBatches - 1) {
        console.log('⏳ Esperando 3 segundos antes del siguiente lote...\n');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    // 3. Resumen final
    console.log('\n' + '=' .repeat(80));
    console.log('🎉 MIGRACIÓN COMPLETADA - RESUMEN FINAL');
    console.log('=' .repeat(80));
    console.log(`📊 Total procesados: ${wixComments.length}`);
    console.log(`✅ URLs actualizadas: ${actualizados}`);
    console.log(`⚠️  Archivos no encontrados: ${noEncontrados}`);
    console.log(`❌ Errores: ${errores}`);

    const successRate = ((actualizados / wixComments.length) * 100).toFixed(1);
    console.log(`📈 Tasa de éxito: ${successRate}%`);

    // 4. Verificación final
    console.log('\n🔍 VERIFICACIÓN FINAL...');

    const { data: remainingWix } = await supabase
      .from('comentarios')
      .select('id', { count: 'exact', head: false })
      .like('documento_url', 'wix:document://%');

    const { data: migratedUrls } = await supabase
      .from('comentarios')
      .select('id', { count: 'exact', head: false })
      .like('documento_url', '%storage/v1/object/public/documentos%');

    console.log(`📊 URLs de Wix restantes: ${remainingWix?.length || 0}`);
    console.log(`📊 URLs migradas a Supabase: ${migratedUrls?.length || 0}`);

    return {
      procesados: wixComments.length,
      actualizados,
      noEncontrados,
      errores,
      restantes: remainingWix?.length || 0,
      migrados: migratedUrls?.length || 0
    };

  } catch (error) {
    console.error('💥 Error general en la migración:', error);
  }
}

updateWixToSupabaseUrls().catch(console.error);