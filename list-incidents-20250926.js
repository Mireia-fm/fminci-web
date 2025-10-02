require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
);

async function listIncidents20250926() {
  console.log('🔍 BUSCANDO INCIDENCIAS CON FORMATO XXXXXXXX-XX');
  console.log('=' .repeat(60));

  try {
    // Buscar todas las incidencias que tengan formato de 8 dígitos seguidos de guión y 2 dígitos
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
      .order('num_solicitud');

    if (error) {
      console.error('❌ Error buscando incidencias:', error);
      return;
    }

    if (!incidencias || incidencias.length === 0) {
      console.log('✅ No se encontraron incidencias');
      return;
    }

    // Filtrar incidencias que tengan el formato XXXXXXXX-XX
    const formatoRegex = /^\d{8}-\d{2}$/;
    const incidenciasFormato = incidencias.filter(inc =>
      inc.num_solicitud && formatoRegex.test(inc.num_solicitud)
    );

    // Filtrar por los últimos 4 días
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - 4);

    const incidenciasRecientes = incidenciasFormato.filter(inc => {
      if (!inc.fecha) return false;
      const fechaIncidencia = new Date(inc.fecha);
      return fechaIncidencia >= fechaLimite;
    });

    if (incidenciasRecientes.length === 0) {
      console.log('✅ No se encontraron incidencias con formato XXXXXXXX-XX de los últimos 4 días');
      console.log(`📊 Total con formato XXXXXXXX-XX encontrado: ${incidenciasFormato.length}`);
      return;
    }

    console.log(`📋 INCIDENCIAS CON FORMATO XXXXXXXX-XX (ÚLTIMOS 4 DÍAS): ${incidenciasRecientes.length}`);
    console.log(`📊 Total con formato XXXXXXXX-XX: ${incidenciasFormato.length}\n`);

    // Mostrar detalles de cada incidencia reciente
    for (let i = 0; i < incidenciasRecientes.length; i++) {
      const inc = incidenciasRecientes[i];
      console.log(`${i + 1}. SOLICITUD: ${inc.num_solicitud}`);
      console.log(`   📋 ID: ${inc.id}`);
      console.log(`   📝 Descripción: ${inc.descripcion || 'Sin descripción'}`);
      console.log(`   🏢 Centro: ${inc.centro || 'Sin centro'}`);
      console.log(`   📅 Fecha: ${inc.fecha || 'Sin fecha'}`);
      console.log(`   🔄 Estado Cliente: ${inc.estado_cliente || 'Sin estado'}`);

      // Contar datos relacionados
      try {
        // Comentarios
        const { data: comentarios } = await supabase
          .from('comentarios')
          .select('id', { count: 'exact', head: true })
          .eq('incidencia_id', inc.id);

        // Adjuntos
        const { data: adjuntos } = await supabase
          .from('adjuntos')
          .select('id', { count: 'exact', head: true })
          .eq('incidencia_id', inc.id);

        // Casos de proveedor
        const { data: casos } = await supabase
          .from('proveedor_casos')
          .select('id, proveedor_id', { count: 'exact', head: true })
          .eq('incidencia_id', inc.id);

        // Presupuestos
        const { data: presupuestos } = await supabase
          .from('presupuestos')
          .select('id', { count: 'exact', head: true })
          .eq('incidencia_id', inc.id);

        // Historial
        const { data: historial } = await supabase
          .from('historial_estados')
          .select('id', { count: 'exact', head: true })
          .eq('incidencia_id', inc.id);

        console.log(`   📊 Datos relacionados:`);
        console.log(`      💬 Comentarios: ${comentarios?.length || 0}`);
        console.log(`      📎 Adjuntos: ${adjuntos?.length || 0}`);
        console.log(`      🏢 Casos proveedor: ${casos?.length || 0}`);
        console.log(`      💰 Presupuestos: ${presupuestos?.length || 0}`);
        console.log(`      📈 Historial: ${historial?.length || 0}`);

      } catch (relatedError) {
        console.log(`   ⚠️  Error consultando datos relacionados: ${relatedError.message}`);
      }

      console.log(''); // Línea vacía entre incidencias
    }

    console.log('=' .repeat(60));
    console.log(`📊 RESUMEN:`);
    console.log(`   Total incidencias a eliminar: ${incidenciasRecientes.length}`);
    console.log(`   Formato: XXXXXXXX-XX (8 dígitos seguidos de guión y 2 dígitos)`);
    console.log('');
    console.log('⚠️  IMPORTANTE:');
    console.log('   - Se eliminarán TODAS las incidencias listadas arriba');
    console.log('   - Se eliminarán TODOS sus datos relacionados (comentarios, adjuntos, etc.)');
    console.log('   - Esta acción NO se puede deshacer');
    console.log('');
    console.log('💡 Para proceder, confirma que quieres eliminar TODAS estas incidencias');

    return incidenciasRecientes;

  } catch (error) {
    console.error('💥 Error general:', error);
  }
}

listIncidents20250926().catch(console.error);