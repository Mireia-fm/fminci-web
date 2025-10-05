import { supabase } from "@/lib/supabaseClient";
import { registrarCambioEstado } from "@/lib/historialEstados";

export interface CalendarizarVisitaParams {
  incidenciaId: string;
  fechaVisita: string;
  horarioVisita: 'mañana' | 'tarde';
  autorId: string;
}

export interface CalendarizarVisitaResult {
  success: boolean;
  fechaFormateada?: string;
  horarioTexto?: string;
  error?: string;
}

/**
 * Calendariza una visita del proveedor a una incidencia
 */
export async function calendarizarVisita(
  params: CalendarizarVisitaParams
): Promise<CalendarizarVisitaResult> {
  const { incidenciaId, fechaVisita, horarioVisita, autorId } = params;

  try {
    // 1. Obtener estado anterior y cambiar estado_proveedor a "En resolución"
    const { data: casoActual } = await supabase
      .from("proveedor_casos")
      .select("estado_proveedor, proveedor_id")
      .eq("incidencia_id", incidenciaId)
      .eq("activo", true)
      .single();

    const estadoAnterior = casoActual?.estado_proveedor || null;

    const { error: estadoError } = await supabase
      .from("proveedor_casos")
      .update({
        estado_proveedor: "En resolución"
      })
      .eq("incidencia_id", incidenciaId)
      .eq("activo", true);

    if (estadoError) {
      console.error("Error actualizando estado del proveedor:", estadoError);
      throw estadoError;
    }

    // Registrar cambio de estado en el historial
    await registrarCambioEstado({
      incidenciaId,
      tipoEstado: 'proveedor',
      estadoAnterior,
      estadoNuevo: 'En resolución',
      autorId,
      motivo: 'Visita calendarizada',
      metadatos: {
        fecha_visita: fechaVisita,
        horario: horarioVisita,
        accion: 'calendarizar_visita'
      }
    });

    // 2. Crear timestamp para la visita y guardar en tabla de citas
    const horaVisita = horarioVisita === 'mañana' ? '09:00:00' : '14:00:00';
    const fechaHoraVisita = `${fechaVisita}T${horaVisita}`;

    if (casoActual?.proveedor_id) {
      const { error: citaError } = await supabase
        .from("citas_proveedores")
        .insert({
          incidencia_id: incidenciaId,
          proveedor_id: casoActual.proveedor_id,
          fecha_visita: fechaHoraVisita,
          horario: horarioVisita,
          estado: 'programada',
          creado_por: autorId
        });

      if (citaError) {
        console.error("Error creando cita:", citaError);
        throw citaError;
      }
    }

    // 3. Formatear fecha para los comentarios
    const fechaFormateada = new Date(fechaVisita).toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const horarioTexto = horarioVisita === 'mañana'
      ? 'horario de mañana'
      : 'horario de tarde';

    // 4. Agregar comentario visible en ambos chats
    const mensajeVisita = `Visita programada para el ${fechaFormateada} en ${horarioTexto}.`;

    const { error: errorComentario } = await supabase
      .from("comentarios")
      .insert({
        incidencia_id: incidenciaId,
        autor_id: autorId,
        cuerpo: mensajeVisita,
        ambito: 'ambos',
        es_sistema: true
      });

    if (errorComentario) {
      console.error("Error insertando comentario:", errorComentario);
    }

    return {
      success: true,
      fechaFormateada,
      horarioTexto
    };

  } catch (error) {
    console.error("Error calendarizando visita:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}
