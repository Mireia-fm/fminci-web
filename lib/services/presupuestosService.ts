import { supabase } from "@/lib/supabaseClient";
import { registrarCambioEstado } from "@/lib/historialEstados";

export interface OfertarPresupuestoParams {
  incidenciaId: string;
  numeroIncidencia: string;
  fechaEstimadaInicio: string;
  duracionEstimada: string;
  importeTotalSinIva: string;
  documentoPresupuesto: File;
  descripcionPresupuesto: string;
  autorId: string;
  autorEmail: string;
}

export interface OfertarPresupuestoResult {
  success: boolean;
  presupuestoId?: string;
  error?: string;
}

/**
 * Crea una oferta de presupuesto del proveedor
 */
export async function ofertarPresupuesto(
  params: OfertarPresupuestoParams
): Promise<OfertarPresupuestoResult> {
  const {
    incidenciaId,
    numeroIncidencia,
    fechaEstimadaInicio,
    duracionEstimada,
    importeTotalSinIva,
    documentoPresupuesto,
    descripcionPresupuesto,
    autorId,
    autorEmail
  } = params;

  try {
    // 1. Subir documento del presupuesto
    const nombreArchivo = `${Date.now()}_${documentoPresupuesto.name}`;
    const ruta = `incidencias/${numeroIncidencia}/presupuestos/${nombreArchivo}`;

    const { error: uploadError } = await supabase.storage
      .from('incidencias')
      .upload(ruta, documentoPresupuesto);

    if (uploadError) {
      console.error('Error subiendo documento:', uploadError);
      throw uploadError;
    }

    // 2. Obtener proveedor_id del caso actual
    const { data: proveedorCaso } = await supabase
      .from("proveedor_casos")
      .select("proveedor_id, estado_proveedor")
      .eq("incidencia_id", incidenciaId)
      .eq("activo", true)
      .single();

    if (!proveedorCaso) {
      throw new Error('No se encontró el caso del proveedor');
    }

    const estadoAnterior = proveedorCaso.estado_proveedor || null;

    // 3. Guardar presupuesto en la tabla presupuestos
    const { data: presupuestoCreado, error: presupuestoError } = await supabase
      .from("presupuestos")
      .insert({
        incidencia_id: incidenciaId,
        proveedor_id: proveedorCaso.proveedor_id,
        numero_incidencia: numeroIncidencia,
        fecha_estimada_inicio: fechaEstimadaInicio,
        duracion_estimada: duracionEstimada,
        importe_total_sin_iva: parseFloat(importeTotalSinIva),
        presupuesto_detallado_url: ruta,
        descripcion_breve: descripcionPresupuesto,
        estado: 'pendiente_revision',
        creado_por: autorId
      })
      .select()
      .single();

    if (presupuestoError) {
      console.error("Error creando presupuesto:", presupuestoError);
      throw presupuestoError;
    }

    // 4. Cambiar estado_proveedor a "Ofertada"
    await supabase
      .from("proveedor_casos")
      .update({ estado_proveedor: "Ofertada" })
      .eq("incidencia_id", incidenciaId)
      .eq("activo", true);

    // 5. Registrar cambio de estado en el historial
    await registrarCambioEstado({
      incidenciaId,
      tipoEstado: 'proveedor',
      estadoAnterior,
      estadoNuevo: 'Ofertada',
      autorId,
      motivo: 'Presupuesto detallado ofertado',
      metadatos: {
        presupuesto_id: presupuestoCreado?.id || '',
        importe_total_sin_iva: parseFloat(importeTotalSinIva),
        fecha_estimada_inicio: fechaEstimadaInicio,
        duracion_estimada: duracionEstimada,
        accion: 'ofertar_presupuesto_detallado'
      }
    });

    // 6. Comentario en chat de proveedor con formato lista
    const descripcionTruncada = descripcionPresupuesto.length > 100
      ? descripcionPresupuesto.substring(0, 100) + '...'
      : descripcionPresupuesto;

    const mensajePresupuesto = `Datos del presupuesto:
• Fecha estimada de inicio: ${new Date(fechaEstimadaInicio).toLocaleDateString('es-ES')}
• Duración estimada: ${duracionEstimada}
• Importe total sin IVA: ${importeTotalSinIva}€
• Descripción: ${descripcionTruncada}

Documento adjunto: ${documentoPresupuesto.name}`;

    const { data: comentarioCreado, error: comentarioError } = await supabase
      .from("comentarios")
      .insert({
        incidencia_id: incidenciaId,
        ambito: 'proveedor',
        autor_id: autorId,
        autor_email: autorEmail,
        autor_rol: 'Proveedor',
        cuerpo: mensajePresupuesto,
        es_sistema: false
      })
      .select()
      .single();

    if (comentarioError) {
      console.error("Error creando comentario:", comentarioError);
      throw comentarioError;
    }

    // 7. Agregar el documento como adjunto al comentario
    if (comentarioCreado) {
      const { error: adjuntoError } = await supabase
        .from("adjuntos")
        .insert({
          incidencia_id: incidenciaId,
          comentario_id: comentarioCreado.id,
          tipo: 'documento',
          nombre_archivo: documentoPresupuesto.name,
          storage_key: ruta,
          categoria: 'presupuesto'
        });

      if (adjuntoError) {
        console.error("Error agregando adjunto:", adjuntoError);
      }
    }

    return {
      success: true,
      presupuestoId: presupuestoCreado?.id
    };

  } catch (error) {
    console.error("Error ofertando presupuesto:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}
