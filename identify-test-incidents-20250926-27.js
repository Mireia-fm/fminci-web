require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
);

async function identifyTestIncidents() {
  console.log('🔍 IDENTIFICANDO INCIDENCIAS DE PRUEBA - 2025-09-26 y 2025-09-27');
  console.log('=' .repeat(80));

  try {
    // Query incidencias table for incidents created on specified dates
    // First, let's get all incidents and filter by fecha column
    const { data: incidencias, error } = await supabase
      .from('incidencias')
      .select(`
        id,
        num_solicitud,
        descripcion,
        estado_cliente,
        centro,
        fecha
      `)
      .gte('fecha', '2025-09-26')
      .lte('fecha', '2025-09-27')
      .order('fecha');

    if (error) {
      console.error('❌ Error consultando incidencias:', error);
      return [];
    }

    if (!incidencias || incidencias.length === 0) {
      console.log('✅ No se encontraron incidencias en las fechas especificadas');
      return [];
    }

    console.log(`📋 INCIDENCIAS ENCONTRADAS: ${incidencias.length}\n`);

    const incidenciasConDetalles = [];

    // For each incident, get related data details
    for (let i = 0; i < incidencias.length; i++) {
      const inc = incidencias[i];
      console.log(`${i + 1}. INCIDENCIA: ${inc.num_solicitud || 'Sin número'}`);
      console.log(`   📋 ID: ${inc.id}`);
      console.log(`   📝 Descripción: ${inc.descripcion || 'Sin descripción'}`);
      console.log(`   🏢 Centro: ${inc.centro || 'Sin centro'}`);
      console.log(`   📅 Fecha: ${inc.fecha || 'Sin fecha'}`);
      console.log(`   🔄 Estado Cliente: ${inc.estado_cliente || 'Sin estado'}`);

      // Count related data
      const relacionados = {};

      try {
        // Comments
        const { count: comentariosCount } = await supabase
          .from('comentarios')
          .select('*', { count: 'exact', head: true })
          .eq('incidencia_id', inc.id);

        // Attachments
        const { count: adjuntosCount } = await supabase
          .from('adjuntos')
          .select('*', { count: 'exact', head: true })
          .eq('incidencia_id', inc.id);

        // Provider cases
        const { count: casosCount } = await supabase
          .from('proveedor_casos')
          .select('*', { count: 'exact', head: true })
          .eq('incidencia_id', inc.id);

        // Budgets
        const { count: presupuestosCount } = await supabase
          .from('presupuestos')
          .select('*', { count: 'exact', head: true })
          .eq('incidencia_id', inc.id);

        // History
        const { count: historialCount } = await supabase
          .from('historial_estados')
          .select('*', { count: 'exact', head: true })
          .eq('incidencia_id', inc.id);

        // Provider appointments
        const { count: citasCount } = await supabase
          .from('citas_proveedores')
          .select('*', { count: 'exact', head: true })
          .eq('incidencia_id', inc.id);

        relacionados.comentarios = comentariosCount || 0;
        relacionados.adjuntos = adjuntosCount || 0;
        relacionados.casos = casosCount || 0;
        relacionados.presupuestos = presupuestosCount || 0;
        relacionados.historial = historialCount || 0;
        relacionados.citas = citasCount || 0;

        console.log(`   📊 Datos relacionados:`);
        console.log(`      💬 Comentarios: ${relacionados.comentarios}`);
        console.log(`      📎 Adjuntos: ${relacionados.adjuntos}`);
        console.log(`      🏢 Casos proveedor: ${relacionados.casos}`);
        console.log(`      💰 Presupuestos: ${relacionados.presupuestos}`);
        console.log(`      📈 Historial: ${relacionados.historial}`);
        console.log(`      📅 Citas proveedores: ${relacionados.citas}`);

      } catch (relatedError) {
        console.log(`   ⚠️  Error consultando datos relacionados: ${relatedError.message}`);
      }

      // Add to collection for deletion script
      incidenciasConDetalles.push({
        ...inc,
        relacionados
      });

      console.log(''); // Empty line between incidents
    }

    console.log('=' .repeat(80));
    console.log(`📊 RESUMEN:`);
    console.log(`   📅 Fecha objetivo: 2025-09-26 y 2025-09-27`);
    console.log(`   📋 Total incidencias encontradas: ${incidencias.length}`);

    const totalComentarios = incidenciasConDetalles.reduce((sum, inc) => sum + (inc.relacionados?.comentarios || 0), 0);
    const totalAdjuntos = incidenciasConDetalles.reduce((sum, inc) => sum + (inc.relacionados?.adjuntos || 0), 0);
    const totalCasos = incidenciasConDetalles.reduce((sum, inc) => sum + (inc.relacionados?.casos || 0), 0);
    const totalPresupuestos = incidenciasConDetalles.reduce((sum, inc) => sum + (inc.relacionados?.presupuestos || 0), 0);
    const totalHistorial = incidenciasConDetalles.reduce((sum, inc) => sum + (inc.relacionados?.historial || 0), 0);
    const totalCitas = incidenciasConDetalles.reduce((sum, inc) => sum + (inc.relacionados?.citas || 0), 0);

    console.log(`   💬 Total comentarios: ${totalComentarios}`);
    console.log(`   📎 Total adjuntos: ${totalAdjuntos}`);
    console.log(`   🏢 Total casos proveedor: ${totalCasos}`);
    console.log(`   💰 Total presupuestos: ${totalPresupuestos}`);
    console.log(`   📈 Total historial: ${totalHistorial}`);
    console.log(`   📅 Total citas proveedores: ${totalCitas}`);
    console.log('');
    console.log('⚠️  IMPORTANTE:');
    console.log('   - Se eliminarán TODAS las incidencias listadas arriba');
    console.log('   - Se eliminarán TODOS sus datos relacionados');
    console.log('   - Esta acción NO se puede deshacer');
    console.log('   - Revisar cada incidencia para confirmar que son de prueba');

    return incidenciasConDetalles;

  } catch (error) {
    console.error('💥 Error general:', error);
    return [];
  }
}

// Execute and export results
identifyTestIncidents()
  .then(incidents => {
    if (incidents.length > 0) {
      console.log('\n✅ Identificación completada. Revisar lista antes de proceder con eliminación.');
    }
  })
  .catch(console.error);