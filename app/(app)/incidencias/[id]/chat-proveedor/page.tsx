"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
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
import ModalRechazarResolucion from "@/components/ModalRechazarResolucion";
import ModalMotivoRevision from "@/components/ModalMotivoRevision";
import ModalCerrarIncidencia from "@/components/ModalCerrarIncidencia";
import ModalAnularAsignacionProveedor from "@/components/ModalAnularAsignacionProveedor";
import ModalAsignarProveedor from "@/components/ModalAsignarProveedor";
import { asignarProveedorCompleto, type FormularioAsignacionProveedor } from "@/lib/services/asignacionProveedorService";

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
  tipo_revision?: string | null;
  centro?: string;
  fecha?: string;
  hora?: string;
  imagen_url?: string;
  catalogacion?: string;
  institucion_id?: string;
  proveedor_nombre?: string;
  instituciones?: {
    nombre: string;
    direccion?: string;
  }[] | null;
  adjuntos_principales?: Adjunto[];
};

type Comentario = {
  id: string;
  incidencia_id: string;
  proveedor_caso_id?: string | null;
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

type ProveedorCaso = {
  id: string;
  asignado_en?: string;
  estado_proveedor: string;
  prioridad: string;
  descripcion_proveedor?: string | null;
  activo: boolean;
  tipo_revision?: string | null;
  proveedor_id: string;
};

export default function ChatProveedor() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const incidenciaId = params.id as string;
  const proveedorCasoIdUrl = searchParams.get('proveedor_caso_id');

  // AuthContext
  const { perfil, loading: authLoading } = useAuth();

  // Estados principales
  const [incidencia, setIncidencia] = useState<Incidencia | null>(null);
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);

  // Estados de proveedor
  const [proveedorCasoId, setProveedorCasoId] = useState<string | null>(null);
  const [fechaAsignacionProveedor, setFechaAsignacionProveedor] = useState<string | null>(null);
  const [direccionCentro, setDireccionCentro] = useState<string | null>(null);
  const [tieneOfertaAprobada, setTieneOfertaAprobada] = useState(false);
  const [tuvoOfertaAprobada, setTuvoOfertaAprobada] = useState(false);
  const [tieneResolucion, setTieneResolucion] = useState(false);
  const [tieneResolucionManual, setTieneResolucionManual] = useState(false);
  const [resolucionExistente, setResolucionExistente] = useState<{
    solucion_aplicada: string;
    fecha_realizacion: string;
  } | null>(null);
  const [tieneValoracion, setTieneValoracion] = useState(false);
  const [valoracionExistente, setValoracionExistente] = useState<{
    id: string;
    importe_sin_iva: number;
    porcentaje_iva: number;
    importe_con_iva: number;
  } | null>(null);
  const [resumenResolucion, setResumenResolucion] = useState<{
    solucion_aplicada: string;
    fecha_realizacion: string;
    tiene_imagenes: boolean;
    tiene_documento: boolean;
    imagenes_urls?: string[];
    documento_url?: string;
  } | null>(null);
  const [resumenValoracion, setResumenValoracion] = useState<{
    importe_sin_iva: number;
    porcentaje_iva: number;
    importe_con_iva: number;
    tiene_documento: boolean;
    documento_url?: string;
  } | null>(null);

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
  const [fechaRealizacion, setFechaRealizacion] = useState('');
  const [imagenesResolucion, setImagenesResolucion] = useState<File[]>([]);
  const [documentoResolucion, setDocumentoResolucion] = useState<File | null>(null);
  const [importeSinIva, setImporteSinIva] = useState('');
  const [importeConIva, setImporteConIva] = useState('');
  const [porcentajeIva, setPorcentajeIva] = useState('21');
  const [documentoJustificativo, setDocumentoJustificativo] = useState<File | null>(null);

  // Modales de Control
  const [mostrarModalAnular, setMostrarModalAnular] = useState(false);
  const [mostrarModalCerrar, setMostrarModalCerrar] = useState(false);
  const [mostrarModalRechazarResolucion, setMostrarModalRechazarResolucion] = useState(false);
  const [mostrarModalGestionPresupuesto, setMostrarModalGestionPresupuesto] = useState(false);
  const [mostrarModalResolucionManual, setMostrarModalResolucionManual] = useState(false);
  const [mostrarModalMotivoRevision, setMostrarModalMotivoRevision] = useState(false);
  const [mostrarModalReasignarProveedor, setMostrarModalReasignarProveedor] = useState(false);

  // Estados para modales de Control
  const [motivoAnulacion, setMotivoAnulacion] = useState('');
  const [presupuestoActual, setPresupuestoActual] = useState<{
    id: string;
    importe_total: number;
    importe_total_sin_iva?: number;
    presupuesto_detallado_url?: string;
    estado: string;
    fecha_estimada_inicio?: string;
    duracion_estimada?: string;
    descripcion_breve?: string;
    documento_adjunto_id?: string | null;
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

  // DEBUG: Log cuando cambian los comentarios
  useEffect(() => {
    console.log('🔄 Estado comentarios actualizado:', comentarios.length, 'comentarios');
    if (comentarios.length > 0) {
      console.log('📋 Comentarios en estado:', comentarios.map(c => ({ id: c.id, cuerpo: c.cuerpo?.substring(0, 50) })));
    }
  }, [comentarios]);

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

      console.log('🔵 incidenciaData existe?', !!incidenciaData);

      if (incidenciaData) {
        console.log('🟢 DENTRO del bloque if (incidenciaData)');
        // Obtener datos del proveedor_casos
        let estadoProveedor = null;
        let prioridadProveedor = null;
        let descripcionProveedor = null;
        let tipoRevision = null;
        let proveedorNombre = null;
        let proveedorCaso: ProveedorCaso | null = null; // Declarar en scope más amplio para usarlo después

        if (perfil.rol === 'Control' || perfil.rol === 'Proveedor') {
          // Cargar el último proveedor_caso (incluyendo anulados)
          // Si hay proveedorCasoIdUrl, cargar ese caso específico; si no, cargar el activo
          let errorProveedorCaso;

          if (proveedorCasoIdUrl) {
            // Cargar el proveedor_caso específico de la URL
            const { data, error } = await supabase
              .from("proveedor_casos")
              .select(`
                id,
                asignado_en,
                estado_proveedor,
                prioridad,
                descripcion_proveedor,
                activo,
                tipo_revision,
                proveedor_id
              `)
              .eq("id", proveedorCasoIdUrl)
              .eq("incidencia_id", incidenciaId)
              .maybeSingle();

            proveedorCaso = data;
            errorProveedorCaso = error;
          } else {
            // Comportamiento normal: cargar el caso activo (incluye anulados para mostrar el estado)
            const { data, error } = await supabase
              .from("proveedor_casos")
              .select(`
                id,
                asignado_en,
                estado_proveedor,
                prioridad,
                descripcion_proveedor,
                activo,
                tipo_revision,
                proveedor_id
              `)
              .eq("incidencia_id", incidenciaId)
              .eq("activo", true)
              .order("asignado_en", { ascending: false })
              .limit(1)
              .maybeSingle();

            proveedorCaso = data;
            errorProveedorCaso = error;
          }

          if (errorProveedorCaso) {
            console.error('Error en consulta proveedor caso:', errorProveedorCaso);
          }

          if (proveedorCaso) {
            console.log('✅ Proveedor caso cargado:', {
              id: proveedorCaso.id,
              estado: proveedorCaso.estado_proveedor,
              proveedor_id: proveedorCaso.proveedor_id,
              desde_url: !!proveedorCasoIdUrl
            });

            setProveedorCasoId(proveedorCaso.id);
            if (proveedorCaso.asignado_en) {
              setFechaAsignacionProveedor(proveedorCaso.asignado_en);
            }
            estadoProveedor = proveedorCaso.estado_proveedor;
            prioridadProveedor = proveedorCaso.prioridad;
            descripcionProveedor = proveedorCaso.descripcion_proveedor;
            tipoRevision = proveedorCaso.tipo_revision;

            // Obtener nombre del proveedor con consulta separada
            if (proveedorCaso.proveedor_id) {
              const { data: proveedorData } = await supabase
                .from("instituciones")
                .select("nombre")
                .eq("id", proveedorCaso.proveedor_id)
                .single();

              if (proveedorData) {
                proveedorNombre = proveedorData.nombre;
              }
            }
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
          estado_proveedor: estadoProveedor ?? undefined,
          prioridad_proveedor: prioridadProveedor ?? undefined,
          descripcion_proveedor: descripcionProveedor ?? undefined,
          tipo_revision: tipoRevision ?? undefined,
          proveedor_nombre: proveedorNombre ?? undefined,
          adjuntos_principales: adjuntosPrincipales
        });

        // Cargar dirección del centro
        if (incidenciaData.institucion_id) {
          await cargarDireccionCentro(incidenciaData.institucion_id);
        } else if (incidenciaData.centro) {
          await cargarDireccionCentro(undefined, incidenciaData.centro);
        }

        // Cargar comentarios con adjuntos
        console.log('🔍 DEBUG COMENTARIOS - Inicio carga');
        console.log('  - Rol:', perfil.rol);
        console.log('  - ProveedorCaso existe?', !!proveedorCaso);
        console.log('  - ProveedorCaso ID:', proveedorCaso?.id);

        let comentariosData: Comentario[] = [];
        if (perfil.rol === 'Control' || perfil.rol === 'Proveedor') {
          // Cargar comentarios del ámbito proveedor
          if (proveedorCaso) {
            console.log('📌 Cargando comentarios para proveedor_caso_id:', proveedorCaso.id);

            // Con proveedorCaso: filtrar por ese ID específico
            const { data: comentarios, error: errorComentarios } = await supabase
              .from("comentarios")
              .select(`
                *,
                adjuntos(id, tipo, nombre_archivo, storage_key, categoria)
              `)
              .eq("incidencia_id", incidenciaId)
              .eq("proveedor_caso_id", proveedorCaso.id)
              .in("ambito", ["proveedor", "ambos"])
              .not("cuerpo", "is", null)
              .order("creado_en", { ascending: true });

            if (errorComentarios) {
              console.error("❌ Error cargando comentarios:", errorComentarios);
            } else {
              console.log(`✅ Comentarios cargados:`, comentarios?.length || 0);
              if (comentarios && comentarios.length > 0) {
                console.log('📄 Primer comentario:', comentarios[0]);
              }
            }

            comentariosData = comentarios || [];
          } else {
            console.log('⚠️ No hay proveedorCaso - cargando todos los comentarios del ámbito proveedor');

            // Si no hay proveedorCaso, cargar todos los comentarios del ámbito proveedor
            const { data: comentarios } = await supabase
              .from("comentarios")
              .select(`
                *,
                adjuntos(id, tipo, nombre_archivo, storage_key, categoria)
              `)
              .eq("incidencia_id", incidenciaId)
              .in("ambito", ["proveedor", "ambos"])
              .not("cuerpo", "is", null)
              .order("creado_en", { ascending: true });

            console.log(`✅ Comentarios cargados (sin filtro proveedor):`, comentarios?.length || 0);
            comentariosData = comentarios || [];
          }
        } else {
          console.log('⚠️ Rol no es Control ni Proveedor, no se cargan comentarios');
        }

        console.log('🎯 Llamando setComentarios con:', comentariosData.length, 'comentarios');
        setComentarios(comentariosData);
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

      // Verificar si existe resolución técnica y cargar sus datos
      const { data: resolucionData } = await supabase
        .from("resoluciones_tecnicas")
        .select("id, solucion_aplicada, fecha_realizacion")
        .eq("incidencia_id", incidenciaId)
        .order("creado_en", { ascending: false })
        .limit(1)
        .maybeSingle();

      setTieneResolucion(!!resolucionData);
      if (resolucionData) {
        setResolucionExistente({
          solucion_aplicada: resolucionData.solucion_aplicada,
          fecha_realizacion: resolucionData.fecha_realizacion
        });

        // Cargar adjuntos de la resolución para el resumen
        const { data: adjuntosResolucion } = await supabase
          .from("adjuntos")
          .select("tipo, storage_key")
          .eq("incidencia_id", incidenciaId)
          .eq("resolucion_tecnica_id", resolucionData.id);

        const imagenes = adjuntosResolucion?.filter(adj => adj.tipo === 'imagen') || [];
        const documento = adjuntosResolucion?.find(adj => adj.tipo === 'documento');

        const imagenesUrls = await Promise.all(
          imagenes.map(async (img) => {
            const { data: urlData } = await supabase.storage
              .from("incidencias")
              .createSignedUrl(img.storage_key, 3600); // URL válida por 1 hora
            return urlData?.signedUrl || '';
          })
        );

        let documentoUrl = undefined;
        if (documento) {
          const { data: urlData } = await supabase.storage
            .from("incidencias")
            .createSignedUrl(documento.storage_key, 3600); // URL válida por 1 hora
          documentoUrl = urlData?.signedUrl;
        }

        setResumenResolucion({
          solucion_aplicada: resolucionData.solucion_aplicada,
          fecha_realizacion: resolucionData.fecha_realizacion,
          tiene_imagenes: imagenes.length > 0,
          tiene_documento: !!documento,
          imagenes_urls: imagenesUrls.filter(url => url !== ''),
          documento_url: documentoUrl
        });
      }

      // Verificar si existe valoración económica y cargar sus datos
      const { data: valoracionData } = await supabase
        .from("valoraciones_economicas")
        .select(`
          id,
          importe_sin_iva,
          porcentaje_iva,
          importe_con_iva,
          documento_adjunto_id
        `)
        .eq("incidencia_id", incidenciaId)
        .order("creado_en", { ascending: false })
        .limit(1)
        .maybeSingle();

      setTieneValoracion(!!valoracionData);
      if (valoracionData) {
        setValoracionExistente({
          id: valoracionData.id,
          importe_sin_iva: valoracionData.importe_sin_iva,
          porcentaje_iva: valoracionData.porcentaje_iva,
          importe_con_iva: valoracionData.importe_con_iva
        });

        // Obtener URL del documento adjunto si existe
        let documentoUrl = undefined;
        let storageKey = undefined;

        if (valoracionData.documento_adjunto_id) {
          // Cargar el adjunto por separado
          const { data: adjuntoData } = await supabase
            .from("adjuntos")
            .select("storage_key")
            .eq("id", valoracionData.documento_adjunto_id)
            .maybeSingle();

          if (adjuntoData?.storage_key) {
            storageKey = adjuntoData.storage_key;
            const { data: urlData } = await supabase.storage
              .from("incidencias")
              .createSignedUrl(adjuntoData.storage_key, 3600); // URL válida por 1 hora
            documentoUrl = urlData?.signedUrl;
          }
        }

        const valoracionResumen = {
          importe_sin_iva: valoracionData.importe_sin_iva,
          porcentaje_iva: valoracionData.porcentaje_iva,
          importe_con_iva: valoracionData.importe_con_iva,
          tiene_documento: !!storageKey,
          documento_url: documentoUrl
        };

        console.log('📊 VALORACIÓN ECONÓMICA CARGADA:', {
          documento_adjunto_id: valoracionData.documento_adjunto_id,
          storageKey,
          documentoUrl,
          tiene_documento: valoracionResumen.tiene_documento,
          resumen_completo: valoracionResumen
        });

        setResumenValoracion(valoracionResumen);
      }

      // Verificar si alguna vez se aprobó una oferta y si hay resolución manual
      const { data: historialData } = await supabase
        .from("historial_estados")
        .select("*")
        .eq("incidencia_id", incidenciaId)
        .eq("tipo_estado", "proveedor");

      const tuvoOfertaAprobadaEnHistorial = historialData?.some(
        registro => registro.estado_nuevo === 'Oferta aprobada'
      );
      setTuvoOfertaAprobada(!!tuvoOfertaAprobadaEnHistorial);

      // Verificar si existe resolución manual (hecha por Control)
      const hayResolucionManual = historialData?.some(
        registro => {
          const metadatos = registro.metadatos as Record<string, unknown> | null;
          return metadatos && metadatos.accion === 'resolucion_manual_control';
        }
      );
      setTieneResolucionManual(!!hayResolucionManual);

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

      // Crear comentario con proveedor_caso_id
      const comentarioCreado = await crearComentario({
        incidencia_id: incidenciaId,
        proveedor_caso_id: proveedorCasoId || undefined,
        ambito: 'proveedor',
        autor_id: perfil.persona_id,
        autor_email: perfil.email,
        autor_rol: perfil.rol,
        cuerpo: nuevoComentario.trim(),
        es_sistema: false
      });

      if (comentarioCreado) {
        // Si hay archivos, crear adjuntos
        let adjuntosCreados: Adjunto[] = [];
        if (imagenUrl || documentoUrl) {
          const adjuntos: Array<{ storage_key: string; nombre_archivo: string; tipo: string }> = [];
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
            adjuntosCreados = await crearAdjuntos(comentarioCreado.id, incidenciaId, adjuntos);
          }
        }

        // Añadir el comentario al estado local sin recargar toda la página
        const nuevoComentarioCompleto = {
          ...comentarioCreado,
          personas: {
            nombre: perfil.email,
            email: perfil.email
          },
          adjuntos: adjuntosCreados || []
        };

        setComentarios(prev => [...prev, nuevoComentarioCompleto]);
      }

      // Limpiar formulario
      setNuevoComentario("");
      limpiarArchivos();

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
        proveedorCasoId: proveedorCasoId || undefined,
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
        proveedorCasoId: proveedorCasoId || undefined,
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
    if (!perfil || !incidencia || !solucionAplicada || !fechaRealizacion) return;

    try {
      setEnviando(true);

      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData.user?.email;

      const result = await resolverIncidenciaService({
        incidenciaId,
        numeroIncidencia: incidencia.num_solicitud,
        solucionAplicada,
        fechaRealizacion,
        imagenesResolucion,
        documentoResolucion,
        tieneOfertaAprobada,
        autorId: perfil.persona_id,
        autorEmail: userEmail || perfil.email
      });

      if (result.success) {
        setMostrarModalResolver(false);
        setSolucionAplicada('');
        setFechaRealizacion('');
        setImagenesResolucion([]);
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
        autorEmail: userEmail || perfil.email,
        valoracionExistenteId: valoracionExistente?.id || null,
        esEdicion: !!valoracionExistente
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

      // Marcar proveedor_caso como anulado (mantener activo=true)
      await supabase
        .from("proveedor_casos")
        .update({
          estado_proveedor: "Anulada",
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
        proveedor_caso_id: proveedorCasoId || undefined,
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

  const handleReasignarProveedor = async (formularioProveedor: FormularioAsignacionProveedor) => {
    if (!formularioProveedor.proveedor_id || !incidencia || !perfil) return;

    try {
      setEnviando(true);
      await asignarProveedorCompleto(
        incidenciaId,
        incidencia.num_solicitud,
        incidencia.estado_cliente,
        formularioProveedor,
        perfil.persona_id,
        perfil.email
      );
      setMostrarModalReasignarProveedor(false);
      cargarDatos();
    } catch (error) {
      console.error("Error completo reasignando proveedor:", error);
      const mensajeError = error instanceof Error ? error.message : 'Error desconocido';
      alert(`Error al reasignar el proveedor: ${mensajeError}`);
    } finally {
      setEnviando(false);
    }
  };

  const cerrarIncidencia = async (motivoCierre: string) => {
    if (!perfil) return;

    try {
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
        .eq("activo", true)
        .neq("estado_proveedor", "Anulada");

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

      cargarDatos();

    } catch (error) {
      console.error("Error cerrando incidencia:", error);
      throw error; // Re-lanzar para que el modal lo maneje
    }
  };

  const rechazarResolucion = async (tipoRechazo: 'tecnica' | 'economica' | 'ambas', motivoRechazo: string) => {
    if (!perfil || !motivoRechazo.trim()) return;

    try {
      // Obtener estado actual del caso activo no anulado
      const { data: estadoActual } = await supabase
        .from("proveedor_casos")
        .select("estado_proveedor")
        .eq("incidencia_id", incidenciaId)
        .eq("activo", true)
        .neq("estado_proveedor", "Anulada")
        .single();

      const estadoAnterior = estadoActual?.estado_proveedor || null;

      // Cambiar estado a "Revisar resolución" y guardar el tipo de revisión
      const { data: updateData, error: updateError } = await supabase
        .from("proveedor_casos")
        .update({
          estado_proveedor: "Revisar resolución",
          tipo_revision: tipoRechazo
        })
        .eq("incidencia_id", incidenciaId)
        .eq("activo", true)
        .neq("estado_proveedor", "Anulada")
        .select();

      if (updateError) {
        console.error("Error actualizando estado_proveedor:", updateError);
        throw updateError;
      }

      console.log("Estado actualizado:", updateData);

      // Definir textos según tipo de rechazo
      const tiposRechazo = {
        tecnica: {
          titulo: 'RESOLUCIÓN TÉCNICA RECHAZADA',
          instruccion: 'Por favor, revise y corrija la resolución técnica según las indicaciones.'
        },
        economica: {
          titulo: 'VALORACIÓN ECONÓMICA RECHAZADA',
          instruccion: 'Por favor, revise y corrija la valoración económica según las indicaciones.'
        },
        ambas: {
          titulo: 'RESOLUCIÓN Y VALORACIÓN RECHAZADAS',
          instruccion: 'Por favor, revise y corrija tanto la resolución técnica como la valoración económica.'
        }
      };

      const textoRechazo = tiposRechazo[tipoRechazo];

      // Registrar cambio de estado
      await registrarCambioEstado({
        incidenciaId,
        tipoEstado: 'proveedor',
        estadoAnterior,
        estadoNuevo: 'Revisar resolución',
        autorId: perfil.persona_id,
        motivo: 'Control rechazó la resolución',
        metadatos: {
          accion: 'rechazar_resolucion',
          tipo_rechazo: tipoRechazo,
          motivo_rechazo: motivoRechazo
        }
      });

      // Crear comentario en el chat del proveedor
      await crearComentario({
        incidencia_id: incidenciaId,
        proveedor_caso_id: proveedorCasoId || undefined,
        ambito: 'proveedor',
        autor_id: perfil.persona_id,
        autor_email: perfil.email,
        autor_rol: 'Control',
        cuerpo: `${textoRechazo.titulo}

Aspecto rechazado: ${tipoRechazo === 'tecnica' ? 'Resolución técnica' : tipoRechazo === 'economica' ? 'Valoración económica' : 'Ambas (técnica y económica)'}

Motivo detallado:
${motivoRechazo}

${textoRechazo.instruccion}`,
        es_sistema: false
      });

      cargarDatos();

    } catch (error) {
      console.error("Error rechazando resolución:", error);
      alert('Error al rechazar la resolución');
      throw error; // Re-lanzar para que el modal lo maneje
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
        .eq("activo", true)
        .neq("estado_proveedor", "Anulada");

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
        proveedor_caso_id: proveedorCasoId || undefined,
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
        .eq("activo", true)
        .neq("estado_proveedor", "Anulada");

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
        proveedor_caso_id: proveedorCasoId || undefined,
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

  const mandarARevisar = async (motivoRevision: string) => {
    if (!perfil || !presupuestoActual || !motivoRevision.trim()) return;

    try {
      await supabase
        .from("proveedor_casos")
        .update({ estado_proveedor: "Oferta a revisar" })
        .eq("incidencia_id", incidenciaId)
        .eq("activo", true)
        .neq("estado_proveedor", "Anulada");

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
        proveedor_caso_id: proveedorCasoId || undefined,
        ambito: 'proveedor',
        autor_id: perfil.persona_id,
        autor_email: perfil.email,
        autor_rol: 'Control',
        cuerpo: `Control ha solicitado revisión del presupuesto.\n**Motivo:** ${motivoRevision}`,
        es_sistema: true
      });

      setMostrarModalGestionPresupuesto(false);
      cargarDatos();

    } catch (error) {
      console.error("Error mandando a revisar:", error);
      throw error; // Re-lanzar para que el modal lo maneje
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
        {/* Título de la sección */}
        <div className="mb-12">
          {perfil?.rol === 'Control' ? (
            <div className="text-white text-center">
              <h2 className="text-lg font-semibold mb-1 tracking-wider">CHAT PROVEEDOR</h2>
              <p className="text-sm opacity-80">#{incidencia.num_solicitud}</p>
              {incidencia.proveedor_nombre && (
                <p className="text-sm opacity-90 mt-1">{incidencia.proveedor_nombre}</p>
              )}
            </div>
          ) : (
            <h2 className="text-white text-center text-lg font-semibold mb-4 tracking-wider">SEGUIMIENTO</h2>
          )}
        </div>

        {/* Datos Técnicos de la Incidencia - específicos para proveedor */}
        <div className="mb-12">
          <div className="rounded-lg shadow-lg" style={{ backgroundColor: PALETA.card }}>
            <div
              className="px-6 py-3 border-b rounded-t-lg"
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
          <div className="mb-12">
            <div className="rounded-lg shadow-lg" style={{ backgroundColor: PALETA.card }}>
              <div
                className="px-6 py-3 border-b rounded-t-lg"
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

                  // Estado Cerrada: Mostrar información aprobada
                  if (incidenciaCerrada) {
                    // Verificar si tiene datos de resolución y valoración
                    if (resumenResolucion && resumenValoracion) {
                      return (
                        <div className="space-y-6">
                          {/* Mensaje de incidencia cerrada */}
                          <div className="bg-green-50 rounded-lg p-4" style={{ border: `2px solid ${PALETA.verdeClaro}` }}>
                            <p className="text-sm font-semibold" style={{ color: PALETA.verdeClaro }}>
                              ✓ Incidencia cerrada y aprobada
                            </p>
                          </div>

                          {/* Resumen de Resolución Técnica Aprobada */}
                          <div className="bg-gray-50 rounded-lg p-4">
                            <h3 className="font-semibold text-base mb-3 uppercase" style={{ color: PALETA.textoOscuro }}>
                              Resolución Técnica Aprobada
                            </h3>
                            <div className="space-y-2 text-sm">
                              <div>
                                <span className="font-medium">Solución aplicada:</span>
                                <p className="text-gray-700 mt-1">{resumenResolucion.solucion_aplicada}</p>
                              </div>
                              <div>
                                <span className="font-medium">Fecha de realización:</span>
                                <span className="ml-2 text-gray-700">
                                  {new Date(resumenResolucion.fecha_realizacion).toLocaleDateString('es-ES')}
                                </span>
                              </div>
                              <div className="flex flex-col gap-2 text-xs">
                                {resumenResolucion.tiene_imagenes && resumenResolucion.imagenes_urls && resumenResolucion.imagenes_urls.length > 0 && (
                                  <div className="flex flex-wrap gap-2">
                                    {resumenResolucion.imagenes_urls.map((url, index) => (
                                      <a
                                        key={index}
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:text-blue-800 underline cursor-pointer"
                                      >
                                        📷 Imagen {index + 1}
                                      </a>
                                    ))}
                                  </div>
                                )}
                                {resumenResolucion.tiene_documento && resumenResolucion.documento_url && (
                                  <a
                                    href={resumenResolucion.documento_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 underline cursor-pointer"
                                  >
                                    📄 Parte de trabajo adjunto
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Resumen de Valoración Económica Aprobada */}
                          <div className="bg-gray-50 rounded-lg p-4">
                            <h3 className="font-semibold text-base mb-3 uppercase" style={{ color: PALETA.textoOscuro }}>
                              Valoración Económica Aprobada
                            </h3>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="font-medium">Importe sin IVA:</span>
                                <span className="text-gray-700">{resumenValoracion.importe_sin_iva.toFixed(2)}€</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="font-medium">IVA ({resumenValoracion.porcentaje_iva}%):</span>
                                <span className="text-gray-700">
                                  {(resumenValoracion.importe_con_iva - resumenValoracion.importe_sin_iva).toFixed(2)}€
                                </span>
                              </div>
                              <div className="flex justify-between pt-2 border-t">
                                <span className="font-bold">Total con IVA:</span>
                                <span className="font-bold text-black">{resumenValoracion.importe_con_iva.toFixed(2)}€</span>
                              </div>
                              <div className="mt-2 pt-2 border-t text-xs">
                                {resumenValoracion.tiene_documento && resumenValoracion.documento_url ? (
                                  <a
                                    href={resumenValoracion.documento_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 underline cursor-pointer block"
                                  >
                                    📄 Documento justificativo adjunto
                                  </a>
                                ) : (
                                  <span className="text-gray-500 italic block">
                                    Sin documento justificativo adjunto
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Botón para ir al chat cliente */}
                          <div className="flex justify-center pt-2 border-t">
                            <button
                              type="button"
                              onClick={() => router.push(`/incidencias/${incidenciaId}/chat-control-cliente`)}
                              className="px-4 py-2 text-sm border bg-white rounded transition-colors"
                              style={{
                                borderColor: PALETA.bg,
                                color: PALETA.bg
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = `${PALETA.bg}15`;
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'white';
                              }}
                            >
                              Ir al Chat Cliente
                            </button>
                          </div>
                        </div>
                      );
                    } else {
                      // Incidencia cerrada migrada sin datos de resolución/valoración
                      return (
                        <div className="space-y-6">
                          {/* Mensaje de incidencia cerrada migrada */}
                          <div className="bg-green-50 rounded-lg p-4" style={{ border: `2px solid ${PALETA.verdeClaro}` }}>
                            <p className="text-sm font-semibold" style={{ color: PALETA.verdeClaro }}>
                              ✓ Incidencia cerrada
                            </p>
                            <p className="text-xs text-gray-600 mt-2">
                              Esta incidencia fue migrada desde el sistema anterior y no dispone de formularios de resolución técnica o valoración económica registrados.
                            </p>
                          </div>

                          {/* Botón para ir al chat cliente */}
                          <div className="flex justify-center pt-2 border-t">
                            <button
                              type="button"
                              onClick={() => router.push(`/incidencias/${incidenciaId}/chat-control-cliente`)}
                              className="px-4 py-2 text-sm border bg-white rounded transition-colors"
                              style={{
                                borderColor: PALETA.bg,
                                color: PALETA.bg
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = `${PALETA.bg}15`;
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'white';
                              }}
                            >
                              Ir al Chat Cliente
                            </button>
                          </div>
                        </div>
                      );
                    }
                  }

                  // Estado Valorada: Mostrar resumen y aprobación
                  if (estado === "Valorada") {
                    // Verificar si tiene datos de resolución y valoración
                    if (resumenResolucion && resumenValoracion) {
                      return (
                        <div className="space-y-6">
                          {/* Mensaje informativo */}
                          <div className="bg-white rounded-lg p-4" style={{ border: `2px solid ${PALETA.verdeClaro}` }}>
                            <p className="text-sm font-medium" style={{ color: PALETA.textoOscuro }}>
                              La incidencia está lista para cerrarse. Revise la información y apruebe o rechace la resolución.
                            </p>
                          </div>

                          {/* Resumen de Resolución Técnica */}
                          <div className="bg-gray-50 rounded-lg p-4">
                            <h3 className="font-semibold text-base mb-3 uppercase" style={{ color: PALETA.textoOscuro }}>
                              Resolución Técnica
                            </h3>
                            <div className="space-y-2 text-sm">
                              <div>
                                <span className="font-medium">Solución aplicada:</span>
                                <p className="text-gray-700 mt-1">{resumenResolucion.solucion_aplicada}</p>
                              </div>
                              <div>
                                <span className="font-medium">Fecha de realización:</span>
                                <span className="ml-2 text-gray-700">
                                  {new Date(resumenResolucion.fecha_realizacion).toLocaleDateString('es-ES')}
                                </span>
                              </div>
                              <div className="flex flex-col gap-2 text-xs">
                                {resumenResolucion.tiene_imagenes && resumenResolucion.imagenes_urls && resumenResolucion.imagenes_urls.length > 0 && (
                                  <div className="flex flex-wrap gap-2">
                                    {resumenResolucion.imagenes_urls.map((url, index) => (
                                      <a
                                        key={index}
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:text-blue-800 underline cursor-pointer"
                                      >
                                        📷 Imagen {index + 1}
                                      </a>
                                    ))}
                                  </div>
                                )}
                                {resumenResolucion.tiene_documento && resumenResolucion.documento_url && (
                                  <a
                                    href={resumenResolucion.documento_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 underline cursor-pointer"
                                  >
                                    📄 Parte de trabajo adjunto
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Resumen de Valoración Económica */}
                          <div className="bg-gray-50 rounded-lg p-4">
                            <h3 className="font-semibold text-base mb-3 uppercase" style={{ color: PALETA.textoOscuro }}>
                              Valoración Económica
                            </h3>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="font-medium">Importe sin IVA:</span>
                                <span className="text-gray-700">{resumenValoracion.importe_sin_iva.toFixed(2)}€</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="font-medium">IVA ({resumenValoracion.porcentaje_iva}%):</span>
                                <span className="text-gray-700">
                                  {(resumenValoracion.importe_con_iva - resumenValoracion.importe_sin_iva).toFixed(2)}€
                                </span>
                              </div>
                              <div className="flex justify-between pt-2 border-t">
                                <span className="font-bold">Total con IVA:</span>
                                <span className="font-bold text-black">{resumenValoracion.importe_con_iva.toFixed(2)}€</span>
                              </div>
                              <div className="mt-2 pt-2 border-t text-xs">
                                {resumenValoracion.tiene_documento && resumenValoracion.documento_url ? (
                                  <a
                                    href={resumenValoracion.documento_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 underline cursor-pointer block"
                                  >
                                    📄 Documento justificativo adjunto
                                  </a>
                                ) : (
                                  <span className="text-gray-500 italic block">
                                    Sin documento justificativo adjunto
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Botones de acción */}
                          <div className="flex gap-3 justify-center pt-2">
                            <button
                              type="button"
                              onClick={() => setMostrarModalRechazarResolucion(true)}
                              className="px-6 py-3 text-sm font-medium bg-white rounded hover:opacity-80 transition-opacity"
                              style={{ border: `2px solid ${PALETA.verdeClaro}`, color: PALETA.verdeClaro }}
                            >
                              Rechazar Resolución
                            </button>
                            <button
                              type="button"
                              onClick={() => setMostrarModalCerrar(true)}
                              className="px-6 py-3 text-sm font-medium text-white rounded hover:opacity-90 transition-opacity"
                              style={{ backgroundColor: PALETA.verdeClaro }}
                            >
                              Aprobar y Cerrar Incidencia
                            </button>
                          </div>

                          {/* Acciones comunes */}
                          <div className="flex gap-3 justify-center flex-wrap pt-4 border-t">
                            <button
                              type="button"
                              onClick={() => router.push(`/incidencias/${incidenciaId}/chat-control-cliente`)}
                              className="px-4 py-2 text-sm border bg-white rounded transition-colors"
                              style={{
                                borderColor: PALETA.bg,
                                color: PALETA.bg
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = `${PALETA.bg}15`;
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'white';
                              }}
                            >
                              Ir al Chat Cliente
                            </button>

                            {!incidenciaCerrada && (
                              <button
                                type="button"
                                onClick={() => setMostrarModalAnular(true)}
                                className="px-3 py-2 text-sm border border-red-500 text-red-600 bg-white rounded hover:bg-red-50 transition-colors"
                              >
                                Anular Asignación de Proveedor
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    } else {
                      // Incidencia migrada sin datos de resolución/valoración
                      return (
                        <div className="space-y-6">
                          {/* Mensaje informativo para incidencias migradas */}
                          <div className="bg-yellow-50 rounded-lg p-4" style={{ border: `2px solid #fbbf24` }}>
                            <p className="text-sm font-medium text-gray-800">
                              Esta incidencia fue migrada desde el sistema anterior y está marcada como &quot;Valorada&quot;.
                            </p>
                            <p className="text-xs text-gray-600 mt-2">
                              No dispone de formularios de resolución técnica o valoración económica registrados en el nuevo sistema.
                              Puede aprobar y cerrar la incidencia o rechazarla para que el proveedor complete los datos.
                            </p>
                          </div>

                          {/* Botones de acción */}
                          <div className="flex gap-3 justify-center pt-2">
                            <button
                              type="button"
                              onClick={() => setMostrarModalRechazarResolucion(true)}
                              className="px-6 py-3 text-sm font-medium bg-white rounded hover:opacity-80 transition-opacity"
                              style={{ border: `2px solid ${PALETA.verdeClaro}`, color: PALETA.verdeClaro }}
                            >
                              Rechazar Resolución
                            </button>
                            <button
                              type="button"
                              onClick={() => setMostrarModalCerrar(true)}
                              className="px-6 py-3 text-sm font-medium text-white rounded hover:opacity-90 transition-opacity"
                              style={{ backgroundColor: PALETA.verdeClaro }}
                            >
                              Aprobar y Cerrar Incidencia
                            </button>
                          </div>

                          {/* Acciones comunes */}
                          <div className="flex gap-3 justify-center flex-wrap pt-4 border-t">
                            <button
                              type="button"
                              onClick={() => router.push(`/incidencias/${incidenciaId}/chat-control-cliente`)}
                              className="px-4 py-2 text-sm border bg-white rounded transition-colors"
                              style={{
                                borderColor: PALETA.bg,
                                color: PALETA.bg
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = `${PALETA.bg}15`;
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'white';
                              }}
                            >
                              Ir al Chat Cliente
                            </button>

                            {!incidenciaCerrada && (
                              <button
                                type="button"
                                onClick={() => setMostrarModalAnular(true)}
                                className="px-3 py-2 text-sm border border-red-500 text-red-600 bg-white rounded hover:bg-red-50 transition-colors"
                              >
                                Anular Asignación de Proveedor
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    }
                  }

                  // Otros estados
                  return (
                    <div className="space-y-4">
                      {/* Acciones específicas por estado */}
                      <div className="flex gap-3 justify-center flex-wrap">
                        {estado === "Anulada" && (
                          <button
                            type="button"
                            onClick={() => setMostrarModalReasignarProveedor(true)}
                            className="px-4 py-2 text-white rounded hover:opacity-90 transition-opacity"
                            style={{ backgroundColor: PALETA.verdeClaro }}
                          >
                            Reasignar Proveedor
                          </button>
                        )}

                        {estado === "Ofertada" && (
                          <button
                            type="button"
                            onClick={abrirModalGestionPresupuesto}
                            className="px-4 py-2 text-sm text-white rounded hover:opacity-90 transition-opacity"
                            style={{ backgroundColor: PALETA.verdeClaro }}
                          >
                            Gestionar Presupuesto
                          </button>
                        )}

                        {tieneResolucionManual && (
                          <button
                            type="button"
                            onClick={() => router.push(`/incidencias/${incidenciaId}/resolver-proveedor`)}
                            className="px-4 py-2 text-sm text-white rounded hover:opacity-90 transition-opacity"
                            style={{ backgroundColor: PALETA.verdeClaro }}
                          >
                            Editar Resolución Manual
                          </button>
                        )}

                        {estado !== "Valorada" && estado !== "Cerrada" && estado !== "Anulada" && (
                          <button
                            type="button"
                            onClick={() => router.push(`/incidencias/${incidenciaId}/resolver-proveedor`)}
                            className="px-4 py-2 text-sm text-white rounded hover:opacity-90 transition-opacity"
                            style={{ backgroundColor: PALETA.verdeClaro }}
                          >
                            Resolver como Proveedor
                          </button>
                        )}
                      </div>

                      {/* Acciones comunes */}
                      <div className="flex gap-3 justify-center flex-wrap pt-2 border-t">
                        <button
                          type="button"
                          onClick={() => router.push(`/incidencias/${incidenciaId}/chat-control-cliente`)}
                          className="px-4 py-2 text-sm border bg-white rounded transition-colors"
                          style={{
                            borderColor: PALETA.bg,
                            color: PALETA.bg
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = `${PALETA.bg}15`;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'white';
                          }}
                        >
                          Ir al Chat Cliente
                        </button>

                        {!incidenciaCerrada && estado !== "Anulada" && (
                          <button
                            type="button"
                            onClick={() => setMostrarModalAnular(true)}
                            className="px-3 py-2 text-sm border border-red-500 text-red-600 bg-white rounded hover:bg-red-50 transition-colors"
                          >
                            Anular Asignación de Proveedor
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Botones de acciones del proveedor */}
        {perfil?.rol === 'Proveedor' && (
          <div className="mb-12">
            <div className="rounded-lg shadow-lg" style={{ backgroundColor: PALETA.card }}>
              <div
                className="px-6 py-3 border-b rounded-t-lg"
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
                    volverResolver: false,
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
                      mensaje = 'Esperando respuesta de Control sobre la oferta enviada';
                      break;

                    case "Oferta aprobada":
                      botonesDisponibles.calendarizar = true;
                      botonesDisponibles.resolver = true;
                      break;

                    case "Oferta a revisar":
                      botonesDisponibles.ofertar = true;
                      mensaje = 'Oferta rechazada - Debe revisar y presentar una nueva oferta';
                      break;

                    case "Resuelta":
                      botonesDisponibles.valorar = true;
                      botonesDisponibles.volverResolver = true;
                      mensaje = 'Incidencia resuelta - Puede proceder con la valoración económica';
                      break;

                    case "Pendiente valoración":
                      botonesDisponibles.valorar = true;
                      mensaje = 'Incidencia lista para valorar';
                      break;

                    case "Valorada":
                      botonesDisponibles.valorar = true;
                      botonesDisponibles.volverResolver = true;
                      mensaje = 'Esperando a la aprobación por parte de Control - Puede editar la resolución o valoración';
                      break;

                    case "Revisar resolución":
                      botonesDisponibles.valorar = true;
                      botonesDisponibles.volverResolver = true;
                      mensaje = 'Control ha solicitado revisar la resolución - Revise el motivo en el chat y corrija';
                      break;

                    case "Cerrada":
                      // Para cerrada, mostraremos el resumen más abajo
                      break;

                    case "Anulada":
                      mensaje = 'Incidencia finalizada - No hay acciones disponibles';
                      break;

                    default:
                      mensaje = 'Estado desconocido - Contacte con soporte si persiste';
                  }

                  if (tuvoOfertaAprobada) {
                    botonesDisponibles.ofertar = false;
                  }

                  return (
                    <>
                      {/* Resumen para Proveedor cuando está Cerrada */}
                      {estado === "Cerrada" && resumenResolucion && resumenValoracion && (
                        <div className="space-y-4 mb-6">
                          {/* Mensaje de incidencia cerrada */}
                          <div className="bg-green-50 rounded-lg p-4" style={{ border: `2px solid ${PALETA.verdeClaro}` }}>
                            <p className="text-sm font-semibold" style={{ color: PALETA.verdeClaro }}>
                              ✓ Incidencia cerrada y aprobada
                            </p>
                          </div>

                          {/* Resumen de Resolución Técnica Aprobada */}
                          <div className="bg-gray-50 rounded-lg p-4">
                            <h3 className="font-semibold text-base mb-3 uppercase" style={{ color: PALETA.textoOscuro }}>
                              Resolución Técnica Aprobada
                            </h3>
                            <div className="space-y-2 text-sm">
                              <div>
                                <span className="font-medium">Solución aplicada:</span>
                                <p className="text-gray-700 mt-1">{resumenResolucion.solucion_aplicada}</p>
                              </div>
                              <div>
                                <span className="font-medium">Fecha de realización:</span>
                                <span className="ml-2 text-gray-700">
                                  {new Date(resumenResolucion.fecha_realizacion).toLocaleDateString('es-ES')}
                                </span>
                              </div>
                              <div className="flex flex-col gap-2 text-xs">
                                {resumenResolucion.tiene_imagenes && resumenResolucion.imagenes_urls && resumenResolucion.imagenes_urls.length > 0 && (
                                  <div className="flex flex-wrap gap-2">
                                    {resumenResolucion.imagenes_urls.map((url, index) => (
                                      <a
                                        key={index}
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:text-blue-800 underline cursor-pointer"
                                      >
                                        📷 Imagen {index + 1}
                                      </a>
                                    ))}
                                  </div>
                                )}
                                {resumenResolucion.tiene_documento && resumenResolucion.documento_url && (
                                  <a
                                    href={resumenResolucion.documento_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 underline cursor-pointer"
                                  >
                                    📄 Parte de trabajo adjunto
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Resumen de Valoración Económica Aprobada */}
                          <div className="bg-gray-50 rounded-lg p-4">
                            <h3 className="font-semibold text-base mb-3 uppercase" style={{ color: PALETA.textoOscuro }}>
                              Valoración Económica Aprobada
                            </h3>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="font-medium">Importe sin IVA:</span>
                                <span className="text-gray-700">{resumenValoracion.importe_sin_iva.toFixed(2)}€</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="font-medium">IVA ({resumenValoracion.porcentaje_iva}%):</span>
                                <span className="text-gray-700">
                                  {(resumenValoracion.importe_con_iva - resumenValoracion.importe_sin_iva).toFixed(2)}€
                                </span>
                              </div>
                              <div className="flex justify-between pt-2 border-t">
                                <span className="font-bold">Total con IVA:</span>
                                <span className="font-bold text-black">{resumenValoracion.importe_con_iva.toFixed(2)}€</span>
                              </div>
                              {resumenValoracion.tiene_documento && resumenValoracion.documento_url && (
                                <a
                                  href={resumenValoracion.documento_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:text-blue-800 underline cursor-pointer"
                                >
                                  📄 Documento justificativo adjunto
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

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
                              Calendarizar Visita
                            </button>
                          )}

                          {botonesDisponibles.ofertar && (
                            <button
                              type="button"
                              onClick={() => setMostrarModalPresupuesto(true)}
                              className="px-4 py-2 text-white rounded hover:opacity-90 transition-opacity"
                              style={{ backgroundColor: PALETA.verdeClaro }}
                            >
                              Ofertar Presupuesto
                            </button>
                          )}

                          {botonesDisponibles.resolver && (
                            <button
                              type="button"
                              onClick={() => {
                                // Precargar datos si existe resolución
                                if (resolucionExistente) {
                                  setSolucionAplicada(resolucionExistente.solucion_aplicada);
                                  setFechaRealizacion(resolucionExistente.fecha_realizacion);
                                }
                                setMostrarModalResolver(true);
                              }}
                              className="px-4 py-2 text-white rounded hover:opacity-90 transition-opacity"
                              style={{ backgroundColor: PALETA.verdeClaro }}
                            >
                              Resolver Incidencia
                            </button>
                          )}
                        </div>
                      )}

                      {(botonesDisponibles.valorar || botonesDisponibles.volverResolver) && (
                        <div className="flex gap-3 justify-center mt-3">
                          {botonesDisponibles.volverResolver && (
                            <button
                              type="button"
                              onClick={() => {
                                // Precargar datos si existe resolución
                                if (resolucionExistente) {
                                  setSolucionAplicada(resolucionExistente.solucion_aplicada);
                                  setFechaRealizacion(resolucionExistente.fecha_realizacion);
                                }
                                setMostrarModalResolver(true);
                              }}
                              className="px-4 py-2 text-white rounded hover:opacity-90 transition-opacity"
                              style={{ backgroundColor: PALETA.verdeClaro }}
                            >
                              {resolucionExistente ? 'Editar resolución' : 'Volver a Resolver'}
                            </button>
                          )}
                          {botonesDisponibles.valorar && (
                            <button
                              type="button"
                              onClick={() => {
                                // Precargar datos si existe valoración
                                if (valoracionExistente) {
                                  setImporteSinIva(valoracionExistente.importe_sin_iva.toString());
                                  setPorcentajeIva(valoracionExistente.porcentaje_iva.toString());
                                  setImporteConIva(valoracionExistente.importe_con_iva.toString());
                                }
                                setMostrarModalValorarIncidencia(true);
                              }}
                              className="px-4 py-2 text-white rounded hover:opacity-90 transition-opacity"
                              style={{ backgroundColor: PALETA.verdeClaro }}
                            >
                              {valoracionExistente ? 'Editar valoración' : 'Valorar Económicamente'}
                            </button>
                          )}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Área de comentarios */}
        <div className="bg-white rounded-lg shadow-sm flex flex-col h-[700px] relative mb-12">
          {/* Header de comentarios */}
          <div
            className="px-6 py-3 border-b rounded-t-lg flex justify-between items-center"
            style={{
              backgroundColor: PALETA.headerTable,
              color: PALETA.textoOscuro
            }}
          >
            <h2 className="text-lg font-semibold">COMENTARIOS</h2>
            <p className="text-sm opacity-75">#{incidencia.num_solicitud}</p>
          </div>

          {/* Botón flotante para ir al último mensaje */}
          <ScrollToBottomButton
            onClick={scrollToBottom}
            show={comentarios.length > 3}
          />

          {/* Lista de comentarios */}
          <div ref={comentariosContainerRef} className="flex-1 overflow-y-auto p-6 space-y-4">
            {comentarios.length === 0 ? (
              <div className="text-center text-gray-500 py-8 text-sm">
                No hay comentarios aún. Añada el primero.
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
                          : (comentario.autor_rol?.toLowerCase() === 'proveedor' ? 'white' : getColorEmisor(comentario.autor_rol || 'proveedor')),
                      border: (!comentario.es_sistema && comentario.autor_email !== perfil?.email && comentario.autor_rol?.toLowerCase() === 'proveedor')
                        ? `2px solid ${PALETA.bg}`
                        : 'none'
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
              placeholder="Escriba aquí su comentario"
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
              <div className="flex flex-col gap-2 mb-3">
                {imagenSeleccionada && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded border border-gray-300">
                    <img
                      src={URL.createObjectURL(imagenSeleccionada)}
                      alt="Vista previa"
                      className="w-16 h-16 object-cover rounded border border-gray-300"
                    />
                    <div className="flex-1">
                      <p className="text-sm text-gray-700">{imagenSeleccionada.name}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {(imagenSeleccionada.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => seleccionarImagen(null)}
                      className="text-gray-400 hover:text-gray-600 text-xl font-bold px-2"
                    >
                      ×
                    </button>
                  </div>
                )}
                {documentoSeleccionado && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded border border-gray-300">
                    <div className="w-16 h-16 flex items-center justify-center bg-blue-100 rounded border border-gray-300">
                      <span className="text-2xl">📄</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-700">{documentoSeleccionado.name}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {(documentoSeleccionado.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => seleccionarDocumento(null)}
                      className="text-gray-400 hover:text-gray-600 text-xl font-bold px-2"
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
                    if (file) {
                      seleccionarImagen(file);
                    }
                    e.target.value = ''; // Reset input para permitir seleccionar el mismo archivo
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
                {enviando ? 'Guardando sus cambios...' : 'Enviar'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Historial de Estados del Proveedor */}
      <HistorialEstados
        cambios={historialProveedor}
        titulo="HISTORIAL DE ESTADOS DEL PROVEEDOR"
      />

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
          setFechaRealizacion('');
          setImagenesResolucion([]);
          setDocumentoResolucion(null);
        }}
        onSubmit={handleResolverIncidencia}
        solucionAplicada={solucionAplicada}
        setSolucionAplicada={setSolucionAplicada}
        fechaRealizacion={fechaRealizacion}
        setFechaRealizacion={setFechaRealizacion}
        imagenesResolucion={imagenesResolucion}
        setImagenesResolucion={setImagenesResolucion}
        documentoResolucion={documentoResolucion}
        setDocumentoResolucion={setDocumentoResolucion}
        tieneOfertaAprobada={tieneOfertaAprobada}
        enviando={enviando}
        esEdicion={!!resolucionExistente}
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
        esEdicion={!!valoracionExistente}
      />

      {/* Modales de Control */}
      <ModalAnularAsignacionProveedor
        isOpen={mostrarModalAnular}
        onClose={() => setMostrarModalAnular(false)}
        onConfirm={anularIncidencia}
        motivo={motivoAnulacion}
        setMotivo={setMotivoAnulacion}
        enviando={enviando}
      />

      <ModalAsignarProveedor
        isOpen={mostrarModalReasignarProveedor}
        onClose={() => setMostrarModalReasignarProveedor(false)}
        incidenciaId={incidenciaId}
        onSubmit={handleReasignarProveedor}
        enviando={enviando}
        esReasignacion={true}
      />

      {mostrarModalCerrar && (
        <ModalCerrarIncidencia
          onClose={() => setMostrarModalCerrar(false)}
          onCerrar={cerrarIncidencia}
        />
      )}

      {mostrarModalRechazarResolucion && (
        <ModalRechazarResolucion
          onClose={() => setMostrarModalRechazarResolucion(false)}
          onRechazar={rechazarResolucion}
        />
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
                    className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50"
                  >
                    Cerrar
                  </button>
                  <button
                    onClick={() => setMostrarModalMotivoRevision(true)}
                    className="px-3 py-1.5 text-sm text-white rounded hover:opacity-90"
                    style={{ backgroundColor: PALETA.b2 }}
                  >
                    Rechazar
                  </button>
                  <button
                    onClick={aprobarPresupuesto}
                    disabled={enviando}
                    className="px-3 py-1.5 text-sm text-white rounded hover:opacity-90 disabled:opacity-50"
                    style={{ backgroundColor: PALETA.bg }}
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
        <ModalMotivoRevision
          onClose={() => setMostrarModalMotivoRevision(false)}
          onEnviar={mandarARevisar}
        />
      )}

      <ModalResolucionManual
        isOpen={mostrarModalResolucionManual}
        onClose={() => setMostrarModalResolucionManual(false)}
        onSubmit={resolverManualmenteConProveedor}
        enviando={enviando}
      />
    </div>
  );
}
