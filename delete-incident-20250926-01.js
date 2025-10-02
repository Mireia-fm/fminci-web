require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
);

async function deleteIncident() {
  const numSolicitud = '20250926-01';

  console.log(`🗑️  ELIMINANDO INCIDENCIA: ${numSolicitud}`);
  console.log('=' .repeat(60));

  try {
    // 1. Buscar la incidencia
    const { data: incidencia, error: incidenciaError } = await supabase
      .from('incidencias')
      .select('id, num_solicitud, descripcion')
      .eq('num_solicitud', numSolicitud)
      .single();

    if (incidenciaError) {
      console.error('❌ Error buscando incidencia:', incidenciaError);
      return;
    }

    if (!incidencia) {
      console.log('⚠️  Incidencia no encontrada');
      return;
    }

    console.log(`📋 Incidencia encontrada:`);
    console.log(`   ID: ${incidencia.id}`);
    console.log(`   Descripción: ${incidencia.descripcion || 'Sin descripción'}`);

    const incidenciaId = incidencia.id;

    // 2. Eliminar adjuntos
    console.log('\n🗂️  Eliminando adjuntos...');
    const { data: adjuntos, error: adjuntosSelectError } = await supabase
      .from('adjuntos')
      .select('id, storage_key, nombre_archivo')
      .eq('incidencia_id', incidenciaId);

    if (adjuntosSelectError) {
      console.error('❌ Error consultando adjuntos:', adjuntosSelectError);
    } else {
      console.log(`📎 Adjuntos encontrados: ${adjuntos?.length || 0}`);

      if (adjuntos && adjuntos.length > 0) {
        // Eliminar archivos del Storage
        for (const adjunto of adjuntos) {
          if (adjunto.storage_key) {
            const { error: storageError } = await supabase.storage
              .from('documentos')
              .remove([adjunto.storage_key]);

            if (storageError) {
              console.log(`⚠️  Error eliminando archivo ${adjunto.nombre_archivo}:`, storageError.message);
            } else {
              console.log(`✅ Archivo eliminado: ${adjunto.nombre_archivo}`);
            }
          }
        }

        // Eliminar registros de adjuntos
        const { error: adjuntosDeleteError } = await supabase
          .from('adjuntos')
          .delete()
          .eq('incidencia_id', incidenciaId);

        if (adjuntosDeleteError) {
          console.error('❌ Error eliminando adjuntos de BD:', adjuntosDeleteError);
        } else {
          console.log(`✅ ${adjuntos.length} adjuntos eliminados de BD`);
        }
      }
    }

    // 3. Eliminar comentarios
    console.log('\n💬 Eliminando comentarios...');
    const { data: comentarios, error: comentariosSelectError } = await supabase
      .from('comentarios')
      .select('id, cuerpo, autor_rol')
      .eq('incidencia_id', incidenciaId);

    if (comentariosSelectError) {
      console.error('❌ Error consultando comentarios:', comentariosSelectError);
    } else {
      console.log(`💬 Comentarios encontrados: ${comentarios?.length || 0}`);

      if (comentarios && comentarios.length > 0) {
        const { error: comentariosDeleteError } = await supabase
          .from('comentarios')
          .delete()
          .eq('incidencia_id', incidenciaId);

        if (comentariosDeleteError) {
          console.error('❌ Error eliminando comentarios:', comentariosDeleteError);
        } else {
          console.log(`✅ ${comentarios.length} comentarios eliminados`);
        }
      }
    }

    // 4. Eliminar historial de estados
    console.log('\n📈 Eliminando historial de estados...');
    const { data: historial, error: historialSelectError } = await supabase
      .from('historial_estados')
      .select('id, tipo_estado, estado_nuevo')
      .eq('incidencia_id', incidenciaId);

    if (historialSelectError) {
      console.error('❌ Error consultando historial:', historialSelectError);
    } else {
      console.log(`📈 Registros de historial: ${historial?.length || 0}`);

      if (historial && historial.length > 0) {
        const { error: historialDeleteError } = await supabase
          .from('historial_estados')
          .delete()
          .eq('incidencia_id', incidenciaId);

        if (historialDeleteError) {
          console.error('❌ Error eliminando historial:', historialDeleteError);
        } else {
          console.log(`✅ ${historial.length} registros de historial eliminados`);
        }
      }
    }

    // 5. Eliminar presupuestos
    console.log('\n💰 Eliminando presupuestos...');
    const { data: presupuestos, error: presupuestosSelectError } = await supabase
      .from('presupuestos')
      .select('id, importe_total_sin_iva, estado')
      .eq('incidencia_id', incidenciaId);

    if (presupuestosSelectError) {
      console.error('❌ Error consultando presupuestos:', presupuestosSelectError);
    } else {
      console.log(`💰 Presupuestos encontrados: ${presupuestos?.length || 0}`);

      if (presupuestos && presupuestos.length > 0) {
        const { error: presupuestosDeleteError } = await supabase
          .from('presupuestos')
          .delete()
          .eq('incidencia_id', incidenciaId);

        if (presupuestosDeleteError) {
          console.error('❌ Error eliminando presupuestos:', presupuestosDeleteError);
        } else {
          console.log(`✅ ${presupuestos.length} presupuestos eliminados`);
        }
      }
    }

    // 6. Eliminar casos de proveedor
    console.log('\n🏢 Eliminando casos de proveedor...');
    const { data: casos, error: casosSelectError } = await supabase
      .from('proveedor_casos')
      .select('id, estado_proveedor, proveedor_id')
      .eq('incidencia_id', incidenciaId);

    if (casosSelectError) {
      console.error('❌ Error consultando casos:', casosSelectError);
    } else {
      console.log(`🏢 Casos de proveedor: ${casos?.length || 0}`);

      if (casos && casos.length > 0) {
        const { error: casosDeleteError } = await supabase
          .from('proveedor_casos')
          .delete()
          .eq('incidencia_id', incidenciaId);

        if (casosDeleteError) {
          console.error('❌ Error eliminando casos:', casosDeleteError);
        } else {
          console.log(`✅ ${casos.length} casos de proveedor eliminados`);
        }
      }
    }

    // 7. Eliminar archivos del Storage por carpeta
    console.log('\n📁 Eliminando archivos de Storage...');
    try {
      const { data: storageFiles, error: storageListError } = await supabase.storage
        .from('documentos')
        .list(`incidencias/${numSolicitud}`, { limit: 100, sortBy: { column: 'name', order: 'asc' } });

      if (storageListError) {
        console.log('⚠️  Error listando archivos de Storage:', storageListError.message);
      } else if (storageFiles && storageFiles.length > 0) {
        console.log(`📁 Archivos en Storage: ${storageFiles.length}`);

        const filesToDelete = storageFiles.map(file => `incidencias/${numSolicitud}/${file.name}`);
        const { error: storageDeleteError } = await supabase.storage
          .from('documentos')
          .remove(filesToDelete);

        if (storageDeleteError) {
          console.log('⚠️  Error eliminando archivos de Storage:', storageDeleteError.message);
        } else {
          console.log(`✅ ${storageFiles.length} archivos eliminados de Storage`);
        }
      } else {
        console.log('📁 No hay archivos en Storage para esta incidencia');
      }
    } catch (storageError) {
      console.log('⚠️  Error con Storage:', storageError.message);
    }

    // 8. Finalmente, eliminar la incidencia
    console.log('\n📋 Eliminando incidencia principal...');
    const { error: incidenciaDeleteError } = await supabase
      .from('incidencias')
      .delete()
      .eq('id', incidenciaId);

    if (incidenciaDeleteError) {
      console.error('❌ Error eliminando incidencia:', incidenciaDeleteError);
    } else {
      console.log(`✅ Incidencia ${numSolicitud} eliminada exitosamente`);
    }

    console.log('\n' + '=' .repeat(60));
    console.log('🎉 PROCESO COMPLETADO');
    console.log(`Incidencia ${numSolicitud} y todos sus datos relacionados han sido eliminados`);

  } catch (error) {
    console.error('💥 Error general:', error);
  }
}

deleteIncident().catch(console.error);