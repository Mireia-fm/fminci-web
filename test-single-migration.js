require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const DOWNLOADS_PATH = '/Users/mireia/Downloads/Cargas del visitante-2';
const BUCKET_NAME = 'incidencias';

async function testSingleMigration() {
  const testNumSolicitud = '08591';
  const testFileName = '20250910_105709.jpg';

  try {
    console.log('🧪 Probando migración individual...');

    // 1. Verificar que el archivo físico existe
    const filePath = path.join(DOWNLOADS_PATH, testFileName);
    if (!fs.existsSync(filePath)) {
      console.error('❌ Archivo no existe:', filePath);
      return;
    }
    console.log('✅ Archivo físico encontrado');

    // 2. Verificar que la incidencia existe en BD
    const { data: incidencia, error: selectError } = await supabase
      .from('incidencias')
      .select('num_solicitud, imagen_url')
      .eq('num_solicitud', testNumSolicitud)
      .single();

    if (selectError) {
      console.error('❌ Error buscando incidencia:', selectError);
      return;
    }

    if (!incidencia) {
      console.error('❌ Incidencia no encontrada:', testNumSolicitud);
      return;
    }

    console.log('✅ Incidencia encontrada:', incidencia);

    // 3. Subir archivo a Storage
    const fileBuffer = fs.readFileSync(filePath);
    const storagePath = `${testNumSolicitud}/${testFileName}`;

    console.log(`📤 Subiendo archivo a: ${storagePath}`);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, fileBuffer, {
        contentType: 'image/jpeg',
        upsert: true
      });

    if (uploadError) {
      console.error('❌ Error subiendo archivo:', uploadError);
      return;
    }

    console.log('✅ Archivo subido:', uploadData);

    // 4. Obtener URL pública
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath);

    const newUrl = publicUrlData.publicUrl;
    console.log('🔗 Nueva URL:', newUrl);

    // 5. Actualizar base de datos
    console.log(`🔄 Actualizando BD para ${testNumSolicitud}...`);

    const { data: updateData, error: updateError } = await supabase
      .from('incidencias')
      .update({ imagen_url: newUrl })
      .eq('num_solicitud', testNumSolicitud)
      .select();

    if (updateError) {
      console.error('❌ Error actualizando BD:', updateError);
      return;
    }

    console.log('✅ BD actualizada:', updateData);

    // 6. Verificar actualización
    const { data: verifyData, error: verifyError } = await supabase
      .from('incidencias')
      .select('num_solicitud, imagen_url')
      .eq('num_solicitud', testNumSolicitud)
      .single();

    if (verifyError) {
      console.error('❌ Error verificando:', verifyError);
      return;
    }

    console.log('🔍 Verificación final:', verifyData);
    console.log('🎉 Migración de prueba completada exitosamente!');

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

testSingleMigration();