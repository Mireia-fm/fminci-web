import { supabase } from "@/lib/supabaseClient";
import { registrarCambioEstado } from "@/lib/historialEstados";
import { crearComentario } from "./comentariosService";

export interface CalendarizarVisitaParams {
  incidenciaId: string;
  proveedorCasoId?: string;
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
  const { incidenciaId, proveedorCasoId, fechaVisita, horarioVisita, autorId } = params;

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
      // Obtener nombre del proveedor y datos de la incidencia para guardarlos en la cita
      const { data: proveedorData } = await supabase
        .from("instituciones")
        .select("nombre")
        .eq("id", casoActual.proveedor_id)
        .single();

      const { data: incidenciaData } = await supabase
        .from("incidencias")
        .select("centro, num_solicitud, descripcion")
        .eq("id", incidenciaId)
        .single();

      const { error: citaError } = await supabase
        .from("citas_proveedores")
        .insert({
          incidencia_id: incidenciaId,
          proveedor_id: casoActual.proveedor_id,
          proveedor_nombre: proveedorData?.nombre || null,
          centro_nombre: incidenciaData?.centro || null,
          num_solicitud: incidenciaData?.num_solicitud || null,
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

    // 4. Agregar comentario visible en ambos chats (con proveedor_caso_id para el chat proveedor)
    const mensajeVisita = `Visita programada para el ${fechaFormateada} en ${horarioTexto}.`;

    // Necesitamos obtener email del autor para crearComentario
    const { data: autorData } = await supabase
      .from("personas")
      .select("email, rol")
      .eq("id", autorId)
      .single();

    if (autorData) {
      await crearComentario({
        incidencia_id: incidenciaId,
        proveedor_caso_id: proveedorCasoId,
        autor_id: autorId,
        autor_email: autorData.email || '',
        autor_rol: autorData.rol || 'Proveedor',
        cuerpo: mensajeVisita,
        ambito: 'ambos',
        es_sistema: true
      });
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
