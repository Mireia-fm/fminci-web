"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { registrarCambioEstado } from "@/lib/historialEstados";
import ModalAsignarProveedor from "@/components/ModalAsignarProveedor";
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
  centro?: string;
  fecha?: string;
  hora?: string;
  imagen_url?: string;
  catalogacion?: string | null;
  prioridad?: string | null;
  prioridad_proveedor?: string;
  instituciones?: {
    nombre: string;
  }[] | null;
  adjuntos_principales?: Adjunto[];
  proveedor_casos?: {
    estado_proveedor: string;
    prioridad?: string;
    activo?: boolean;
  }[] | null;
};

export default function ChatControlCliente() {
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
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [commentAttachmentUrls, setCommentAttachmentUrls] = useState<Record<string, string>>({});
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [tieneProveedorAsignado, setTieneProveedorAsignado] = useState(false);
  const [tieneProveedorAnulado, setTieneProveedorAnulado] = useState(false);
  const [mostrarModalProveedor, setMostrarModalProveedor] = useState(false);
  const [mostrarModalAnular, setMostrarModalAnular] = useState(false);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');
  const [mostrarModalEspera, setMostrarModalEspera] = useState(false);
  const [motivoEspera, setMotivoEspera] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const incidenciaId = params.id as string;

  // Función para hacer scroll al último mensaje
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    cargarDatos();
  }, [incidenciaId]);

  // Marcar como no inicial después de la primera carga
  useEffect(() => {
    if (isInitialLoad) {
      setIsInitialLoad(false);
    }
  }, [comentarios, isInitialLoad]);

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

  // Cargar URLs de adjuntos de comentarios (desde campos imagen_url y documento_url)
  useEffect(() => {
    if (comentarios.length > 0) {
      const loadCommentAttachmentUrls = async () => {
        const urls: Record<string, string> = {};
        for (const comentario of comentarios) {
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
          // Mantener compatibilidad con adjuntos legacy
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
        setCurrentUserEmail(userEmail);
      }

      // Cargar incidencia con adjuntos principales y proveedor_casos
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
          prioridad,
          instituciones(nombre),
          proveedor_casos(estado_proveedor, prioridad, activo)
        `)
        .eq("id", incidenciaId)
        .single();

      // La prioridad ya viene en incidenciaData
      const prioridad = incidenciaData?.prioridad || null;

      // Cargar adjuntos principales (imágenes de la incidencia)
      let adjuntosPrincipales = [];
      if (incidenciaData) {
        const { data: adjuntosData } = await supabase
          .from("adjuntos")
          .select("*")
          .eq("incidencia_id", incidenciaId)
          .eq("categoria", "imagen_principal");

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
        const incidenciaCompleta = {
          ...incidenciaData,
          adjuntos_principales: adjuntosPrincipales,
          prioridad: prioridad
        };
        setIncidencia(incidenciaCompleta);

        // Verificar si tiene proveedor asignado (solo activos)
        const tieneProveedor = incidenciaCompleta?.proveedor_casos &&
                              incidenciaCompleta.proveedor_casos.length > 0 &&
                              incidenciaCompleta.proveedor_casos.some(pc =>
                                pc.activo &&
                                pc.estado_proveedor &&
                                pc.estado_proveedor !== 'Anulada'
                              );
        setTieneProveedorAsignado(!!tieneProveedor);

        // Verificar si hay proveedores anulados (para mostrar botón reasignar)
        const tieneProveedorAnuladoDetectado = incidenciaCompleta?.proveedor_casos &&
                                             incidenciaCompleta.proveedor_casos.length > 0 &&
                                             incidenciaCompleta.proveedor_casos.some(pc =>
                                               !pc.activo &&
                                               pc.estado_proveedor === 'Anulada'
                                             );
        setTieneProveedorAnulado(!!tieneProveedorAnuladoDetectado);
      }

      // Cargar comentarios del chat control/cliente con campos de archivos
      const { data: comentariosData, error: comentariosError } = await supabase
        .from("comentarios")
        .select("*")
        .eq("incidencia_id", incidenciaId)
        .in("ambito", ["cliente", "ambos"])
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
    if (!nuevoComentario.trim() || enviando || !tipoUsuario || !autorId) return;

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

      // Crear el comentario con archivos adjuntos
      const { data: comentarioData, error } = await supabase
        .from("comentarios")
        .insert({
          incidencia_id: incidenciaId,
          ambito: 'cliente',
          autor_id: autorId,
          autor_email: userEmail,
          autor_rol: tipoUsuario,
          cuerpo: nuevoComentario.trim(),
          imagen_url: imagenUrl || null,
          documento_url: documentoUrl || null,
        })
        .select()
        .single();

      if (error) {
        console.error("Error enviando comentario:", {
          error: error,
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        return;
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
      case 'cliente':
        return "#E8D36A";
      case 'control':
        return "#A9B88C";
      case 'gestor':
        return "#8F9B83";
      default:
        return PALETA.headerTable;
    }
  };

  const getSignedImageUrl = async (storageKey: string | null | undefined) => {
    if (!storageKey) return null;

    try {
      let cleanPath = storageKey;

      console.log('Original storage_key:', storageKey);
      
      // Extract storage path from full URLs (backward compatibility)
      if (storageKey.startsWith('https://')) {
        if (storageKey.includes('/storage/v1/object/public/incidencias/')) {
          const parts = storageKey.split('/storage/v1/object/public/incidencias/');
          if (parts.length > 1) {
            cleanPath = parts[1];
            console.log('Extracted path from URL:', cleanPath);
          }
        }
      } else {
        console.log('Using relative path:', cleanPath);
      }
      
      console.log('Attempting to create signed URL for path:', cleanPath);

      // Extract filename from path for potential fallback searches
      const filename = cleanPath.split('/').pop() || cleanPath;
      console.log('Extracted filename:', filename);

      // Create signed URL for private access (expires in 4 hours)
      const { data, error } = await supabase.storage
        .from('incidencias')
        .createSignedUrl(cleanPath, 14400);

      if (error) {
        console.error('Error creating signed URL for path:', cleanPath, error);

        // If direct path fails, try to find the file by listing bucket contents
        console.log('Direct path failed, searching for file:', filename);
        
        try {
          // Extract incidencia number from path for targeted search
          const incidenciaNum = cleanPath.split('/')[1] || incidencia?.num_solicitud;
          console.log('Starting targeted file search for incidencia:', incidenciaNum);

          if (incidenciaNum) {
            // Search in the specific incidencia folder and its subfolders
            const searchPaths = [
              `incidencias/${incidenciaNum}`,
              `incidencias/${incidenciaNum}/imagenes`,
              `incidencias/${incidenciaNum}/comentarios`,
              `incidencias/${incidenciaNum}/presupuestos`
            ];

            let foundFile = null;

            for (const searchPath of searchPaths) {
              const { data: files, error: listError } = await supabase.storage
                .from('incidencias')
                .list(searchPath);

              if (!listError && files) {
                foundFile = files.find(file =>
                  file.name === filename ||
                  file.name.includes(filename) ||
                  file.name.endsWith(filename.split('_').pop() || filename)
                );

                if (foundFile) {
                  console.log(`Found file in ${searchPath}:`, foundFile.name);
                  const correctedPath = `${searchPath}/${foundFile.name}`;

                  // Try creating signed URL with corrected path
                  const { data: correctedData, error: correctedError } = await supabase.storage
                    .from('incidencias')
                    .createSignedUrl(correctedPath, 14400);

                  if (correctedData && !correctedError) {
                    console.log('Successfully created signed URL with corrected path:', correctedPath);
                    return correctedData.signedUrl;
                  }
                  break;
                }
              }
            }

            if (!foundFile) {
              console.log('File not found in any incidencia subfolder');
              return null;
            }
          }

          // Fallback to original broad search if no incidencia number
          console.log('Fallback: Starting broad file search...');
          const { data: files, error: listError } = await supabase.storage
            .from('incidencias')
            .list('');
            
          if (listError) {
            console.error('Error listing files:', listError);
            return null;
          }
          
          console.log('Total files found in bucket:', files?.length || 0);
          console.log('First 5 files:', files?.slice(0, 5));
          
          // Look for files with matching filename (exact match)
          let matchingFile = files?.find(file => file.name === filename);
          
          if (!matchingFile) {
            // Try partial match with the filename
            console.log('Exact match not found, trying partial match...');
            matchingFile = files?.find(file => file.name.includes(filename));
          }
          
          if (!matchingFile) {
            // Try to find files that end with the same filename
            console.log('Partial match not found, trying suffix match...');
            const filenameParts = filename.split('_');
            if (filenameParts.length > 1) {
              const lastPart = filenameParts[filenameParts.length - 1];
              matchingFile = files?.find(file => file.name.endsWith(lastPart));
            }
          }
          
          if (matchingFile) {
            console.log('Found matching file:', matchingFile);
            
            // Try to build the full path - files from recursive listing need special handling
            let actualPath = matchingFile.name;
            
            // If the file has a path, we might need to reconstruct it
            if (matchingFile.id && files) {
              // For files in subdirectories, we need to find the full path
              const allFiles = files.filter(f => f.name.includes(filename) || f.name.endsWith(filename));
              console.log('All potential matching files:', allFiles);
              
              if (allFiles.length > 0) {
                actualPath = allFiles[0].name;
              }
            }
            
            console.log('Attempting signed URL with path:', actualPath);
            
            const { data: signedData, error: signedError } = await supabase.storage
              .from('incidencias')
              .createSignedUrl(actualPath, 14400);
              
            if (!signedError && signedData) {
              console.log('Successfully created signed URL with actual path');
              return signedData.signedUrl;
            } else {
              console.error('Error creating signed URL with actual path:', signedError);
            }
          } else {
            console.log('File not found in bucket listing with any matching strategy');
            console.log('Searched filename:', filename);
          }
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

  const abrirModalProveedor = () => {
    setMostrarModalProveedor(true);
  };

  const cerrarModalProveedor = () => {
    setMostrarModalProveedor(false);
  };

  const asignarProveedorCompleto = async (formularioProveedor: {
    proveedor_id: string;
    descripcion_proveedor: string;
    prioridad: string;
    estado_proveedor: string;
    imagenes_excluidas?: string[];
    documentos_incluidos?: string[];
  }) => {
    if (!formularioProveedor.proveedor_id) return;

    try {
      setEnviando(true);

      // Obtener datos del usuario actual
      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData.user?.email;
      let asignadoPorId = null;

      if (userEmail) {
        const { data: persona } = await supabase
          .from("personas")
          .select("id")
          .eq("email", userEmail)
          .maybeSingle();
        asignadoPorId = persona?.id;
      }

      // Obtener estado anterior del cliente
      const { data: incidenciaActual } = await supabase
        .from("incidencias")
        .select("estado_cliente")
        .eq("id", incidenciaId)
        .single();

      const estadoClienteAnterior = incidenciaActual?.estado_cliente || null;

      // Verificar si ya existe un caso activo
      const { data: casoExistente } = await supabase
        .from("proveedor_casos")
        .select("id")
        .eq("incidencia_id", incidenciaId)
        .eq("activo", true)
        .maybeSingle();

      if (casoExistente) {
        // Actualizar caso existente
        const { error } = await supabase
          .from("proveedor_casos")
          .update({
            proveedor_id: formularioProveedor.proveedor_id,
            descripcion_proveedor: formularioProveedor.descripcion_proveedor,
            prioridad: formularioProveedor.prioridad,
            estado_proveedor: formularioProveedor.estado_proveedor,
            asignado_por: asignadoPorId,
            asignado_en: new Date().toISOString(),
            actualizado_en: new Date().toISOString()
          })
          .eq("id", casoExistente.id);

        if (error) throw error;
      } else {
        // Crear nuevo caso
        const { error } = await supabase
          .from("proveedor_casos")
          .insert({
            incidencia_id: incidenciaId,
            proveedor_id: formularioProveedor.proveedor_id,
            descripcion_proveedor: formularioProveedor.descripcion_proveedor,
            prioridad: formularioProveedor.prioridad,
            estado_proveedor: formularioProveedor.estado_proveedor,
            asignado_por: asignadoPorId,
            asignado_en: new Date().toISOString(),
            activo: true
          });

        if (error) throw error;
      }

      // Cambiar estado de la incidencia a "En tramitación"
      await supabase
        .from("incidencias")
        .update({ estado_cliente: "En tramitación" })
        .eq("id", incidenciaId);

      // Registrar cambios de estado en el historial
      await registrarCambioEstado({
        incidenciaId,
        tipoEstado: 'cliente',
        estadoAnterior: estadoClienteAnterior,
        estadoNuevo: 'En tramitación',
        autorId: asignadoPorId,
        motivo: 'Proveedor asignado',
        metadatos: {
          accion: casoExistente ? 'reasignar_proveedor' : 'asignar_proveedor',
          proveedor_id: formularioProveedor.proveedor_id
        }
      });

      await registrarCambioEstado({
        incidenciaId,
        tipoEstado: 'proveedor',
        estadoAnterior: null,
        estadoNuevo: formularioProveedor.estado_proveedor,
        autorId: asignadoPorId,
        motivo: casoExistente ? 'Proveedor reasignado' : 'Proveedor asignado',
        metadatos: {
          accion: casoExistente ? 'reasignar_proveedor' : 'asignar_proveedor',
          proveedor_id: formularioProveedor.proveedor_id,
          prioridad: formularioProveedor.prioridad
        }
      });

      // Procesar imágenes excluidas (marcarlas como ocultas para el proveedor)
      if (formularioProveedor.imagenes_excluidas && formularioProveedor.imagenes_excluidas.length > 0) {
        for (const imagenId of formularioProveedor.imagenes_excluidas) {
          await supabase
            .from("adjuntos")
            .update({ visible_proveedor: false })
            .eq("id", imagenId);
        }
      }

      // Procesar documentos incluidos (copiarlos al chat del nuevo proveedor)
      if (formularioProveedor.documentos_incluidos && formularioProveedor.documentos_incluidos.length > 0) {
        for (const docId of formularioProveedor.documentos_incluidos) {
          // Obtener el adjunto original
          const { data: adjunto } = await supabase
            .from("adjuntos")
            .select("storage_key, nombre_archivo, comentario_id")
            .eq("id", docId)
            .single();

          if (adjunto) {
            // Crear comentario del sistema con el documento
            const { data: comentario, error: comentarioError } = await supabase
              .from("comentarios")
              .insert({
                incidencia_id: incidenciaId,
                ambito: 'proveedor',
                autor_id: asignadoPorId,
                autor_email: userEmail,
                autor_rol: 'Control',
                cuerpo: `Documento del proveedor anterior incluido por Control.`,
                es_sistema: true
              })
              .select()
              .single();

            if (comentario && !comentarioError) {
              // Asociar el adjunto existente al nuevo comentario
              await supabase
                .from("adjuntos")
                .insert({
                  incidencia_id: incidenciaId,
                  comentario_id: comentario.id,
                  storage_key: adjunto.storage_key,
                  nombre_archivo: adjunto.nombre_archivo,
                  tipo: 'documento'
                });
            }
          }
        }
      }

      // Obtener nombre del proveedor para el comentario
      const { data: proveedor } = await supabase
        .from("instituciones")
        .select("nombre")
        .eq("id", formularioProveedor.proveedor_id)
        .single();

      if (proveedor) {
        await supabase
          .from("comentarios")
          .insert({
            incidencia_id: incidenciaId,
            ambito: 'cliente',
            autor_id: asignadoPorId,
            autor_email: userEmail,
            autor_rol: 'Control',
            cuerpo: `La incidencia ha sido asignada al proveedor ${proveedor.nombre}.`,
            es_sistema: true
          });
      }

      cerrarModalProveedor();
      cargarDatos(); // Recargar datos
    } catch (error) {
      console.error("Error asignando proveedor:", error);
    } finally {
      setEnviando(false);
    }
  };

  const anularIncidencia = async () => {
    if (!motivoAnulacion.trim() || !autorId) return;

    try {
      setEnviando(true);

      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData.user?.email;

      // 0. Obtener estado anterior
      const { data: incidenciaActual } = await supabase
        .from("incidencias")
        .select("estado_cliente")
        .eq("id", incidenciaId)
        .single();

      const estadoAnterior = incidenciaActual?.estado_cliente || null;

      // 1. Cambiar estado_cliente a "Anulada"
      await supabase
        .from("incidencias")
        .update({ estado_cliente: "Anulada" })
        .eq("id", incidenciaId);

      // 1.1. Registrar cambio de estado
      await registrarCambioEstado({
        incidenciaId,
        tipoEstado: 'cliente',
        estadoAnterior,
        estadoNuevo: 'Anulada',
        autorId,
        motivo: motivoAnulacion,
        metadatos: {
          accion: 'anular_incidencia'
        }
      });

      // 2. Comentario en el chat del cliente
      const mensajeAnulacion = `Incidencia anulada por Control. Motivo: ${motivoAnulacion}`;

      await supabase
        .from("comentarios")
        .insert({
          incidencia_id: incidenciaId,
          ambito: 'cliente',
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
    } finally {
      setEnviando(false);
    }
  };

  const ponerEnEspera = async () => {
    if (!motivoEspera.trim() || !autorId) return;

    try {
      setEnviando(true);

      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData.user?.email;

      // 0. Obtener estado anterior
      const { data: incidenciaActual } = await supabase
        .from("incidencias")
        .select("estado_cliente")
        .eq("id", incidenciaId)
        .single();

      const estadoAnterior = incidenciaActual?.estado_cliente || null;

      // 1. Cambiar estado_cliente a "En espera"
      await supabase
        .from("incidencias")
        .update({ estado_cliente: "En espera" })
        .eq("id", incidenciaId);

      // 1.1. Registrar cambio de estado
      await registrarCambioEstado({
        incidenciaId,
        tipoEstado: 'cliente',
        estadoAnterior,
        estadoNuevo: 'En espera',
        autorId,
        motivo: motivoEspera,
        metadatos: {
          accion: 'poner_en_espera'
        }
      });

      // 2. Comentario en el chat del cliente
      const mensajeEspera = `Incidencia puesta en espera por Control. Motivo: ${motivoEspera}`;

      await supabase
        .from("comentarios")
        .insert({
          incidencia_id: incidenciaId,
          ambito: 'cliente',
          autor_id: autorId,
          autor_email: userEmail,
          autor_rol: 'Control',
          cuerpo: mensajeEspera,
          es_sistema: true
        });

      setMostrarModalEspera(false);
      setMotivoEspera('');
      cargarDatos();

    } catch (error) {
      console.error("Error poniendo incidencia en espera:", error);
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

  return (
    <div className="min-h-screen" style={{ backgroundColor: PALETA.bg }}>
      {/* Header con logo */}
      <div className="flex justify-between items-center p-6 relative">
        <button
          onClick={() => router.push("/incidencias")}
          className="text-white text-sm hover:underline"
        >
          ← Volver a incidencias
        </button>

        <div></div>

        <div></div>
      </div>

      {/* Sección de datos de incidencia - estilo más compacto y organizado */}
      <div className="px-6 pb-6">
        <div
          className="rounded-lg mb-6 shadow-lg"
          style={{
            backgroundColor: PALETA.card
          }}
        >
          <div
            className="px-6 py-4 border-b rounded-t-lg"
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
              <div className={`grid grid-cols-1 ${hasImages ? 'lg:grid-cols-3' : ''} gap-6 p-6`}>
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
                          {incidencia.instituciones?.[0]?.nombre || incidencia.centro || "-"}
                        </td>
                      </tr>

                      <tr>
                        <td className="py-2 font-semibold" style={{ color: PALETA.textoOscuro }}>
                          Fecha/Hora:
                        </td>
                        <td className="py-2 font-mono" style={{ color: PALETA.textoOscuro }}>
                          {incidencia.fecha && incidencia.hora
                            ? new Date(incidencia.fecha + 'T' + incidencia.hora).toLocaleString('es-ES', {
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
                            {incidencia.estado_cliente}
                          </span>
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
                          {incidencia.prioridad ? (
                            <span
                              className="px-2 py-1 rounded text-xs font-medium text-white"
                              style={{
                                backgroundColor: incidencia.prioridad === 'Crítico' ? '#ef4444' : '#10b981'
                              }}
                            >
                              {incidencia.prioridad}
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
                          {incidencia.descripcion}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Sección de imágenes - solo mostrar si hay imágenes */}
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

        {/* Acciones de Control - solo para Control */}
        {tipoUsuario === 'Control' && (
          <div className="mb-6">
            <div
              className="rounded-lg p-4 shadow-sm"
              style={{
                backgroundColor: PALETA.card
              }}
            >
              <h3
                className="text-center text-lg font-semibold mb-4"
                style={{ color: PALETA.textoOscuro }}
              >
                ACCIONES DE CONTROL
              </h3>

              <div className="flex justify-center gap-4 flex-wrap">
                {!tieneProveedorAsignado && !tieneProveedorAnulado && incidencia.estado_cliente !== 'Anulada' && (
                  <button
                    onClick={abrirModalProveedor}
                    className="px-3 py-2 text-sm text-white rounded hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: PALETA.verdeClaro }}
                  >
                    Asignar Proveedor
                  </button>
                )}

                {tieneProveedorAnulado && !tieneProveedorAsignado && incidencia.estado_cliente !== 'Anulada' && (
                  <button
                    onClick={abrirModalProveedor}
                    className="px-3 py-2 text-sm text-white rounded hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: PALETA.verdeClaro }}
                  >
                    Reasignar Proveedor
                  </button>
                )}

                {/* Botón Poner en espera - disponible si no está anulada, ni en espera, ni tiene proveedor asignado */}
                {incidencia.estado_cliente !== 'Anulada' && incidencia.estado_cliente !== 'En espera' && !tieneProveedorAsignado && (
                  <button
                    onClick={() => setMostrarModalEspera(true)}
                    className="px-3 py-2 text-sm border bg-white rounded transition-colors"
                    style={{
                      borderColor: PALETA.verdeClaro,
                      color: PALETA.verdeClaro
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = `${PALETA.verdeClaro}20`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    Poner en espera
                  </button>
                )}

                {/* Botón Anular - disponible si no está anulada */}
                {incidencia.estado_cliente !== 'Anulada' && (
                  <button
                    onClick={() => setMostrarModalAnular(true)}
                    className="px-3 py-2 text-sm border border-red-500 text-red-600 bg-white rounded hover:bg-red-50 transition-colors"
                  >
                    Anular incidencia
                  </button>
                )}

                {/* Botón Cambiar al Chat Proveedor - solo si hay proveedor asignado y no está anulada */}
                {tieneProveedorAsignado && incidencia.estado_cliente !== 'Anulada' && (
                  <button
                    onClick={() => router.push(`/incidencias/${incidenciaId}/chat-proveedor`)}
                    className="px-3 py-2 text-sm border bg-white rounded transition-colors"
                    style={{
                      borderColor: PALETA.bg,
                      color: PALETA.bg
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = `${PALETA.bg}20`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    Cambiar al Chat Proveedor
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Sección de seguimiento */}
        <div className="mb-8">
          {tipoUsuario === 'Control' ? (
            <div className="text-white text-center">
              <h2 className="text-lg font-semibold mb-1 tracking-wider">CHAT CLIENTE</h2>
              <p className="text-sm opacity-80">#{incidencia.num_solicitud}</p>
            </div>
          ) : (
            <h2 className="text-white text-center text-lg font-semibold mb-4 tracking-wider">SEGUIMIENTO</h2>
          )}
        </div>

        {/* Área de comentarios */}
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

          {/* Lista de comentarios */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
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
                      : comentario.autor_email === currentUserEmail ? 'justify-end' : 'justify-start'
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
                        : comentario.autor_email === currentUserEmail
                          ? '#dcfce7'
                          : getColorEmisor(comentario.autor_rol || 'cliente')
                    }}
                  >
                    {!comentario.es_sistema && (
                      <div className="text-xs font-medium mb-1" style={{
                        color: PALETA.bg
                      }}>
                        {`${comentario.autor_email} (${comentario.autor_rol})`}
                      </div>
                    )}
                    <div className="text-sm">{comentario.cuerpo}</div>

                    {/* Mostrar adjuntos desde campos imagen_url y documento_url */}
                    {((comentario.imagen_url || comentario.documento_url) || (comentario.adjuntos && comentario.adjuntos.length > 0)) && (
                      <div className="mt-2 space-y-2">
                        {/* Mostrar imagen_url del comentario */}
                        {comentario.imagen_url && (
                          (() => {
                            const imageUrl = commentAttachmentUrls[`imagen_${comentario.id}`];
                            return imageUrl ? (
                              <img
                                src={imageUrl}
                                alt="Imagen adjunta al comentario"
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

                        {/* Mantener compatibilidad con adjuntos legacy */}
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
            {/* Referencia para scroll al último mensaje */}
            <div ref={messagesEndRef} />
          </div>

          {/* Formulario para añadir comentario */}
          <form onSubmit={enviarComentario} className="border-t p-4 space-y-4">
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

            {/* Botones de archivos adjuntos - estilo Wix */}
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
            </div>
            
            {/* Botón enviar */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!nuevoComentario.trim() || enviando}
                className="px-6 py-2 text-white rounded disabled:opacity-50 hover:opacity-90 transition-opacity"
                style={{ backgroundColor: PALETA.bg }}
              >
                {enviando ? "Enviando..." : "Enviar"}
              </button>
            </div>
          </form>
        </div>
      </div>
      
      {/* Footer */}
      <div className="text-center py-4">
        <p className="text-white text-sm">
          Software de gestión de incidencias para los centros de Gent Gran de Fundació La Caixa
        </p>
      </div>

      <ModalAsignarProveedor
        isOpen={mostrarModalProveedor}
        onClose={cerrarModalProveedor}
        onSubmit={asignarProveedorCompleto}
        descripcionInicial={incidencia?.descripcion || ''}
        enviando={enviando}
        incidenciaId={incidenciaId}
        esReasignacion={tieneProveedorAnulado}
      />

      {/* Modal para anular incidencia */}
      {mostrarModalAnular && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div
            className="rounded-lg p-8 max-w-md w-full mx-4 shadow"
            style={{ backgroundColor: PALETA.card }}
          >
            <h3 className="text-xl font-semibold mb-6" style={{ color: PALETA.textoOscuro }}>
              Anular Incidencia
            </h3>

            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Esta acción anulará la incidencia completamente. Por favor, proporciona el motivo:
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
                {enviando ? 'Anulando...' : 'Anular Incidencia'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para poner en espera */}
      {mostrarModalEspera && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div
            className="rounded-lg p-8 max-w-md w-full mx-4 shadow"
            style={{ backgroundColor: PALETA.card }}
          >
            <h3 className="text-xl font-semibold mb-6" style={{ color: PALETA.textoOscuro }}>
              Poner en Espera
            </h3>

            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Esta acción pondrá la incidencia en espera. Por favor, proporciona el motivo:
              </p>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                  Motivo para poner en espera *
                </label>
                <textarea
                  value={motivoEspera}
                  onChange={(e) => setMotivoEspera(e.target.value)}
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
                  setMostrarModalEspera(false);
                  setMotivoEspera('');
                }}
                className="px-4 py-2 text-sm rounded border hover:bg-gray-50 transition-colors"
                style={{ color: PALETA.textoOscuro, borderColor: '#d1d5db' }}
                disabled={enviando}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={ponerEnEspera}
                disabled={!motivoEspera.trim() || enviando}
                className="px-6 py-2 text-sm text-white rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                style={{ backgroundColor: PALETA.bg }}
              >
                {enviando ? 'Poniendo en espera...' : 'Poner en Espera'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}