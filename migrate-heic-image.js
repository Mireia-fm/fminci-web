const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function migrateHeicImage() {
  console.log('🔄 Migrando imagen HEIC\n');
  console.log('='.repeat(70));

  const num = '49780';
  const filename = '49780.heic';
  const oldPath = `incidencias/${num}/${filename}`;
  const newPath = `${num}/${filename}`;

  console.log(`\n📸 Incidencia: ${num}`);
  console.log(`   Desde: ${oldPath}`);
  console.log(`   Hacia: ${newPath}\n`);

  // Mover el archivo
  console.log('📦 Moviendo archivo...');

  const { error: moveError } = await supabase.storage
    .from('incidencias')
    .move(oldPath, newPath);

  if (moveError) {
    console.error(`❌ Error al mover: ${moveError.message}`);
    return;
  }

  console.log('✅ Archivo movido exitosamente\n');

  // Verificar en la BD
  console.log('💾 Verificando registro en BD...');

  const { data: incidencia, error: selectError } = await supabase
    .from('incidencias')
    .select('num_solicitud, imagen_url')
    .eq('num_solicitud', num)
    .maybeSingle();

  if (selectError) {
    console.error(`❌ Error consultando BD: ${selectError.message}`);
    return;
  }

  if (!incidencia) {
    console.log('⚠️  No existe registro en tabla incidencias');
    return;
  }

  console.log(`\n   Registro encontrado:`);
  console.log(`   num_solicitud: ${incidencia.num_solicitud}`);
  console.log(`   imagen_url actual: ${incidencia.imagen_url || '(NULL)'}`);

  // Actualizar URL si es necesario
  if (incidencia.imagen_url === oldPath || incidencia.imagen_url === `incidencias/${num}/${filename}`) {
    console.log('\n📝 Actualizando imagen_url...');

    const { error: updateError } = await supabase
      .from('incidencias')
      .update({ imagen_url: newPath })
      .eq('num_solicitud', num);

    if (updateError) {
      console.error(`❌ Error actualizando: ${updateError.message}`);
    } else {
      console.log(`✅ URL actualizada: ${newPath}`);
    }
  } else if (!incidencia.imagen_url) {
    console.log('\n📝 Estableciendo imagen_url...');

    const { error: updateError } = await supabase
      .from('incidencias')
      .update({ imagen_url: newPath })
      .eq('num_solicitud', num);

    if (updateError) {
      console.error(`❌ Error actualizando: ${updateError.message}`);
    } else {
      console.log(`✅ URL establecida: ${newPath}`);
    }
  } else {
    console.log(`✅ URL ya está correcta o tiene otro valor`);
  }

  // Verificar resultado final
  console.log('\n🔍 Verificación final...');

  const { data: finalCheck } = await supabase.storage
    .from('incidencias')
    .list(num, { limit: 10 });

  if (finalCheck && finalCheck.length > 0) {
    console.log(`\n✅ Contenido de ${num}/:`);
    finalCheck.forEach(f => {
      const icon = f.id ? '📄' : '📂';
      const size = f.id ? ` (${(f.metadata?.size / 1024).toFixed(2)} KB)` : '';
      console.log(`   ${icon} ${f.name}${size}`);
    });
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ Migración completada exitosamente');
  console.log('='.repeat(70));
}

migrateHeicImage().catch(console.error);
