"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { registrarCambioEstado } from "@/lib/historialEstados";
import ModalAsignarProveedor from "@/components/ModalAsignarProveedor";
import ModalResolucionManual, { type FormularioResolucionManual } from "@/components/ModalResolucionManual";
import ModalPonerEnEspera from "@/components/ModalPonerEnEspera";
import ModalAnular from "@/components/ModalAnular";
import { PALETA } from "@/lib/theme";
import { useAuth } from "@/contexts/AuthContext";

// Nuevos imports de la refactorización
import { subirMultiples } from "@/lib/services/storageService";
import { crearComentario, crearAdjuntos } from "@/lib/services/comentariosService";
import { obtenerProveedorActivo, tieneProveedorActivo as checkProveedorActivo } from "@/lib/services/proveedorCasosService";
import { asignarProveedorCompleto, type FormularioAsignacionProveedor } from "@/lib/services/asignacionProveedorService";
import { useSignedUrls, useComentarioUrls } from "@/shared/hooks/useSignedUrls";
import { useChatFileUpload } from "@/shared/hooks/useFileUpload";
import DatosTecnicosIncidencia from "@/shared/components/DatosTecnicosIncidencia";
import HistorialEstados from "@/shared/components/HistorialEstados";
import ScrollToBottomButton from "@/components/ScrollToBottomButton";

type Adjunto = {
  id: string;
  tipo: string;
  nombre_archivo?: string | null;
  storage_key?: string | null;
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

type Comentario = {
  id: string;
  incidencia_id: string;
  ambito: 'cliente' | 'proveedor' | 'ambos';
  autor_id?: string | null;
  autor_email?: string | null;
  autor_rol?: string | null;
  cuerpo?: string | null;
  creado_en: string;
  es_sistema?: boolean | null;
  imagen_url?: string | null;
  documento_url?: string | null;
  adjuntos?: Adjunto[];
  personas?: {
    nombre: string | null;
    email: string;
  };
};

export default function ChatControlCliente() {
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
  const [tieneProveedorAsignado, setTieneProveedorAsignado] = useState(false);
  const [tieneProveedorAnulado, setTieneProveedorAnulado] = useState(false);

  // Modales
  const [mostrarModalProveedor, setMostrarModalProveedor] = useState(false);
  const [mostrarModalAnular, setMostrarModalAnular] = useState(false);
  const [mostrarModalEspera, setMostrarModalEspera] = useState(false);
  const [mostrarModalResolucionManual, setMostrarModalResolucionManual] = useState(false);

  // Historial de estados
  type CambioEstado = {
    id: string;
    estado_anterior: string | null;
    estado_nuevo: string;
    cambiado_en: string;
    motivo: string | null;
  };
  const [historialCliente, setHistorialCliente] = useState<CambioEstado[]>([]);

  // Chat input
  const [nuevoComentario, setNuevoComentario] = useState("");

  // Hooks de refactorización
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

  // Cargar datos iniciales (esperar a que AuthContext esté listo)
  useEffect(() => {
    if (!authLoading && perfil) {
      cargarDatos();
    }
  }, [incidenciaId, authLoading, perfil]);

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

  const cargarDatos = async () => {
    try {
      setLoading(true);

      // Verificar que tenemos perfil del AuthContext
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
          prioridad,
          instituciones(nombre),
          proveedor_casos(estado_proveedor, prioridad, activo)
        `)
        .eq("id", incidenciaId)
        .single();

      if (incidenciaData) {
        // Cargar adjuntos principales
        const { data: adjuntosData } = await supabase
          .from("adjuntos")
          .select("id, nombre_archivo, storage_key, categoria, tipo, visible_proveedor")
          .eq("incidencia_id", incidenciaId)
          .eq("categoria", "imagen_principal");

        let adjuntosPrincipales = adjuntosData || [];

        // Fallback a imagen_url si no hay adjuntos
        if (incidenciaData.imagen_url && adjuntosPrincipales.length === 0) {
          adjuntosPrincipales = [{
            id: 'imagen_url_' + incidenciaId,
            tipo: 'imagen',
            nombre_archivo: 'Imagen de la incidencia',
            storage_key: incidenciaData.imagen_url,
            categoria: 'imagen_principal',
            visible_proveedor: true
          }];
        }

        setIncidencia({
          ...incidenciaData,
          adjuntos_principales: adjuntosPrincipales
        });

        // Verificar estado del proveedor usando el nuevo servicio
        const tieneProveedor = await checkProveedorActivo(incidenciaId);
        setTieneProveedorAsignado(tieneProveedor);

        // Verificar proveedores anulados
        const tieneAnulado = incidenciaData.proveedor_casos?.some(
          pc => !pc.activo && pc.estado_proveedor === 'Anulada'
        );
        setTieneProveedorAnulado(!!tieneAnulado);

        // Cargar historial de estados del cliente
        const { data: historialData } = await supabase
          .from("historial_estados")
          .select("id, estado_anterior, estado_nuevo, cambiado_en, motivo")
          .eq("incidencia_id", incidenciaId)
          .eq("tipo_estado", "cliente")
          .order("cambiado_en", { ascending: false });

        setHistorialCliente(historialData || []);
      }

      // Cargar comentarios con adjuntos
      const { data: comentariosData } = await supabase
        .from("comentarios")
        .select(`
          *,
          personas(nombre, email),
          adjuntos(*)
        `)
        .eq("incidencia_id", incidenciaId)
        .in("ambito", ["cliente", "ambos"])
        .order("creado_en", { ascending: true});

      setComentarios(comentariosData || []);

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

      // Crear comentario usando el servicio
      const comentarioCreado = await crearComentario({
        incidencia_id: incidenciaId,
        ambito: 'cliente',
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

  const abrirModalProveedor = () => setMostrarModalProveedor(true);

  const handlePonerEnEspera = async (motivo: string) => {
    if (!incidencia || !perfil) return;

    const estadoAnterior = incidencia.estado_cliente;

    await supabase
      .from("incidencias")
      .update({ estado_cliente: "En espera" })
      .eq("id", incidenciaId);

    await registrarCambioEstado({
      incidenciaId,
      tipoEstado: 'cliente',
      estadoAnterior,
      estadoNuevo: 'En espera',
      autorId: perfil.persona_id,
      motivo
    });

    await crearComentario({
      incidencia_id: incidenciaId,
      ambito: 'cliente',
      autor_id: perfil.persona_id,
      autor_email: perfil.email,
      autor_rol: perfil.rol,
      cuerpo: `Incidencia puesta en espera.\n**Motivo:** ${motivo}`,
      es_sistema: true
    });

    cargarDatos();
  };

  const handleAnular = async (motivo: string) => {
    if (!incidencia || !perfil) return;

    const estadoAnterior = incidencia.estado_cliente;

    await supabase
      .from("incidencias")
      .update({ estado_cliente: "Anulada" })
      .eq("id", incidenciaId);

    if (tieneProveedorAsignado) {
      await supabase
        .from("proveedor_casos")
        .update({
          estado_proveedor: "Anulada",
          activo: false,
          desasignado_en: new Date().toISOString(),
          desasignado_por: perfil.persona_id,
          motivo_desasignacion: motivo
        })
        .eq("incidencia_id", incidenciaId)
        .eq("activo", true);

      const proveedor = await obtenerProveedorActivo(incidenciaId);
      if (proveedor) {
        await registrarCambioEstado({
          incidenciaId,
          tipoEstado: 'proveedor',
          estadoAnterior: proveedor.estado_proveedor,
          estadoNuevo: 'Anulada',
          autorId: perfil.persona_id,
          motivo
        });
      }
    }

    await registrarCambioEstado({
      incidenciaId,
      tipoEstado: 'cliente',
      estadoAnterior,
      estadoNuevo: 'Anulada',
      autorId: perfil.persona_id,
      motivo
    });

    await crearComentario({
      incidencia_id: incidenciaId,
      ambito: 'ambos',
      autor_id: perfil.persona_id,
      autor_email: perfil.email,
      autor_rol: perfil.rol,
      cuerpo: `Incidencia anulada por Control.\n**Motivo:** ${motivo}`,
      es_sistema: true
    });

    cargarDatos();
  };

  const handleAsignarProveedor = async (formularioProveedor: FormularioAsignacionProveedor) => {
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
      setMostrarModalProveedor(false);
      cargarDatos();
    } catch (error) {
      console.error("Error completo asignando proveedor:", error);
      const mensajeError = error instanceof Error ? error.message : 'Error desconocido';
      alert(`Error al asignar el proveedor: ${mensajeError}`);
    } finally {
      setEnviando(false);
    }
  };

  const resolverManualmenteSinProveedor = async (formulario: FormularioResolucionManual) => {
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

      // Actualizar estado
      const estadoAnterior = incidencia.estado_cliente;
      await supabase
        .from("incidencias")
        .update({ estado_cliente: "Resuelta" })
        .eq("id", incidenciaId);

      // Registrar cambio de estado
      await registrarCambioEstado({
        incidenciaId,
        tipoEstado: 'cliente',
        estadoAnterior,
        estadoNuevo: 'Resuelta',
        autorId: perfil.persona_id,
        motivo: 'Resolución manual por Control',
        metadatos: {
          accion: 'resolucion_manual',
          proveedor_externo: formulario.proveedor_externo || 'No especificado',
          importe: formulario.importe || 0,
          num_documentos: documentosUrls.length
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
        ambito: 'cliente',
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
        {/* Datos Técnicos - Componente Refactorizado */}
        <DatosTecnicosIncidencia
          incidencia={incidencia}
          imageUrls={imageUrls}
          adjuntosPrincipales={incidencia.adjuntos_principales}
        />

        {/* Acciones de Control */}
        {perfil?.rol === 'Control' && (
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

                {!tieneProveedorAsignado && (incidencia.estado_cliente === 'Abierta' || incidencia.estado_cliente === 'En espera') && (
                  <button
                    onClick={() => setMostrarModalResolucionManual(true)}
                    className="px-3 py-2 text-sm text-white rounded hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: PALETA.bg }}
                  >
                    Resolver Manualmente
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

                {incidencia.estado_cliente !== 'Anulada' && (
                  <button
                    onClick={() => setMostrarModalAnular(true)}
                    className="px-3 py-2 text-sm border border-red-500 text-red-600 bg-white rounded hover:bg-red-50 transition-colors"
                  >
                    Anular incidencia
                  </button>
                )}

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
          </div>
        )}

        {/* Sección de seguimiento */}
        <div className="mb-8">
          {perfil?.rol === 'Control' ? (
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

      {/* Historial de Estados del Cliente */}
      <div className="px-6 mb-6">
        <HistorialEstados
          cambios={historialCliente}
          titulo="HISTORIAL DE ESTADOS"
        />
      </div>

      {/* Modales */}
      {mostrarModalProveedor && (
        <ModalAsignarProveedor
          isOpen={mostrarModalProveedor}
          onClose={() => setMostrarModalProveedor(false)}
          incidenciaId={incidenciaId}
          onSubmit={handleAsignarProveedor}
          enviando={enviando}
          esReasignacion={tieneProveedorAnulado}
        />
      )}

      <ModalPonerEnEspera
        isOpen={mostrarModalEspera}
        onClose={() => setMostrarModalEspera(false)}
        onConfirm={handlePonerEnEspera}
      />

      <ModalAnular
        isOpen={mostrarModalAnular}
        onClose={() => setMostrarModalAnular(false)}
        onConfirm={handleAnular}
      />

      <ModalResolucionManual
        isOpen={mostrarModalResolucionManual}
        onClose={() => setMostrarModalResolucionManual(false)}
        onSubmit={resolverManualmenteSinProveedor}
        tieneProveedor={false}
        enviando={enviando}
      />
    </div>
  );
}
