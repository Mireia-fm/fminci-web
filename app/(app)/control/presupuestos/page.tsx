"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { registrarCambioEstado } from "@/lib/historialEstados";
import SearchableSelect from "@/components/SearchableSelect";
import { PALETA } from "@/lib/theme";

type Presupuesto = {
  id: string;
  incidencia_id: string;
  numero_incidencia: string;
  fecha_estimada_inicio: string;
  duracion_estimada: string;
  importe_total_sin_iva: number;
  descripcion_breve: string;
  presupuesto_detallado_url?: string;
  estado: string;
  creado_en: string;
  creado_por: string;
  comentarios_revision?: string;
  instituciones: {
    nombre: string;
  };
  incidencias: {
    num_solicitud: string;
    descripcion: string;
  };
};

export default function PresupuestosPage() {
  const router = useRouter();
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [autorId, setAutorId] = useState<string | null>(null);
  const [presupuestoSeleccionado, setPresupuestoSeleccionado] = useState<Presupuesto | null>(null);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [documentUrls, setDocumentUrls] = useState<Record<string, string>>({});
  const [mostrarModalMotivoRevision, setMostrarModalMotivoRevision] = useState(false);
  const [motivoRevision, setMotivoRevision] = useState('');
  const [presupuestoParaRechazar, setPresupuestoParaRechazar] = useState<Presupuesto | null>(null);
  const [filtroProveedor, setFiltroProveedor] = useState("");
  const [filtroNumeroSolicitud, setFiltroNumeroSolicitud] = useState("");
  const [proveedores, setProveedores] = useState<{id: string, nombre: string}[]>([]);

  useEffect(() => {
    cargarDatos();
  }, [filtroEstado, filtroProveedor, filtroNumeroSolicitud]);

  useEffect(() => {
    cargarProveedores();
  }, []);

  // Cargar URLs firmadas de documentos
  useEffect(() => {
    if (presupuestos.length > 0) {
      cargarDocumentUrls();
    }
  }, [presupuestos]);

  const cargarDatos = async () => {
    try {
      setLoading(true);

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
        .select("id, rol")
        .eq("email", userEmail)
        .maybeSingle();

      if (persona && persona.rol === 'Control') {
        setAutorId(persona.id);

        // Cargar presupuestos con filtros
        let query = supabase
          .from("presupuestos")
          .select(`
            *,
            instituciones(nombre),
            incidencias(num_solicitud, descripcion)
          `);

        // Aplicar filtro de estado si está seleccionado
        if (filtroEstado) {
          query = query.eq("estado", filtroEstado);
        }

        // Aplicar filtro de proveedor si está seleccionado
        if (filtroProveedor) {
          query = query.eq("proveedor_id", filtroProveedor);
        }

        // Aplicar filtro de número de solicitud si está seleccionado
        if (filtroNumeroSolicitud) {
          query = query.filter("incidencias.num_solicitud", "ilike", `%${filtroNumeroSolicitud}%`);
        }

        const { data: presupuestosData, error } = await query.order("creado_en", { ascending: false });

        if (error) {
          console.error("Error cargando presupuestos:", error);
        } else {
          setPresupuestos(presupuestosData || []);
        }
      } else {
        router.push('/dashboard');
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const cargarDocumentUrls = async () => {
    const urls: Record<string, string> = {};

    for (const presupuesto of presupuestos) {
      if (presupuesto.presupuesto_detallado_url) {
        const signedUrl = await getSignedDocumentUrl(presupuesto.presupuesto_detallado_url);
        if (signedUrl) {
          urls[presupuesto.id] = signedUrl;
        }
      }
    }

    setDocumentUrls(urls);
  };

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

  const aprobarPresupuesto = async (presupuesto: Presupuesto) => {
    try {
      setEnviando(true);

      // 1. Cambiar estado del presupuesto a "aprobado"
      const { error: presupuestoError } = await supabase
        .from("presupuestos")
        .update({ estado: "aprobado" })
        .eq("id", presupuesto.id);

      if (presupuestoError) {
        console.error("Error aprobando presupuesto:", presupuestoError);
        throw presupuestoError;
      }

      // 2. Cambiar estado del proveedor a "Oferta aprobada"
      const { error: estadoError } = await supabase
        .from("proveedor_casos")
        .update({ estado_proveedor: "Oferta aprobada" })
        .eq("incidencia_id", presupuesto.incidencia_id)
        .eq("activo", true);

      if (estadoError) {
        console.error("Error actualizando estado proveedor:", estadoError);
        throw estadoError;
      }

      // 3. Registrar cambio de estado en el historial
      await registrarCambioEstado({
        incidenciaId: presupuesto.incidencia_id,
        tipoEstado: 'proveedor',
        estadoAnterior: 'Ofertada',
        estadoNuevo: 'Oferta aprobada',
        autorId: autorId!,
        motivo: 'Presupuesto aprobado por Control',
        metadatos: {
          presupuesto_id: presupuesto.id,
          importe: presupuesto.importe_total_sin_iva,
          accion: 'aprobar_presupuesto'
        }
      });

      // 4. Crear comentario del sistema
      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData.user?.email;

      await supabase
        .from("comentarios")
        .insert({
          incidencia_id: presupuesto.incidencia_id,
          ambito: 'proveedor',
          autor_id: autorId,
          autor_email: userEmail,
          autor_rol: 'Control',
          cuerpo: `Control ha aprobado la oferta de presupuesto por ${presupuesto.importe_total_sin_iva}€. El proveedor puede proceder con la resolución.`,
          es_sistema: true
        });

      // 5. Recargar datos
      cargarDatos();
      setMostrarModal(false);

    } catch (error) {
      console.error("Error aprobando presupuesto:", error);
      alert('Error al aprobar el presupuesto');
    } finally {
      setEnviando(false);
    }
  };

  const abrirModalMotivoRevision = (presupuesto: Presupuesto) => {
    setPresupuestoParaRechazar(presupuesto);
    setMostrarModalMotivoRevision(true);
  };

  const rechazarPresupuesto = async () => {
    if (!presupuestoParaRechazar || !motivoRevision.trim()) {
      alert('Por favor, proporcione un motivo para la revisión');
      return;
    }

    try {
      setEnviando(true);

      // 1. Cambiar estado del presupuesto a "rechazado" y guardar motivo
      const { error: presupuestoError } = await supabase
        .from("presupuestos")
        .update({
          estado: "rechazado",
          comentarios_revision: motivoRevision
        })
        .eq("id", presupuestoParaRechazar.id);

      if (presupuestoError) {
        console.error("Error rechazando presupuesto:", presupuestoError);
        throw presupuestoError;
      }

      // 2. Cambiar estado del proveedor a "Oferta a revisar"
      const { error: estadoError } = await supabase
        .from("proveedor_casos")
        .update({ estado_proveedor: "Oferta a revisar" })
        .eq("incidencia_id", presupuestoParaRechazar.incidencia_id)
        .eq("activo", true);

      if (estadoError) {
        console.error("Error actualizando estado proveedor:", estadoError);
        throw estadoError;
      }

      // 3. Registrar cambio de estado en el historial
      await registrarCambioEstado({
        incidenciaId: presupuestoParaRechazar.incidencia_id,
        tipoEstado: 'proveedor',
        estadoAnterior: 'Ofertada',
        estadoNuevo: 'Oferta a revisar',
        autorId: autorId!,
        motivo: `Presupuesto mandado a revisar por Control: ${motivoRevision}`,
        metadatos: {
          presupuesto_id: presupuestoParaRechazar.id,
          importe: presupuestoParaRechazar.importe_total_sin_iva,
          accion: 'rechazar_presupuesto',
          justificacion: motivoRevision
        }
      });

      // 4. Crear comentario del sistema solo para el proveedor
      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData.user?.email;

      await supabase
        .from("comentarios")
        .insert({
          incidencia_id: presupuestoParaRechazar.incidencia_id,
          ambito: 'proveedor',
          autor_id: autorId,
          autor_email: userEmail,
          autor_rol: 'Control',
          cuerpo: `Control ha mandado la oferta de presupuesto a revisar.

Motivo: ${motivoRevision}

El proveedor debe enviar una nueva propuesta.`,
          es_sistema: true
        });

      // 5. Crear notificación para el proveedor
      const { data: proveedorCaso } = await supabase
        .from("proveedor_casos")
        .select("proveedor_id")
        .eq("incidencia_id", presupuestoParaRechazar.incidencia_id)
        .eq("activo", true)
        .single();

      if (proveedorCaso) {
        await supabase
          .from("proveedor_notificaciones")
          .upsert({
            proveedor_id: proveedorCaso.proveedor_id,
            incidencia_id: presupuestoParaRechazar.incidencia_id,
            tipo_notificacion: 'revision',
            notificacion_vista: false
          }, {
            onConflict: 'proveedor_id,incidencia_id,tipo_notificacion'
          });
      }

      // 6. Cerrar modales y limpiar estado
      setMostrarModalMotivoRevision(false);
      setMostrarModal(false);
      setMotivoRevision('');
      setPresupuestoParaRechazar(null);

      // 7. Recargar datos
      await cargarDatos();

    } catch (error) {
      console.error("Error rechazando presupuesto:", error);
      alert('Error al rechazar el presupuesto. Por favor, intente de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  const abrirModal = (presupuesto: Presupuesto) => {
    setPresupuestoSeleccionado(presupuesto);
    setMostrarModal(true);
  };

  const cargarProveedores = async () => {
    try {
      const { data, error } = await supabase
        .from("instituciones")
        .select("id, nombre")
        .eq("tipo", "Proveedor")
        .eq("activo", true)
        .order("nombre");

      if (!error && data) {
        setProveedores(data);
      }
    } catch (error) {
      console.error("Error cargando proveedores:", error);
    }
  };

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'pendiente_revision':
        return PALETA.filtros;
      case 'aprobado':
        return PALETA.verdeClaro;
      case 'rechazado':
        return '#d4a574';
      default:
        return '#6b7280';
    }
  };

  const getEstadoTexto = (estado: string) => {
    switch (estado) {
      case 'pendiente_revision':
        return 'Pendiente';
      case 'aprobado':
        return 'Aprobado';
      case 'rechazado':
        return 'Rechazado';
      default:
        return estado;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: PALETA.bg }}>
        <div className="text-white">Cargando presupuestos...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: PALETA.bg }}>
      {/* Header */}
      <div className="flex items-center justify-center p-6">
        <h1 className="text-lg tracking-[0.3em] text-white font-semibold">
          GESTIÓN DE PRESUPUESTOS
        </h1>
      </div>

      {/* Filtros */}
      <div className="px-6 mb-12">
        <div className="relative">
          <div
            className="p-4"
            style={{
              backgroundColor: PALETA.headerTable,
              borderRadius: "4px 4px 0 4px"
            }}
          >
            <div className="flex gap-4 items-end">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: PALETA.textoOscuro }}>
                  Estado del presupuesto
                </label>
                <SearchableSelect
                  value={filtroEstado}
                  onChange={setFiltroEstado}
                  placeholder="Seleccionar"
                  className="w-52"
                  options={[
                    { value: "", label: "Todos" },
                    { value: "pendiente_revision", label: "Pendientes de revisión" },
                    { value: "aprobado", label: "Aprobados" },
                    { value: "rechazado", label: "Rechazados" }
                  ]}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: PALETA.textoOscuro }}>
                  Proveedor
                </label>
                <SearchableSelect
                  value={filtroProveedor}
                  onChange={setFiltroProveedor}
                  placeholder="Seleccionar"
                  className="w-52"
                  options={proveedores.map(proveedor => ({
                    value: proveedor.id,
                    label: proveedor.nombre
                  }))}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: PALETA.textoOscuro }}>
                  Número de solicitud
                </label>
                <input
                  type="text"
                  value={filtroNumeroSolicitud}
                  onChange={(e) => setFiltroNumeroSolicitud(e.target.value)}
                  placeholder="Buscar"
                  className="w-52 px-3 py-1.5 rounded border text-sm h-8 bg-white outline-none focus:ring-2"
                  style={{
                    '--tw-ring-color': PALETA.verdeClaro
                  } as React.CSSProperties}
                  onFocus={(e) => {
                    e.target.style.boxShadow = `0 0 0 2px ${PALETA.verdeClaro}40`;
                  }}
                  onBlur={(e) => {
                    e.target.style.boxShadow = '';
                  }}
                />
              </div>
            </div>
          </div>

          {/* Botón limpiar filtros - extensión separada */}
          <div className="absolute bottom-0 right-0 translate-y-full">
            <button
              onClick={() => {
                setFiltroEstado("");
                setFiltroProveedor("");
                setFiltroNumeroSolicitud("");
              }}
              className="px-3 py-1 text-xs font-medium hover:opacity-80 transition-opacity flex items-center gap-1"
              style={{
                backgroundColor: PALETA.headerTable,
                color: PALETA.textoOscuro,
                borderRadius: "0 0 4px 4px"
              }}
              title="Limpiar filtros"
            >
              <span className="text-xs">✕</span>
              Limpiar filtros
            </button>
          </div>
        </div>
      </div>

      {/* Lista de presupuestos */}
      <div className="px-6 pb-6">
        {presupuestos.length === 0 ? (
          <div className="bg-white rounded-lg p-8 text-center">
            <p className="text-gray-500">
              {filtroEstado
                ? `No hay presupuestos con estado "${getEstadoTexto(filtroEstado)}"`
                : "No hay presupuestos disponibles"
              }
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {presupuestos.map((presupuesto) => (
              <div
                key={presupuesto.id}
                className="bg-white rounded-lg shadow-sm border p-6"
                style={{ borderColor: PALETA.verdeSombra }}
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                  {/* Info básica */}
                  <div className="lg:col-span-6">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg" style={{ color: PALETA.textoOscuro }}>
                        #{presupuesto.incidencias.num_solicitud}
                      </h3>
                      <span
                        className="px-2 py-1 rounded text-xs font-medium text-white"
                        style={{ backgroundColor: getEstadoColor(presupuesto.estado) }}
                      >
                        {getEstadoTexto(presupuesto.estado)}
                      </span>
                    </div>

                    <p className="text-sm text-gray-600 mb-2">
                      <strong>Proveedor:</strong> {presupuesto.instituciones.nombre}
                    </p>

                    <div className="text-sm text-gray-600 mb-2">
                      <strong>Descripción:</strong>
                      <p className="mt-1 break-words overflow-hidden">
                        {presupuesto.descripcion_breve.length > 150
                          ? `${presupuesto.descripcion_breve.substring(0, 150)}...`
                          : presupuesto.descripcion_breve
                        }
                      </p>
                    </div>

                    <p className="text-xs text-gray-500">
                      Enviado el {new Date(presupuesto.creado_en).toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>

                  {/* Detalles financieros */}
                  <div className="lg:col-span-3">
                    <p className="text-2xl font-bold mb-1" style={{ color: PALETA.bg }}>
                      {presupuesto.importe_total_sin_iva}€
                    </p>
                    <p className="text-xs text-gray-500 mb-2">Sin IVA</p>

                    <p className="text-sm text-gray-600">
                      <strong>Inicio:</strong> {new Date(presupuesto.fecha_estimada_inicio).toLocaleDateString('es-ES')}
                    </p>
                    <p className="text-sm text-gray-600">
                      <strong>Duración:</strong> {presupuesto.duracion_estimada}
                    </p>
                  </div>

                  {/* Acciones */}
                  <div className="lg:col-span-3 flex flex-col gap-2">
                    <button
                      onClick={() => abrirModal(presupuesto)}
                      className="px-4 py-2 bg-white border-2 rounded text-sm hover:bg-gray-50 transition-colors"
                      style={{
                        borderColor: PALETA.verdeSombra,
                        color: PALETA.verdeSombra
                      }}
                    >
                      Ver detalle
                    </button>

                    {presupuesto.estado === 'pendiente_revision' && (
                      <>
                        <button
                          onClick={() => aprobarPresupuesto(presupuesto)}
                          disabled={enviando}
                          className="px-4 py-2 text-white rounded text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                          style={{ backgroundColor: PALETA.verdeClaro }}
                        >
                          {enviando ? 'Procesando...' : 'Aprobar'}
                        </button>
                        <button
                          onClick={() => abrirModalMotivoRevision(presupuesto)}
                          disabled={enviando}
                          className="px-4 py-2 text-white rounded text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                          style={{ backgroundColor: '#d4a574' }}
                        >
                          {enviando ? 'Procesando...' : 'Mandar a revisar'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de detalle */}
      {mostrarModal && presupuestoSeleccionado && (
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
                DETALLE DEL PRESUPUESTO #{presupuestoSeleccionado.incidencias.num_solicitud}
              </h3>
              <button
                onClick={() => setMostrarModal(false)}
                className="text-2xl hover:opacity-70 transition-opacity"
                style={{ color: PALETA.textoOscuro }}
              >
                ×
              </button>
            </div>

            <div className="p-6">
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
                          {presupuestoSeleccionado.instituciones.nombre}
                        </td>
                      </tr>
                      <tr style={{ backgroundColor: `${PALETA.headerTable}20` }}>
                        <td className="py-2 font-semibold" style={{ color: PALETA.textoOscuro }}>
                          Estado:
                        </td>
                        <td className="py-2">
                          <span
                            className="px-2 py-1 rounded text-xs font-medium text-white"
                            style={{ backgroundColor: getEstadoColor(presupuestoSeleccionado.estado) }}
                          >
                            {getEstadoTexto(presupuestoSeleccionado.estado)}
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
                          {presupuestoSeleccionado.importe_total_sin_iva}€
                        </td>
                      </tr>
                      <tr style={{ backgroundColor: `${PALETA.headerTable}20` }}>
                        <td className="py-2 font-semibold" style={{ color: PALETA.textoOscuro }}>
                          Fecha estimada de inicio:
                        </td>
                        <td className="py-2" style={{ color: PALETA.textoOscuro }}>
                          {new Date(presupuestoSeleccionado.fecha_estimada_inicio).toLocaleDateString('es-ES')}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 font-semibold" style={{ color: PALETA.textoOscuro }}>
                          Duración estimada:
                        </td>
                        <td className="py-2" style={{ color: PALETA.textoOscuro }}>
                          {presupuestoSeleccionado.duracion_estimada}
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
                      {presupuestoSeleccionado.descripcion_breve}
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
                      {presupuestoSeleccionado.incidencias.descripcion}
                    </p>
                  </div>
                </div>
              </div>

              {/* Motivo de revisión (solo si fue rechazado) */}
              {presupuestoSeleccionado.estado === 'rechazado' && presupuestoSeleccionado.comentarios_revision && (
                <div className="mb-6">
                  <div
                    className="border rounded-lg"
                    style={{ borderColor: '#ef4444' }}
                  >
                    <div
                      className="px-4 py-3 border-b"
                      style={{
                        backgroundColor: '#fef2f2',
                        borderColor: '#ef4444'
                      }}
                    >
                      <h4 className="font-semibold text-sm" style={{ color: '#dc2626' }}>
                        MOTIVO DE RECHAZO
                      </h4>
                    </div>
                    <div className="p-4 bg-red-50">
                      <p className="text-sm" style={{ color: '#991b1b' }}>
                        {presupuestoSeleccionado.comentarios_revision}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Documento adjunto */}
              {presupuestoSeleccionado.presupuesto_detallado_url && (
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
                      {documentUrls[presupuestoSeleccionado.id] ? (
                        <a
                          href={documentUrls[presupuestoSeleccionado.id]}
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
              <div className="flex gap-3 justify-between">
                <button
                  onClick={() => router.push(`/incidencias/${presupuestoSeleccionado.incidencia_id}/chat-proveedor`)}
                  className="px-4 py-2 text-sm text-white rounded hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: PALETA.verdeClaro }}
                >
                  Ir al chat del proveedor
                </button>

                {presupuestoSeleccionado.estado === 'pendiente_revision' && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => setMostrarModal(false)}
                      className="px-4 py-2 text-sm rounded border hover:bg-gray-50 transition-colors"
                      style={{ color: PALETA.textoOscuro, borderColor: '#d1d5db' }}
                      disabled={enviando}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => abrirModalMotivoRevision(presupuestoSeleccionado)}
                      disabled={enviando}
                      className="px-6 py-2 text-sm text-white rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                      style={{ backgroundColor: '#d4a574' }}
                    >
                      {enviando ? 'Procesando...' : 'Mandar a revisar'}
                    </button>
                    <button
                      onClick={() => aprobarPresupuesto(presupuestoSeleccionado)}
                      disabled={enviando}
                      className="px-6 py-2 text-sm text-white rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                      style={{ backgroundColor: PALETA.verdeClaro }}
                    >
                      {enviando ? 'Procesando...' : 'Aprobar Presupuesto'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de motivo de revisión */}
      {mostrarModalMotivoRevision && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div
            className="rounded-lg shadow-lg border max-w-lg w-full"
            style={{
              backgroundColor: PALETA.card,
              borderColor: PALETA.headerTable
            }}
          >
            <div
              className="px-6 py-4 border-b flex justify-between items-center"
              style={{
                backgroundColor: PALETA.headerTable,
                color: PALETA.textoOscuro
              }}
            >
              <h3 className="text-lg font-semibold">
                MOTIVO DE REVISIÓN
              </h3>
              <button
                onClick={() => {
                  setMostrarModalMotivoRevision(false);
                  setMotivoRevision('');
                  setPresupuestoParaRechazar(null);
                }}
                className="text-2xl hover:opacity-70 transition-opacity"
                style={{ color: PALETA.textoOscuro }}
              >
                ×
              </button>
            </div>

            <div className="p-6">
              <p className="text-sm mb-4" style={{ color: PALETA.textoOscuro }}>
                Por favor, indique el motivo por el cual este presupuesto requiere revisión:
              </p>

              <textarea
                value={motivoRevision}
                onChange={(e) => setMotivoRevision(e.target.value)}
                placeholder="Escriba aquí el motivo de la revisión..."
                className="w-full h-32 p-3 border rounded-lg resize-none focus:outline-none focus:ring-2"
                style={{
                  borderColor: PALETA.verdeSombra
                }}
              />

              <div className="flex gap-3 justify-end mt-6">
                <button
                  onClick={() => {
                    setMostrarModalMotivoRevision(false);
                    setMotivoRevision('');
                    setPresupuestoParaRechazar(null);
                  }}
                  className="px-4 py-2 text-sm rounded border hover:bg-gray-50 transition-colors"
                  style={{ color: PALETA.textoOscuro, borderColor: '#d1d5db' }}
                  disabled={enviando}
                >
                  Cancelar
                </button>
                <button
                  onClick={rechazarPresupuesto}
                  disabled={enviando || !motivoRevision.trim()}
                  className="px-6 py-2 text-sm text-white rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                  style={{ backgroundColor: '#d4a574' }}
                >
                  {enviando ? 'Enviando...' : 'Mandar a Revisar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}