require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
);

// IDs of the deleted incidents for verification
const deletedIncidentIds = [
  '2e34c63d-acc9-4166-beaa-2f9dd21c8f33',
  '5950067d-0a1e-46aa-aec7-2648a34f1088',
  'd94107eb-2bce-49e0-b566-4703267faeed',
  '2b6f05ab-1e36-4d22-b7d0-663c12b617ff'
];

const deletedSolicitudes = [
  '20250927-01',
  '20250927-02',
  '20250927-03',
  '20250927-04'
];

async function verifyDeletion() {
  console.log('🔍 VERIFICANDO ELIMINACIÓN DE INCIDENCIAS DE PRUEBA');
  console.log('=' .repeat(70));

  let verificacionCompleta = true;

  try {
    // 1. Verify main incidents are deleted
    console.log('\n1️⃣ Verificando que las incidencias principales fueron eliminadas...');

    for (const id of deletedIncidentIds) {
      const { data: incidencia, error } = await supabase
        .from('incidencias')
        .select('id, num_solicitud')
        .eq('id', id)
        .single();

      if (error && error.code === 'PGRST116') {
        console.log(`   ✅ Incidencia ${id} correctamente eliminada`);
      } else if (incidencia) {
        console.log(`   ❌ PROBLEMA: Incidencia ${id} (${incidencia.num_solicitud}) AÚN EXISTE`);
        verificacionCompleta = false;
      } else {
        console.log(`   ⚠️  Error verificando ${id}:`, error);
      }
    }

    // 2. Verify by num_solicitud as well
    console.log('\n2️⃣ Verificando por número de solicitud...');

    for (const numSolicitud of deletedSolicitudes) {
      const { data: incidencia, error } = await supabase
        .from('incidencias')
        .select('id, num_solicitud')
        .eq('num_solicitud', numSolicitud)
        .single();

      if (error && error.code === 'PGRST116') {
        console.log(`   ✅ Solicitud ${numSolicitud} correctamente eliminada`);
      } else if (incidencia) {
        console.log(`   ❌ PROBLEMA: Solicitud ${numSolicitud} AÚN EXISTE`);
        verificacionCompleta = false;
      } else {
        console.log(`   ⚠️  Error verificando ${numSolicitud}:`, error);
      }
    }

    // 3. Check for any remaining incidents on target dates
    console.log('\n3️⃣ Verificando que no quedan incidencias en las fechas objetivo...');

    const { data: incidenciasRestantes, error: errorRestantes } = await supabase
      .from('incidencias')
      .select('id, num_solicitud, descripcion, fecha')
      .gte('fecha', '2025-09-26')
      .lte('fecha', '2025-09-27');

    if (errorRestantes) {
      console.log(`   ❌ Error consultando incidencias restantes:`, errorRestantes);
      verificacionCompleta = false;
    } else if (incidenciasRestantes && incidenciasRestantes.length > 0) {
      console.log(`   ⚠️  Se encontraron ${incidenciasRestantes.length} incidencias restantes en las fechas objetivo:`);
      incidenciasRestantes.forEach((inc, i) => {
        console.log(`     ${i + 1}. ${inc.num_solicitud} - ${inc.descripcion} (${inc.fecha})`);
      });
    } else {
      console.log(`   ✅ No hay incidencias restantes en las fechas 2025-09-26 y 2025-09-27`);
    }

    // 4. Verify related data was deleted
    console.log('\n4️⃣ Verificando que los datos relacionados fueron eliminados...');

    // Check comments
    const { count: comentariosCount } = await supabase
      .from('comentarios')
      .select('*', { count: 'exact', head: true })
      .in('incidencia_id', deletedIncidentIds);

    if (comentariosCount === 0) {
      console.log(`   ✅ Comentarios: 0 registros restantes`);
    } else {
      console.log(`   ❌ PROBLEMA: ${comentariosCount} comentarios AÚN EXISTEN`);
      verificacionCompleta = false;
    }

    // Check attachments
    const { count: adjuntosCount } = await supabase
      .from('adjuntos')
      .select('*', { count: 'exact', head: true })
      .in('incidencia_id', deletedIncidentIds);

    if (adjuntosCount === 0) {
      console.log(`   ✅ Adjuntos: 0 registros restantes`);
    } else {
      console.log(`   ❌ PROBLEMA: ${adjuntosCount} adjuntos AÚN EXISTEN`);
      verificacionCompleta = false;
    }

    // Check provider cases
    const { count: casosCount } = await supabase
      .from('proveedor_casos')
      .select('*', { count: 'exact', head: true })
      .in('incidencia_id', deletedIncidentIds);

    if (casosCount === 0) {
      console.log(`   ✅ Casos proveedor: 0 registros restantes`);
    } else {
      console.log(`   ❌ PROBLEMA: ${casosCount} casos de proveedor AÚN EXISTEN`);
      verificacionCompleta = false;
    }

    // Check budgets
    const { count: presupuestosCount } = await supabase
      .from('presupuestos')
      .select('*', { count: 'exact', head: true })
      .in('incidencia_id', deletedIncidentIds);

    if (presupuestosCount === 0) {
      console.log(`   ✅ Presupuestos: 0 registros restantes`);
    } else {
      console.log(`   ❌ PROBLEMA: ${presupuestosCount} presupuestos AÚN EXISTEN`);
      verificacionCompleta = false;
    }

    // Check state history
    const { count: historialCount } = await supabase
      .from('historial_estados')
      .select('*', { count: 'exact', head: true })
      .in('incidencia_id', deletedIncidentIds);

    if (historialCount === 0) {
      console.log(`   ✅ Historial estados: 0 registros restantes`);
    } else {
      console.log(`   ❌ PROBLEMA: ${historialCount} registros de historial AÚN EXISTEN`);
      verificacionCompleta = false;
    }

    // Check provider appointments
    const { count: citasCount } = await supabase
      .from('citas_proveedores')
      .select('*', { count: 'exact', head: true })
      .in('incidencia_id', deletedIncidentIds);

    if (citasCount === 0) {
      console.log(`   ✅ Citas proveedores: 0 registros restantes`);
    } else {
      console.log(`   ❌ PROBLEMA: ${citasCount} citas AÚN EXISTEN`);
      verificacionCompleta = false;
    }

    // 5. Final summary
    console.log('\n' + '=' .repeat(70));
    if (verificacionCompleta) {
      console.log('🎉 VERIFICACIÓN EXITOSA');
      console.log('✅ Todas las incidencias de prueba y sus datos relacionados fueron eliminados correctamente');
      console.log('✅ No quedan residuos en la base de datos');
    } else {
      console.log('❌ VERIFICACIÓN FALLÓ');
      console.log('⚠️  Algunos datos no fueron eliminados correctamente');
      console.log('⚠️  Revisar los problemas reportados arriba');
    }
    console.log('=' .repeat(70));

    return verificacionCompleta;

  } catch (error) {
    console.error('💥 Error durante verificación:', error);
    return false;
  }
}

verifyDeletion()
  .then(success => {
    if (success) {
      console.log('\n✅ Verificación completada exitosamente');
      process.exit(0);
    } else {
      console.log('\n❌ Verificación falló');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n💥 Error fatal durante verificación:', error);
    process.exit(1);
  });