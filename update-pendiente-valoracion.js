require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
);

async function updatePendienteValoracion() {
  console.log('🔄 Actualizando casos de "Pendiente valoración" a "Resuelta"...');

  // 1. Verificar casos actuales
  const { data: casosBefore, error: errorBefore } = await supabase
    .from('proveedor_casos')
    .select('*')
    .eq('estado_proveedor', 'Pendiente valoración')
    .eq('activo', true);

  if (errorBefore) {
    console.error('Error verificando casos:', errorBefore);
    return;
  }

  console.log(`📊 Casos encontrados con "Pendiente valoración": ${casosBefore?.length || 0}`);

  if (!casosBefore || casosBefore.length === 0) {
    console.log('✅ No hay casos para actualizar');
    return;
  }

  // 2. Actualizar estados
  const { data, error } = await supabase
    .from('proveedor_casos')
    .update({
      estado_proveedor: 'Resuelta',
      actualizado_en: new Date().toISOString()
    })
    .eq('estado_proveedor', 'Pendiente valoración')
    .eq('activo', true);

  if (error) {
    console.error('❌ Error actualizando estados:', error);
    return;
  }

  console.log(`✅ Estados actualizados exitosamente`);

  // 3. Verificar actualización
  const { data: casosAfter, error: errorAfter } = await supabase
    .from('proveedor_casos')
    .select('*')
    .eq('estado_proveedor', 'Pendiente valoración')
    .eq('activo', true);

  if (errorAfter) {
    console.error('Error verificando actualización:', errorAfter);
    return;
  }

  console.log(`📊 Casos restantes con "Pendiente valoración": ${casosAfter?.length || 0}`);

  // 4. Contar estados "Resuelta"
  const { data: resueltas, error: errorResueltas } = await supabase
    .from('proveedor_casos')
    .select('*')
    .eq('estado_proveedor', 'Resuelta')
    .eq('activo', true);

  if (!errorResueltas) {
    console.log(`📊 Total casos "Resuelta": ${resueltas?.length || 0}`);
  }

  return { actualizados: casosBefore.length, restantes: casosAfter?.length || 0 };
}

updatePendienteValoracion().catch(console.error);