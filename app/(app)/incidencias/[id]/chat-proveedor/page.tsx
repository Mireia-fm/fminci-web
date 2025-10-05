"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { registrarCambioEstado } from "@/lib/historialEstados";
import ModalResolucionManual, { type FormularioResolucionManual } from "@/components/ModalResolucionManual";
import { PALETA } from "@/lib/theme";
import { useAuth } from "@/contexts/AuthContext";

// Servicios
import { crearComentario, crearAdjuntos } from "@/lib/services/comentariosService";
import { calendarizarVisita } from "@/lib/services/citasService";
import { ofertarPresupuesto } from "@/lib/services/presupuestosService";
import { resolverIncidencia as resolverIncidenciaService, valoracionEconomica as valoracionEconomicaService } from "@/lib/services/resolucionProveedorService";

// Hooks compartidos
import { useSignedUrls, useComentarioUrls } from "@/shared/hooks/useSignedUrls";
import { useChatFileUpload } from "@/shared/hooks/useFileUpload";

// Componentes compartidos
import HistorialEstados from "@/shared/components/HistorialEstados";
import ScrollToBottomButton from "@/components/ScrollToBottomButton";

// Modales de proveedor
import ModalCalendarizar from "@/components/proveedor/ModalCalendarizar";
import ModalOferta from "@/components/proveedor/ModalOferta";
import ModalValoracion from "@/components/proveedor/ModalValoracion";
import ModalResolver from "@/components/proveedor/ModalResolver";

type Adjunto = {
  id: string;
  tipo: string;
  nombre_archivo?: string | null;
  storage_key?: string | null;
  visible_proveedor?: boolean;
};

type Incidencia = {
  id: string;
  num_solicitud: string;
  descripcion: string;
  estado_cliente: string;
  estado_proveedor?: string;
  prioridad_proveedor?: string;
  descripcion_proveedor?: string;
  centro?: string;
  fecha?: string;
  hora?: string;
  imagen_url?: string;
  catalogacion?: string;
  institucion_id?: string;
  instituciones?: {
    nombre: string;
    direccion?: string;
  }[] | null;
  adjuntos_principales?: Adjunto[];
};

type Comentario = {
  id: string;
  incidencia_id: string;
  ambito: 'cliente' | 'proveedor' | 'ambos';
  proveedor_id?: string | null;
  autor_id?: string | null;
  autor_email?: string | null;
  autor_rol?: string | null;
  cuerpo?: string | null;
  creado_en: string;
  es_sistema?: boolean | null;
  imagen_url?: string | null;
  documento_url?: string | null;
  adjuntos?: Adjunto[];
};

type CambioEstado = {
  id: string;
  estado_anterior: string | null;
  estado_nuevo: string;
  cambiado_en: string;
  motivo: string | null;
};

export default function ChatProveedor() {
  const params = useParams();
  const router = useRouter();
  const incidenciaId = params.id as string;

  // AuthContext
  const { perfil, loading: authLoading } = useAuth();

  // Estados principales
  const [incidencia, setIncidencia] = useState<Incidencia | null>(null);
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);

  // Estados de proveedor
  const [fechaAsignacionProveedor, setFechaAsignacionProveedor] = useState<string | null>(null);
  const [direccionCentro, setDireccionCentro] = useState<string | null>(null);
  const [tieneOfertaAprobada, setTieneOfertaAprobada] = useState(false);
  const [tuvoOfertaAprobada, setTuvoOfertaAprobada] = useState(false);

  // Modales de proveedor
  const [mostrarModalVisita, setMostrarModalVisita] = useState(false);
  const [mostrarModalPresupuesto, setMostrarModalPresupuesto] = useState(false);
  const [mostrarModalResolver, setMostrarModalResolver] = useState(false);
  const [mostrarModalValorarIncidencia, setMostrarModalValorarIncidencia] = useState(false);

  // Estados para modales de proveedor
  const [fechaVisita, setFechaVisita] = useState('');
  const [horarioVisita, setHorarioVisita] = useState('');
  const [presupuesto, setPresupuesto] = useState('');
  const [descripcionPresupuesto, setDescripcionPresupuesto] = useState('');
  const [fechaEstimadaInicio, setFechaEstimadaInicio] = useState('');
  const [duracionEstimada, setDuracionEstimada] = useState('');
  const [importeTotalSinIva, setImporteTotalSinIva] = useState('');
  const [documentoPresupuesto, setDocumentoPresupuesto] = useState<File | null>(null);
  const [solucionAplicada, setSolucionAplicada] = useState('');
  const [imagenResolucion, setImagenResolucion] = useState<File | null>(null);
  const [documentoResolucion, setDocumentoResolucion] = useState<File | null>(null);
  const [importeSinIva, setImporteSinIva] = useState('');
  const [importeConIva, setImporteConIva] = useState('');
  const [porcentajeIva, setPorcentajeIva] = useState('21');
  const [documentoJustificativo, setDocumentoJustificativo] = useState<File | null>(null);

  // Modales de Control
  const [mostrarModalAnular, setMostrarModalAnular] = useState(false);
  const [mostrarModalCerrar, setMostrarModalCerrar] = useState(false);
  const [mostrarModalGestionPresupuesto, setMostrarModalGestionPresupuesto] = useState(false);
  const [mostrarModalResolucionManual, setMostrarModalResolucionManual] = useState(false);
  const [mostrarModalMotivoRevision, setMostrarModalMotivoRevision] = useState(false);

  // Estados para modales de Control
  const [motivoAnulacion, setMotivoAnulacion] = useState('');
  const [motivoCierre, setMotivoCierre] = useState('');
  const [motivoRevision, setMotivoRevision] = useState('');
  const [presupuestoActual, setPresupuestoActual] = useState<{
    id: string;
    importe_total: number;
    importe_total_sin_iva?: number;
    presupuesto_detallado_url?: string;
    estado: string;
    fecha_estimada_inicio?: string;
    duracion_estimada?: string;
    descripcion_breve?: string;
  } | null>(null);
  const [cargandoPresupuesto, setCargandoPresupuesto] = useState(false);
  const [documentoPresupuestoUrl, setDocumentoPresupuestoUrl] = useState<string | null>(null);

  // Historial de estados del proveedor
  const [historialProveedor, setHistorialProveedor] = useState<CambioEstado[]>([]);

  // Chat input
  const [nuevoComentario, setNuevoComentario] = useState("");

  // Hooks compartidos
  const { urls: imageUrls } = useSignedUrls(incidencia?.adjuntos_principales || []);
  const { urls: commentAttachmentUrls } = useComentarioUrls(comentarios);
  const {
    imagenSeleccionada,
    documentoSeleccionado,
    seleccionarImagen,
    seleccionarDocumento,
    uploadFiles,
    limpiar: limpiarArchivos
  } = useChatFileUpload(incidencia?.num_solicitud || '');

  // Ref para scroll automático
  const comentariosContainerRef = useRef<HTMLDivElement>(null);

  // Función para hacer scroll al último mensaje
  const scrollToBottom = () => {
    comentariosContainerRef.current?.scrollTo({
      top: comentariosContainerRef.current.scrollHeight,
      behavior: 'smooth'
    });
  };

  // Cargar datos iniciales
  useEffect(() => {
    if (!authLoading && perfil) {
      cargarDatos();
    }
  }, [incidenciaId, authLoading, perfil]);

  const getColorEmisor = (emisor: string) => {
    switch (emisor.toLowerCase()) {
      case 'proveedor':
        return "#C9A9E3";
      case 'control':
        return "#A9B88C";
      default:
        return PALETA.headerTable;
    }
  };

  const cargarDireccionCentro = async (institucionId?: string, nombreCentro?: string) => {
    try {
      let query = supabase.from("instituciones").select("direccion");

      if (institucionId) {
        query = query.eq("id", institucionId);
      } else if (nombreCentro) {
        query = query.eq("nombre", nombreCentro);
      } else {
        return;
      }

      const { data, error } = await query.maybeSingle();

      if (!error && data?.direccion) {
        setDireccionCentro(data.direccion);
      }
    } catch (error) {
      console.error("Error cargando dirección del centro:", error);
    }
  };

  const cargarDatos = async () => {
    try {
      setLoading(true);

      // Verificar perfil
      if (!perfil) {
        router.push('/login');
        return;
      }

      // Cargar incidencia
      const { data: incidenciaData } = await supabase
        .from("incidencias")
        .select(`
          id,
          num_solicitud,
          descripcion,
          estado_cliente,
          centro,
          fecha,
          hora,
          imagen_url,
          catalogacion,
          institucion_id,
          instituciones(nombre, direccion)
        `)
        .eq("id", incidenciaId)
        .single();

      if (incidenciaData) {
        // Obtener datos del proveedor_casos
        let estadoProveedor = null;
        let prioridadProveedor = null;
        let descripcionProveedor = null;

        if (perfil.rol === 'Control' || perfil.rol === 'Proveedor') {
          const { data: proveedorCaso } = await supabase
            .from("proveedor_casos")
            .select("asignado_en, estado_proveedor, prioridad, descripcion_proveedor, activo")
            .eq("incidencia_id", incidenciaId)
            .order("asignado_en", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (proveedorCaso) {
            if (proveedorCaso.asignado_en) {
              setFechaAsignacionProveedor(proveedorCaso.asignado_en);
            }
            estadoProveedor = proveedorCaso.estado_proveedor;
            prioridadProveedor = proveedorCaso.prioridad;
            descripcionProveedor = proveedorCaso.descripcion_proveedor;
          }
        }

        // Cargar adjuntos principales
        const { data: adjuntosData } = await supabase
          .from("adjuntos")
          .select("*")
          .eq("incidencia_id", incidenciaId)
          .eq("categoria", "imagen_principal");

        // Filtrar solo las imágenes visibles para el proveedor
        let adjuntosPrincipales = (adjuntosData || []).filter(
          adj => adj.visible_proveedor !== false
        );

        // Fallback a imagen_url si no existen adjuntos
        const existenAdjuntos = (adjuntosData || []).length > 0;
        if (incidenciaData.imagen_url && !existenAdjuntos) {
          adjuntosPrincipales = [{
            id: 'imagen_url_' + incidenciaId,
            tipo: 'imagen',
            nombre_archivo: 'Imagen de la incidencia',
            storage_key: incidenciaData.imagen_url,
            categoria: 'imagen_principal'
          }];
        }

        setIncidencia({
          ...incidenciaData,
          estado_proveedor: estadoProveedor,
          prioridad_proveedor: prioridadProveedor,
          descripcion_proveedor: descripcionProveedor,
          adjuntos_principales: adjuntosPrincipales
        });

        // Cargar dirección del centro
        if (incidenciaData.institucion_id) {
          await cargarDireccionCentro(incidenciaData.institucion_id);
        } else if (incidenciaData.centro) {
          await cargarDireccionCentro(undefined, incidenciaData.centro);
        }
      }

      // Verificar oferta aprobada
      const { data: ofertaData } = await supabase
        .from("presupuestos")
        .select("*")
        .eq("incidencia_id", incidenciaId)
        .eq("estado", "aprobado")
        .maybeSingle();

      setTieneOfertaAprobada(!!ofertaData);
      if (ofertaData) {
        setPresupuestoActual(ofertaData);
      }

      // Cargar comentarios con adjuntos
      const { data: comentariosData } = await supabase
        .from("comentarios")
        .select(`
          *,
          adjuntos(id, tipo, nombre_archivo, storage_key, categoria)
        `)
        .eq("incidencia_id", incidenciaId)
        .in("ambito", ["proveedor", "ambos"])
        .not("cuerpo", "is", null)
        .order("creado_en", { ascending: true });

      setComentarios(comentariosData || []);

      // Verificar si alguna vez se aprobó una oferta
      const { data: historialData } = await supabase
        .from("historial_estados")
        .select("*")
        .eq("incidencia_id", incidenciaId)
        .eq("tipo_estado", "proveedor");

      const tuvoOfertaAprobadaEnHistorial = historialData?.some(
        registro => registro.estado_nuevo === 'Oferta aprobada'
      );
      setTuvoOfertaAprobada(!!tuvoOfertaAprobadaEnHistorial);

      // Cargar historial de estados del proveedor
      const { data: historialProveedorData } = await supabase
        .from("historial_estados")
        .select("id, estado_anterior, estado_nuevo, cambiado_en, motivo")
        .eq("incidencia_id", incidenciaId)
        .eq("tipo_estado", "proveedor")
        .order("cambiado_en", { ascending: false });

      setHistorialProveedor(historialProveedorData || []);

    } catch (error) {
      console.error("Error cargando datos:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnviarComentario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoComentario.trim() && !imagenSeleccionada && !documentoSeleccionado) return;
    if (enviando || !perfil) return;

    try {
      setEnviando(true);

      // Subir archivos usando el hook
      const { imagenUrl, documentoUrl } = await uploadFiles();

      // Crear comentario
      const comentarioCreado = await crearComentario({
        incidencia_id: incidenciaId,
        ambito: 'proveedor',
        autor_id: perfil.persona_id,
        autor_email: perfil.email,
        autor_rol: perfil.rol,
        cuerpo: nuevoComentario.trim(),
        es_sistema: false
      });

      if (comentarioCreado) {
        // Si hay archivos, crear adjuntos
        if (imagenUrl || documentoUrl) {
          const adjuntos = [];
          if (imagenUrl) {
            adjuntos.push({
              storage_key: imagenUrl,
              nombre_archivo: imagenSeleccionada?.name || 'imagen.jpg',
              tipo: 'imagen'
            });
          }
          if (documentoUrl) {
            adjuntos.push({
              storage_key: documentoUrl,
              nombre_archivo: documentoSeleccionado?.name || 'documento.pdf',
              tipo: 'documento'
            });
          }

          if (adjuntos.length > 0) {
            await crearAdjuntos(comentarioCreado.id, incidenciaId, adjuntos);
          }
        }
      }

      // Limpiar y recargar
      setNuevoComentario("");
      limpiarArchivos();
      await cargarDatos();

    } catch (error) {
      console.error("Error enviando comentario:", error);
      alert('Error al enviar el comentario');
    } finally {
      setEnviando(false);
    }
  };

  // Handlers de proveedor
  const handleCalendarizarVisita = async () => {
    if (!perfil || !fechaVisita || !horarioVisita) return;

    try {
      setEnviando(true);

      const result = await calendarizarVisita({
        incidenciaId,
        fechaVisita,
        horarioVisita: horarioVisita as 'mañana' | 'tarde',
        autorId: perfil.persona_id
      });

      if (result.success) {
        setMostrarModalVisita(false);
        setFechaVisita('');
        setHorarioVisita('');
        cargarDatos();
      } else {
        alert(result.error || 'Error al calendarizar la visita');
      }
    } catch (error) {
      console.error("Error calendarizando visita:", error);
      alert('Error al calendarizar la visita');
    } finally {
      setEnviando(false);
    }
  };

  const handleOfertarPresupuesto = async () => {
    if (!perfil || !incidencia || !fechaEstimadaInicio || !duracionEstimada || !importeTotalSinIva || !documentoPresupuesto || !descripcionPresupuesto) return;

    try {
      setEnviando(true);

      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData.user?.email;

      const result = await ofertarPresupuesto({
        incidenciaId,
        numeroIncidencia: incidencia.num_solicitud,
        fechaEstimadaInicio,
        duracionEstimada,
        importeTotalSinIva,
        documentoPresupuesto,
        descripcionPresupuesto,
        autorId: perfil.persona_id,
        autorEmail: userEmail || perfil.email
      });

      if (result.success) {
        setMostrarModalPresupuesto(false);
        setPresupuesto('');
        setDescripcionPresupuesto('');
        setFechaEstimadaInicio('');
        setDuracionEstimada('');
        setImporteTotalSinIva('');
        setDocumentoPresupuesto(null);
        cargarDatos();
      } else {
        alert(result.error || 'Error al enviar el presupuesto');
      }
    } catch (error) {
      console.error("Error ofertando presupuesto:", error);
      alert('Error al enviar el presupuesto');
    } finally {
      setEnviando(false);
    }
  };

  const handleResolverIncidencia = async () => {
    if (!perfil || !incidencia || !solucionAplicada) return;

    try {
      setEnviando(true);

      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData.user?.email;

      const result = await resolverIncidenciaService({
        incidenciaId,
        numeroIncidencia: incidencia.num_solicitud,
        solucionAplicada,
        imagenResolucion,
        documentoResolucion,
        tieneOfertaAprobada,
        autorId: perfil.persona_id,
        autorEmail: userEmail || perfil.email
      });

      if (result.success) {
        setMostrarModalResolver(false);
        setSolucionAplicada('');
        setImagenResolucion(null);
        setDocumentoResolucion(null);
        cargarDatos();
      } else {
        alert(result.error || 'Error al resolver la incidencia');
      }
    } catch (error) {
      console.error("Error resolviendo incidencia:", error);
      alert('Error al resolver la incidencia');
    } finally {
      setEnviando(false);
    }
  };

  const handleValoracionEconomica = async () => {
    if (!perfil || !incidencia || !importeSinIva || !importeConIva) return;

    try {
      setEnviando(true);

      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData.user?.email;

      const result = await valoracionEconomicaService({
        incidenciaId,
        numeroIncidencia: incidencia.num_solicitud,
        importeSinIva,
        porcentajeIva,
        importeConIva,
        documentoJustificativo,
        tieneOfertaAprobada,
        autorId: perfil.persona_id,
        autorEmail: userEmail || perfil.email
      });

      if (result.success) {
        setMostrarModalValorarIncidencia(false);
        setImporteSinIva('');
        setImporteConIva('');
        setDocumentoJustificativo(null);
        cargarDatos();
      } else {
        alert(result.error || 'Error en la valoración económica');
      }
    } catch (error) {
      console.error("Error en valoración económica:", error);
      alert('Error en la valoración económica');
    } finally {
      setEnviando(false);
    }
  };

  // Handlers de Control
  const anularIncidencia = async () => {
    if (!motivoAnulacion.trim() || !perfil) return;

    try {
      setEnviando(true);

      const fechaAnulacion = new Date();

      // Obtener información del proveedor
      const { data: proveedorInfo } = await supabase
        .from("proveedor_casos")
        .select("proveedor_id, estado_proveedor")
        .eq("incidencia_id", incidenciaId)
        .eq("activo", true)
        .single();

      if (!proveedorInfo) {
        throw new Error("No se encontró información del proveedor");
      }

      const estadoAnterior = proveedorInfo.estado_proveedor;

      // Cancelar citas programadas
      await supabase
        .from("citas_proveedores")
        .update({ estado: 'cancelada' })
        .eq("incidencia_id", incidenciaId)
        .eq("proveedor_id", proveedorInfo.proveedor_id)
        .eq("estado", "programada");

      // Marcar proveedor_caso como anulado
      await supabase
        .from("proveedor_casos")
        .update({
          estado_proveedor: "Anulada",
          activo: false,
          motivo_anulacion: motivoAnulacion,
          anulado_en: fechaAnulacion.toISOString(),
          anulado_por: perfil.persona_id,
          cerrado_en: fechaAnulacion.toISOString()
        })
        .eq("incidencia_id", incidenciaId)
        .eq("activo", true);

      // Crear notificación
      await supabase
        .from("proveedor_notificaciones")
        .insert({
          proveedor_id: proveedorInfo.proveedor_id,
          incidencia_id: incidenciaId,
          tipo_notificacion: 'anulacion',
          notificacion_vista: false,
          fecha_creacion: fechaAnulacion.toISOString()
        });

      // Registrar cambio de estado
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

      // Comentario en el chat
      await crearComentario({
        incidencia_id: incidenciaId,
        ambito: 'proveedor',
        autor_id: perfil.persona_id,
        autor_email: perfil.email,
        autor_rol: 'Control',
        cuerpo: `Asignación anulada por Control. Motivo: ${motivoAnulacion}`,
        es_sistema: true
      });

      setMostrarModalAnular(false);
      setMotivoAnulacion('');
      cargarDatos();

    } catch (error) {
      console.error("Error anulando incidencia:", error);
      alert("Error al anular la incidencia");
    } finally {
      setEnviando(false);
    }
  };

  const cerrarIncidencia = async () => {
    if (!perfil) return;

    try {
      setEnviando(true);

      // Obtener estados actuales
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

      // Cambiar estados a "Cerrada"
      await supabase
        .from("proveedor_casos")
        .update({ estado_proveedor: "Cerrada" })
        .eq("incidencia_id", incidenciaId)
        .eq("activo", true);

      await supabase
        .from("incidencias")
        .update({ estado_cliente: "Cerrada" })
        .eq("id", incidenciaId);

      // Registrar cambios de estado
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

      // Comentario para ambos chats
      const mensajeCierre = motivoCierre.trim()
        ? `Incidencia cerrada por Control. ${motivoCierre}`
        : 'Incidencia cerrada por Control.';

      await crearComentario({
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
    } finally {
      setEnviando(false);
    }
  };

  const resolverManualmenteConProveedor = async (formulario: FormularioResolucionManual) => {
    if (!perfil || !incidencia) return;

    try {
      setEnviando(true);

      const estadoClienteAnterior = incidencia.estado_cliente;
      const estadoProveedorAnterior = incidencia.estado_proveedor || null;

      // Actualizar estados
      await supabase
        .from("incidencias")
        .update({ estado_cliente: "Resuelta" })
        .eq("id", incidenciaId);

      await supabase
        .from("proveedor_casos")
        .update({ estado_proveedor: "Resuelta" })
        .eq("incidencia_id", incidenciaId)
        .eq("activo", true);

      // Registrar cambios de estado
      await registrarCambioEstado({
        incidenciaId,
        tipoEstado: 'cliente',
        estadoAnterior: estadoClienteAnterior,
        estadoNuevo: 'Resuelta',
        autorId: perfil.persona_id,
        motivo: 'Resolución manual por Control',
        metadatos: {
          accion: 'resolucion_manual_control'
        }
      });

      await registrarCambioEstado({
        incidenciaId,
        tipoEstado: 'proveedor',
        estadoAnterior: estadoProveedorAnterior,
        estadoNuevo: 'Resuelta',
        autorId: perfil.persona_id,
        motivo: 'Resolución manual por Control',
        metadatos: {
          accion: 'resolucion_manual_control'
        }
      });

      // Comentarios
      await crearComentario({
        incidencia_id: incidenciaId,
        ambito: 'proveedor',
        autor_id: perfil.persona_id,
        autor_email: perfil.email,
        autor_rol: 'Control',
        cuerpo: `Control ha resuelto esta incidencia manualmente.\n\n**Motivo:** ${formulario.descripcion}\n\n${formulario.observaciones ? `**Observaciones:** ${formulario.observaciones}` : ''}`,
        es_sistema: true
      });

      await crearComentario({
        incidencia_id: incidenciaId,
        ambito: 'cliente',
        autor_id: perfil.persona_id,
        autor_email: perfil.email,
        autor_rol: 'Control',
        cuerpo: `Incidencia resuelta por Control.\n\n**Motivo:** ${formulario.descripcion}`,
        es_sistema: true
      });

      setMostrarModalResolucionManual(false);
      cargarDatos();

    } catch (error) {
      console.error("Error en resolución manual:", error);
      alert('Error al resolver la incidencia');
    } finally {
      setEnviando(false);
    }
  };

  const getSignedDocumentUrl = async (storageKey: string) => {
    try {
      let cleanPath = storageKey;

      if (storageKey.startsWith('https://')) {
        if (storageKey.includes('/storage/v1/object/public/incidencias/')) {
          const parts = storageKey.split('/storage/v1/object/public/incidencias/');
          if (parts.length > 1) {
            cleanPath = parts[1];
          }
        }
      }

      const { data, error } = await supabase.storage
        .from('incidencias')
        .createSignedUrl(cleanPath, 14400);

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

  const abrirModalGestionPresupuesto = async () => {
    try {
      setCargandoPresupuesto(true);
      setMostrarModalGestionPresupuesto(true);
      setDocumentoPresupuestoUrl(null);

      const { data: presupuestos } = await supabase
        .from("presupuestos")
        .select("*")
        .eq("incidencia_id", incidenciaId)
        .order("creado_en", { ascending: false })
        .limit(1);

      const presupuesto = presupuestos && presupuestos.length > 0 ? presupuestos[0] : null;
      setPresupuestoActual(presupuesto);

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

  const aprobarPresupuesto = async () => {
    if (!perfil || !presupuestoActual || enviando) return;

    try {
      setEnviando(true);

      await supabase
        .from("proveedor_casos")
        .update({ estado_proveedor: "Oferta aprobada" })
        .eq("incidencia_id", incidenciaId)
        .eq("activo", true);

      await supabase
        .from("presupuestos")
        .update({ estado: "aprobado" })
        .eq("id", presupuestoActual.id);

      await registrarCambioEstado({
        incidenciaId,
        tipoEstado: 'proveedor',
        estadoAnterior: "pendiente_revision",
        estadoNuevo: "aprobado",
        autorId: perfil.persona_id,
        motivo: `Presupuesto aprobado. Importe: ${presupuestoActual.importe_total_sin_iva}€ (sin IVA)`,
        metadatos: {
          presupuesto_id: presupuestoActual.id,
          importe: presupuestoActual.importe_total_sin_iva || 0,
          accion: 'aprobar_presupuesto'
        }
      });

      await crearComentario({
        incidencia_id: incidenciaId,
        ambito: 'proveedor',
        autor_id: perfil.persona_id,
        autor_email: perfil.email,
        autor_rol: 'Control',
        cuerpo: `Presupuesto aprobado por Control. Importe: ${presupuestoActual.importe_total_sin_iva}€ (sin IVA). Puedes proceder con la ejecución.`,
        es_sistema: true
      });

      setMostrarModalGestionPresupuesto(false);
      cargarDatos();

    } catch (error) {
      console.error("Error aprobando presupuesto:", error);
    } finally {
      setEnviando(false);
    }
  };

  const mandarARevisar = async () => {
    if (!perfil || !presupuestoActual || !motivoRevision.trim()) return;

    try {
      setEnviando(true);

      await supabase
        .from("proveedor_casos")
        .update({ estado_proveedor: "Oferta a revisar" })
        .eq("incidencia_id", incidenciaId)
        .eq("activo", true);

      await supabase
        .from("presupuestos")
        .update({ estado: "revisar" })
        .eq("id", presupuestoActual.id);

      await registrarCambioEstado({
        incidenciaId,
        tipoEstado: 'proveedor',
        estadoAnterior: "Ofertada",
        estadoNuevo: "Oferta a revisar",
        autorId: perfil.persona_id,
        motivo: motivoRevision,
        metadatos: {
          accion: 'rechazar_presupuesto',
          presupuesto_id: presupuestoActual.id
        }
      });

      await crearComentario({
        incidencia_id: incidenciaId,
        ambito: 'proveedor',
        autor_id: perfil.persona_id,
        autor_email: perfil.email,
        autor_rol: 'Control',
        cuerpo: `Control ha solicitado revisión del presupuesto.\n**Motivo:** ${motivoRevision}`,
        es_sistema: true
      });

      setMostrarModalMotivoRevision(false);
      setMostrarModalGestionPresupuesto(false);
      setMotivoRevision('');
      cargarDatos();

    } catch (error) {
      console.error("Error mandando a revisar:", error);
    } finally {
      setEnviando(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: PALETA.bg }}>
        <div className="text-white">Cargando...</div>
      </div>
    );
  }

  if (!incidencia) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: PALETA.bg }}>
        <div className="text-white">Incidencia no encontrada</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: PALETA.bg }}>
      {/* Header */}
      <div className="flex justify-between items-center p-6">
        <button
          onClick={() => router.push("/incidencias")}
          className="text-white text-sm hover:underline"
        >
          ← Volver a incidencias
        </button>
      </div>

      {/* Contenido */}
      <div className="px-6 pb-6">
        {/* Datos Técnicos de la Incidencia - específicos para proveedor */}
        <div className="mb-6">
          <div className="rounded-lg shadow-lg" style={{ backgroundColor: PALETA.card }}>
            <div
              className="px-6 py-4 mb-6 border-b rounded-t-lg"
              style={{
                backgroundColor: PALETA.headerTable,
                color: PALETA.textoOscuro
              }}
            >
              <h2 className="text-lg font-semibold">DATOS TÉCNICOS DE LA INCIDENCIA</h2>
            </div>

            {(() => {
              const hasImages = incidencia.adjuntos_principales && incidencia.adjuntos_principales.length > 0 &&
                incidencia.adjuntos_principales.some(adjunto => imageUrls[adjunto.id]);

              return (
                <div className={`grid grid-cols-1 ${hasImages ? 'lg:grid-cols-3' : ''} gap-6 px-6 pb-6`}>
                  {/* Tabla de datos técnicos */}
                  <div className={hasImages ? "lg:col-span-2" : ""}>
                    <table className="w-full text-sm">
                      <tbody className="divide-y" style={{ borderColor: PALETA.headerTable }}>
                        <tr>
                          <td className="py-2 font-semibold w-1/3" style={{ color: PALETA.textoOscuro }}>
                            ID Solicitud:
                          </td>
                          <td className="py-2 font-mono" style={{ color: PALETA.textoOscuro }}>
                            {incidencia.num_solicitud}
                          </td>
                        </tr>

                        <tr style={{ backgroundColor: `${PALETA.headerTable}20` }}>
                          <td className="py-2 font-semibold" style={{ color: PALETA.textoOscuro }}>
                            Centro:
                          </td>
                          <td className="py-2" style={{ color: PALETA.textoOscuro }}>
                            <div className="flex items-center gap-2">
                              <span>{incidencia.instituciones?.[0]?.nombre || incidencia.centro || "-"}</span>
                              {direccionCentro && (
                                <button
                                  onClick={() => window.open(direccionCentro || '', '_blank')}
                                  className="px-2 py-1 text-xs rounded text-white hover:opacity-90 transition-opacity"
                                  style={{ backgroundColor: PALETA.bg }}
                                  title="Ir a la dirección"
                                >
                                  📍 Ir a la dirección
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        <tr style={{ backgroundColor: `${PALETA.headerTable}20` }}>
                          <td className="py-2 font-semibold" style={{ color: PALETA.textoOscuro }}>
                            Estado:
                          </td>
                          <td className="py-2">
                            <span
                              className="px-2 py-1 rounded text-xs font-medium text-white"
                              style={{ backgroundColor: '#3b82f6' }}
                            >
                              {incidencia.estado_proveedor || "Sin asignar"}
                            </span>
                          </td>
                        </tr>

                        <tr>
                          <td className="py-2 font-semibold" style={{ color: PALETA.textoOscuro }}>
                            Fecha de Creación:
                          </td>
                          <td className="py-2" style={{ color: PALETA.textoOscuro }}>
                            {incidencia.fecha && incidencia.hora
                              ? new Date(`${incidencia.fecha}T${incidencia.hora}`).toLocaleString('es-ES', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })
                              : '-'}
                          </td>
                        </tr>

                        <tr style={{ backgroundColor: `${PALETA.headerTable}20` }}>
                          <td className="py-2 font-semibold" style={{ color: PALETA.textoOscuro }}>
                            Fecha de Asignación:
                          </td>
                          <td className="py-2" style={{ color: PALETA.textoOscuro }}>
                            {fechaAsignacionProveedor ? new Date(fechaAsignacionProveedor).toLocaleString('es-ES', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            }) : '-'}
                          </td>
                        </tr>

                        <tr>
                          <td className="py-2 font-semibold" style={{ color: PALETA.textoOscuro }}>
                            Catalogación:
                          </td>
                          <td className="py-2" style={{ color: PALETA.textoOscuro }}>
                            {incidencia.catalogacion || "Sin catalogar"}
                          </td>
                        </tr>

                        <tr style={{ backgroundColor: `${PALETA.headerTable}20` }}>
                          <td className="py-2 font-semibold" style={{ color: PALETA.textoOscuro }}>
                            Prioridad:
                          </td>
                          <td className="py-2">
                            {incidencia.prioridad_proveedor ? (
                              <span
                                className="px-2 py-1 rounded text-xs font-medium text-white"
                                style={{
                                  backgroundColor: incidencia.prioridad_proveedor === 'Crítico' ? '#ef4444' : '#10b981'
                                }}
                              >
                                {incidencia.prioridad_proveedor}
                              </span>
                            ) : (
                              <span style={{ color: PALETA.textoOscuro }}>No asignada</span>
                            )}
                          </td>
                        </tr>

                        <tr>
                          <td className="py-2 font-semibold align-top" style={{ color: PALETA.textoOscuro }}>
                            Descripción:
                          </td>
                          <td className="py-2 leading-relaxed" style={{ color: PALETA.textoOscuro }}>
                            {incidencia.descripcion_proveedor || incidencia.descripcion}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Sección de imágenes */}
                  {hasImages && (
                    <div className="lg:col-span-1">
                      <div className="rounded-lg p-4">
                        <p className="py-2 font-semibold text-sm" style={{ color: PALETA.textoOscuro }}>
                          Imagen:
                        </p>

                        <div className="space-y-3">
                          {incidencia.adjuntos_principales?.map((adjunto) => {
                            const imageUrl = imageUrls[adjunto.id];
                            if (!imageUrl) return null;
                            return (
                              <div key={adjunto.id} className="text-center">
                                <div
                                  className="cursor-pointer border-2 rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
                                  style={{ borderColor: PALETA.bg }}
                                  onClick={() => window.open(imageUrl, '_blank')}
                                >
                                  <img
                                    src={imageUrl}
                                    alt={adjunto.nombre_archivo || "Imagen de la incidencia"}
                                    className="w-full h-48 object-cover hover:scale-105 transition-transform duration-200"
                                    onError={(e) => {
                                      console.error('Error cargando imagen:', adjunto.storage_key);
                                      e.currentTarget.style.display = 'none';
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Panel de acciones para Control */}
        {perfil?.rol === "Control" && (
          <div className="mb-6">
            <div className="rounded-lg shadow-lg" style={{ backgroundColor: PALETA.card }}>
              <div
                className="px-6 py-4 border-b rounded-t-lg"
                style={{
                  backgroundColor: PALETA.headerTable,
                  color: PALETA.textoOscuro
                }}
              >
                <h2 className="text-lg font-semibold">ACCIONES DE CONTROL</h2>
              </div>
              <div className="px-6 py-4">
                {(() => {
                  const estado = incidencia.estado_proveedor;
                  const incidenciaCerrada = incidencia.estado_cliente === "Cerrada" && estado === "Cerrada";

                  return (
                    <div className="flex gap-3 justify-center flex-wrap">
                      {!incidenciaCerrada && estado !== "Anulada" && (
                        <button
                          type="button"
                          onClick={() => setMostrarModalAnular(true)}
                          className="px-3 py-2 text-sm border border-red-500 text-red-600 bg-white rounded hover:bg-red-50 transition-colors"
                        >
                          Anular asignación proveedor
                        </button>
                      )}

                      {estado === "Anulada" && (
                        <button
                          type="button"
                          onClick={() => router.push(`/incidencias/${incidenciaId}/chat-control-cliente`)}
                          className="px-4 py-2 text-white rounded hover:opacity-90 transition-opacity"
                          style={{ backgroundColor: PALETA.verdeClaro }}
                        >
                          Reasignar Proveedor
                        </button>
                      )}

                      {estado === "Valorada" && (
                        <button
                          type="button"
                          onClick={() => setMostrarModalCerrar(true)}
                          className="px-4 py-2 text-white rounded hover:opacity-90 transition-opacity"
                          style={{ backgroundColor: PALETA.verdeClaro }}
                        >
                          Cerrar Incidencia
                        </button>
                      )}

                      {estado === "Ofertada" && (
                        <button
                          type="button"
                          onClick={abrirModalGestionPresupuesto}
                          className="px-4 py-2 text-white rounded hover:opacity-90 transition-opacity"
                          style={{ backgroundColor: PALETA.verdeClaro }}
                        >
                          Gestionar Presupuesto
                        </button>
                      )}

                      {estado === "Resuelta" && (
                        <button
                          type="button"
                          onClick={() => setMostrarModalValorarIncidencia(true)}
                          className="px-4 py-2 text-white rounded hover:opacity-90 transition-opacity"
                          style={{ backgroundColor: "#059669" }}
                        >
                          Valorar Incidencia
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => router.push(`/incidencias/${incidenciaId}/chat-control-cliente`)}
                        className="px-4 py-2 text-sm border rounded hover:bg-gray-50 transition-colors"
                        style={{
                          borderColor: PALETA.bg,
                          color: PALETA.bg
                        }}
                      >
                        Cambiar al Chat Cliente
                      </button>

                      {incidencia.estado_proveedor !== 'Cerrada' && incidencia.estado_proveedor !== 'Anulada' && (
                        <button
                          type="button"
                          onClick={() => setMostrarModalResolucionManual(true)}
                          className="px-4 py-2 text-sm text-white rounded hover:opacity-90 transition-opacity"
                          style={{ backgroundColor: PALETA.verdeClaro }}
                        >
                          Resolver Manualmente
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Botones de acciones del proveedor */}
        {perfil?.rol === 'Proveedor' && (
          <div className="mb-6">
            <div className="rounded-lg shadow-lg" style={{ backgroundColor: PALETA.card }}>
              <div
                className="px-6 py-4 border-b rounded-t-lg"
                style={{
                  backgroundColor: PALETA.headerTable,
                  color: PALETA.textoOscuro
                }}
              >
                <h2 className="text-lg font-semibold">ACCIONES DISPONIBLES</h2>
              </div>
              <div className="px-6 py-4">
                {(() => {
                  const estado = incidencia.estado_proveedor;

                  const botonesDisponibles = {
                    calendarizar: false,
                    ofertar: false,
                    resolver: false,
                    valorar: false
                  };

                  let mensaje = '';

                  switch (estado) {
                    case "Abierta":
                    case "En resolución":
                      botonesDisponibles.calendarizar = true;
                      botonesDisponibles.ofertar = true;
                      botonesDisponibles.resolver = true;
                      break;

                    case "Ofertada":
                      mensaje = '⏳ Esperando respuesta de Control sobre la oferta enviada';
                      break;

                    case "Oferta aprobada":
                      botonesDisponibles.calendarizar = true;
                      botonesDisponibles.resolver = true;
                      break;

                    case "Oferta a revisar":
                      botonesDisponibles.ofertar = true;
                      mensaje = '🔄 Oferta rechazada - Debe revisar y presentar una nueva oferta';
                      break;

                    case "Resuelta":
                      botonesDisponibles.valorar = true;
                      mensaje = '✅ Incidencia resuelta - Puede proceder con la valoración económica';
                      break;

                    case "Pendiente valoración":
                      botonesDisponibles.valorar = true;
                      mensaje = '📋 Incidencia lista para valorar';
                      break;

                    case "Valorada":
                    case "Cerrada":
                    case "Anulada":
                      mensaje = '🔒 Incidencia finalizada - No hay acciones disponibles';
                      break;

                    default:
                      mensaje = '⚠️ Estado desconocido - Contacte con soporte si persiste';
                  }

                  if (tuvoOfertaAprobada) {
                    botonesDisponibles.ofertar = false;
                  }

                  return (
                    <>
                      {mensaje && (
                        <div className="text-center py-4">
                          <p className="text-sm text-gray-600 mb-2">{mensaje}</p>
                        </div>
                      )}

                      {(botonesDisponibles.calendarizar || botonesDisponibles.ofertar || botonesDisponibles.resolver) && (
                        <div className="flex gap-3 justify-center flex-wrap">
                          {botonesDisponibles.calendarizar && (
                            <button
                              type="button"
                              onClick={() => setMostrarModalVisita(true)}
                              className="px-4 py-2 text-white rounded hover:opacity-90 transition-opacity"
                              style={{ backgroundColor: PALETA.verdeClaro }}
                            >
                              📅 Calendarizar Visita
                            </button>
                          )}

                          {botonesDisponibles.ofertar && (
                            <button
                              type="button"
                              onClick={() => setMostrarModalPresupuesto(true)}
                              className="px-4 py-2 text-white rounded hover:opacity-90 transition-opacity"
                              style={{ backgroundColor: "#2563eb" }}
                            >
                              💰 Ofertar Presupuesto
                            </button>
                          )}

                          {botonesDisponibles.resolver && (
                            <button
                              type="button"
                              onClick={() => setMostrarModalResolver(true)}
                              className="px-4 py-2 text-white rounded hover:opacity-90 transition-opacity"
                              style={{ backgroundColor: "#059669" }}
                            >
                              ✅ Resolver Incidencia
                            </button>
                          )}
                        </div>
                      )}

                      {botonesDisponibles.valorar && (
                        <div className="flex justify-center mt-3">
                          <button
                            type="button"
                            onClick={() => setMostrarModalValorarIncidencia(true)}
                            className="px-4 py-2 text-white rounded hover:opacity-90 transition-opacity"
                            style={{ backgroundColor: "#dc2626" }}
                          >
                            💵 Valorar Económicamente
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Sección de seguimiento */}
        <div className="mb-8">
          {perfil?.rol === 'Control' ? (
            <div className="text-white text-center">
              <h2 className="text-lg font-semibold mb-1 tracking-wider">CHAT PROVEEDOR</h2>
              <p className="text-sm opacity-80">#{incidencia.num_solicitud}</p>
            </div>
          ) : (
            <h2 className="text-white text-center text-lg font-semibold mb-4 tracking-wider">SEGUIMIENTO</h2>
          )}
        </div>

        {/* Área de comentarios */}
        <div className="bg-white rounded-lg shadow-sm flex flex-col h-[700px] relative">
          {/* Botón flotante para ir al último mensaje */}
          <ScrollToBottomButton
            onClick={scrollToBottom}
            show={comentarios.length > 3}
          />

          {/* Lista de comentarios */}
          <div ref={comentariosContainerRef} className="flex-1 overflow-y-auto p-6 space-y-4">
            {comentarios.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                No hay comentarios aún. ¡Añade el primero!
              </div>
            ) : (
              comentarios.map((comentario) => (
                <div
                  key={comentario.id}
                  className={`flex ${
                    comentario.es_sistema
                      ? 'justify-center'
                      : comentario.autor_email === perfil?.email ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`rounded-lg p-3 ${
                      comentario.es_sistema
                        ? 'max-w-full mx-4'
                        : 'max-w-xs md:max-w-md'
                    }`}
                    style={{
                      backgroundColor: comentario.es_sistema
                        ? '#fef3c7'
                        : comentario.autor_email === perfil?.email
                          ? '#dcfce7'
                          : getColorEmisor(comentario.autor_rol || 'proveedor')
                    }}
                  >
                    {!comentario.es_sistema && (
                      <div className="text-xs font-medium mb-1" style={{
                        color: PALETA.bg
                      }}>
                        {`${comentario.autor_email} (${comentario.autor_rol})`}
                      </div>
                    )}
                    <div className="text-sm whitespace-pre-wrap">{comentario.cuerpo}</div>

                    {/* Mostrar adjuntos */}
                    {((comentario.imagen_url || comentario.documento_url) || (comentario.adjuntos && comentario.adjuntos.length > 0)) && (
                      <div className="mt-2 space-y-2">
                        {comentario.imagen_url && (
                          (() => {
                            const imageUrl = commentAttachmentUrls[`imagen_${comentario.id}`];
                            return imageUrl ? (
                              <img
                                src={imageUrl}
                                alt="Imagen adjunta"
                                className="max-w-32 h-24 object-cover rounded border cursor-pointer hover:scale-105 transition-transform"
                                onClick={() => window.open(imageUrl, '_blank')}
                              />
                            ) : null;
                          })()
                        )}

                        {comentario.documento_url && (
                          (() => {
                            const documentUrl = commentAttachmentUrls[`documento_${comentario.id}`];
                            const fileName = comentario.documento_url.split('/').pop() || 'Documento adjunto';
                            return documentUrl ? (
                              <a
                                href={documentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 text-blue-600 hover:underline text-sm bg-blue-50 px-3 py-1 rounded"
                              >
                                📎 {fileName}
                              </a>
                            ) : null;
                          })()
                        )}

                        {comentario.adjuntos && comentario.adjuntos.map((adjunto) => (
                          <div key={adjunto.id}>
                            {adjunto.tipo === 'imagen' && (
                              (() => {
                                const imageUrl = commentAttachmentUrls[adjunto.id];
                                return imageUrl ? (
                                  <img
                                    src={imageUrl}
                                    alt={adjunto.nombre_archivo || "Imagen adjunta"}
                                    className="max-w-32 h-24 object-cover rounded border cursor-pointer hover:scale-105 transition-transform"
                                    onClick={() => window.open(imageUrl, '_blank')}
                                  />
                                ) : null;
                              })()
                            )}
                            {adjunto.tipo === 'documento' && (
                              (() => {
                                const documentUrl = commentAttachmentUrls[adjunto.id];
                                return documentUrl ? (
                                  <a
                                    href={documentUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-blue-600 hover:underline text-sm bg-blue-50 px-3 py-1 rounded"
                                  >
                                    📎 {adjunto.nombre_archivo || 'Documento adjunto'}
                                  </a>
                                ) : null;
                              })()
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="text-xs opacity-75 mt-1">
                      {new Date(comentario.creado_en).toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Formulario para añadir comentario */}
          <form onSubmit={handleEnviarComentario} className="border-t p-4 space-y-4">
            <textarea
              value={nuevoComentario}
              onChange={(e) => setNuevoComentario(e.target.value)}
              placeholder="Añadir comentario"
              className="w-full h-24 p-3 border rounded focus:outline-none resize-none text-sm"
              style={{ borderColor: PALETA.textoOscuro }}
              onFocus={(e) => {
                e.target.style.boxShadow = `0 0 0 2px ${PALETA.verdeClaro}80`;
              }}
              onBlur={(e) => {
                e.target.style.boxShadow = '';
              }}
              disabled={enviando}
            />

            {/* Preview de archivos seleccionados */}
            {(imagenSeleccionada || documentoSeleccionado) && (
              <div className="flex gap-2 flex-wrap">
                {imagenSeleccionada && (
                  <div className="flex items-center gap-2 bg-white px-3 py-2 rounded border border-gray-300">
                    <span className="text-gray-700 text-sm">{imagenSeleccionada.name}</span>
                    <button
                      type="button"
                      onClick={() => seleccionarImagen(null)}
                      className="text-gray-500 hover:text-gray-700 text-sm"
                    >
                      ×
                    </button>
                  </div>
                )}
                {documentoSeleccionado && (
                  <div className="flex items-center gap-2 bg-white px-3 py-2 rounded border border-gray-300">
                    <span className="text-gray-700 text-sm">{documentoSeleccionado.name}</span>
                    <button
                      type="button"
                      onClick={() => seleccionarDocumento(null)}
                      className="text-gray-500 hover:text-gray-700 text-sm"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Botones de archivos adjuntos */}
            <div className="flex gap-4 items-center">
              <div className="relative">
                <input
                  type="file"
                  id="imagen"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) seleccionarImagen(file);
                  }}
                  className="hidden"
                />
                <label
                  htmlFor="imagen"
                  className="inline-flex items-center gap-2 px-3 py-0.5 border border-gray-400 rounded cursor-pointer transition-colors text-gray-600"
                  style={{ borderColor: PALETA.textoOscuro }}
                >
                  <span className="font-medium text-sm">Añadir imagen</span>
                  <span className="text-2xl text-gray-400">+</span>
                </label>
              </div>

              <div className="relative">
                <input
                  type="file"
                  id="documento"
                  accept=".pdf,.doc,.docx,.txt"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) seleccionarDocumento(file);
                  }}
                  className="hidden"
                />
                <label
                  htmlFor="documento"
                  className="inline-flex items-center gap-2 px-3 py-0.5 border border-gray-400 rounded cursor-pointer transition-colors text-gray-600"
                  style={{ borderColor: PALETA.textoOscuro }}
                >
                  <span className="font-medium text-sm">Añadir documento</span>
                  <span className="text-2xl text-gray-400">+</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={enviando}
                className="ml-auto px-6 py-2 text-white rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                style={{ backgroundColor: PALETA.verdeClaro }}
              >
                {enviando ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Historial de Estados del Proveedor */}
      <div className="px-6 mb-6">
        <HistorialEstados
          cambios={historialProveedor}
          titulo="HISTORIAL DE ESTADOS DEL PROVEEDOR"
        />
      </div>

      {/* Modales de Proveedor */}
      <ModalCalendarizar
        isOpen={mostrarModalVisita}
        onClose={() => {
          setMostrarModalVisita(false);
          setFechaVisita('');
          setHorarioVisita('');
        }}
        onSubmit={handleCalendarizarVisita}
        fechaVisita={fechaVisita}
        setFechaVisita={setFechaVisita}
        horarioVisita={horarioVisita}
        setHorarioVisita={setHorarioVisita}
        enviando={enviando}
      />

      <ModalOferta
        isOpen={mostrarModalPresupuesto}
        onClose={() => {
          setMostrarModalPresupuesto(false);
          setDescripcionPresupuesto('');
          setFechaEstimadaInicio('');
          setDuracionEstimada('');
          setImporteTotalSinIva('');
          setDocumentoPresupuesto(null);
        }}
        onSubmit={handleOfertarPresupuesto}
        numeroIncidencia={incidencia?.num_solicitud || ''}
        descripcionPresupuesto={descripcionPresupuesto}
        setDescripcionPresupuesto={setDescripcionPresupuesto}
        fechaEstimadaInicio={fechaEstimadaInicio}
        setFechaEstimadaInicio={setFechaEstimadaInicio}
        duracionEstimada={duracionEstimada}
        setDuracionEstimada={setDuracionEstimada}
        importeTotalSinIva={importeTotalSinIva}
        setImporteTotalSinIva={setImporteTotalSinIva}
        documentoPresupuesto={documentoPresupuesto}
        setDocumentoPresupuesto={setDocumentoPresupuesto}
        enviando={enviando}
      />

      <ModalResolver
        isOpen={mostrarModalResolver}
        onClose={() => {
          setMostrarModalResolver(false);
          setSolucionAplicada('');
          setImagenResolucion(null);
          setDocumentoResolucion(null);
        }}
        onSubmit={handleResolverIncidencia}
        solucionAplicada={solucionAplicada}
        setSolucionAplicada={setSolucionAplicada}
        imagenResolucion={imagenResolucion}
        setImagenResolucion={setImagenResolucion}
        documentoResolucion={documentoResolucion}
        setDocumentoResolucion={setDocumentoResolucion}
        tieneOfertaAprobada={tieneOfertaAprobada}
        enviando={enviando}
      />

      <ModalValoracion
        isOpen={mostrarModalValorarIncidencia}
        onClose={() => {
          setMostrarModalValorarIncidencia(false);
          setImporteSinIva('');
          setImporteConIva('');
          setDocumentoJustificativo(null);
        }}
        onSubmit={handleValoracionEconomica}
        importeSinIva={importeSinIva}
        setImporteSinIva={setImporteSinIva}
        importeConIva={importeConIva}
        setImporteConIva={setImporteConIva}
        porcentajeIva={porcentajeIva}
        setPorcentajeIva={setPorcentajeIva}
        documentoJustificativo={documentoJustificativo}
        setDocumentoJustificativo={setDocumentoJustificativo}
        tieneOfertaAprobada={tieneOfertaAprobada}
        presupuestoActual={presupuestoActual}
        enviando={enviando}
      />

      {/* Modales de Control */}
      {mostrarModalAnular && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Anular Asignación de Proveedor</h3>
            <textarea
              value={motivoAnulacion}
              onChange={(e) => setMotivoAnulacion(e.target.value)}
              placeholder="Motivo de la anulación"
              className="w-full p-3 border rounded mb-4"
              rows={4}
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setMostrarModalAnular(false);
                  setMotivoAnulacion('');
                }}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={anularIncidencia}
                disabled={!motivoAnulacion.trim() || enviando}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                {enviando ? 'Anulando...' : 'Anular'}
              </button>
            </div>
          </div>
        </div>
      )}

      {mostrarModalCerrar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Cerrar Incidencia</h3>
            <textarea
              value={motivoCierre}
              onChange={(e) => setMotivoCierre(e.target.value)}
              placeholder="Motivo del cierre (opcional)"
              className="w-full p-3 border rounded mb-4"
              rows={4}
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setMostrarModalCerrar(false);
                  setMotivoCierre('');
                }}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={cerrarIncidencia}
                disabled={enviando}
                className="px-4 py-2 text-white rounded hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: PALETA.verdeClaro }}
              >
                {enviando ? 'Cerrando...' : 'Cerrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {mostrarModalGestionPresupuesto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Gestionar Presupuesto</h3>
            {cargandoPresupuesto ? (
              <p>Cargando presupuesto...</p>
            ) : presupuestoActual ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-semibold">Importe sin IVA:</p>
                    <p>{presupuestoActual.importe_total_sin_iva}€</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Importe total:</p>
                    <p>{presupuestoActual.importe_total}€</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Fecha inicio estimada:</p>
                    <p>{presupuestoActual.fecha_estimada_inicio || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Duración estimada:</p>
                    <p>{presupuestoActual.duracion_estimada || '-'}</p>
                  </div>
                </div>
                {presupuestoActual.descripcion_breve && (
                  <div>
                    <p className="text-sm font-semibold">Descripción:</p>
                    <p>{presupuestoActual.descripcion_breve}</p>
                  </div>
                )}
                {documentoPresupuestoUrl && (
                  <div>
                    <a
                      href={documentoPresupuestoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      📎 Ver documento del presupuesto
                    </a>
                  </div>
                )}
                <div className="flex gap-3 justify-end pt-4">
                  <button
                    onClick={() => setMostrarModalGestionPresupuesto(false)}
                    className="px-4 py-2 border rounded hover:bg-gray-50"
                  >
                    Cerrar
                  </button>
                  <button
                    onClick={() => setMostrarModalMotivoRevision(true)}
                    className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
                  >
                    Rechazar
                  </button>
                  <button
                    onClick={aprobarPresupuesto}
                    disabled={enviando}
                    className="px-4 py-2 text-white rounded hover:opacity-90 disabled:opacity-50"
                    style={{ backgroundColor: PALETA.verdeClaro }}
                  >
                    {enviando ? 'Aprobando...' : 'Aprobar'}
                  </button>
                </div>
              </div>
            ) : (
              <p>No se encontró presupuesto para esta incidencia.</p>
            )}
          </div>
        </div>
      )}

      {mostrarModalMotivoRevision && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Motivo de Revisión</h3>
            <textarea
              value={motivoRevision}
              onChange={(e) => setMotivoRevision(e.target.value)}
              placeholder="Explique por qué se rechaza el presupuesto"
              className="w-full p-3 border rounded mb-4"
              rows={4}
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setMostrarModalMotivoRevision(false);
                  setMotivoRevision('');
                }}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={mandarARevisar}
                disabled={!motivoRevision.trim() || enviando}
                className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50"
              >
                {enviando ? 'Enviando...' : 'Enviar a Revisar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ModalResolucionManual
        isOpen={mostrarModalResolucionManual}
        onClose={() => setMostrarModalResolucionManual(false)}
        onSubmit={resolverManualmenteConProveedor}
        tieneProveedor={true}
        enviando={enviando}
      />
    </div>
  );
}
