"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

// Paleta de colores consistente
const PALETA = {
  fondo: "#5D6D52",
  headerTable: "#D9B6A9",
  card: "#F9FAF8",
  filtros: "#E8B5A8",
  texto: "#EDF0E9",
  textoOscuro: "#4b4b4b",
  verdeClaro: "#A9B88C", // Verde claro del dashboard para incidencias cerradas
  verdeSombra: "#7A8A6F", // Verde más claro que el fondo para sombra
};

type Adjunto = {
  id: string;
  tipo: string;
  nombre_archivo?: string | null;
  storage_key?: string | null;
};

type Comentario = {
  id: string;
  incidencia_id: string;
  ambito: 'cliente' | 'proveedor';
  proveedor_id?: string | null;
  autor_id?: string | null;
  autor_email?: string | null;
  autor_rol?: string | null;
  cuerpo?: string | null;
  creado_en: string;
  es_sistema?: boolean | null;
  dedupe_key?: string | null;
  adjuntos?: Adjunto[];
};

type Incidencia = {
  id: string;
  num_solicitud: string;
  descripcion: string;
  estado_cliente: string;
  estado_proveedor?: string;
  centro?: string;
  fecha?: string;
  hora?: string;
  imagen_url?: string;
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
  const [autorId, setAutorId] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [commentAttachmentUrls, setCommentAttachmentUrls] = useState<Record<string, string>>({});
  const [mostrarModalVisita, setMostrarModalVisita] = useState(false);
  const [fechaVisita, setFechaVisita] = useState('');
  const [horarioVisita, setHorarioVisita] = useState('mañana');
  const [mostrarModalPresupuesto, setMostrarModalPresupuesto] = useState(false);
  const [presupuesto, setPresupuesto] = useState('');
  const [descripcionPresupuesto, setDescripcionPresupuesto] = useState('');
  const [mostrarModalResolver, setMostrarModalResolver] = useState(false);
  const [solucionAplicada, setSolucionAplicada] = useState('');
  const [mostrarModalValorar, setMostrarModalValorar] = useState(false);
  const [valoracion, setValoracion] = useState('');
  const [comentariosValoracion, setComentariosValoracion] = useState('');

  const incidenciaId = params.id as string;

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

  // Cargar URLs de adjuntos de comentarios
  useEffect(() => {
    if (comentarios.length > 0) {
      const loadCommentAttachmentUrls = async () => {
        const urls: Record<string, string> = {};
        for (const comentario of comentarios) {
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
        }
        setCommentAttachmentUrls(urls);
      };
      loadCommentAttachmentUrls();
    }
  }, [comentarios]);

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
          instituciones(nombre)
        `)
        .eq("id", incidenciaId)
        .single();

      // Cargar estado_proveedor por separado
      let estadoProveedor = null;
      if (incidenciaData && personaInst?.institucion_id) {
        const { data: proveedorCaso } = await supabase
          .from("proveedor_casos")
          .select("estado_proveedor")
          .eq("incidencia_id", incidenciaId)
          .eq("proveedor_id", personaInst.institucion_id)
          .eq("activo", true)
          .maybeSingle();

        estadoProveedor = proveedorCaso?.estado_proveedor;
      }

      // Cargar adjuntos principales (imágenes de la incidencia)
      let adjuntosPrincipales = [];
      if (incidenciaData) {
        const { data: adjuntosData } = await supabase
          .from("adjuntos")
          .select("*")
          .eq("incidencia_id", incidenciaId)
          .eq("categoria", "imagen_principal");
        
        adjuntosPrincipales = adjuntosData || [];
      }

      if (incidenciaError) {
        console.error("Error cargando incidencia:", incidenciaError);
      } else {
        setIncidencia({
          ...incidenciaData,
          estado_proveedor: estadoProveedor,
          adjuntos_principales: adjuntosPrincipales
        });
      }

      // Cargar comentarios del chat proveedor con adjuntos de comentarios
      const { data: comentariosData, error: comentariosError } = await supabase
        .from("comentarios")
        .select(`
          *,
          adjuntos(id, tipo, nombre_archivo, storage_key, categoria)
        `)
        .eq("incidencia_id", incidenciaId)
        .eq("ambito", "proveedor")
        .not("cuerpo", "is", null)
        .order("creado_en", { ascending: true });

      if (comentariosError) {
        console.error("Error cargando comentarios:", comentariosError);
      } else {
        setComentarios(comentariosData || []);
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
      const ruta = `incidencias/${incidenciaId}/${tipo}/${nombreArchivo}`;
      
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
    if (!fechaVisita || !autorId) return;

    try {
      setEnviando(true);

      // Obtener datos del usuario actual
      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData.user?.email;

      // 1. Cambiar estado_proveedor a "En resolución"
      await supabase
        .from("proveedor_casos")
        .update({ estado_proveedor: "En resolución" })
        .eq("incidencia_id", incidenciaId)
        .eq("activo", true);

      // 2. Formatear fecha para los comentarios
      const fechaFormateada = new Date(fechaVisita).toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const horarioTexto = horarioVisita === 'mañana' ? 'horario de mañana' : 'horario de tarde';

      // 3. Comentario para el chat del proveedor
      await supabase
        .from("comentarios")
        .insert({
          incidencia_id: incidenciaId,
          ambito: 'proveedor',
          autor_id: autorId,
          autor_email: userEmail,
          autor_rol: 'Proveedor',
          cuerpo: `Visita calendarizada para el ${fechaFormateada} en ${horarioTexto}.`,
          es_sistema: true
        });

      // 4. Comentario para el chat del cliente
      await supabase
        .from("comentarios")
        .insert({
          incidencia_id: incidenciaId,
          ambito: 'cliente',
          autor_id: autorId,
          autor_email: userEmail,
          autor_rol: 'Proveedor',
          cuerpo: `El proveedor ha calendarizado una visita para el ${fechaFormateada} en ${horarioTexto}. Nos pondremos en contacto para coordinar los detalles.`,
          es_sistema: true
        });

      // 5. Cerrar modal y recargar datos
      setMostrarModalVisita(false);
      setFechaVisita('');
      setHorarioVisita('mañana');
      cargarDatos();

    } catch (error) {
      console.error("Error calendarizando visita:", error);
    } finally {
      setEnviando(false);
    }
  };

  const ofertarPresupuesto = async () => {
    if (!presupuesto || !descripcionPresupuesto || !autorId) return;

    try {
      setEnviando(true);

      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData.user?.email;

      // 1. Cambiar estado_proveedor a "Ofertada"
      await supabase
        .from("proveedor_casos")
        .update({ estado_proveedor: "Ofertada" })
        .eq("incidencia_id", incidenciaId)
        .eq("activo", true);

      // 2. Comentarios para ambos chats
      const mensajePresupuesto = `Presupuesto ofertado: ${presupuesto}€\nDescripción: ${descripcionPresupuesto}`;

      await supabase
        .from("comentarios")
        .insert([
          {
            incidencia_id: incidenciaId,
            ambito: 'proveedor',
            autor_id: autorId,
            autor_email: userEmail,
            autor_rol: 'Proveedor',
            cuerpo: mensajePresupuesto,
            es_sistema: true
          },
          {
            incidencia_id: incidenciaId,
            ambito: 'cliente',
            autor_id: autorId,
            autor_email: userEmail,
            autor_rol: 'Proveedor',
            cuerpo: `El proveedor ha enviado un presupuesto:\n${mensajePresupuesto}`,
            es_sistema: true
          }
        ]);

      setMostrarModalPresupuesto(false);
      setPresupuesto('');
      setDescripcionPresupuesto('');
      cargarDatos();

    } catch (error) {
      console.error("Error ofertando presupuesto:", error);
    } finally {
      setEnviando(false);
    }
  };

  const resolverIncidencia = async () => {
    if (!solucionAplicada || !autorId) return;

    try {
      setEnviando(true);

      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData.user?.email;

      // 1. Cambiar estado_proveedor a "Pendiente valoración"
      await supabase
        .from("proveedor_casos")
        .update({ estado_proveedor: "Pendiente valoración" })
        .eq("incidencia_id", incidenciaId)
        .eq("activo", true);

      // 2. Comentarios para ambos chats
      const mensajeSolucion = `Incidencia resuelta. Solución aplicada: ${solucionAplicada}`;

      await supabase
        .from("comentarios")
        .insert([
          {
            incidencia_id: incidenciaId,
            ambito: 'proveedor',
            autor_id: autorId,
            autor_email: userEmail,
            autor_rol: 'Proveedor',
            cuerpo: mensajeSolucion,
            es_sistema: true
          },
          {
            incidencia_id: incidenciaId,
            ambito: 'cliente',
            autor_id: autorId,
            autor_email: userEmail,
            autor_rol: 'Proveedor',
            cuerpo: `${mensajeSolucion}\n\nLa incidencia está pendiente de valoración por parte del cliente.`,
            es_sistema: true
          }
        ]);

      setMostrarModalResolver(false);
      setSolucionAplicada('');
      cargarDatos();

    } catch (error) {
      console.error("Error resolviendo incidencia:", error);
    } finally {
      setEnviando(false);
    }
  };

  const valorarIncidencia = async () => {
    if (!valoracion || !autorId) return;

    try {
      setEnviando(true);

      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData.user?.email;

      // 1. Cambiar estado_proveedor a "Valorada"
      await supabase
        .from("proveedor_casos")
        .update({ estado_proveedor: "Valorada" })
        .eq("incidencia_id", incidenciaId)
        .eq("activo", true);

      // 2. Comentarios para ambos chats
      const mensajeValoracion = `Valoración del proveedor: ${valoracion}/5${comentariosValoracion ? `\nComentarios: ${comentariosValoracion}` : ''}`;

      await supabase
        .from("comentarios")
        .insert([
          {
            incidencia_id: incidenciaId,
            ambito: 'proveedor',
            autor_id: autorId,
            autor_email: userEmail,
            autor_rol: 'Proveedor',
            cuerpo: mensajeValoracion,
            es_sistema: true
          },
          {
            incidencia_id: incidenciaId,
            ambito: 'cliente',
            autor_id: autorId,
            autor_email: userEmail,
            autor_rol: 'Proveedor',
            cuerpo: `El proveedor ha completado la valoración de la incidencia:\n${mensajeValoracion}`,
            es_sistema: true
          }
        ]);

      setMostrarModalValorar(false);
      setValoracion('');
      setComentariosValoracion('');
      cargarDatos();

    } catch (error) {
      console.error("Error valorando incidencia:", error);
    } finally {
      setEnviando(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: PALETA.fondo }}>
        <div className="text-white">Cargando...</div>
      </div>
    );
  }

  if (!incidencia) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: PALETA.fondo }}>
        <div className="text-white">No se encontró la incidencia</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: PALETA.fondo }}>
      {/* Header */}
      <div className="flex items-center justify-between p-6">
        <button
          onClick={() => router.back()}
          className="text-white text-sm hover:underline"
        >
          ← Volver a incidencias
        </button>

        <div className="text-white text-center">
          <h1 className="text-lg font-semibold tracking-wider">CHAT PROVEEDOR</h1>
          <p className="text-sm opacity-80">#{incidencia.num_solicitud}</p>
        </div>

        <div></div>
      </div>

      {/* Información de la incidencia - estilo mejorado */}
      <div className="px-6 pb-4">
        <div 
          className="rounded-lg p-6 shadow-lg"
          style={{ 
            backgroundColor: PALETA.verdeClaro,
            boxShadow: `0 4px 6px -1px ${PALETA.verdeSombra}40, 0 2px 4px -1px ${PALETA.verdeSombra}20`
          }}
        >
          <h2 className="text-lg font-semibold mb-6" style={{ color: PALETA.fondo }}>DATOS INCIDENCIA</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-sm">
            {/* Primera columna */}
            <div className="space-y-4">
              <div>
                <div className="font-semibold mb-1" style={{ color: PALETA.fondo }}>Número solicitud:</div>
                <div style={{ color: PALETA.textoOscuro }}>{incidencia.num_solicitud}</div>
              </div>
              
              <div>
                <div className="font-semibold mb-1" style={{ color: PALETA.fondo }}>Centro:</div>
                <div style={{ color: PALETA.textoOscuro }}>
                  {incidencia.instituciones?.[0]?.nombre || incidencia.centro || "-"}
                </div>
              </div>
            </div>

            {/* Segunda columna */}
            <div className="space-y-4">
              <div>
                <div className="font-semibold mb-1" style={{ color: PALETA.fondo }}>Fecha:</div>
                <div style={{ color: PALETA.textoOscuro }}>
                  {incidencia.fecha && incidencia.hora 
                    ? new Date(incidencia.fecha + 'T' + incidencia.hora).toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : "-"
                  }
                </div>
              </div>
              
              <div>
                <div className="font-semibold mb-1" style={{ color: PALETA.fondo }}>Estado:</div>
                <div style={{ color: PALETA.textoOscuro }}>{incidencia.estado_proveedor || incidencia.estado_cliente}</div>
              </div>
            </div>

            {/* Tercera columna - Descripción e Imagen */}
            <div className="space-y-4">
              <div>
                <div className="font-semibold mb-1" style={{ color: PALETA.fondo }}>Descripción:</div>
                <div style={{ color: PALETA.textoOscuro }} className="text-sm leading-relaxed">
                  {incidencia.descripcion}
                </div>
              </div>
              
              {/* Solo mostrar imágenes si existen */}
              {incidencia.adjuntos_principales && incidencia.adjuntos_principales.length > 0 && (
                <div>
                  <div className="font-semibold mb-2" style={{ color: PALETA.fondo }}>Imágenes:</div>
                  <div className="flex flex-wrap gap-2">
                    {incidencia.adjuntos_principales.map((adjunto) => {
                      const imageUrl = imageUrls[adjunto.id];
                      return imageUrl ? (
                        <div key={adjunto.id} className="cursor-pointer" onClick={() => window.open(imageUrl, '_blank')}>
                          <img 
                            src={imageUrl}
                            alt={adjunto.nombre_archivo || "Imagen de la incidencia"}
                            className="w-24 h-24 object-cover rounded border-2 border-green-600 hover:scale-105 transition-transform duration-200"
                            style={{ borderColor: PALETA.fondo }}
                          />
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sección de seguimiento */}
      <div className="px-6 mb-6">
        <h2 className="text-white text-center text-lg font-semibold mb-4 tracking-wider">SEGUIMIENTO</h2>
      </div>

      {/* Chat */}
      <div className="px-6 pb-6">
        <div className="bg-white rounded-lg shadow-sm flex flex-col h-[500px]">
          {/* Comentarios */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3">
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
                        color: PALETA.fondo 
                      }}>
                        {`${comentario.autor_email} (${comentario.autor_rol})`}
                      </div>
                    )}
                    <div className="text-sm">{comentario.cuerpo}</div>
                    
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
                                    className="max-w-sm rounded border cursor-pointer"
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

          {/* Formulario de envío */}
          <form onSubmit={enviarComentario} className="border-t p-4 space-y-4">
            <textarea
              value={nuevoComentario}
              onChange={(e) => setNuevoComentario(e.target.value)}
              placeholder="Escribe tu comentario..."
              className="w-full h-20 p-3 border border-gray-300 rounded focus:outline-none resize-none text-sm"
              disabled={enviando}
            />
            
            {/* Preview de archivos seleccionados */}
            {(imagenSeleccionada || documentoSeleccionado) && (
              <div className="flex gap-2 flex-wrap">
                {imagenSeleccionada && (
                  <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded border">
                    <span className="text-blue-600">🖼️ {imagenSeleccionada.name}</span>
                    <button
                      type="button"
                      onClick={() => setImagenSeleccionada(null)}
                      className="text-red-500 hover:text-red-700 text-sm font-bold"
                    >
                      ✕
                    </button>
                  </div>
                )}
                {documentoSeleccionado && (
                  <div className="flex items-center gap-2 bg-green-50 px-3 py-2 rounded border">
                    <span className="text-green-600">📎 {documentoSeleccionado.name}</span>
                    <button
                      type="button"
                      onClick={() => setDocumentoSeleccionado(null)}
                      className="text-red-500 hover:text-red-700 text-sm font-bold"
                    >
                      ✕
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
                  className="inline-flex items-center gap-2 px-3 py-1 border border-gray-400 rounded cursor-pointer transition-colors text-gray-600"
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
                  className="inline-flex items-center gap-2 px-3 py-1 border border-gray-400 rounded cursor-pointer transition-colors text-gray-600"
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
              
              {tipoUsuario === 'Proveedor' && (
                <>
                  <button
                    type="button"
                    onClick={() => setMostrarModalVisita(true)}
                    className="px-4 py-2 text-white rounded hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: PALETA.verdeClaro }}
                  >
                    📅 Calendarizar Visita
                  </button>

                  <button
                    type="button"
                    onClick={() => setMostrarModalPresupuesto(true)}
                    className="px-4 py-2 text-white rounded hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: PALETA.filtros }}
                  >
                    💰 Ofertar Presupuesto
                  </button>

                  <button
                    type="button"
                    onClick={() => setMostrarModalResolver(true)}
                    className="px-4 py-2 text-white rounded hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: PALETA.headerTable }}
                  >
                    ✅ Resolver Incidencia
                  </button>

                  <button
                    type="button"
                    onClick={() => setMostrarModalValorar(true)}
                    className="px-4 py-2 text-white rounded hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: PALETA.fondo }}
                  >
                    ⭐ Valorar
                  </button>
                </>
              )}

              <button
                type="submit"
                disabled={!nuevoComentario.trim() || enviando}
                className="px-4 py-2 text-white rounded disabled:opacity-50 hover:opacity-90 transition-opacity ml-auto"
                style={{ backgroundColor: PALETA.fondo }}
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
                  className="w-full h-9 rounded border px-3 text-sm outline-none focus:ring-2 focus:ring-green-300"
                  required
                />
              </div>

              {/* Horario */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                  Horario
                </label>
                <select
                  value={horarioVisita}
                  onChange={(e) => setHorarioVisita(e.target.value)}
                  className="w-full h-9 rounded border px-3 text-sm outline-none focus:ring-2 focus:ring-green-300"
                >
                  <option value="mañana">Horario de mañana</option>
                  <option value="tarde">Horario de tarde</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button
                type="button"
                onClick={() => {
                  setMostrarModalVisita(false);
                  setFechaVisita('');
                  setHorarioVisita('mañana');
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
                disabled={!fechaVisita || enviando}
                className="px-6 py-2 text-sm text-white rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                style={{
                  backgroundColor: PALETA.verdeClaro,
                  opacity: (!fechaVisita || enviando) ? 0.5 : 1
                }}
              >
                {enviando ? 'Calendarizando...' : 'Calendarizar Visita'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para ofertar presupuesto */}
      {mostrarModalPresupuesto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div
            className="rounded-lg p-8 max-w-md w-full mx-4 shadow"
            style={{ backgroundColor: PALETA.card }}
          >
            <h3 className="text-xl font-semibold mb-6" style={{ color: PALETA.textoOscuro }}>
              Ofertar Presupuesto
            </h3>

            <div className="space-y-6">
              {/* Presupuesto */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                  Importe del presupuesto (€) *
                </label>
                <input
                  type="number"
                  value={presupuesto}
                  onChange={(e) => setPresupuesto(e.target.value)}
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full h-9 rounded border px-3 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                  required
                />
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                  Descripción del presupuesto *
                </label>
                <textarea
                  value={descripcionPresupuesto}
                  onChange={(e) => setDescripcionPresupuesto(e.target.value)}
                  placeholder="Describe los trabajos y materiales incluidos..."
                  className="min-h-[80px] w-full rounded border p-3 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button
                type="button"
                onClick={() => {
                  setMostrarModalPresupuesto(false);
                  setPresupuesto('');
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
                disabled={!presupuesto || !descripcionPresupuesto || enviando}
                className="px-6 py-2 text-sm text-white rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                style={{
                  backgroundColor: PALETA.filtros,
                  opacity: (!presupuesto || !descripcionPresupuesto || enviando) ? 0.5 : 1
                }}
              >
                {enviando ? 'Enviando...' : 'Enviar Presupuesto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para resolver incidencia */}
      {mostrarModalResolver && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div
            className="rounded-lg p-8 max-w-md w-full mx-4 shadow"
            style={{ backgroundColor: PALETA.card }}
          >
            <h3 className="text-xl font-semibold mb-6" style={{ color: PALETA.textoOscuro }}>
              Resolver Incidencia
            </h3>

            <div className="space-y-6">
              {/* Solución aplicada */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                  Describe la solución aplicada *
                </label>
                <textarea
                  value={solucionAplicada}
                  onChange={(e) => setSolucionAplicada(e.target.value)}
                  placeholder="Explica detalladamente qué se ha hecho para resolver la incidencia..."
                  className="min-h-[120px] w-full rounded border p-3 text-sm outline-none focus:ring-2 focus:ring-green-300"
                  required
                />
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                <p className="text-sm text-yellow-800">
                  <strong>Nota:</strong> Al marcar como resuelta, la incidencia quedará pendiente de valoración por parte del cliente.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button
                type="button"
                onClick={() => {
                  setMostrarModalResolver(false);
                  setSolucionAplicada('');
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
                disabled={!solucionAplicada || enviando}
                className="px-6 py-2 text-sm text-white rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                style={{
                  backgroundColor: PALETA.headerTable,
                  opacity: (!solucionAplicada || enviando) ? 0.5 : 1
                }}
              >
                {enviando ? 'Resolviendo...' : 'Marcar como Resuelta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para valorar incidencia */}
      {mostrarModalValorar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div
            className="rounded-lg p-8 max-w-md w-full mx-4 shadow"
            style={{ backgroundColor: PALETA.card }}
          >
            <h3 className="text-xl font-semibold mb-6" style={{ color: PALETA.textoOscuro }}>
              Valorar Incidencia
            </h3>

            <div className="space-y-6">
              {/* Valoración */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                  Valoración (1-5 estrellas) *
                </label>
                <select
                  value={valoracion}
                  onChange={(e) => setValoracion(e.target.value)}
                  className="w-full h-9 rounded border px-3 text-sm outline-none focus:ring-2 focus:ring-yellow-300"
                  required
                >
                  <option value="">Selecciona una valoración...</option>
                  <option value="1">⭐ 1 - Muy insatisfecho</option>
                  <option value="2">⭐⭐ 2 - Insatisfecho</option>
                  <option value="3">⭐⭐⭐ 3 - Neutral</option>
                  <option value="4">⭐⭐⭐⭐ 4 - Satisfecho</option>
                  <option value="5">⭐⭐⭐⭐⭐ 5 - Muy satisfecho</option>
                </select>
              </div>

              {/* Comentarios adicionales */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                  Comentarios adicionales (opcional)
                </label>
                <textarea
                  value={comentariosValoracion}
                  onChange={(e) => setComentariosValoracion(e.target.value)}
                  placeholder="Añade cualquier comentario sobre el servicio recibido..."
                  className="min-h-[80px] w-full rounded border p-3 text-sm outline-none focus:ring-2 focus:ring-yellow-300"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button
                type="button"
                onClick={() => {
                  setMostrarModalValorar(false);
                  setValoracion('');
                  setComentariosValoracion('');
                }}
                className="px-4 py-2 text-sm rounded border hover:bg-gray-50 transition-colors"
                style={{ color: PALETA.textoOscuro, borderColor: '#d1d5db' }}
                disabled={enviando}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={valorarIncidencia}
                disabled={!valoracion || enviando}
                className="px-6 py-2 text-sm text-white rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                style={{
                  backgroundColor: PALETA.fondo,
                  opacity: (!valoracion || enviando) ? 0.5 : 1
                }}
              >
                {enviando ? 'Enviando...' : 'Enviar Valoración'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}