"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { registrarCambioEstado, obtenerHistorialEstados } from "@/lib/historialEstados";
import SearchableSelect from "@/components/SearchableSelect";
import { PALETA } from "@/lib/theme";

type Adjunto = {
  id: string;
  tipo: string;
  nombre_archivo?: string | null;
  storage_key?: string | null;
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
  dedupe_key?: string | null;
  imagen_url?: string | null;
  documento_url?: string | null;
  adjuntos?: Adjunto[];
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
  instituciones?: {
    nombre: string;
  }[] | null;
  adjuntos_principales?: Adjunto[];
};

export default function ChatProveedor() {
  const params = useParams();
  const router = useRouter();
  const [incidencia, setIncidencia] = useState<Incidencia | null>(null);
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [nuevoComentario, setNuevoComentario] = useState("");
  const [imagenSeleccionada, setImagenSeleccionada] = useState<File | null>(null);
  const [documentoSeleccionado, setDocumentoSeleccionado] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [tipoUsuario, setTipoUsuario] = useState<string | null>(null);
  const [nombreUsuario, setNombreUsuario] = useState<string>("");
  const [direccionCentro, setDireccionCentro] = useState<string | null>(null);

  const [autorId, setAutorId] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [commentAttachmentUrls, setCommentAttachmentUrls] = useState<Record<string, string>>({});
  const [mostrarModalVisita, setMostrarModalVisita] = useState(false);
  const [fechaVisita, setFechaVisita] = useState('');
  const [horarioVisita, setHorarioVisita] = useState('');
  const [mostrarModalPresupuesto, setMostrarModalPresupuesto] = useState(false);
  const [mostrarModalGestionPresupuesto, setMostrarModalGestionPresupuesto] = useState(false);
  const [presupuesto, setPresupuesto] = useState('');
  const [descripcionPresupuesto, setDescripcionPresupuesto] = useState('');
  const [fechaEstimadaInicio, setFechaEstimadaInicio] = useState('');
  const [duracionEstimada, setDuracionEstimada] = useState('');
  const [importeTotalSinIva, setImporteTotalSinIva] = useState('');
  const [documentoPresupuesto, setDocumentoPresupuesto] = useState<File | null>(null);
  const [mostrarModalResolver, setMostrarModalResolver] = useState(false);
  const [solucionAplicada, setSolucionAplicada] = useState('');
  const [tieneOfertaAprobada, setTieneOfertaAprobada] = useState(false);

  // Estados para valoración económica
  const [importeSinIva, setImporteSinIva] = useState('');
  const [importeConIva, setImporteConIva] = useState('');
  const [porcentajeIva, setPorcentajeIva] = useState('');
  const [busquedaIva, setBusquedaIva] = useState('');
  const [mostrarOpcionesIva, setMostrarOpcionesIva] = useState(false);

  const opcionesIva = [
    { valor: '0', texto: '0% (Exento)' },
    { valor: '4', texto: '4% (Superreducido)' },
    { valor: '10', texto: '10% (Reducido)' },
    { valor: '21', texto: '21% (General)' }
  ];

  const opcionesFiltradas = busquedaIva.trim() === ''
    ? opcionesIva
    : opcionesIva.filter(opcion =>
        opcion.texto.toLowerCase().includes(busquedaIva.toLowerCase())
      );
  const [documentoJustificativo, setDocumentoJustificativo] = useState<File | null>(null);
  const [proveedorAsignado, setProveedorAsignado] = useState(false);
  const [fechaAsignacionProveedor, setFechaAsignacionProveedor] = useState<string | null>(null);
  const [visitaCalendarizada, setVisitaCalendarizada] = useState<{
    fecha: string;
    horario: string;
  } | null>(null);

  // Estados para modales de Control
  const [mostrarModalAnular, setMostrarModalAnular] = useState(false);
  const [mostrarModalCerrar, setMostrarModalCerrar] = useState(false);
  const [mostrarModalValorarIncidencia, setMostrarModalValorarIncidencia] = useState(false);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');
  const [motivoCierre, setMotivoCierre] = useState('');
  const [presupuestoActual, setPresupuestoActual] = useState<{ id: string; importe_total: number; importe_total_sin_iva?: number; presupuesto_detallado_url?: string; estado: string; fecha_estimada_inicio?: string; duracion_estimada?: string; descripcion_breve?: string; instituciones?: { nombre: string }; incidencias?: { num_solicitud: string; descripcion: string } } | null>(null);
  const [tuvoOfertaAprobada, setTuvoOfertaAprobada] = useState(false);
  const [cargandoPresupuesto, setCargandoPresupuesto] = useState(false);
  const [nombreProveedor, setNombreProveedor] = useState<string | null>(null);
  const [documentoPresupuestoUrl, setDocumentoPresupuestoUrl] = useState<string | null>(null);
  const [mostrarModalMotivoRevision, setMostrarModalMotivoRevision] = useState(false);
  const [motivoRevision, setMotivoRevision] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Estado para historial de proveedores
  type ProveedorHistorico = {
    proveedor_nombre: string;
    fecha_asignacion: string;
    fecha_anulacion?: string | null;
    motivo_anulacion?: string | null;
    estado_proveedor: string;
    activo: boolean;
  };
  const [historialProveedores, setHistorialProveedores] = useState<ProveedorHistorico[]>([]);

  const incidenciaId = params.id as string;

  // Función para hacer scroll al último mensaje
  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  // Función para generar URL firmada del documento
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

  // Función para abrir el modal y cargar el presupuesto
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

  useEffect(() => {
    cargarDatos();
  }, [incidenciaId]);

  // Cargar URLs de imágenes cuando cambie la incidencia
  useEffect(() => {
    if (incidencia?.adjuntos_principales) {
      const loadImageUrls = async () => {
        const urls: Record<string, string> = {};
        for (const adjunto of incidencia.adjuntos_principales || []) {
          if (adjunto.storage_key) {
            const url = await getSignedImageUrl(adjunto.storage_key);
            if (url) {
              urls[adjunto.id] = url;
            }
          }
        }
        setImageUrls(urls);
      };
      loadImageUrls();
    }
  }, [incidencia?.adjuntos_principales]);

  // Cargar URLs de adjuntos de comentarios (desde adjuntos y campos imagen_url/documento_url)
  useEffect(() => {
    if (comentarios.length > 0) {
      const loadCommentAttachmentUrls = async () => {
        const urls: Record<string, string> = {};
        for (const comentario of comentarios) {
          // Cargar adjuntos tradicionales
          if (comentario.adjuntos) {
            for (const adjunto of comentario.adjuntos) {
              if (adjunto.storage_key) {
                const url = await getSignedImageUrl(adjunto.storage_key);
                if (url) {
                  urls[adjunto.id] = url;
                }
              }
            }
          }
          // Cargar imagen_url del comentario
          if (comentario.imagen_url) {
            const url = await getSignedImageUrl(comentario.imagen_url);
            if (url) {
              urls[`imagen_${comentario.id}`] = url;
            }
          }
          // Cargar documento_url del comentario
          if (comentario.documento_url) {
            const url = await getSignedImageUrl(comentario.documento_url);
            if (url) {
              urls[`documento_${comentario.id}`] = url;
            }
          }
        }
        setCommentAttachmentUrls(urls);
      };
      loadCommentAttachmentUrls();
    }
  }, [comentarios]);

  // Limpiar documento justificativo cuando el importe coincide con la oferta aprobada
  useEffect(() => {
    if (tieneOfertaAprobada && presupuestoActual && importeSinIva) {
      const importeActual = parseFloat(importeSinIva) || 0;
      const importeOferta = presupuestoActual?.importe_total_sin_iva ? parseFloat(String(presupuestoActual.importe_total_sin_iva)) : 0;
      const importeCoincide = importeActual > 0 && importeActual === importeOferta;

      if (importeCoincide && documentoJustificativo) {
        setDocumentoJustificativo(null);
      }
    }
  }, [tieneOfertaAprobada, presupuestoActual, importeSinIva, documentoJustificativo]);

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
      // Obtener datos del usuario actual
      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData.user?.email;

      if (!userEmail) {
        router.push('/login');
        return;
      }

      // Obtener información del usuario
      const { data: persona } = await supabase
        .from("personas")
        .select("id, rol, nombre")
        .eq("email", userEmail)
        .maybeSingle();

      if (persona) {
        setTipoUsuario(persona.rol);
        setNombreUsuario(persona.nombre || userEmail);
        setAutorId(persona.id);
      }

      // Obtener institución del proveedor (solo si es necesario)
      let personaInst = null;
      if (persona?.rol === 'Proveedor') {
        const { data: instData } = await supabase
          .from("personas_instituciones")
          .select("institucion_id")
          .eq("persona_id", persona.id)
          .maybeSingle();

        personaInst = instData;

        if (!personaInst?.institucion_id) {
          console.error("No se encontró institución para el proveedor");
          setLoading(false);
          return;
        }
      }

      // Cargar incidencia con adjuntos principales
      const { data: incidenciaData, error: incidenciaError } = await supabase
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
          fecha_creacion,
          instituciones(nombre, direccion)
        `)
        .eq("id", incidenciaId)
        .single();

      // Verificar si la incidencia está asignada a un proveedor
      let estadoProveedor = null;
      let prioridadProveedor = null;
      let descripcionProveedor = null;
      let asignado = false;

      if (incidenciaData) {
        // Permitir acceso a usuarios Control y Proveedor
        if (persona?.rol === 'Control' || persona?.rol === 'Proveedor') {
          asignado = true;

          // Obtener datos del proveedor (fecha de asignación, estado y prioridad)
          // Buscar el caso más reciente (activo o anulado)
          console.log('Buscando proveedor_casos para incidencia:', incidenciaId);

          const { data: proveedorCaso, error: proveedorError } = await supabase
            .from("proveedor_casos")
            .select("asignado_en, estado_proveedor, prioridad, descripcion_proveedor, activo")
            .eq("incidencia_id", incidenciaId)
            .order("asignado_en", { ascending: false })
            .limit(1)
            .maybeSingle();

          console.log('Resultado proveedor_casos:', { proveedorCaso, proveedorError });

          if (proveedorCaso) {
            if (proveedorCaso.asignado_en) {
              setFechaAsignacionProveedor(proveedorCaso.asignado_en);
            }
            estadoProveedor = proveedorCaso.estado_proveedor;
            prioridadProveedor = proveedorCaso.prioridad;
            descripcionProveedor = proveedorCaso.descripcion_proveedor;

            console.log('Datos asignados:', {
              estadoProveedor,
              prioridadProveedor,
              descripcionProveedor,
              fechaAsignacion: proveedorCaso.asignado_en
            });
          } else {
            console.log('No se encontró proveedor_casos o está inactivo');
          }
        }
      }

      setProveedorAsignado(asignado);

      // Cargar adjuntos principales (imágenes de la incidencia)
      let adjuntosPrincipales = [];
      if (incidenciaData) {
        const { data: adjuntosData } = await supabase
          .from("adjuntos")
          .select("*")
          .eq("incidencia_id", incidenciaId)
          .eq("categoria", "imagen_principal")
          .eq("visible_proveedor", true); // Solo mostrar imágenes visibles para el proveedor

        adjuntosPrincipales = adjuntosData || [];

        // También considerar imagen_url de la incidencia si existe
        if (incidenciaData.imagen_url && adjuntosPrincipales.length === 0) {
          // Crear un adjunto virtual para imagen_url
          adjuntosPrincipales = [{
            id: 'imagen_url_' + incidenciaId,
            tipo: 'imagen',
            nombre_archivo: 'Imagen de la incidencia',
            storage_key: incidenciaData.imagen_url,
            categoria: 'imagen_principal'
          }];
        }
      }

      if (incidenciaError) {
        console.error("Error cargando incidencia:", incidenciaError);
      } else {
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

      // Verificar si existe oferta aprobada para esta incidencia y cargar todos sus datos
      const { data: ofertaData } = await supabase
        .from("presupuestos")
        .select("*")
        .eq("incidencia_id", incidenciaId)
        .eq("estado", "aprobado")
        .maybeSingle();

      setTieneOfertaAprobada(!!ofertaData);

      // Si hay oferta aprobada, cargar los datos del presupuesto para comparación
      if (ofertaData) {
        setPresupuestoActual(ofertaData);
      }

      // Cargar comentarios del chat proveedor con adjuntos de comentarios
      const { data: comentariosData, error: comentariosError } = await supabase
        .from("comentarios")
        .select(`
          *,
          adjuntos(id, tipo, nombre_archivo, storage_key, categoria)
        `)
        .eq("incidencia_id", incidenciaId)
        .in("ambito", ["proveedor", "ambos"])
        .not("cuerpo", "is", null)
        .order("creado_en", { ascending: true });

      if (comentariosError) {
        console.error("Error cargando comentarios:", comentariosError);
      } else {
        setComentarios(comentariosData || []);
      }

      // Verificar si alguna vez se aprobó una oferta
      const historial = await obtenerHistorialEstados(incidenciaId);
      const tuvoOfertaAprobadaEnHistorial = historial.some(registro =>
        registro.tipo_estado === 'proveedor' && registro.estado_nuevo === 'Oferta aprobada'
      );
      setTuvoOfertaAprobada(tuvoOfertaAprobadaEnHistorial);

      // Cargar historial de proveedores (solo para Control)
      if (persona?.rol === 'Control') {
        const { data: proveedoresHistoricos } = await supabase
          .from("proveedor_casos")
          .select(`
            proveedor_id,
            asignado_en,
            anulado_en,
            motivo_anulacion,
            estado_proveedor,
            activo
          `)
          .eq("incidencia_id", incidenciaId)
          .order("asignado_en", { ascending: false });

        if (proveedoresHistoricos && proveedoresHistoricos.length > 0) {
          // Obtener nombres de proveedores
          const proveedorIds = proveedoresHistoricos.map(p => p.proveedor_id);
          const { data: proveedoresData } = await supabase
            .from("instituciones")
            .select("id, nombre")
            .in("id", proveedorIds);

          const proveedoresMap = new Map(
            (proveedoresData || []).map(p => [p.id, p.nombre])
          );

          const historialFormateado: ProveedorHistorico[] = proveedoresHistoricos.map(p => ({
            proveedor_nombre: proveedoresMap.get(p.proveedor_id) || 'Proveedor desconocido',
            fecha_asignacion: p.asignado_en,
            fecha_anulacion: p.anulado_en,
            motivo_anulacion: p.motivo_anulacion,
            estado_proveedor: p.estado_proveedor || 'Sin estado',
            activo: p.activo
          }));

          setHistorialProveedores(historialFormateado);
        }
      }

    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const enviarComentario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoComentario.trim() || enviando || !tipoUsuario) return;

    try {
      setEnviando(true);

      const now = new Date();
      const fecha = now.toISOString().split('T')[0];
      const hora = now.toTimeString().split(' ')[0].slice(0, 5);

      // Subir archivos si existen
      let imagenUrl = null;
      let documentoUrl = null;

      if (imagenSeleccionada) {
        imagenUrl = await subirArchivo(imagenSeleccionada, 'imagenes');
      }

      if (documentoSeleccionado) {
        documentoUrl = await subirArchivo(documentoSeleccionado, 'documentos');
      }

      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData.user?.email;

      // Crear el comentario primero
      const { data: comentarioData, error } = await supabase
        .from("comentarios")
        .insert({
          incidencia_id: incidenciaId,
          ambito: 'proveedor',
          autor_id: autorId,
          autor_email: userEmail,
          autor_rol: tipoUsuario,
          cuerpo: nuevoComentario.trim(),
        })
        .select()
        .single();

      if (error) {
        console.error("Error enviando comentario:", error);
        return;
      }

      // Guardar archivos adjuntos si existen
      const adjuntos = [];
      
      if (imagenUrl && comentarioData) {
        adjuntos.push({
          incidencia_id: incidenciaId,
          comentario_id: comentarioData.id,
          tipo: 'imagen',
          categoria: 'imagen_comentario',
          nombre_archivo: imagenSeleccionada?.name,
          storage_key: imagenUrl
        });
      }

      if (documentoUrl && comentarioData) {
        adjuntos.push({
          incidencia_id: incidenciaId,
          comentario_id: comentarioData.id,
          tipo: 'documento',
          categoria: 'documento_comentario',
          nombre_archivo: documentoSeleccionado?.name,
          storage_key: documentoUrl
        });
      }

      if (adjuntos.length > 0) {
        const { error: adjuntosError } = await supabase
          .from("adjuntos")
          .insert(adjuntos);

        if (adjuntosError) {
          console.error("Error guardando adjuntos:", adjuntosError);
        }
      }

      setNuevoComentario("");
      setImagenSeleccionada(null);
      setDocumentoSeleccionado(null);
      cargarDatos(); // Recargar comentarios
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setEnviando(false);
    }
  };

  const subirArchivo = async (archivo: File, tipo: 'imagenes' | 'documentos') => {
    try {
      const nombreArchivo = `${Date.now()}_${archivo.name}`;
      // Nueva estructura: incidencias/{num_solicitud}/comentarios/
      const ruta = `incidencias/${incidencia?.num_solicitud}/comentarios/${nombreArchivo}`;
      
      console.log('Uploading file with path:', ruta);
      console.log('File details:', { name: archivo.name, size: archivo.size, type: archivo.type });
      
      const { data, error } = await supabase.storage
        .from('incidencias')
        .upload(ruta, archivo);
      
      if (error) {
        console.error('Upload error:', error);
        throw error;
      }
      
      console.log('Upload successful, data:', data);
      
      // Instead of public URL, return the storage path for consistency
      console.log('Returning storage path instead of public URL:', ruta);
      return ruta;
    } catch (error) {
      console.error('Error subiendo archivo:', error);
      return null;
    }
  };

  const manejarSeleccionImagen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    if (archivo) {
      setImagenSeleccionada(archivo);
    }
  };

  const manejarSeleccionDocumento = (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    if (archivo) {
      setDocumentoSeleccionado(archivo);
    }
  };

  const getColorEmisor = (emisor: string) => {
    switch (emisor.toLowerCase()) {
      case 'proveedor':
        return "#C9A96E";
      case 'control':
        return "#A9B88C";
      default:
        return PALETA.headerTable;
    }
  };

  const getSignedImageUrl = async (storageKey: string | null | undefined) => {
    if (!storageKey) return null;

    try {
      let cleanPath = storageKey;
      
      // Extract potential filename from storage_key
      let filename = '';
      if (storageKey.includes('/')) {
        const parts = storageKey.split('/');
        filename = parts[parts.length - 1]; // Get the last part (filename)
      } else {
        filename = storageKey;
      }
      
      console.log('Original storage_key:', storageKey);
      console.log('Extracted filename:', filename);
      
      // Extract storage path from full URLs
      if (storageKey.startsWith('https://')) {
        // Handle double prefix URLs (comment attachments)
        if (storageKey.includes('/storage/v1/object/public/incidencias/incidencias/')) {
          const parts = storageKey.split('/storage/v1/object/public/incidencias/incidencias/');
          if (parts.length > 1) {
            cleanPath = parts[1];
            console.log('Extracted path from double prefix URL:', cleanPath);
          }
        } 
        // Handle single prefix URLs
        else if (storageKey.includes('/storage/v1/object/public/incidencias/')) {
          const parts = storageKey.split('/storage/v1/object/public/incidencias/');
          if (parts.length > 1) {
            cleanPath = parts[1];
            console.log('Extracted path from single prefix URL:', cleanPath);
          }
        }
      }
      // For relative paths like "incidencias/00171/legacy/00171.jpg", use as-is
      else {
        console.log('Using relative path as-is:', cleanPath);
      }
      
      console.log('Attempting to create signed URL for path:', cleanPath);
      
      // Create signed URL for private access (expires in 4 hours)
      const { data, error } = await supabase.storage
        .from('incidencias')
        .createSignedUrl(cleanPath, 14400);
      
      if (error) {
        console.error('Error creating signed URL for path:', cleanPath, error);
        
        // If direct path fails, try to find the file by listing bucket contents
        console.log('Direct path failed, searching for file:', filename);
        
        try {
          const { data: files, error: listError } = await supabase.storage
            .from('incidencias')
            .list('');
            
          if (listError) {
            console.error('Error listing files:', listError);
            return null;
          }
          
          // Look for files with matching filename
          const matchingFile = files?.find(file => file.name === filename);
          
          if (matchingFile) {
            console.log('Found matching file:', matchingFile);
            // Try to create signed URL with the actual path
            const actualPath = matchingFile.name;
            const { data: signedData, error: signedError } = await supabase.storage
              .from('incidencias')
              .createSignedUrl(actualPath, 14400);
              
            if (!signedError && signedData) {
              console.log('Successfully created signed URL with actual path');
              return signedData.signedUrl;
            }
          }
          
          console.log('File not found in bucket listing');
        } catch (listingError) {
          console.error('Error during file search:', listingError);
        }
        
        return null;
      }
      
      console.log('Successfully created signed URL');
      return data.signedUrl;
    } catch (error) {
      console.error('Error generating signed URL:', error);
      return null;
    }
  };

  const calendarizarVisita = async () => {
    if (!fechaVisita || !horarioVisita || !autorId) {
      alert('Por favor, complete todos los campos obligatorios (fecha y horario)');
      return;
    }

    try {
      setEnviando(true);

      // Obtener datos del usuario actual
      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData.user?.email;

      // 1. Obtener estado anterior y cambiar estado_proveedor a "En resolución"
      const { data: casoActual } = await supabase
        .from("proveedor_casos")
        .select("estado_proveedor")
        .eq("incidencia_id", incidenciaId)
        .eq("activo", true)
        .single();

      const estadoAnterior = casoActual?.estado_proveedor || null;

      const { data: estadoActualizado, error: estadoError } = await supabase
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

      console.log("Estado actualizado a 'En resolución':", estadoActualizado);

      // 2. Crear timestamp para la visita y guardar en tabla de citas
      const horaVisita = horarioVisita === 'mañana' ? '09:00:00' : '14:00:00';
      const fechaHoraVisita = `${fechaVisita}T${horaVisita}`;

      // Obtener proveedor_id del caso actual
      const { data: proveedorCaso } = await supabase
        .from("proveedor_casos")
        .select("proveedor_id")
        .eq("incidencia_id", incidenciaId)
        .eq("activo", true)
        .single();

      if (proveedorCaso?.proveedor_id) {
        const { data: citaCreada, error: citaError } = await supabase
          .from("citas_proveedores")
          .insert({
            incidencia_id: incidenciaId,
            proveedor_id: proveedorCaso.proveedor_id,
            fecha_visita: fechaHoraVisita,
            horario: horarioVisita,
            estado: 'programada',
            creado_por: autorId
          });

        if (citaError) {
          console.error("Error creando cita:", citaError);
          throw citaError;
        }

        console.log("Cita creada exitosamente:", citaCreada);
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

      // Comentario con ámbito 'ambos' - se verá en ambos chats
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
      } else {
        console.log("Comentario insertado exitosamente en ambos chats");
      }

      // 5. Mostrar pantalla de éxito
      setVisitaCalendarizada({
        fecha: fechaFormateada,
        horario: horarioTexto
      });

      // 6. Cerrar modal y recargar datos
      setMostrarModalVisita(false);
      setFechaVisita('');
      setHorarioVisita('');
      cargarDatos();

    } catch (error) {
      console.error("Error calendarizando visita:", error);
    } finally {
      setEnviando(false);
    }
  };

  const ofertarPresupuesto = async () => {
    if (!fechaEstimadaInicio || !duracionEstimada || !importeTotalSinIva || !documentoPresupuesto || !descripcionPresupuesto || !autorId) {
      alert('Por favor, complete todos los campos obligatorios');
      return;
    }

    try {
      setEnviando(true);

      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData.user?.email;

      // 1. Subir documento del presupuesto
      let documentoUrl = '';
      if (documentoPresupuesto) {
        const nombreArchivo = `${Date.now()}_${documentoPresupuesto.name}`;
        // Nueva estructura: incidencias/{num_solicitud}/presupuestos/
        const ruta = `incidencias/${incidencia?.num_solicitud}/presupuestos/${nombreArchivo}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('incidencias')
          .upload(ruta, documentoPresupuesto);

        if (uploadError) {
          console.error('Error subiendo documento:', uploadError);
          throw uploadError;
        }

        documentoUrl = ruta;
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
          numero_incidencia: incidencia?.num_solicitud || '',
          fecha_estimada_inicio: fechaEstimadaInicio,
          duracion_estimada: duracionEstimada,
          importe_total_sin_iva: parseFloat(importeTotalSinIva),
          presupuesto_detallado_url: documentoUrl,
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
          autor_email: userEmail,
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
      if (comentarioCreado && documentoUrl) {
        const { error: adjuntoError } = await supabase
          .from("adjuntos")
          .insert({
            incidencia_id: incidenciaId,
            comentario_id: comentarioCreado.id,
            tipo: 'documento',
            nombre_archivo: documentoPresupuesto.name,
            storage_key: documentoUrl,
            categoria: 'presupuesto'
          });

        if (adjuntoError) {
          console.error("Error agregando adjunto:", adjuntoError);
        }
      }

      // 8. Limpiar formulario y cerrar modal
      setMostrarModalPresupuesto(false);
      setFechaEstimadaInicio('');
      setDuracionEstimada('');
      setImporteTotalSinIva('');
      setDocumentoPresupuesto(null);
      setDescripcionPresupuesto('');
      cargarDatos();

    } catch (error) {
      console.error("Error ofertando presupuesto:", error);
      alert('Error al enviar el presupuesto. Por favor, inténtelo de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  const resolverIncidencia = async () => {
    // Solo validar que existe solución aplicada
    if (!solucionAplicada || !solucionAplicada.trim()) {
      alert('Por favor, complete la solución aplicada');
      return;
    }

    if (!autorId) {
      alert('Error: no se pudo identificar el usuario');
      return;
    }

    try {
      setEnviando(true);

      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData.user?.email;

      // 1. Subir archivos si existen
      let imagenUrl = null;
      let documentoUrl = null;

      if (imagenResolucion) {
        imagenUrl = await subirArchivo(imagenResolucion, 'imagenes');
      }

      if (documentoResolucion) {
        documentoUrl = await subirArchivo(documentoResolucion, 'documentos');
      }

      // 2. Obtener estado anterior del proveedor
      const { data: casoActual } = await supabase
        .from("proveedor_casos")
        .select("estado_proveedor")
        .eq("incidencia_id", incidenciaId)
        .eq("activo", true)
        .single();

      const estadoProveedorAnterior = casoActual?.estado_proveedor || null;

      // Obtener estado anterior del cliente
      const { data: incidenciaActual } = await supabase
        .from("incidencias")
        .select("estado_cliente")
        .eq("id", incidenciaId)
        .single();

      const estadoClienteAnterior = incidenciaActual?.estado_cliente || null;

      // 3. Cambiar ambos estados a "Resuelta"
      await supabase
        .from("proveedor_casos")
        .update({ estado_proveedor: "Resuelta" })
        .eq("incidencia_id", incidenciaId)
        .eq("activo", true);

      await supabase
        .from("incidencias")
        .update({ estado_cliente: "Resuelta" })
        .eq("id", incidenciaId);

      // 4. Registrar cambios de estado en el historial
      const metadatosResolucion: Record<string, string | number | boolean> = {
        solucion_aplicada: solucionAplicada,
        tiene_oferta_aprobada: tieneOfertaAprobada,
        accion: 'resolver_incidencia'
      };

      if (!tieneOfertaAprobada && importeResolucion) {
        metadatosResolucion.importe_resolucion = parseFloat(importeResolucion);
      }


      // Registrar cambios de estado individualmente
      await registrarCambioEstado({
        incidenciaId,
        tipoEstado: 'proveedor',
        estadoAnterior: estadoProveedorAnterior || undefined,
        estadoNuevo: 'Resuelta',
        autorId,
        motivo: 'Incidencia resuelta por proveedor',
        metadatos: metadatosResolucion
      });

      await registrarCambioEstado({
        incidenciaId,
        tipoEstado: 'cliente',
        estadoAnterior: estadoClienteAnterior || undefined,
        estadoNuevo: 'Resuelta',
        autorId,
        motivo: 'Incidencia resuelta por proveedor',
        metadatos: metadatosResolucion
      });

      // 5. Crear comentario con información de resolución
      let mensajeSolucion = `Incidencia resuelta
Solución aplicada: ${solucionAplicada}`;

      if (!tieneOfertaAprobada && importeResolucion) {
        mensajeSolucion += `
Importe total sin IVA: ${importeResolucion}€`;
      }


      const { data: comentarioCreado, error: comentarioError } = await supabase
        .from("comentarios")
        .insert({
          incidencia_id: incidenciaId,
          ambito: 'proveedor',
          autor_id: autorId,
          autor_email: userEmail,
          autor_rol: 'Proveedor',
          cuerpo: mensajeSolucion,
          es_sistema: false
        })
        .select()
        .single();

      if (comentarioError) {
        console.error("Error creando comentario:", comentarioError);
        throw comentarioError;
      }

      // 6. Agregar adjuntos si existen
      const adjuntos = [];

      if (imagenUrl && comentarioCreado) {
        adjuntos.push({
          incidencia_id: incidenciaId,
          comentario_id: comentarioCreado.id,
          tipo: 'imagen',
          categoria: 'evidencia_resolucion',
          nombre_archivo: imagenResolucion?.name,
          storage_key: imagenUrl
        });
      }

      if (documentoUrl && comentarioCreado) {
        adjuntos.push({
          incidencia_id: incidenciaId,
          comentario_id: comentarioCreado.id,
          tipo: 'documento',
          categoria: 'documento_resolucion',
          nombre_archivo: documentoResolucion?.name,
          storage_key: documentoUrl
        });
      }

      if (adjuntos.length > 0) {
        const { error: adjuntosError } = await supabase
          .from("adjuntos")
          .insert(adjuntos);

        if (adjuntosError) {
          console.error("Error guardando adjuntos:", adjuntosError);
        }
      }

      // 7. Crear comentario para ambos chats indicando que la incidencia ha sido resuelta
      const { data: comentarioCliente, error: comentarioClienteError } = await supabase
        .from("comentarios")
        .insert({
          incidencia_id: incidenciaId,
          ambito: 'ambos',
          autor_id: autorId,
          autor_email: userEmail || 'proveedor@sistema.com',
          autor_rol: 'Proveedor',
          cuerpo: "La incidencia ha sido resuelta técnicamente.",
          es_sistema: true
        })
        .select()
        .single();

      if (comentarioClienteError) {
        console.error("Error creando comentario para cliente:", {
          error: comentarioClienteError,
          message: comentarioClienteError.message,
          details: comentarioClienteError.details,
          hint: comentarioClienteError.hint,
          code: comentarioClienteError.code
        });
        // No lanzamos el error para que no interrumpa el proceso
      } else {
        console.log("Comentario para cliente creado exitosamente:", comentarioCliente);
      }

      // 8. Limpiar formulario y cerrar modal
      setMostrarModalResolver(false);
      setSolucionAplicada('');
      setImporteResolucion('');
      setImagenResolucion(null);
      setDocumentoResolucion(null);
      cargarDatos();

    } catch (error) {
      console.error("Error resolviendo incidencia:", error);
      alert('Error al resolver la incidencia. Por favor, inténtelo de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  const valoracionEconomica = async () => {
    // Validar si el documento es requerido
    const importeActual = parseFloat(importeSinIva) || 0;
    const importeOferta = presupuestoActual?.importe_total_sin_iva ? parseFloat(String(presupuestoActual.importe_total_sin_iva)) : 0;
    const importeHaCambiado = tieneOfertaAprobada && importeActual !== importeOferta;
    const importeCoincide = tieneOfertaAprobada && !importeHaCambiado && importeActual > 0;
    const documentoRequerido = !tieneOfertaAprobada || importeHaCambiado;

    // Si el importe coincide, no requiere documento
    if (importeCoincide) {
      if (!importeSinIva || !importeConIva || !autorId) return;
    } else {
      if (!importeSinIva || !importeConIva || (documentoRequerido && !documentoJustificativo) || !autorId) return;
    }

    try {
      setEnviando(true);

      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData.user?.email;

      // 1. Subir documento justificativo si existe y es requerido
      let documentoUrl = null;
      if (documentoJustificativo && !importeCoincide) {
        const fileName = `${Date.now()}-${documentoJustificativo.name}`;
        const storagePath = `${incidencia?.num_solicitud}/comentarios/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('incidencias')
          .upload(storagePath, documentoJustificativo);

        if (uploadError) {
          throw uploadError;
        }

        const { data: urlData } = supabase.storage
          .from('incidencias')
          .getPublicUrl(storagePath);

        documentoUrl = urlData.publicUrl;
      }

      // 2. Cambiar estado_proveedor a "Valorada"
      await supabase
        .from("proveedor_casos")
        .update({ estado_proveedor: "Valorada" })
        .eq("incidencia_id", incidenciaId)
        .eq("activo", true);

      // 3. Crear mensaje de valoración económica
      const mensajeValoracion = `Valoración económica completada:
• Importe sin IVA: €${importeSinIva}
• Porcentaje IVA: ${porcentajeIva}%
• Importe con IVA: €${importeConIva}${tieneOfertaAprobada ? '\n• Incidencia con oferta previa aprobada' : ''}`;

      // 4. Insertar comentarios
      const comentariosData = [
        {
          incidencia_id: incidenciaId,
          ambito: 'proveedor',
          autor_id: autorId,
          autor_email: userEmail,
          autor_rol: 'Proveedor',
          cuerpo: mensajeValoracion,
          documento_url: documentoUrl,
          es_sistema: false
        },
        {
          incidencia_id: incidenciaId,
          ambito: 'cliente',
          autor_id: autorId,
          autor_email: userEmail,
          autor_rol: 'Proveedor',
          cuerpo: `El proveedor ha completado la valoración económica de la incidencia:\n${mensajeValoracion}`,
          documento_url: documentoUrl,
          es_sistema: true
        }
      ];

      await supabase.from("comentarios").insert(comentariosData);

      // 5. Limpiar estados y cerrar modal
      setMostrarModalValorarIncidencia(false);
      setImporteSinIva('');
      setImporteConIva('');
      setDocumentoJustificativo(null);
      cargarDatos();

    } catch (error) {
      console.error("Error en valoración económica:", error);
    } finally {
      setEnviando(false);
    }
  };

  // Funciones para acciones de Control
  const anularIncidencia = async () => {
    if (!motivoAnulacion.trim() || !autorId) return;

    try {
      setEnviando(true);

      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData.user?.email;
      const fechaAnulacion = new Date();

      // 1. Obtener información del proveedor y estado anterior antes de anular
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

      // 3. Marcar proveedor_caso como anulado e inactivo
      const { error: updateError } = await supabase
        .from("proveedor_casos")
        .update({
          estado_proveedor: "Anulada",
          activo: false,
          motivo_anulacion: motivoAnulacion,
          anulado_en: fechaAnulacion.toISOString(),
          anulado_por: autorId
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
        autorId,
        motivo: motivoAnulacion,
        metadatos: {
          accion: 'anular_proveedor',
          citas_canceladas: true
        }
      });

      // 6. Comentario en el chat del proveedor (mantener historial)
      const mensajeAnulacion = `Asignación anulada por Control. Motivo: ${motivoAnulacion}`;

      await supabase
        .from("comentarios")
        .insert({
          incidencia_id: incidenciaId,
          ambito: 'proveedor',
          autor_id: autorId,
          autor_email: userEmail,
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

  const cerrarIncidencia = async () => {
    if (!autorId) return;

    try {
      setEnviando(true);

      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData.user?.email;

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

      // 1. Cambiar estado_proveedor a "Cerrada"
      await supabase
        .from("proveedor_casos")
        .update({ estado_proveedor: "Cerrada" })
        .eq("incidencia_id", incidenciaId)
        .eq("activo", true);

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
        autorId,
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
        autorId,
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
          autor_id: autorId,
          autor_email: userEmail,
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


  // Función para cargar presupuesto
  const cargarPresupuesto = async () => {
    try {
      setCargandoPresupuesto(true);
      console.log("Cargando presupuesto para incidencia:", incidenciaId);

      const { data: presupuestoData, error } = await supabase
        .from("presupuestos")
        .select("*")
        .eq("incidencia_id", incidenciaId)
        .order("creado_en", { ascending: false })
        .limit(1);

      console.log("Resultado consulta presupuesto:", { data: presupuestoData, error });

      if (error) {
        console.error("Error cargando presupuesto:", error);
        return;
      }

      // Tomar el primer (y único) elemento del array
      const presupuesto = presupuestoData && presupuestoData.length > 0 ? presupuestoData[0] : null;
      console.log("Presupuesto seleccionado:", presupuesto);
      setPresupuestoActual(presupuesto);
    } catch (error) {
      console.error("Error en cargarPresupuesto:", error);
    } finally {
      setCargandoPresupuesto(false);
    }
  };

  // Función para aprobar presupuesto
  const aprobarPresupuesto = async () => {
    if (!autorId || !presupuestoActual || enviando) return;

    try {
      setEnviando(true);

      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData.user?.email;

      // 1. Cambiar estado_proveedor a "Oferta aprobada"
      await supabase
        .from("proveedor_casos")
        .update({ estado_proveedor: "Oferta aprobada" })
        .eq("incidencia_id", incidenciaId)
        .eq("activo", true);

      // 2. Actualizar estado del presupuesto
      await supabase
        .from("presupuestos")
        .update({ estado: "aprobado" })
        .eq("id", presupuestoActual.id);

      // 2.1. Registrar cambio de estado en el historial
      await registrarCambioEstado({
        incidenciaId,
        tipoEstado: 'proveedor',
        estadoAnterior: "pendiente_revision",
        estadoNuevo: "aprobado",
        autorId,
        motivo: `Presupuesto aprobado desde chat-proveedor. Importe: ${presupuestoActual.importe_total_sin_iva}€ (sin IVA)`,
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
          autor_id: autorId,
          autor_email: userEmail,
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

  // Función para mandar a revisar presupuesto
  const mandarARevisar = async () => {
    if (!autorId || !presupuestoActual || !motivoRevision.trim()) return;

    try {
      setEnviando(true);

      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData.user?.email;

      // 1. Cambiar estado_proveedor a "Oferta a revisar"
      await supabase
        .from("proveedor_casos")
        .update({ estado_proveedor: "Oferta a revisar" })
        .eq("incidencia_id", incidenciaId)
        .eq("activo", true);

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
        autorId,
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
          autor_id: autorId,
          autor_email: userEmail,
          autor_rol: 'Control',
          cuerpo: `El presupuesto requiere revisión. Motivo: ${motivoRevision}`,
          es_sistema: true
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
        <div className="text-white">No se encontró la incidencia</div>
      </div>
    );
  }

  // Verificar si la incidencia ha sido asignada a un proveedor
  if (!loading && !proveedorAsignado) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ backgroundColor: PALETA.bg }}>
        <div className="text-center text-white max-w-md">
          <h2 className="text-xl font-semibold mb-4">Chat no disponible</h2>
          <p className="mb-6">
            Esta incidencia aún no ha sido asignada a ningún proveedor.
            El chat de proveedor estará disponible una vez que se realice la asignación.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => router.push(`/control/incidencias?asignar=${incidenciaId}`)}
              className="px-4 py-2 text-white rounded hover:opacity-90 transition-colors"
              style={{ backgroundColor: PALETA.filtros }}
            >
              Asignar Proveedor
            </button>
            <button
              onClick={() => router.push("/incidencias")}
              className="px-4 py-2 bg-white text-gray-800 rounded hover:bg-gray-100 transition-colors"
            >
              ← Volver a incidencias
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Si la visita fue calendarizada exitosamente, mostrar pantalla de éxito
  if (visitaCalendarizada) {
    return (
      <div className="min-h-[calc(100vh-80px)] px-6 py-12" style={{ backgroundColor: PALETA.bg }}>
        <div
          className="mx-auto w-full max-w-2xl rounded-lg p-8 shadow text-center"
          style={{ backgroundColor: PALETA.card }}
        >
          <div className="mb-6">
            <div
              className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4"
              style={{ backgroundColor: PALETA.verdeClaro }}
            >
              <svg className="w-8 h-8" fill="none" stroke="#5D6D52" viewBox="0 0 24 24" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-3xl font-semibold mb-2" style={{ color: PALETA.textoOscuro }}>
              ¡Visita calendarizada exitosamente!
            </h1>
            <p className="text-gray-600 mb-6">
              La visita ha sido programada correctamente en el sistema.
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <h2 className="text-lg font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
              Detalles de la visita:
            </h2>
            <p className="text-2xl font-bold mb-2" style={{ color: PALETA.bg }}>
              {visitaCalendarizada.fecha}
            </p>
            <p className="text-gray-600">
              {visitaCalendarizada.horario}
            </p>
            <p className="text-sm text-gray-500 mt-3">
              El estado se ha actualizado a &quot;En resolución&quot;.
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => setVisitaCalendarizada(null)}
              className="w-full rounded px-6 py-3 text-white font-medium"
              style={{ backgroundColor: PALETA.bg }}
            >
              Continuar
            </button>
            <button
              onClick={() => router.push("/incidencias")}
              className="w-full rounded px-6 py-3 border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
            >
              Ver todas las incidencias
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: PALETA.bg }}>
      {/* Header */}
      <div className="flex items-center justify-between p-6">
        <button
          onClick={() => router.push("/incidencias")}
          className="text-white text-sm hover:underline"
        >
          ← Volver a incidencias
        </button>

        <div></div>

        <div></div>
      </div>

      {/* Información de la incidencia - estilo mejorado */}
      <div className="px-6 pb-4">
        <div
          className="rounded-lg mb-6 shadow-lg"
          style={{
            backgroundColor: PALETA.card
          }}
        >
          <div
            className="px-6 py-4 mb-6 border-b rounded-t-lg"
            style={{
              backgroundColor: PALETA.headerTable,
              color: PALETA.textoOscuro
            }}
          >
            <h2 className="text-lg font-semibold">DATOS TÉCNICOS DE LA INCIDENCIA</h2>
          </div>
          
          {/* Determinar si hay imágenes para mostrar */}
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
                                onClick={() => {
                                  window.open(direccionCentro || '', '_blank');
                                }}
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
                          Fecha/Hora:
                        </td>
                        <td className="py-2 font-mono" style={{ color: PALETA.textoOscuro }}>
                          {fechaAsignacionProveedor
                            ? new Date(fechaAsignacionProveedor).toLocaleString('es-ES', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : "-"
                          }
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
                          {incidencia.fecha_creacion ? new Date(incidencia.fecha_creacion).toLocaleString('es-ES', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          }) : '-'}
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

                {/* Sección de imágenes - solo mostrar si hay imágenes */}
                {hasImages && (
                  <div className="lg:col-span-1">
                    <div
                      className="rounded-lg p-4"
                    >
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

      {/* Historial de Proveedores - Solo para Control */}
      {tipoUsuario === "Control" && historialProveedores.length > 0 && (
        <div className="px-6 mb-6">
          <div
            className="rounded-lg shadow-lg"
            style={{ backgroundColor: PALETA.card }}
          >
            <div
              className="px-6 py-4 border-b rounded-t-lg"
              style={{
                backgroundColor: PALETA.headerTable,
                color: PALETA.textoOscuro
              }}
            >
              <h2 className="text-lg font-semibold">HISTORIAL DE PROVEEDORES</h2>
            </div>

            <div className="px-6 py-4">
              <div className="space-y-4">
                {historialProveedores.map((prov, index) => (
                  <div
                    key={index}
                    className="border-l-4 pl-4 py-3 rounded-r"
                    style={{
                      borderColor: prov.activo ? PALETA.bg : '#9ca3af',
                      backgroundColor: prov.activo ? `${PALETA.bg}10` : '#f9fafb'
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold" style={{ color: PALETA.textoOscuro }}>
                            {prov.proveedor_nombre}
                          </span>
                          {prov.activo && (
                            <span
                              className="px-2 py-1 text-xs rounded text-white font-medium"
                              style={{ backgroundColor: PALETA.bg }}
                            >
                              ACTIVO
                            </span>
                          )}
                          {!prov.activo && (
                            <span className="px-2 py-1 text-xs rounded bg-gray-400 text-white font-medium">
                              ANULADO
                            </span>
                          )}
                        </div>

                        <div className="text-sm space-y-1" style={{ color: PALETA.textoOscuro }}>
                          <div>
                            <span className="font-medium">Asignado:</span>{' '}
                            {new Date(prov.fecha_asignacion).toLocaleString('es-ES', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>

                          {prov.fecha_anulacion && (
                            <div>
                              <span className="font-medium">Anulado:</span>{' '}
                              {new Date(prov.fecha_anulacion).toLocaleString('es-ES', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                          )}

                          <div>
                            <span className="font-medium">Estado final:</span>{' '}
                            <span className="px-2 py-0.5 text-xs rounded bg-gray-200">
                              {prov.estado_proveedor}
                            </span>
                          </div>

                          {prov.motivo_anulacion && (
                            <div className="mt-2 p-2 rounded bg-red-50 border border-red-200">
                              <span className="font-medium text-red-700">Motivo de anulación:</span>
                              <p className="text-red-600 mt-1">{prov.motivo_anulacion}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Panel de acciones para Control */}
      {tipoUsuario === "Control" && (
        <div className="px-6 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h3 className="font-semibold mb-4 text-center" style={{ color: PALETA.textoOscuro }}>
              ACCIONES DE CONTROL
            </h3>

            {(() => {
              const estado = incidencia.estado_proveedor;
              const incidenciaCerrada = incidencia.estado_cliente === "Cerrada" && estado === "Cerrada";

              return (
                <div className="flex gap-3 justify-center flex-wrap">
                  {/* Botón Anular - siempre disponible hasta que la incidencia esté completamente cerrada */}
                  {!incidenciaCerrada && estado !== "Anulada" && (
                    <button
                      type="button"
                      onClick={() => setMostrarModalAnular(true)}
                      className="px-3 py-2 text-sm border border-red-500 text-red-600 bg-white rounded hover:bg-red-50 transition-colors"
                    >
                      Anular Proveedor
                    </button>
                  )}

                  {/* Botón Reasignar - disponible cuando está anulada */}
                  {estado === "Anulada" && (
                    <button
                      type="button"
                      onClick={() => router.push(`/control/incidencias?asignar=${incidenciaId}`)}
                      className="px-4 py-2 text-white rounded hover:opacity-90 transition-opacity"
                      style={{ backgroundColor: PALETA.verdeClaro }}
                    >
                      Reasignar Proveedor
                    </button>
                  )}

                  {/* Botón Cerrar - disponible solo cuando está Valorada */}
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

                  {/* Botón Gestionar Presupuesto - solo si está Ofertada */}
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


                  {/* Botón Valorar Incidencia - solo si está Resuelta */}
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

                  {/* Botón Cambiar al Chat Cliente - solo para Control */}
                  {tipoUsuario === 'Control' && (
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
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Botones de acciones del proveedor */}
      {tipoUsuario === 'Proveedor' && (
        <div className="px-6 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h3 className="font-semibold mb-4 text-center" style={{ color: PALETA.textoOscuro }}>
              ACCIONES DISPONIBLES
            </h3>

            {/* Lógica de botones basada en estado */}
            {(() => {
              const estado = incidencia.estado_proveedor;

              // Definir disponibilidad de botones según estado
              const botonesDisponibles = {
                calendarizar: false,
                ofertar: false,
                resolver: false,
                valorar: false
              };

              // Mensajes informativos por estado
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
                  // Estados no contemplados - no habilitar botones por seguridad
                  mensaje = '⚠️ Estado desconocido - Contacte con soporte si persiste';
              }

              // Si alguna vez se aprobó una oferta, no permitir ofertar de nuevo
              if (tuvoOfertaAprobada) {
                botonesDisponibles.ofertar = false;
              }

              return (
                <>
                  {/* Mostrar mensaje si existe */}
                  {mensaje && (
                    <div className="text-center py-4">
                      <p className="text-sm text-gray-600 mb-2">{mensaje}</p>
                      {!botonesDisponibles.valorar && mensaje.includes('Esperando') && (
                        <p className="text-xs text-gray-500">
                          Las acciones estarán disponibles cuando Control responda.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Botones principales */}
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
                          onClick={() => setMostrarModalResolver(true)}
                          className="px-4 py-2 text-white rounded hover:opacity-90 transition-opacity"
                          style={{ backgroundColor: PALETA.verdeClaro }}
                        >
                          Resolver Incidencia
                        </button>
                      )}
                    </div>
                  )}

                  {/* Botón de valorar */}
                  {botonesDisponibles.valorar && (
                    <div className="flex justify-center mt-4">
                      <button
                        type="button"
                        onClick={() => setMostrarModalValorarIncidencia(true)}
                        className="px-4 py-2 text-white rounded hover:opacity-90 transition-opacity"
                        style={{ backgroundColor: PALETA.verdeClaro }}
                      >
                        Valorar Incidencia
                      </button>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Título del chat */}
      <div className="px-6 mb-8">
        {tipoUsuario === 'Control' ? (
          <div className="text-white text-center">
            <h2 className="text-lg font-semibold mb-1 tracking-wider">CHAT PROVEEDOR</h2>
            <p className="text-sm opacity-80">#{incidencia.num_solicitud}</p>
            {nombreProveedor && (
              <p className="text-sm opacity-90 mt-1" style={{ color: PALETA.headerTable }}>
                {nombreProveedor}
              </p>
            )}
          </div>
        ) : (
          <h2 className="text-white text-center text-lg font-semibold mb-4 tracking-wider">SEGUIMIENTO</h2>
        )}
      </div>

      {/* Chat */}
      <div className="px-6 pb-6">
        <div className="bg-white rounded-lg shadow-sm flex flex-col h-[700px] relative">
          {/* Botón flotante para ir al último mensaje */}
          {comentarios.length > 3 && (
            <button
              onClick={scrollToBottom}
              className="absolute top-4 right-4 z-20 bg-white border-2 border-gray-300 rounded-full p-2 shadow-lg hover:shadow-xl transition-shadow hover:bg-gray-50"
              title="Ir al último mensaje"
            >
              <svg
                className="w-5 h-5 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </button>
          )}

          {/* Comentarios */}
          <div ref={chatContainerRef} className="flex-1 p-4 overflow-y-auto space-y-3 relative">
            {comentarios.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                No hay comentarios aún. ¡Sé el primero en escribir!
              </div>
            ) : (
              comentarios.map((comentario) => (
                <div
                  key={comentario.id}
                  className={`flex ${
                    comentario.es_sistema 
                      ? 'justify-center' 
                      : comentario.autor_rol === tipoUsuario ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className="max-w-xs md:max-w-md rounded-lg p-3"
                    style={{
                      backgroundColor: comentario.es_sistema 
                        ? '#fef3c7'
                        : comentario.autor_rol === tipoUsuario 
                          ? getColorEmisor(comentario.autor_rol || 'proveedor')
                          : "#f3f4f6"
                    }}
                  >
                    {!comentario.es_sistema && (
                      <div className="text-xs font-medium mb-1" style={{ 
                        color: PALETA.bg 
                      }}>
                        {`${comentario.autor_email} (${comentario.autor_rol})`}
                      </div>
                    )}
                    <div className="text-sm whitespace-pre-line">{comentario.cuerpo}</div>
                    
                    {/* Mostrar adjuntos */}
                    {comentario.adjuntos && comentario.adjuntos.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {comentario.adjuntos.map((adjunto) => (
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
                                const documentUrl = commentAttachmentUrls[adjunto.id] || adjunto.storage_key;
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

                    {/* Mostrar adjuntos desde campos imagen_url y documento_url */}
                    {((comentario.imagen_url || comentario.documento_url)) && (
                      <div className="mt-2 space-y-2">
                        {/* Mostrar imagen_url del comentario */}
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
                            ) : (
                              <div className="text-sm text-red-600">
                                Error cargando imagen: {comentario.imagen_url}
                              </div>
                            );
                          })()
                        )}

                        {/* Mostrar documento_url del comentario */}
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
                            ) : (
                              <div className="text-sm text-red-600">
                                Error cargando documento: {comentario.documento_url}
                              </div>
                            );
                          })()
                        )}
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
            {/* Referencia para scroll al último mensaje */}
            <div ref={messagesEndRef} />

          </div>

          {/* Formulario de envío */}
          <form onSubmit={enviarComentario} className="border-t p-4 space-y-4">
            <textarea
              value={nuevoComentario}
              onChange={(e) => setNuevoComentario(e.target.value)}
              placeholder="Escribe tu comentario..."
              className="w-full h-20 p-3 border rounded focus:outline-none resize-none text-sm"
              style={{ borderColor: PALETA.textoOscuro }}
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
                      onClick={() => setImagenSeleccionada(null)}
                      className="text-gray-500 hover:text-gray-700 text-sm"
                      style={{
                        color: PALETA.textoOscuro,
                        transition: 'color 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = PALETA.bg;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = PALETA.textoOscuro;
                      }}
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
                      onClick={() => setDocumentoSeleccionado(null)}
                      className="text-gray-500 hover:text-gray-700 text-sm"
                      style={{
                        color: PALETA.textoOscuro,
                        transition: 'color 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = PALETA.bg;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = PALETA.textoOscuro;
                      }}
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
                  onChange={manejarSeleccionImagen}
                  className="hidden"
                />
                <label
                  htmlFor="imagen"
                  className="inline-flex items-center gap-2 px-3 py-0.5 border border-gray-400 rounded cursor-pointer transition-colors text-gray-600"
                  style={{
                    borderColor: PALETA.textoOscuro
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = PALETA.headerTable;
                    e.currentTarget.style.color = PALETA.textoOscuro;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '';
                    e.currentTarget.style.color = '#4b5563';
                  }}
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
                  onChange={manejarSeleccionDocumento}
                  className="hidden"
                />
                <label
                  htmlFor="documento"
                  className="inline-flex items-center gap-2 px-3 py-0.5 border border-gray-400 rounded cursor-pointer transition-colors text-gray-600"
                  style={{
                    borderColor: PALETA.textoOscuro
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = PALETA.headerTable;
                    e.currentTarget.style.color = PALETA.textoOscuro;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '';
                    e.currentTarget.style.color = '#4b5563';
                  }}
                >
                  <span className="font-medium text-sm">Añadir documento</span>
                  <span className="text-2xl text-gray-400">+</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={!nuevoComentario.trim() || enviando}
                className="px-4 py-2 text-white rounded disabled:opacity-50 hover:opacity-90 transition-opacity ml-auto"
                style={{ backgroundColor: PALETA.bg }}
              >
                {enviando ? "Enviando..." : "Enviar"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Modal para calendarizar visita */}
      {mostrarModalVisita && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div
            className="rounded-lg p-8 max-w-md w-full mx-4 shadow"
            style={{ backgroundColor: PALETA.card }}
          >
            <h3 className="text-xl font-semibold mb-6" style={{ color: PALETA.textoOscuro }}>
              Calendarizar Visita
            </h3>

            <div className="space-y-6">
              {/* Fecha */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                  Fecha de la visita *
                </label>
                <input
                  type="date"
                  value={fechaVisita}
                  onChange={(e) => setFechaVisita(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full h-9 rounded border px-3 text-sm outline-none"
                  onFocus={(e) => {
                    e.target.style.borderColor = PALETA.verdeClaro;
                    e.target.style.boxShadow = `0 0 0 2px ${PALETA.verdeClaro}40`;
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '';
                    e.target.style.boxShadow = '';
                  }}
                  required
                />
              </div>

              {/* Horario */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                  Horario *
                </label>
                <SearchableSelect
                  value={horarioVisita}
                  onChange={(value) => setHorarioVisita(value)}
                  options={[
                    { value: "mañana", label: "Horario de mañana" },
                    { value: "tarde", label: "Horario de tarde" }
                  ]}
                  placeholder="Seleccione un horario"
                  focusColor={PALETA.verdeClaro}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button
                type="button"
                onClick={() => {
                  setMostrarModalVisita(false);
                  setFechaVisita('');
                  setHorarioVisita('');
                }}
                className="px-4 py-2 text-sm rounded border hover:bg-gray-50 transition-colors"
                style={{ color: PALETA.textoOscuro, borderColor: '#d1d5db' }}
                disabled={enviando}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={calendarizarVisita}
                disabled={!fechaVisita || !horarioVisita || enviando}
                className="px-6 py-2 text-sm text-white rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                style={{ backgroundColor: '#7A8A6F' }}
              >
                {enviando ? 'Calendarizando...' : 'Calendarizar Visita'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para ofertar presupuesto */}
      {mostrarModalPresupuesto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div
            className="rounded-lg p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow"
            style={{ backgroundColor: PALETA.card }}
          >
            <h3 className="text-xl font-semibold mb-6" style={{ color: PALETA.textoOscuro }}>
              Datos presupuesto
            </h3>

            <div className="space-y-6">
              {/* Número de incidencia */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                  N° incidencia
                </label>
                <input
                  type="text"
                  value={incidencia?.num_solicitud || ''}
                  disabled
                  className="w-full h-9 rounded border px-3 text-sm bg-gray-100"
                />
              </div>

              {/* Fecha estimada de inicio y Duración estimada */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                    Fecha estimada de inicio *
                  </label>
                  <input
                    type="date"
                    value={fechaEstimadaInicio}
                    onChange={(e) => setFechaEstimadaInicio(e.target.value)}
                    className="w-full h-9 rounded border px-3 text-sm outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                    Duración estimada *
                  </label>
                  <input
                    type="text"
                    value={duracionEstimada}
                    onChange={(e) => setDuracionEstimada(e.target.value)}
                    className="w-full h-9 rounded border px-3 text-sm outline-none"
                    placeholder="ej: 2 días, 1 semana..."
                    required
                  />
                </div>
              </div>

              {/* Importe total sin IVA y Presupuesto detallado */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                    Importe total sin IVA (€) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={importeTotalSinIva}
                    onChange={(e) => setImporteTotalSinIva(e.target.value)}
                    className="w-full h-9 rounded border px-3 text-sm outline-none"
                    placeholder="0.00"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                    Presupuesto detallado *
                  </label>
                  <div className="relative">
                    <input
                      type="file"
                      onChange={(e) => setDocumentoPresupuesto(e.target.files?.[0] || null)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      accept=".pdf,.doc,.docx,.xls,.xlsx"
                      required
                    />
                    <div className="w-full h-9 rounded border px-3 text-sm bg-white flex items-center justify-center cursor-pointer hover:bg-gray-50">
                      <span className="text-3xl">+</span>
                    </div>
                  </div>
                  {documentoPresupuesto && (
                    <p className="text-xs text-gray-600 mt-1">{documentoPresupuesto.name}</p>
                  )}
                </div>
              </div>

              {/* Descripción del trabajo */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                  Descripción del trabajo *
                </label>
                <textarea
                  value={descripcionPresupuesto}
                  onChange={(e) => setDescripcionPresupuesto(e.target.value)}
                  className="w-full h-24 rounded border px-3 py-2 text-sm outline-none resize-none"
                  placeholder="Descripción del trabajo a realizar..."
                  required
                />
              </div>
            </div>


            <div className="flex justify-end gap-3 mt-8">
              <button
                type="button"
                onClick={() => {
                  setMostrarModalPresupuesto(false);
                  setFechaEstimadaInicio('');
                  setDuracionEstimada('');
                  setImporteTotalSinIva('');
                  setDocumentoPresupuesto(null);
                  setDescripcionPresupuesto('');
                }}
                className="px-4 py-2 text-sm rounded border hover:bg-gray-50 transition-colors"
                style={{ color: PALETA.textoOscuro, borderColor: '#d1d5db' }}
                disabled={enviando}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={ofertarPresupuesto}
                disabled={!fechaEstimadaInicio || !duracionEstimada || !importeTotalSinIva || !documentoPresupuesto || !descripcionPresupuesto || enviando}
                className="px-6 py-2 text-sm text-white rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                style={{ backgroundColor: '#7A8A6F' }}
              >
                {enviando ? 'Enviando...' : 'Enviar a revisión'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para resolver incidencia */}
      {mostrarModalResolver && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div
            className="rounded-lg p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow"
            style={{ backgroundColor: PALETA.card }}
          >
            <h3 className="text-xl font-semibold mb-6" style={{ color: PALETA.textoOscuro }}>
              Resolver Incidencia
              {tieneOfertaAprobada && (
                <span className="text-sm block mt-1" style={{ color: PALETA.verdeClaro }}>
                  ✓ Incidencia con oferta aprobada
                </span>
              )}
            </h3>

            <div className="space-y-6">
              {/* Solución aplicada - Siempre obligatorio */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                  Solución aplicada *
                </label>
                <textarea
                  value={solucionAplicada}
                  onChange={(e) => setSolucionAplicada(e.target.value)}
                  className="w-full h-24 rounded border px-3 py-2 text-sm outline-none resize-none"
                  placeholder="Describe la solución aplicada..."
                  required
                />
              </div>


              {/* Imagen de evidencia - Opcional */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                  Imagen de evidencia (opcional)
                </label>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setImagenResolucion(e.target.files?.[0] || null)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="w-full h-9 rounded border px-3 text-sm bg-white flex items-center justify-center cursor-pointer hover:bg-gray-50">
                    <span className="text-3xl">+</span>
                  </div>
                </div>
                {imagenResolucion && (
                  <p className="text-xs text-gray-600 mt-1">{imagenResolucion.name}</p>
                )}
              </div>

              {/* Documento de parte de trabajo - Opcional */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                  Documento de parte de trabajo (opcional)
                </label>
                <div className="relative">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx"
                    onChange={(e) => setDocumentoResolucion(e.target.files?.[0] || null)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="w-full h-9 rounded border px-3 text-sm bg-white flex items-center justify-center cursor-pointer hover:bg-gray-50">
                    <span className="text-3xl">+</span>
                  </div>
                </div>
                {documentoResolucion && (
                  <p className="text-xs text-gray-600 mt-1">{documentoResolucion.name}</p>
                )}
              </div>

            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button
                type="button"
                onClick={() => {
                  setMostrarModalResolver(false);
                  setSolucionAplicada('');
                  setImporteResolucion('');
                  setImagenResolucion(null);
                  setDocumentoResolucion(null);
                }}
                className="px-4 py-2 text-sm rounded border hover:bg-gray-50 transition-colors"
                style={{ color: PALETA.textoOscuro, borderColor: '#d1d5db' }}
                disabled={enviando}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={resolverIncidencia}
                disabled={
                  !solucionAplicada?.trim() ||
                  enviando
                }
                className="px-6 py-2 text-sm text-white rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                style={{ backgroundColor: '#7A8A6F' }}
              >
                {enviando ? 'Resolviendo...' : 'Marcar como Resuelta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para valoración económica */}
      {mostrarModalValorarIncidencia && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div
            className="rounded-lg p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow"
            style={{ backgroundColor: PALETA.card }}
          >
            <h3 className="text-xl font-semibold mb-6" style={{ color: PALETA.textoOscuro }}>
              Valoración Económica
              {tieneOfertaAprobada && (
                <span className="text-sm block mt-1" style={{ color: PALETA.verdeClaro }}>
                  ✓ Incidencia con oferta aprobada
                </span>
              )}
            </h3>

            <div className="space-y-6">
              {/* Importe sin IVA - Obligatorio */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                  Importe sin IVA (€) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={importeSinIva}
                  onChange={(e) => {
                    const sinIva = parseFloat(e.target.value) || 0;
                    setImporteSinIva(e.target.value);
                    // Calcular automáticamente el IVA con el porcentaje seleccionado
                    const iva = parseFloat(porcentajeIva) || 0;
                    const multiplier = 1 + (iva / 100);
                    const conIva = (sinIva * multiplier).toFixed(2);
                    setImporteConIva(conIva);
                  }}
                  className="w-full h-9 rounded border px-3 text-sm outline-none"
                  onFocus={(e) => {
                    e.target.style.borderColor = PALETA.verdeClaro;
                    e.target.style.boxShadow = `0 0 0 2px ${PALETA.verdeClaro}40`;
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '';
                    e.target.style.boxShadow = '';
                  }}
                  placeholder="0.00"
                  required
                />
              </div>

              {/* Porcentaje de IVA */}
              <div className="relative">
                <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                  Porcentaje de IVA (%) *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={busquedaIva}
                    onChange={(e) => {
                      setBusquedaIva(e.target.value);
                      setMostrarOpcionesIva(true);
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = PALETA.verdeClaro;
                      e.target.style.boxShadow = `0 0 0 2px ${PALETA.verdeClaro}40`;
                      setMostrarOpcionesIva(true);
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '';
                      e.target.style.boxShadow = '';
                      // Delay para permitir click en opciones
                      setTimeout(() => setMostrarOpcionesIva(false), 200);
                    }}
                    className="w-full h-9 rounded border px-3 text-sm outline-none"
                    placeholder="Seleccionar porcentaje de IVA..."
                    required
                  />

                  {/* Dropdown de opciones */}
                  {mostrarOpcionesIva && opcionesFiltradas.length > 0 && (
                    <div
                      className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-md shadow-lg z-50 max-h-40 overflow-y-auto"
                      style={{ marginTop: '2px' }}
                    >
                      {opcionesFiltradas.map((opcion) => (
                        <div
                          key={opcion.valor}
                          className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                          onClick={() => {
                            setPorcentajeIva(opcion.valor);
                            setBusquedaIva(opcion.texto);
                            setMostrarOpcionesIva(false);

                            // Recalcular el importe con IVA
                            const sinIva = parseFloat(importeSinIva) || 0;
                            const iva = parseFloat(opcion.valor) || 0;
                            const multiplier = 1 + (iva / 100);
                            const conIva = (sinIva * multiplier).toFixed(2);
                            setImporteConIva(conIva);
                          }}
                        >
                          {opcion.texto}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Importe con IVA - Obligatorio y calculado automáticamente */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                  Importe con IVA (€) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={importeConIva}
                  onChange={(e) => setImporteConIva(e.target.value)}
                  className="w-full h-9 rounded border px-3 text-sm outline-none"
                  onFocus={(e) => {
                    e.target.style.borderColor = PALETA.verdeClaro;
                    e.target.style.boxShadow = `0 0 0 2px ${PALETA.verdeClaro}40`;
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '';
                    e.target.style.boxShadow = '';
                  }}
                  placeholder="0.00"
                  required
                />
                <p className="text-xs text-gray-600 mt-1">
                  Se calcula automáticamente al introducir el importe sin IVA y el porcentaje de IVA
                </p>
              </div>

              {/* Documento justificativo - Solo mostrar si es necesario */}
              {(() => {
                // Determinar si el importe ha cambiado respecto a la oferta aprobada
                const importeActual = parseFloat(importeSinIva) || 0;
                const importeOferta = presupuestoActual?.importe_total_sin_iva ? parseFloat(String(presupuestoActual.importe_total_sin_iva)) : 0;
                const importeHaCambiado = tieneOfertaAprobada && importeActual !== importeOferta;
                const mostrarCampo = !tieneOfertaAprobada || importeHaCambiado;

                // Si el importe coincide exactamente, no mostrar el campo
                if (tieneOfertaAprobada && !importeHaCambiado && importeActual > 0) {
                  return (
                    <div>
                      <p className="text-xs mt-1" style={{ color: PALETA.verdeClaro }}>
                        El importe coincide con la oferta aprobada (€{importeOferta}). No se requiere documento justificativo.
                      </p>
                    </div>
                  );
                }

                // Mostrar el campo solo cuando sea necesario
                if (!mostrarCampo) return null;

                return (
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                      Documento justificativo
                      <span className="text-red-500"> *</span>
                    </label>
                    <div className="relative">
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                        onChange={(e) => setDocumentoJustificativo(e.target.files?.[0] || null)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        required={true}
                      />
                      <div className="w-full h-9 rounded border px-3 text-sm bg-white flex items-center justify-center cursor-pointer hover:bg-gray-50">
                        <span className="text-3xl">+</span>
                      </div>
                    </div>
                    {documentoJustificativo && (
                      <p className="text-xs text-gray-600 mt-1">{documentoJustificativo.name}</p>
                    )}
                    {!tieneOfertaAprobada && (
                      <p className="text-xs text-red-600 mt-1">
                        Este documento es obligatorio para incidencias sin oferta previa aprobada
                      </p>
                    )}
                    {tieneOfertaAprobada && importeHaCambiado && (
                      <p className="text-xs mt-1" style={{ color: '#d97706' }}>
                        El importe ha cambiado respecto a la oferta aprobada (€{importeOferta}). Documento requerido.
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setMostrarModalValorarIncidencia(false);
                  setImporteSinIva('');
                  setImporteConIva('');
                  setDocumentoJustificativo(null);
                }}
                className="px-4 py-2 text-sm rounded border hover:bg-gray-50 transition-colors"
                style={{ color: PALETA.textoOscuro, borderColor: '#d1d5db' }}
                disabled={enviando}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={valoracionEconomica}
                disabled={(() => {
                  const importeActual = parseFloat(importeSinIva) || 0;
                  const importeOferta = presupuestoActual?.importe_total_sin_iva ? parseFloat(String(presupuestoActual.importe_total_sin_iva)) : 0;
                  const importeHaCambiado = tieneOfertaAprobada && importeActual !== importeOferta;
                  const importeCoincide = tieneOfertaAprobada && !importeHaCambiado && importeActual > 0;
                  const documentoRequerido = !tieneOfertaAprobada || importeHaCambiado;

                  // Si el importe coincide, no requiere documento
                  if (importeCoincide) {
                    return !importeSinIva || !importeConIva || enviando;
                  }

                  return !importeSinIva || !importeConIva || (documentoRequerido && !documentoJustificativo) || enviando;
                })()}
                className="px-6 py-2 text-sm text-white rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                style={{ backgroundColor: '#7A8A6F' }}
              >
                {enviando ? 'Valorando...' : 'Confirmar Valoración Económica'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para anular incidencia */}
      {mostrarModalAnular && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div
            className="rounded-lg p-8 max-w-md w-full mx-4 shadow"
            style={{ backgroundColor: PALETA.card }}
          >
            <h3 className="text-xl font-semibold mb-6" style={{ color: PALETA.textoOscuro }}>
              Anular Asignación de Proveedor
            </h3>

            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Esta acción anulará la asignación del proveedor actual. Posteriormente podrás asignar otro proveedor. Por favor, proporciona el motivo:
              </p>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                  Motivo de anulación *
                </label>
                <textarea
                  value={motivoAnulacion}
                  onChange={(e) => setMotivoAnulacion(e.target.value)}
                  className="w-full h-20 rounded border px-3 py-2 text-sm outline-none resize-none"
                  placeholder=""
                  onFocus={(e) => {
                    e.target.style.boxShadow = `0 0 0 2px ${PALETA.verdeClaro}80`;
                  }}
                  onBlur={(e) => {
                    e.target.style.boxShadow = '';
                  }}
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setMostrarModalAnular(false);
                  setMotivoAnulacion('');
                }}
                className="px-4 py-2 text-sm rounded border hover:bg-gray-50 transition-colors"
                style={{ color: PALETA.textoOscuro, borderColor: '#d1d5db' }}
                disabled={enviando}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={anularIncidencia}
                disabled={!motivoAnulacion.trim() || enviando}
                className="px-6 py-2 text-sm text-white rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                style={{ backgroundColor: PALETA.bg }}
              >
                {enviando ? 'Anulando...' : 'Anular Proveedor'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para cerrar incidencia */}
      {mostrarModalCerrar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div
            className="rounded-lg p-8 max-w-md w-full mx-4 shadow"
            style={{ backgroundColor: PALETA.card }}
          >
            <h3 className="text-xl font-semibold mb-6" style={{ color: PALETA.textoOscuro }}>
              Cerrar Incidencia
            </h3>

            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                La incidencia será marcada como cerrada. Los comentarios adicionales son opcionales:
              </p>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                  Comentarios (opcional)
                </label>
                <textarea
                  value={motivoCierre}
                  onChange={(e) => setMotivoCierre(e.target.value)}
                  className="w-full h-20 rounded border px-3 py-2 text-sm outline-none resize-none"
                  placeholder="Comentarios sobre el cierre de la incidencia..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setMostrarModalCerrar(false);
                  setMotivoCierre('');
                }}
                className="px-4 py-2 text-sm rounded border hover:bg-gray-50 transition-colors"
                style={{ color: PALETA.textoOscuro, borderColor: '#d1d5db' }}
                disabled={enviando}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={cerrarIncidencia}
                disabled={enviando}
                className="px-6 py-2 text-sm text-white rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                style={{ backgroundColor: PALETA.verdeClaro }}
              >
                {enviando ? 'Cerrando...' : 'Cerrar Incidencia'}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Modal para gestionar presupuesto */}
      {mostrarModalGestionPresupuesto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div
            className="rounded-lg shadow-lg border max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            style={{
              backgroundColor: PALETA.card,
              borderColor: PALETA.headerTable
            }}
          >
            {/* Header del modal */}
            <div
              className="px-6 py-4 border-b flex justify-between items-center"
              style={{
                backgroundColor: PALETA.headerTable,
                color: PALETA.textoOscuro
              }}
            >
              <h3 className="text-xl font-semibold">
                DETALLE DEL PRESUPUESTO #{incidencia?.num_solicitud}
              </h3>
              <button
                onClick={() => {
                  setMostrarModalGestionPresupuesto(false);
                  setPresupuestoActual(null);
                  setDocumentoPresupuestoUrl(null);
                }}
                className="text-2xl hover:opacity-70 transition-opacity"
                style={{ color: PALETA.textoOscuro }}
              >
                ×
              </button>
            </div>

            <div className="p-6">
              {cargandoPresupuesto ? (
                <div className="text-center py-8">
                  <p className="text-gray-600">Cargando presupuesto...</p>
                </div>
              ) : !presupuestoActual ? (
                <div className="text-center py-8">
                  <p className="text-red-600">No se encontró el presupuesto para esta incidencia.</p>
                </div>
              ) : (
                <>
                  {/* Grid de información */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Información del proveedor */}
                    <div
                      className="border rounded-lg p-4"
                      style={{ borderColor: PALETA.verdeSombra }}
                    >
                      <h4 className="font-semibold mb-4 text-center text-sm" style={{ color: PALETA.textoOscuro }}>
                        INFORMACIÓN DEL PROVEEDOR
                      </h4>
                      <table className="w-full text-xs">
                        <tbody>
                          <tr>
                            <td className="py-2 font-semibold" style={{ color: PALETA.textoOscuro }}>
                              Proveedor:
                            </td>
                            <td className="py-2" style={{ color: PALETA.textoOscuro }}>
                              {nombreProveedor || 'No especificado'}
                            </td>
                          </tr>
                          <tr style={{ backgroundColor: `${PALETA.headerTable}20` }}>
                            <td className="py-2 font-semibold" style={{ color: PALETA.textoOscuro }}>
                              Estado:
                            </td>
                            <td className="py-2">
                              <span
                                className="px-2 py-1 rounded text-xs font-medium text-white"
                                style={{ backgroundColor: PALETA.verdeClaro }}
                              >
                                Pendiente revisión
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Detalles financieros */}
                    <div
                      className="border rounded-lg p-4"
                      style={{ borderColor: PALETA.verdeSombra }}
                    >
                      <h4 className="font-semibold mb-4 text-center text-sm" style={{ color: PALETA.textoOscuro }}>
                        DETALLES
                      </h4>
                      <table className="w-full text-xs">
                        <tbody>
                          <tr>
                            <td className="py-2 font-semibold" style={{ color: PALETA.textoOscuro }}>
                              Importe sin IVA:
                            </td>
                            <td className="py-2 font-bold text-base" style={{ color: PALETA.bg }}>
                              {presupuestoActual.importe_total_sin_iva}€
                            </td>
                          </tr>
                          <tr style={{ backgroundColor: `${PALETA.headerTable}20` }}>
                            <td className="py-2 font-semibold" style={{ color: PALETA.textoOscuro }}>
                              Fecha estimada de inicio:
                            </td>
                            <td className="py-2" style={{ color: PALETA.textoOscuro }}>
                              {presupuestoActual.fecha_estimada_inicio ? new Date(presupuestoActual.fecha_estimada_inicio).toLocaleDateString('es-ES') : 'No especificada'}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-2 font-semibold" style={{ color: PALETA.textoOscuro }}>
                              Duración estimada:
                            </td>
                            <td className="py-2" style={{ color: PALETA.textoOscuro }}>
                              {presupuestoActual.duracion_estimada || 'No especificada'}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Descripción del trabajo */}
                  <div className="mb-6">
                    <div
                      className="border rounded-lg"
                      style={{ borderColor: PALETA.verdeSombra }}
                    >
                      <div
                        className="px-4 py-3 border-b"
                        style={{
                          backgroundColor: `${PALETA.headerTable}40`,
                          borderColor: PALETA.verdeSombra
                        }}
                      >
                        <h4 className="font-semibold text-sm" style={{ color: PALETA.textoOscuro }}>
                          DESCRIPCIÓN DEL TRABAJO
                        </h4>
                      </div>
                      <div className="p-4">
                        <p className="text-sm" style={{ color: PALETA.textoOscuro }}>
                          {presupuestoActual.descripcion_breve || 'No especificada'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Descripción de la incidencia */}
                  <div className="mb-6">
                    <div
                      className="border rounded-lg"
                      style={{ borderColor: PALETA.verdeSombra }}
                    >
                      <div
                        className="px-4 py-3 border-b"
                        style={{
                          backgroundColor: `${PALETA.headerTable}40`,
                          borderColor: PALETA.verdeSombra
                        }}
                      >
                        <h4 className="font-semibold text-sm" style={{ color: PALETA.textoOscuro }}>
                          DESCRIPCIÓN DE LA INCIDENCIA
                        </h4>
                      </div>
                      <div className="p-4">
                        <p className="text-sm" style={{ color: PALETA.textoOscuro }}>
                          {incidencia?.descripcion || 'No especificada'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Documento adjunto */}
                  {presupuestoActual.presupuesto_detallado_url && (
                    <div className="mb-6">
                      <div
                        className="border rounded-lg"
                        style={{ borderColor: PALETA.verdeSombra }}
                      >
                        <div
                          className="px-4 py-3 border-b"
                          style={{
                            backgroundColor: `${PALETA.headerTable}40`,
                            borderColor: PALETA.verdeSombra
                          }}
                        >
                          <h4 className="font-semibold text-sm" style={{ color: PALETA.textoOscuro }}>
                            DOCUMENTO ADJUNTO
                          </h4>
                        </div>
                        <div className="p-4">
                          {documentoPresupuestoUrl ? (
                            <a
                              href={documentoPresupuestoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-4 py-2 rounded border transition-colors text-sm"
                              style={{
                                borderColor: PALETA.verdeSombra,
                                color: PALETA.bg
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = PALETA.headerTable;
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                            >
                              📎 Visualizar detalle del presupuesto
                            </a>
                          ) : (
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded border text-sm" style={{
                              borderColor: '#d1d5db',
                              color: '#9ca3af'
                            }}>
                              📎 Cargando documento...
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Botones de acción */}
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => {
                        setMostrarModalGestionPresupuesto(false);
                        setPresupuestoActual(null);
                        setDocumentoPresupuestoUrl(null);
                      }}
                      className="px-4 py-2 text-sm rounded border hover:bg-gray-50 transition-colors"
                      style={{ color: PALETA.textoOscuro, borderColor: '#d1d5db' }}
                      disabled={enviando}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => setMostrarModalMotivoRevision(true)}
                      disabled={enviando}
                      className="px-6 py-2 text-sm text-white rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                      style={{ backgroundColor: '#d4a574' }}
                    >
                      Mandar a revisar
                    </button>
                    <button
                      onClick={aprobarPresupuesto}
                      disabled={enviando}
                      className="px-6 py-2 text-sm text-white rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                      style={{ backgroundColor: PALETA.verdeClaro }}
                    >
                      {enviando ? 'Procesando...' : 'Aprobar Presupuesto'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal para pedir motivo de revisión */}
      {mostrarModalMotivoRevision && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div
            className="rounded-lg p-6 max-w-md w-full shadow-lg"
            style={{ backgroundColor: PALETA.card }}
          >
            <h3 className="text-lg font-semibold mb-4" style={{ color: PALETA.textoOscuro }}>
              Motivo de Revisión
            </h3>

            <p className="text-sm text-gray-600 mb-4">
              Por favor, especifica el motivo por el cual este presupuesto requiere revisión:
            </p>

            <textarea
              value={motivoRevision}
              onChange={(e) => setMotivoRevision(e.target.value)}
              placeholder="Describe el motivo de la revisión..."
              className="w-full p-3 border border-gray-300 rounded-md resize-none"
              rows={4}
              style={{ fontSize: '14px' }}
            />

            <div className="flex gap-3 justify-end mt-6">
              <button
                type="button"
                onClick={() => {
                  setMostrarModalMotivoRevision(false);
                  setMotivoRevision('');
                }}
                className="px-4 py-2 text-sm rounded border hover:bg-gray-50 transition-colors"
                style={{ color: PALETA.textoOscuro, borderColor: '#d1d5db' }}
                disabled={enviando}
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={mandarARevisar}
                disabled={enviando || !motivoRevision.trim()}
                className="px-6 py-2 text-sm text-white rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                style={{ backgroundColor: '#d4a574' }}
              >
                {enviando ? 'Procesando...' : 'Enviar a Revisión'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}