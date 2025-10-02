require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
);

const incidenciasAEliminar = [
  '20250924-01',
  '20250924-02',
  '20250924-04',
  '20250924-05',
  '20250924-06',
  '20250925-01',
  '20250925-02'
];

async function deleteIncident(numSolicitud) {
  console.log(`\n🗑️  ELIMINANDO INCIDENCIA: ${numSolicitud}`);
  console.log('═'.repeat(50));

  try {
    // 1. Buscar la incidencia
    const { data: incidencia, error: incidenciaError } = await supabase
      .from('incidencias')
      .select('id, num_solicitud, descripcion')
      .eq('num_solicitud', numSolicitud)
      .single();

    if (incidenciaError) {
      console.error('❌ Error buscando incidencia:', incidenciaError);
      return false;
    }

    if (!incidencia) {
      console.log('⚠️  Incidencia no encontrada');
      return false;
    }

    console.log(`📋 Incidencia encontrada: ${incidencia.descripcion || 'Sin descripción'}`);
    const incidenciaId = incidencia.id;

    // 2. Eliminar adjuntos
    const { data: adjuntos, error: adjuntosSelectError } = await supabase
      .from('adjuntos')
      .select('id, storage_key, nombre_archivo')
      .eq('incidencia_id', incidenciaId);

    if (!adjuntosSelectError && adjuntos && adjuntos.length > 0) {
      // Eliminar archivos del Storage
      for (const adjunto of adjuntos) {
        if (adjunto.storage_key) {
          const { error: storageError } = await supabase.storage
            .from('documentos')
            .remove([adjunto.storage_key]);

          if (storageError) {
            console.log(`⚠️  Error eliminando archivo ${adjunto.nombre_archivo}:`, storageError.message);
          }
        }
      }

      // Eliminar registros de adjuntos
      await supabase.from('adjuntos').delete().eq('incidencia_id', incidenciaId);
      console.log(`✅ ${adjuntos.length} adjuntos eliminados`);
    }

    // 3. Eliminar comentarios
    const { data: comentarios } = await supabase
      .from('comentarios')
      .select('id')
      .eq('incidencia_id', incidenciaId);

    if (comentarios && comentarios.length > 0) {
      await supabase.from('comentarios').delete().eq('incidencia_id', incidenciaId);
      console.log(`✅ ${comentarios.length} comentarios eliminados`);
    }

    // 4. Eliminar historial de estados
    const { data: historial } = await supabase
      .from('historial_estados')
      .select('id')
      .eq('incidencia_id', incidenciaId);

    if (historial && historial.length > 0) {
      await supabase.from('historial_estados').delete().eq('incidencia_id', incidenciaId);
      console.log(`✅ ${historial.length} registros de historial eliminados`);
    }

    // 5. Eliminar presupuestos
    const { data: presupuestos } = await supabase
      .from('presupuestos')
      .select('id')
      .eq('incidencia_id', incidenciaId);

    if (presupuestos && presupuestos.length > 0) {
      await supabase.from('presupuestos').delete().eq('incidencia_id', incidenciaId);
      console.log(`✅ ${presupuestos.length} presupuestos eliminados`);
    }

    // 6. Eliminar casos de proveedor
    const { data: casos } = await supabase
      .from('proveedor_casos')
      .select('id')
      .eq('incidencia_id', incidenciaId);

    if (casos && casos.length > 0) {
      await supabase.from('proveedor_casos').delete().eq('incidencia_id', incidenciaId);
      console.log(`✅ ${casos.length} casos de proveedor eliminados`);
    }

    // 7. Eliminar archivos del Storage por carpeta
    try {
      const { data: storageFiles, error: storageListError } = await supabase.storage
        .from('documentos')
        .list(`incidencias/${numSolicitud}`, { limit: 100 });

      if (!storageListError && storageFiles && storageFiles.length > 0) {
        const filesToDelete = storageFiles.map(file => `incidencias/${numSolicitud}/${file.name}`);
        await supabase.storage.from('documentos').remove(filesToDelete);
        console.log(`✅ ${storageFiles.length} archivos eliminados de Storage`);
      }
    } catch (storageError) {
      // Silencioso si no hay archivos
    }

    // 8. Finalmente, eliminar la incidencia
    const { error: incidenciaDeleteError } = await supabase
      .from('incidencias')
      .delete()
      .eq('id', incidenciaId);

    if (incidenciaDeleteError) {
      console.error('❌ Error eliminando incidencia:', incidenciaDeleteError);
      return false;
    }

    console.log(`✅ Incidencia ${numSolicitud} eliminada exitosamente`);
    return true;

  } catch (error) {
    console.error(`💥 Error eliminando ${numSolicitud}:`, error);
    return false;
  }
}

async function deleteTestIncidentsBatch() {
  console.log('🗂️  ELIMINACIÓN MASIVA DE INCIDENCIAS DE PRUEBA');
  console.log('═'.repeat(60));
  console.log(`📋 Total de incidencias a eliminar: ${incidenciasAEliminar.length}`);
  console.log(`📅 Formato: XXXXXXXX-XX (8 dígitos + guión + 2 dígitos)`);
  console.log('═'.repeat(60));

  let eliminadas = 0;
  let errores = 0;

  for (const numSolicitud of incidenciasAEliminar) {
    const resultado = await deleteIncident(numSolicitud);
    if (resultado) {
      eliminadas++;
    } else {
      errores++;
    }

    // Pequeña pausa entre eliminaciones
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n' + '═'.repeat(60));
  console.log('🎉 PROCESO COMPLETADO');
  console.log(`✅ Incidencias eliminadas: ${eliminadas}`);
  console.log(`❌ Errores: ${errores}`);
  console.log('═'.repeat(60));
}

deleteTestIncidentsBatch().catch(console.error);