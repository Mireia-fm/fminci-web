"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { registrarCambioEstado } from "@/lib/historialEstados";
import ModalAsignarProveedor from "@/components/ModalAsignarProveedor";
import ModalResolucionManual, { type FormularioResolucionManual } from "@/components/ModalResolucionManual";
import { PALETA } from "@/lib/theme";

// Nuevos imports de la refactorización
import { subirMultiples } from "@/lib/services/storageService";
import { crearComentario, crearAdjuntos } from "@/lib/services/comentariosService";
import { obtenerProveedorActivo, tieneProveedorActivo as checkProveedorActivo } from "@/lib/services/proveedorCasosService";
import { useSignedUrls, useComentarioUrls } from "@/shared/hooks/useSignedUrls";
import { useChatFileUpload } from "@/shared/hooks/useFileUpload";
import DatosTecnicosIncidencia from "@/shared/components/DatosTecnicosIncidencia";
import ChatContainer from "@/shared/components/ChatContainer";

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

  // Estados principales
  const [incidencia, setIncidencia] = useState<Incidencia | null>(null);
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);

  // Usuario
  const [tipoUsuario, setTipoUsuario] = useState<string | null>(null);
  const [nombreUsuario, setNombreUsuario] = useState<string>("");
  const [autorId, setAutorId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Estados de proveedor
  const [tieneProveedorAsignado, setTieneProveedorAsignado] = useState(false);
  const [tieneProveedorAnulado, setTieneProveedorAnulado] = useState(false);

  // Modales
  const [mostrarModalProveedor, setMostrarModalProveedor] = useState(false);
  const [mostrarModalAnular, setMostrarModalAnular] = useState(false);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');
  const [mostrarModalEspera, setMostrarModalEspera] = useState(false);
  const [motivoEspera, setMotivoEspera] = useState('');
  const [mostrarModalResolucionManual, setMostrarModalResolucionManual] = useState(false);

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

  // Cargar datos iniciales
  useEffect(() => {
    cargarDatos();
  }, [incidenciaId]);

  const cargarDatos = async () => {
    try {
      setLoading(true);

      // Obtener usuario actual
      const { data: userData } = await supabase.auth.getUser();
      const email = userData.user?.email;

      if (!email) {
        router.push('/login');
        return;
      }

      // Obtener información del usuario
      const { data: persona } = await supabase
        .from("personas")
        .select("id, rol, nombre")
        .eq("email", email)
        .maybeSingle();

      if (persona) {
        setTipoUsuario(persona.rol);
        setNombreUsuario(persona.nombre || email);
        setAutorId(persona.id);
        setUserEmail(email);
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
          .select("*")
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
            categoria: 'imagen_principal'
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
      }

      // Cargar comentarios
      const { data: comentariosData } = await supabase
        .from("comentarios")
        .select(`
          *,
          personas(nombre, email)
        `)
        .eq("incidencia_id", incidenciaId)
        .in("ambito", ["cliente", "ambos"])
        .order("creado_en", { ascending: true });

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
    if (enviando || !tipoUsuario || !autorId || !userEmail) return;

    try {
      setEnviando(true);

      // Subir archivos usando el hook
      const { imagenUrl, documentoUrl } = await uploadFiles();

      // Crear comentario usando el servicio
      const comentarioCreado = await crearComentario({
        incidencia_id: incidenciaId,
        ambito: 'cliente',
        autor_id: autorId,
        autor_email: userEmail,
        autor_rol: tipoUsuario,
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

  const cambiarAEspera = async () => {
    if (!motivoEspera.trim()) {
      alert('Por favor ingresa un motivo');
      return;
    }

    if (!incidencia || !autorId) return;

    try {
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
        autorId,
        motivo: motivoEspera
      });

      // Comentario del sistema
      await crearComentario({
        incidencia_id: incidenciaId,
        ambito: 'cliente',
        autor_id: autorId,
        autor_email: userEmail!,
        autor_rol: tipoUsuario!,
        cuerpo: `Incidencia puesta en espera.\n**Motivo:** ${motivoEspera}`,
        es_sistema: true
      });

      setMostrarModalEspera(false);
      setMotivoEspera('');
      cargarDatos();
    } catch (error) {
      console.error("Error:", error);
      alert('Error al cambiar estado');
    }
  };

  const anularIncidencia = async () => {
    if (!motivoAnulacion.trim()) {
      alert('Por favor ingresa un motivo de anulación');
      return;
    }

    if (!incidencia || !autorId) return;

    try {
      const estadoAnterior = incidencia.estado_cliente;

      // Actualizar estado de la incidencia
      await supabase
        .from("incidencias")
        .update({ estado_cliente: "Anulada" })
        .eq("id", incidenciaId);

      // Si hay proveedor activo, anularlo también
      if (tieneProveedorAsignado) {
        await supabase
          .from("proveedor_casos")
          .update({
            estado_proveedor: "Anulada",
            activo: false,
            desasignado_en: new Date().toISOString(),
            desasignado_por: autorId,
            motivo_desasignacion: motivoAnulacion
          })
          .eq("incidencia_id", incidenciaId)
          .eq("activo", true);

        // Registrar cambio de estado del proveedor
        const proveedor = await obtenerProveedorActivo(incidenciaId);
        if (proveedor) {
          await registrarCambioEstado({
            incidenciaId,
            tipoEstado: 'proveedor',
            estadoAnterior: proveedor.estado_proveedor,
            estadoNuevo: 'Anulada',
            autorId,
            motivo: motivoAnulacion
          });
        }
      }

      // Registrar cambio de estado del cliente
      await registrarCambioEstado({
        incidenciaId,
        tipoEstado: 'cliente',
        estadoAnterior,
        estadoNuevo: 'Anulada',
        autorId,
        motivo: motivoAnulacion
      });

      // Comentario del sistema
      await crearComentario({
        incidencia_id: incidenciaId,
        ambito: 'ambos',
        autor_id: autorId,
        autor_email: userEmail!,
        autor_rol: tipoUsuario!,
        cuerpo: `Incidencia anulada por Control.\n**Motivo:** ${motivoAnulacion}`,
        es_sistema: true
      });

      setMostrarModalAnular(false);
      setMotivoAnulacion('');
      cargarDatos();
    } catch (error) {
      console.error("Error:", error);
      alert('Error al anular incidencia');
    }
  };

  const resolverManualmenteSinProveedor = async (formulario: FormularioResolucionManual) => {
    if (!autorId || !incidencia || !userEmail) return;

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
        autorId,
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
        autor_id: autorId,
        autor_email: userEmail,
        autor_rol: tipoUsuario!,
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
        <div className="text-white text-xl">Cargando...</div>
      </div>
    );
  }

  if (!incidencia) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: PALETA.bg }}>
        <div className="text-white text-xl">Incidencia no encontrada</div>
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
        {tipoUsuario === 'Control' && (
          <div className="mb-6">
            <div
              className="rounded-lg p-4 shadow-sm"
              style={{ backgroundColor: PALETA.card }}
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
                    🔧 Asignar Proveedor
                  </button>
                )}

                {(tieneProveedorAsignado || tieneProveedorAnulado) && incidencia.estado_cliente !== 'Anulada' && (
                  <button
                    onClick={abrirModalProveedor}
                    className="px-3 py-2 text-sm text-white rounded hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: '#f59e0b' }}
                  >
                    🔄 Reasignar Proveedor
                  </button>
                )}

                {incidencia.estado_cliente !== 'En espera' && incidencia.estado_cliente !== 'Anulada' && (
                  <button
                    onClick={() => setMostrarModalEspera(true)}
                    className="px-3 py-2 text-sm text-white rounded hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: '#6366f1' }}
                  >
                    ⏸️ Poner en Espera
                  </button>
                )}

                {incidencia.estado_cliente !== 'Anulada' && (
                  <button
                    onClick={() => setMostrarModalAnular(true)}
                    className="px-3 py-2 text-sm text-white rounded hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: '#ef4444' }}
                  >
                    ❌ Anular Incidencia
                  </button>
                )}

                {!tieneProveedorAsignado && (incidencia.estado_cliente === 'Abierta' || incidencia.estado_cliente === 'En espera') && (
                  <button
                    onClick={() => setMostrarModalResolucionManual(true)}
                    className="px-3 py-2 text-sm text-white rounded hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: PALETA.verdeClaro }}
                  >
                    🔧 Resolver Manualmente
                  </button>
                )}

                {tieneProveedorAsignado && (
                  <button
                    onClick={() => router.push(`/incidencias/${incidenciaId}/chat-proveedor`)}
                    className="px-3 py-2 text-sm text-white rounded hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: '#8b5cf6' }}
                  >
                    💬 Ver Chat Proveedor
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Chat Container - Componente Refactorizado */}
        <ChatContainer
          title="CHAT CON CLIENTE"
          mensajes={comentarios}
          nuevoMensaje={nuevoComentario}
          onMensajeChange={setNuevoComentario}
          onEnviar={handleEnviarComentario}
          attachmentUrls={commentAttachmentUrls}
          onImageSelect={seleccionarImagen}
          onDocumentSelect={seleccionarDocumento}
          selectedImage={imagenSeleccionada}
          selectedDocument={documentoSeleccionado}
          enviando={enviando}
        />
      </div>

      {/* Modales */}
      {mostrarModalProveedor && (
        <ModalAsignarProveedor
          isOpen={mostrarModalProveedor}
          onClose={() => setMostrarModalProveedor(false)}
          incidenciaId={incidenciaId}
          onProveedorAsignado={cargarDatos}
        />
      )}

      {mostrarModalEspera && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Poner Incidencia en Espera</h3>
            <textarea
              value={motivoEspera}
              onChange={(e) => setMotivoEspera(e.target.value)}
              placeholder="Motivo de la espera..."
              className="w-full p-2 border rounded mb-4"
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setMostrarModalEspera(false);
                  setMotivoEspera('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={cambiarAEspera}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {mostrarModalAnular && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4 text-red-600">Anular Incidencia</h3>
            <textarea
              value={motivoAnulacion}
              onChange={(e) => setMotivoAnulacion(e.target.value)}
              placeholder="Motivo de la anulación..."
              className="w-full p-2 border rounded mb-4"
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setMostrarModalAnular(false);
                  setMotivoAnulacion('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={anularIncidencia}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Anular
              </button>
            </div>
          </div>
        </div>
      )}

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
