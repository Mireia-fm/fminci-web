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
  centro?: string;
  fecha?: string;
  hora?: string;
  imagen_url?: string;
  instituciones?: { 
    nombre: string;
  }[] | null;
  adjuntos_principales?: Adjunto[];
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
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [commentAttachmentUrls, setCommentAttachmentUrls] = useState<Record<string, string>>({});

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
          adjuntos_principales: adjuntosPrincipales
        });
      }

      // Cargar comentarios del chat control/cliente con adjuntos de comentarios
      const { data: comentariosData, error: comentariosError } = await supabase
        .from("comentarios")
        .select(`
          *,
          adjuntos(id, tipo, nombre_archivo, storage_key, categoria)
        `)
        .eq("incidencia_id", incidenciaId)
        .eq("ambito", "cliente")
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
          ambito: 'cliente',
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
          console.log('Starting recursive file search...');
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
      {/* Header con logo */}
      <div className="flex justify-between items-center p-6 relative">
        <button
          onClick={() => router.back()}
          className="text-white text-sm hover:underline"
        >
          ← Volver a incidencias
        </button>

        <div className="text-white text-center">
          <h1 className="text-lg font-semibold tracking-wider">CHAT CLIENTE</h1>
          <p className="text-sm opacity-80">#{incidencia.num_solicitud}</p>
        </div>

        <div></div>
      </div>

      {/* Sección de datos de incidencia - estilo más compacto y organizado */}
      <div className="px-6 pb-6">
        <div 
          className="rounded-lg p-6 mb-6 shadow-lg" 
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
                <div style={{ color: PALETA.textoOscuro }}>{incidencia.estado_cliente}</div>
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
              
              {/* Solo mostrar imagen si existe en adjuntos */}
              {incidencia.adjuntos_principales && incidencia.adjuntos_principales.length > 0 && (
                <div>
                  <div className="font-semibold mb-2" style={{ color: PALETA.fondo }}>Imagen:</div>
                  <div className="space-y-2">
                    {incidencia.adjuntos_principales.map((adjunto) => {
                      const imageUrl = imageUrls[adjunto.id];
                      if (!imageUrl) return null;
                      return (
                        <div key={adjunto.id} className="cursor-pointer" onClick={() => window.open(imageUrl, '_blank')}>
                          <img 
                            src={imageUrl}
                            alt={adjunto.nombre_archivo || "Imagen de la incidencia"}
                            className="w-24 h-24 object-cover rounded border-2 border-green-600 hover:scale-105 transition-transform duration-200"
                            style={{ borderColor: PALETA.fondo }}
                            onError={(e) => {
                              console.error('Error cargando imagen:', adjunto.storage_key);
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sección de seguimiento */}
        <div className="mb-6">
          <h2 className="text-white text-center text-lg font-semibold mb-4 tracking-wider">SEGUIMIENTO</h2>
        </div>

        {/* Área de comentarios */}
        <div className="bg-white rounded-lg p-6">
          {/* Lista de comentarios */}
          <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
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
                      : comentario.autor_rol === 'Control' ? 'justify-end' : 'justify-start'
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
                        : comentario.autor_rol === 'Control' 
                          ? '#dcfce7'
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

          {/* Formulario para añadir comentario */}
          <form onSubmit={enviarComentario} className="space-y-4">
            <textarea
              value={nuevoComentario}
              onChange={(e) => setNuevoComentario(e.target.value)}
              placeholder="Añadir comentario"
              className="w-full h-24 p-3 border border-gray-300 rounded focus:outline-none resize-none text-sm"
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
            </div>
            
            {/* Botón enviar */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!nuevoComentario.trim() || enviando}
                className="px-6 py-2 text-white rounded disabled:opacity-50 hover:opacity-90 transition-opacity"
                style={{ backgroundColor: PALETA.fondo }}
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
    </div>
  );
}