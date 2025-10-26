import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { registrarCambioEstado } from '@/lib/historialEstados';
import { subirMultiples } from '@/lib/services/storageService';
import { crearComentario, crearAdjuntos } from '@/lib/services/comentariosService';

/**
 * Tipos
 */
export type FormularioResolucionManual = {
  descripcion: string;
  proveedor_externo?: string;
  importe?: number;
  documentos?: File[];
};

interface Perfil {
  persona_id: string;
  email: string;
  rol: string;
}

type Incidencia = {
  id: string;
  num_solicitud: string;
  estado_cliente: string;
};

/**
 * Hook para gestionar las acciones de Control en el chat proveedor
 * (Anular, Cerrar, Resolución Manual)
 */
export function useControlActions(
  incidenciaId: string,
  incidencia: Incidencia | null,
  perfil: Perfil | null,
  cargarDatos: () => void
) {
  // Estados de modales
  const [mostrarModalAnular, setMostrarModalAnular] = useState(false);
  const [mostrarModalCerrar, setMostrarModalCerrar] = useState(false);
  const [mostrarModalResolucionManual, setMostrarModalResolucionManual] = useState(false);

  // Estados de formularios
  const [motivoAnulacion, setMotivoAnulacion] = useState('');
  const [motivoCierre, setMotivoCierre] = useState('');

  // Estado de envío
  const [enviando, setEnviando] = useState(false);

  /**
   * Anular incidencia (anular asignación de proveedor)
   */
  const anularIncidencia = async () => {
    if (!motivoAnulacion.trim() || !perfil) return;

    try {
      setEnviando(true);

      const fechaAnulacion = new Date();

      // 1. Obtener información del proveedor y estado anterior antes de anular
      const { data: proveedorInfo } = await supabase
        .from("proveedor_casos")
        .select("id, proveedor_id, estado_proveedor")
        .eq("incidencia_id", incidenciaId)
        .eq("activo", true)
        .single();

      if (!proveedorInfo) {
        throw new Error("No se encontró información del proveedor");
      }

      const estadoAnterior = proveedorInfo.estado_proveedor;
      const proveedorCasoId = proveedorInfo.id;

      // 2. Cancelar todas las citas programadas de ESTA incidencia específica
      const { error: citasError } = await supabase
        .from("citas_proveedores")
        .update({ estado: 'cancelada' })
        .eq("incidencia_id", incidenciaId)
        .eq("proveedor_id", proveedorInfo.proveedor_id)
        .eq("estado", "programada");

      if (citasError) {
        console.error("Error cancelando citas:", citasError);
        // No lanzamos error, solo registramos - no debería bloquear la anulación
      }

      // 3. Marcar proveedor_caso como anulado (mantener activo=true hasta reasignación)
      const { error: updateError } = await supabase
        .from("proveedor_casos")
        .update({
          estado_proveedor: "Anulada",
          // NO cambiar activo=false aquí - se hace al reasignar a otro proveedor
          motivo_anulacion: motivoAnulacion,
          anulado_en: fechaAnulacion.toISOString(),
          anulado_por: perfil.persona_id
        })
        .eq("incidencia_id", incidenciaId)
        .eq("activo", true);

      if (updateError) {
        console.error("Error updating proveedor_casos:", updateError);
        throw updateError;
      }

      // 4. Crear notificación para el proveedor
      const { error: notifError } = await supabase
        .from("proveedor_notificaciones")
        .insert({
          proveedor_id: proveedorInfo.proveedor_id,
          incidencia_id: incidenciaId,
          tipo_notificacion: 'anulacion',
          notificacion_vista: false,
          fecha_creacion: fechaAnulacion.toISOString()
        });

      if (notifError) {
        console.error("Error creando notificación:", notifError);
        // No lanzamos error para no bloquear la anulación
      }

      // 5. Registrar cambio de estado en el historial
      await registrarCambioEstado({
        incidenciaId,
        tipoEstado: 'proveedor',
        estadoAnterior,
        estadoNuevo: 'Anulada',
        autorId: perfil.persona_id,
        motivo: motivoAnulacion,
        metadatos: {
          accion: 'anular_proveedor',
          citas_canceladas: true
        }
      });

      // 6. Comentario en el chat del proveedor (vinculado a esta asignación)
      const mensajeAnulacion = `Asignación anulada por Control. Motivo: ${motivoAnulacion}`;

      await crearComentario({
        incidencia_id: incidenciaId,
        proveedor_caso_id: proveedorCasoId,
        ambito: 'proveedor',
        autor_id: perfil.persona_id,
        autor_email: perfil.email,
        autor_rol: 'Control',
        cuerpo: mensajeAnulacion,
        es_sistema: true
      });

      setMostrarModalAnular(false);
      setMotivoAnulacion('');
      cargarDatos();

    } catch (error) {
      console.error("Error anulando incidencia:", error);
      alert("Error al anular la incidencia. Por favor, intente de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  /**
   * Cerrar incidencia (cambiar estado a "Cerrada")
   */
  const cerrarIncidencia = async () => {
    if (!perfil) return;

    try {
      setEnviando(true);

      // 0. Obtener estados anteriores
      const { data: estadosActuales } = await supabase
        .from("proveedor_casos")
        .select("estado_proveedor")
        .eq("incidencia_id", incidenciaId)
        .eq("activo", true)
        .single();

      const { data: incidenciaActual } = await supabase
        .from("incidencias")
        .select("estado_cliente")
        .eq("id", incidenciaId)
        .single();

      const estadoProveedorAnterior = estadosActuales?.estado_proveedor || null;
      const estadoClienteAnterior = incidenciaActual?.estado_cliente || null;

      // 1. Cambiar estado_proveedor a "Cerrada" y mes_cierre
      const fechaCierre = new Date();
      const mesCierre = fechaCierre.toLocaleDateString('es-ES', { month: 'long' });

      await supabase
        .from("proveedor_casos")
        .update({
          estado_proveedor: "Cerrada",
          mes_cierre: mesCierre
        })
        .eq("incidencia_id", incidenciaId)
        .eq("activo", true)
        .neq("estado_proveedor", "Anulada");

      // 2. Cambiar estado_cliente a "Cerrada"
      await supabase
        .from("incidencias")
        .update({ estado_cliente: "Cerrada" })
        .eq("id", incidenciaId);

      // 3. Registrar cambios de estado en el historial
      await registrarCambioEstado({
        incidenciaId,
        tipoEstado: 'proveedor',
        estadoAnterior: estadoProveedorAnterior,
        estadoNuevo: 'Cerrada',
        autorId: perfil.persona_id,
        motivo: motivoCierre || 'Incidencia cerrada',
        metadatos: {
          accion: 'cerrar_incidencia'
        }
      });

      await registrarCambioEstado({
        incidenciaId,
        tipoEstado: 'cliente',
        estadoAnterior: estadoClienteAnterior,
        estadoNuevo: 'Cerrada',
        autorId: perfil.persona_id,
        motivo: motivoCierre || 'Incidencia cerrada',
        metadatos: {
          accion: 'cerrar_incidencia'
        }
      });

      // 4. Comentario para ambos chats
      const mensajeCierre = motivoCierre.trim()
        ? `Incidencia cerrada por Control. ${motivoCierre}`
        : 'Incidencia cerrada por Control.';

      await supabase
        .from("comentarios")
        .insert({
          incidencia_id: incidenciaId,
          ambito: 'ambos',
          autor_id: perfil.persona_id,
          autor_email: perfil.email,
          autor_rol: 'Control',
          cuerpo: mensajeCierre,
          es_sistema: true
        });

      setMostrarModalCerrar(false);
      setMotivoCierre('');
      cargarDatos();

    } catch (error) {
      console.error("Error cerrando incidencia:", error);
      alert('Error al cerrar la incidencia');
    } finally {
      setEnviando(false);
    }
  };

  /**
   * Resolución manual con proveedor asignado
   */
  const resolverManualmenteConProveedor = async (formulario: FormularioResolucionManual) => {
    if (!perfil || !incidencia) return;

    try {
      setEnviando(true);

      // Subir documentos si existen
      const documentosUrls: string[] = [];
      if (formulario.documentos && formulario.documentos.length > 0) {
        const rutaBase = `incidencias/${incidencia.num_solicitud}/resolucion_manual`;
        const rutas = await subirMultiples(formulario.documentos, rutaBase);
        documentosUrls.push(...rutas);
      }

      // Actualizar estados
      const estadoAnterior = incidencia.estado_cliente;

      await supabase
        .from("incidencias")
        .update({ estado_cliente: "Resuelta" })
        .eq("id", incidenciaId);

      await supabase
        .from("proveedor_casos")
        .update({ estado_proveedor: "Resuelta" })
        .eq("incidencia_id", incidenciaId)
        .eq("activo", true)
        .neq("estado_proveedor", "Anulada");

      // Registrar cambios de estado
      await registrarCambioEstado({
        incidenciaId,
        tipoEstado: 'cliente',
        estadoAnterior,
        estadoNuevo: 'Resuelta',
        autorId: perfil.persona_id,
        motivo: 'Resolución manual por Control (con proveedor)',
        metadatos: {
          accion: 'resolucion_manual_con_proveedor',
          proveedor_externo: formulario.proveedor_externo || 'No especificado',
          importe: formulario.importe || 0,
          num_documentos: documentosUrls.length
        }
      });

      await registrarCambioEstado({
        incidenciaId,
        tipoEstado: 'proveedor',
        estadoAnterior: 'Asignada',
        estadoNuevo: 'Resuelta',
        autorId: perfil.persona_id,
        motivo: 'Resolución manual por Control',
        metadatos: {
          accion: 'resolucion_manual_con_proveedor'
        }
      });

      // Comentario del sistema
      const cuerpoComentario = `Incidencia resuelta manualmente por Control.
**Descripción:** ${formulario.descripcion}
**Proveedor:** ${formulario.proveedor_externo || 'No especificado'}
**Importe:** ${formulario.importe ? `${formulario.importe}€` : 'No especificado'}
${documentosUrls.length > 0 ? `**Documentos adjuntos:** ${documentosUrls.length}` : ''}`;

      const comentarioCreado = await crearComentario({
        incidencia_id: incidenciaId,
        ambito: 'ambos',
        autor_id: perfil.persona_id,
        autor_email: perfil.email,
        autor_rol: perfil.rol,
        cuerpo: cuerpoComentario,
        es_sistema: true
      });

      // Crear adjuntos si hay documentos
      if (documentosUrls.length > 0 && comentarioCreado) {
        const adjuntos = documentosUrls.map((url, index) => ({
          storage_key: url,
          nombre_archivo: formulario.documentos![index].name,
          tipo: 'documento'
        }));
        await crearAdjuntos(comentarioCreado.id, incidenciaId, adjuntos);
      }

      setMostrarModalResolucionManual(false);
      cargarDatos();
    } catch (error) {
      console.error("Error en resolución manual:", error);
      alert('Error al resolver la incidencia');
    } finally {
      setEnviando(false);
    }
  };

  return {
    // Modales
    mostrarModalAnular,
    setMostrarModalAnular,
    mostrarModalCerrar,
    setMostrarModalCerrar,
    mostrarModalResolucionManual,
    setMostrarModalResolucionManual,

    // Formularios
    motivoAnulacion,
    setMotivoAnulacion,
    motivoCierre,
    setMotivoCierre,

    // Estado
    enviando,

    // Acciones
    anularIncidencia,
    cerrarIncidencia,
    resolverManualmenteConProveedor
  };
}
