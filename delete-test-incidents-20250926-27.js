require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
);

// Test incidents found by the identification script
const testIncidents = [
  {
    id: '2e34c63d-acc9-4166-beaa-2f9dd21c8f33',
    num_solicitud: '20250927-01',
    descripcion: 'prueba de resolución'
  },
  {
    id: '5950067d-0a1e-46aa-aec7-2648a34f1088',
    num_solicitud: '20250927-02',
    descripcion: '<sdvfh'
  },
  {
    id: 'd94107eb-2bce-49e0-b566-4703267faeed',
    num_solicitud: '20250927-03',
    descripcion: 'mh,jm'
  },
  {
    id: '2b6f05ab-1e36-4d22-b7d0-663c12b617ff',
    num_solicitud: '20250927-04',
    descripcion: 'ascv'
  }
];

async function deleteIncidentSafely(incident) {
  console.log(`\n🗑️  ELIMINANDO INCIDENCIA: ${incident.num_solicitud}`);
  console.log('═'.repeat(70));

  try {
    const incidenciaId = incident.id;
    console.log(`📋 ID: ${incidenciaId}`);
    console.log(`📝 Descripción: ${incident.descripcion}`);

    // 1. Delete attachments and their files from storage
    console.log('\n1️⃣ Eliminando adjuntos y archivos...');
    const { data: adjuntos, error: adjuntosSelectError } = await supabase
      .from('adjuntos')
      .select('id, storage_key, nombre_archivo')
      .eq('incidencia_id', incidenciaId);

    if (!adjuntosSelectError && adjuntos && adjuntos.length > 0) {
      // Delete files from storage
      for (const adjunto of adjuntos) {
        if (adjunto.storage_key) {
          const { error: storageError } = await supabase.storage
            .from('documentos')
            .remove([adjunto.storage_key]);

          if (storageError) {
            console.log(`   ⚠️  Error eliminando archivo ${adjunto.nombre_archivo}:`, storageError.message);
          } else {
            console.log(`   ✅ Archivo eliminado: ${adjunto.nombre_archivo}`);
          }
        }
      }

      // Delete attachment records
      const { error: adjuntosDeleteError } = await supabase
        .from('adjuntos')
        .delete()
        .eq('incidencia_id', incidenciaId);

      if (adjuntosDeleteError) {
        console.log(`   ❌ Error eliminando registros de adjuntos:`, adjuntosDeleteError);
      } else {
        console.log(`   ✅ ${adjuntos.length} registros de adjuntos eliminados`);
      }
    } else {
      console.log('   ℹ️  No hay adjuntos para eliminar');
    }

    // 2. Delete comments
    console.log('\n2️⃣ Eliminando comentarios...');
    const { data: comentarios } = await supabase
      .from('comentarios')
      .select('id')
      .eq('incidencia_id', incidenciaId);

    if (comentarios && comentarios.length > 0) {
      const { error: comentariosDeleteError } = await supabase
        .from('comentarios')
        .delete()
        .eq('incidencia_id', incidenciaId);

      if (comentariosDeleteError) {
        console.log(`   ❌ Error eliminando comentarios:`, comentariosDeleteError);
      } else {
        console.log(`   ✅ ${comentarios.length} comentarios eliminados`);
      }
    } else {
      console.log('   ℹ️  No hay comentarios para eliminar');
    }

    // 3. Delete provider appointments
    console.log('\n3️⃣ Eliminando citas de proveedores...');
    const { data: citas } = await supabase
      .from('citas_proveedores')
      .select('id')
      .eq('incidencia_id', incidenciaId);

    if (citas && citas.length > 0) {
      const { error: citasDeleteError } = await supabase
        .from('citas_proveedores')
        .delete()
        .eq('incidencia_id', incidenciaId);

      if (citasDeleteError) {
        console.log(`   ❌ Error eliminando citas:`, citasDeleteError);
      } else {
        console.log(`   ✅ ${citas.length} citas eliminadas`);
      }
    } else {
      console.log('   ℹ️  No hay citas para eliminar');
    }

    // 4. Delete budgets
    console.log('\n4️⃣ Eliminando presupuestos...');
    const { data: presupuestos } = await supabase
      .from('presupuestos')
      .select('id')
      .eq('incidencia_id', incidenciaId);

    if (presupuestos && presupuestos.length > 0) {
      const { error: presupuestosDeleteError } = await supabase
        .from('presupuestos')
        .delete()
        .eq('incidencia_id', incidenciaId);

      if (presupuestosDeleteError) {
        console.log(`   ❌ Error eliminando presupuestos:`, presupuestosDeleteError);
      } else {
        console.log(`   ✅ ${presupuestos.length} presupuestos eliminados`);
      }
    } else {
      console.log('   ℹ️  No hay presupuestos para eliminar');
    }

    // 5. Delete state history
    console.log('\n5️⃣ Eliminando historial de estados...');
    const { data: historial } = await supabase
      .from('historial_estados')
      .select('id')
      .eq('incidencia_id', incidenciaId);

    if (historial && historial.length > 0) {
      const { error: historialDeleteError } = await supabase
        .from('historial_estados')
        .delete()
        .eq('incidencia_id', incidenciaId);

      if (historialDeleteError) {
        console.log(`   ❌ Error eliminando historial:`, historialDeleteError);
      } else {
        console.log(`   ✅ ${historial.length} registros de historial eliminados`);
      }
    } else {
      console.log('   ℹ️  No hay historial para eliminar');
    }

    // 6. Delete provider cases
    console.log('\n6️⃣ Eliminando casos de proveedor...');
    const { data: casos } = await supabase
      .from('proveedor_casos')
      .select('id')
      .eq('incidencia_id', incidenciaId);

    if (casos && casos.length > 0) {
      const { error: casosDeleteError } = await supabase
        .from('proveedor_casos')
        .delete()
        .eq('incidencia_id', incidenciaId);

      if (casosDeleteError) {
        console.log(`   ❌ Error eliminando casos de proveedor:`, casosDeleteError);
      } else {
        console.log(`   ✅ ${casos.length} casos de proveedor eliminados`);
      }
    } else {
      console.log('   ℹ️  No hay casos de proveedor para eliminar');
    }

    // 7. Delete files from storage by folder path
    console.log('\n7️⃣ Eliminando archivos de Storage por carpeta...');
    try {
      const { data: storageFiles, error: storageListError } = await supabase.storage
        .from('documentos')
        .list(`incidencias/${incident.num_solicitud}`, { limit: 100 });

      if (!storageListError && storageFiles && storageFiles.length > 0) {
        const filesToDelete = storageFiles.map(file => `incidencias/${incident.num_solicitud}/${file.name}`);
        const { error: storageDeleteError } = await supabase.storage
          .from('documentos')
          .remove(filesToDelete);

        if (storageDeleteError) {
          console.log(`   ⚠️  Error eliminando archivos de storage:`, storageDeleteError.message);
        } else {
          console.log(`   ✅ ${storageFiles.length} archivos eliminados de Storage`);
        }
      } else {
        console.log('   ℹ️  No hay archivos adicionales en Storage para eliminar');
      }
    } catch (storageError) {
      console.log('   ℹ️  Sin carpeta de archivos en Storage');
    }

    // 8. Finally, delete the incident
    console.log('\n8️⃣ Eliminando incidencia principal...');
    const { error: incidenciaDeleteError } = await supabase
      .from('incidencias')
      .delete()
      .eq('id', incidenciaId);

    if (incidenciaDeleteError) {
      console.error(`   ❌ Error eliminando incidencia:`, incidenciaDeleteError);
      return false;
    }

    console.log(`   ✅ Incidencia ${incident.num_solicitud} eliminada exitosamente`);
    return true;

  } catch (error) {
    console.error(`💥 Error eliminando ${incident.num_solicitud}:`, error);
    return false;
  }
}

async function deleteAllTestIncidents() {
  console.log('🗂️  ELIMINACIÓN DE INCIDENCIAS DE PRUEBA 2025-09-26/27');
  console.log('═'.repeat(80));
  console.log(`📋 Total de incidencias a eliminar: ${testIncidents.length}`);
  console.log(`📅 Fecha: 2025-09-27`);
  console.log('═'.repeat(80));

  console.log('\n⚠️  ÚLTIMA CONFIRMACIÓN:');
  console.log('   - Se eliminarán TODAS las incidencias listadas');
  console.log('   - Se eliminarán TODOS sus datos relacionados');
  console.log('   - Esta acción NO se puede deshacer');
  console.log('   - Incidencias:');
  testIncidents.forEach((inc, i) => {
    console.log(`     ${i + 1}. ${inc.num_solicitud} - "${inc.descripcion}"`);
  });

  console.log('\n🚀 Iniciando eliminación en 3 segundos...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  let eliminadas = 0;
  let errores = 0;

  for (const incident of testIncidents) {
    const resultado = await deleteIncidentSafely(incident);
    if (resultado) {
      eliminadas++;
    } else {
      errores++;
    }

    // Small pause between deletions
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n' + '═'.repeat(80));
  console.log('🎉 PROCESO DE ELIMINACIÓN COMPLETADO');
  console.log(`✅ Incidencias eliminadas: ${eliminadas}`);
  console.log(`❌ Errores: ${errores}`);
  if (eliminadas === testIncidents.length) {
    console.log('✨ TODAS las incidencias de prueba han sido eliminadas exitosamente');
  }
  console.log('═'.repeat(80));

  return { eliminadas, errores };
}

// Execute deletion
deleteAllTestIncidents()
  .then((result) => {
    console.log('\n📊 Resumen final:');
    console.log(`   Eliminadas: ${result.eliminadas}/${testIncidents.length}`);
    console.log(`   Errores: ${result.errores}`);
    process.exit(result.errores > 0 ? 1 : 0);
  })
  .catch((error) => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });