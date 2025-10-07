import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { registrarCambioEstado } from '@/lib/historialEstados';

/**
 * Tipos
 */
type PresupuestoType = {
  id: string;
  importe_total: number;
  importe_total_sin_iva?: number;
  presupuesto_detallado_url?: string;
  estado: string;
  fecha_estimada_inicio?: string;
  duracion_estimada?: string;
  descripcion_breve?: string;
  instituciones?: { nombre: string };
  incidencias?: { num_solicitud: string; descripcion: string };
};

interface Perfil {
  persona_id: string;
  email: string;
  rol: string;
}

/**
 * Hook para gestionar toda la lógica relacionada con presupuestos
 */
export function usePresupuestoGestion(
  incidenciaId: string,
  perfil: Perfil | null,
  cargarDatos: () => void
) {
  // Estados de modales
  const [mostrarModalPresupuesto, setMostrarModalPresupuesto] = useState(false);
  const [mostrarModalGestionPresupuesto, setMostrarModalGestionPresupuesto] = useState(false);
  const [mostrarModalMotivoRevision, setMostrarModalMotivoRevision] = useState(false);

  // Estados de formulario de oferta
  const [presupuesto, setPresupuesto] = useState('');
  const [descripcionPresupuesto, setDescripcionPresupuesto] = useState('');
  const [fechaEstimadaInicio, setFechaEstimadaInicio] = useState('');
  const [duracionEstimada, setDuracionEstimada] = useState('');
  const [importeTotalSinIva, setImporteTotalSinIva] = useState('');
  const [documentoPresupuesto, setDocumentoPresupuesto] = useState<File | null>(null);

  // Estados de gestión de presupuesto
  const [presupuestoActual, setPresupuestoActual] = useState<PresupuestoType | null>(null);
  const [tieneOfertaAprobada, setTieneOfertaAprobada] = useState(false);
  const [tuvoOfertaAprobada, setTuvoOfertaAprobada] = useState(false);
  const [cargandoPresupuesto, setCargandoPresupuesto] = useState(false);
  const [documentoPresupuestoUrl, setDocumentoPresupuestoUrl] = useState<string | null>(null);
  const [motivoRevision, setMotivoRevision] = useState('');

  // Estado de envío
  const [enviando, setEnviando] = useState(false);

  /**
   * Genera URL firmada de un documento
   */
  const getSignedDocumentUrl = async (storageKey: string) => {
    try {
      let cleanPath = storageKey;

      // Limpiar la ruta si viene con prefijos
      if (storageKey.startsWith('https://')) {
        // Extraer la ruta del storage de URLs completas
        if (storageKey.includes('/storage/v1/object/public/incidencias/')) {
          const parts = storageKey.split('/storage/v1/object/public/incidencias/');
          if (parts.length > 1) {
            cleanPath = parts[1];
          }
        }
      }

      // Crear URL firmada
      const { data, error } = await supabase.storage
        .from('incidencias')
        .createSignedUrl(cleanPath, 14400); // 4 horas

      if (error) {
        console.error('Error creando URL firmada:', error);
        return null;
      }

      return data.signedUrl;
    } catch (error) {
      console.error('Error generando URL firmada:', error);
      return null;
    }
  };

  /**
   * Abrir modal de gestión de presupuesto y cargar el presupuesto actual
   */
  const abrirModalGestionPresupuesto = async () => {
    try {
      setCargandoPresupuesto(true);
      setMostrarModalGestionPresupuesto(true);
      setDocumentoPresupuestoUrl(null);

      console.log("Buscando presupuesto para incidencia_id:", incidenciaId);

      // Cargar presupuesto de la incidencia (el más reciente)
      const { data: presupuestos, error } = await supabase
        .from("presupuestos")
        .select(`
          *,
          instituciones(nombre),
          incidencias(num_solicitud, descripcion)
        `)
        .eq("incidencia_id", incidenciaId)
        .order("creado_en", { ascending: false })
        .limit(1);

      const presupuesto = presupuestos && presupuestos.length > 0 ? presupuestos[0] : null;

      console.log("Resultado de la consulta:", { presupuesto, error });

      if (error) {
        console.error("Error cargando presupuesto:", error);
        return;
      }

      setPresupuestoActual(presupuesto);

      // Si hay documento adjunto, cargar la URL firmada
      if (presupuesto?.presupuesto_detallado_url) {
        const signedUrl = await getSignedDocumentUrl(presupuesto.presupuesto_detallado_url);
        setDocumentoPresupuestoUrl(signedUrl);
      }
    } catch (error) {
      console.error("Error abriendo modal de gestión de presupuesto:", error);
    } finally {
      setCargandoPresupuesto(false);
    }
  };

  /**
   * Aprobar presupuesto (solo para Control)
   */
  const aprobarPresupuesto = async () => {
    if (!perfil || !presupuestoActual || enviando) return;

    try {
      setEnviando(true);

      // 1. Cambiar estado_proveedor a "Oferta aprobada"
      await supabase
        .from("proveedor_casos")
        .update({ estado_proveedor: "Oferta aprobada" })
        .eq("incidencia_id", incidenciaId)
        .eq("activo", true)
        .neq("estado_proveedor", "Anulada");

      // 2. Actualizar estado del presupuesto
      await supabase
        .from("presupuestos")
        .update({ estado: "aprobado" })
        .eq("id", presupuestoActual.id);

      // 2.1. Registrar cambio de estado en el historial
      await registrarCambioEstado({
        incidenciaId,
        tipoEstado: 'proveedor',
        estadoAnterior: "Ofertada",
        estadoNuevo: "Oferta aprobada",
        autorId: perfil.persona_id,
        motivo: `Presupuesto aprobado por Control. Importe: ${presupuestoActual.importe_total_sin_iva}€ (sin IVA)`,
        metadatos: {
          presupuesto_id: presupuestoActual.id,
          importe: presupuestoActual.importe_total_sin_iva || 0,
          accion: 'aprobar_presupuesto'
        }
      });

      // 3. Comentario para el proveedor
      await supabase
        .from("comentarios")
        .insert({
          incidencia_id: incidenciaId,
          ambito: 'proveedor',
          autor_id: perfil.persona_id,
          autor_email: perfil.email,
          autor_rol: 'Control',
          cuerpo: `Presupuesto aprobado por Control. Importe: ${presupuestoActual.importe_total_sin_iva}€ (sin IVA). Puedes proceder con la ejecución.`,
          es_sistema: false
        });

      setMostrarModalGestionPresupuesto(false);
      cargarDatos();

    } catch (error) {
      console.error("Error aprobando presupuesto:", error);
      alert('Error al aprobar el presupuesto');
    } finally {
      setEnviando(false);
    }
  };

  /**
   * Mandar presupuesto a revisar (solo para Control)
   */
  const mandarARevisar = async () => {
    if (!perfil || !presupuestoActual || !motivoRevision.trim()) return;

    try {
      setEnviando(true);

      // 1. Cambiar estado_proveedor a "Oferta a revisar"
      await supabase
        .from("proveedor_casos")
        .update({ estado_proveedor: "Oferta a revisar" })
        .eq("incidencia_id", incidenciaId)
        .eq("activo", true)
        .neq("estado_proveedor", "Anulada");

      // 2. Actualizar estado del presupuesto
      await supabase
        .from("presupuestos")
        .update({ estado: "rechazado" })
        .eq("id", presupuestoActual.id);

      // 2.1. Registrar cambio de estado en el historial
      await registrarCambioEstado({
        incidenciaId,
        tipoEstado: 'proveedor',
        estadoAnterior: "pendiente_revision",
        estadoNuevo: "rechazado",
        autorId: perfil.persona_id,
        motivo: `Presupuesto rechazado desde chat-proveedor. Motivo: ${motivoRevision}`,
        metadatos: {
          presupuesto_id: presupuestoActual.id,
          motivo_rechazo: motivoRevision,
          accion: 'rechazar_presupuesto'
        }
      });

      // 3. Comentario para el proveedor con motivo personalizado
      await supabase
        .from("comentarios")
        .insert({
          incidencia_id: incidenciaId,
          ambito: 'proveedor',
          autor_id: perfil.persona_id,
          autor_email: perfil.email,
          autor_rol: 'Control',
          cuerpo: `El presupuesto requiere revisión. Motivo: ${motivoRevision.replace(/\*/g, '')}`,
          es_sistema: false
        });

      // 4. Crear notificación para el proveedor
      const { data: proveedorCaso } = await supabase
        .from("proveedor_casos")
        .select("proveedor_id")
        .eq("incidencia_id", incidenciaId)
        .eq("activo", true)
        .single();

      if (proveedorCaso) {
        await supabase
          .from("proveedor_notificaciones")
          .upsert({
            proveedor_id: proveedorCaso.proveedor_id,
            incidencia_id: incidenciaId,
            tipo_notificacion: 'revision',
            notificacion_vista: false
          }, {
            onConflict: 'proveedor_id,incidencia_id,tipo_notificacion'
          });
      }

      // Cerrar modales y limpiar estados
      setMostrarModalGestionPresupuesto(false);
      setMostrarModalMotivoRevision(false);
      setMotivoRevision('');
      setPresupuestoActual(null);
      setDocumentoPresupuestoUrl(null);

      cargarDatos();

    } catch (error) {
      console.error("Error mandando a revisar presupuesto:", error);
      alert('Error al mandar a revisar el presupuesto');
    } finally {
      setEnviando(false);
    }
  };

  /**
   * Limpiar formulario de oferta
   */
  const limpiarFormularioOferta = () => {
    setPresupuesto('');
    setDescripcionPresupuesto('');
    setFechaEstimadaInicio('');
    setDuracionEstimada('');
    setImporteTotalSinIva('');
    setDocumentoPresupuesto(null);
  };

  /**
   * Cerrar modal de oferta
   */
  const cerrarModalOferta = () => {
    setMostrarModalPresupuesto(false);
    limpiarFormularioOferta();
  };

  return {
    // Estados de modales
    mostrarModalPresupuesto,
    setMostrarModalPresupuesto,
    mostrarModalGestionPresupuesto,
    setMostrarModalGestionPresupuesto,
    mostrarModalMotivoRevision,
    setMostrarModalMotivoRevision,

    // Estados de formulario de oferta
    presupuesto,
    setPresupuesto,
    descripcionPresupuesto,
    setDescripcionPresupuesto,
    fechaEstimadaInicio,
    setFechaEstimadaInicio,
    duracionEstimada,
    setDuracionEstimada,
    importeTotalSinIva,
    setImporteTotalSinIva,
    documentoPresupuesto,
    setDocumentoPresupuesto,

    // Estados de gestión de presupuesto
    presupuestoActual,
    setPresupuestoActual,
    tieneOfertaAprobada,
    setTieneOfertaAprobada,
    tuvoOfertaAprobada,
    setTuvoOfertaAprobada,
    cargandoPresupuesto,
    documentoPresupuestoUrl,
    motivoRevision,
    setMotivoRevision,

    // Estado de envío
    enviando,

    // Funciones
    abrirModalGestionPresupuesto,
    aprobarPresupuesto,
    mandarARevisar,
    limpiarFormularioOferta,
    cerrarModalOferta
  };
}
