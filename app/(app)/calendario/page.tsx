"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { PALETA } from "@/lib/theme";
import { crearComentario } from "@/lib/services/comentariosService";

type Cita = {
  id: string;
  incidencia_id: string;
  fecha: string;
  hora: string;
  proveedor_nombre: string;
  centro_nombre?: string;
  incidencia_num: string;
  descripcion: string;
  estado: string;
};

type CitaSupabase = {
  id: string;
  incidencia_id: string;
  fecha_visita: string;
  horario: string;
  estado: string;
  proveedor_id?: string;
  proveedor_nombre?: string;
  centro_nombre?: string;
  num_solicitud?: string;
  descripcion?: string;
  proveedor_casos?: {
    descripcion_proveedor?: string;
  }[];
  incidencias?: {
    id: string;
    num_solicitud?: string;
    descripcion?: string;
    centro?: string;
    institucion_id?: string;
  }[];
};

export default function CalendarioPage() {
  const router = useRouter();
  const { perfil, loading: loadingAuth } = useAuth();
  const [citas, setCitas] = useState<Cita[]>([]);
  const [loading, setLoading] = useState(true);
  const [fechaSeleccionada, setFechaSeleccionada] = useState(new Date());
  const [esProveedor, setEsProveedor] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [citaSeleccionada, setCitaSeleccionada] = useState<Cita | null>(null);
  const [mostrarModalCancelar, setMostrarModalCancelar] = useState(false);

  useEffect(() => {
    if (!loadingAuth && perfil) {
      cargarCitas();
    }
  }, [loadingAuth, perfil]);

  const cargarCitas = async () => {
    if (!perfil) return;

    try {
      // Usar instituciones ya cargadas desde AuthContext
      const institucionId = perfil.instituciones?.[0]?.institucion_id;
      const tipoInstitucion = perfil.instituciones?.[0]?.tipo;

      if (institucionId) {
        let citasData: CitaSupabase[] = [];

        if (tipoInstitucion === 'Proveedor') {
          setEsProveedor(true);
          // Vista para proveedores: mostrar las visitas que HA calendarizado
          const { data } = await supabase
            .from("citas_proveedores")
            .select(`
              id,
              incidencia_id,
              fecha_visita,
              horario,
              estado,
              centro_nombre,
              num_solicitud,
              descripcion,
              proveedor_casos!inner(descripcion_proveedor)
            `)
            .eq("proveedor_id", institucionId)
            .eq("estado", "programada")
            .order("fecha_visita", { ascending: true });

          citasData = data || [];
        } else {
          // Vista para clientes/centros/gestores: mostrar las visitas calendarizadas para sus incidencias

          // Obtener los IDs de todas las instituciones del usuario (para gestores con múltiples centros)
          const institucionesIds = perfil.instituciones?.map(inst => inst.institucion_id) || [];

          if (institucionesIds.length === 0) {
            citasData = [];
          } else {
            const { data, error } = await supabase
              .from("citas_proveedores")
              .select(`
                id,
                incidencia_id,
                fecha_visita,
                horario,
                estado,
                proveedor_id,
                proveedor_nombre,
                centro_nombre,
                num_solicitud,
                descripcion,
                incidencias!inner(
                  id,
                  institucion_id
                )
              `)
              .in("incidencias.institucion_id", institucionesIds)
              .eq("estado", "programada")
              .order("fecha_visita", { ascending: true });

            if (error) {
              console.error("Error cargando citas:", error);
              citasData = [];
            } else {
              citasData = data || [];
            }
          }
        }

        if (citasData) {
          console.log("📅 Datos de citas cargadas:", JSON.stringify(citasData, null, 2));

          const citasFormateadas: Cita[] = citasData.map((cita) => {
            const fechaVisita = new Date(cita.fecha_visita);
            const fechaLocal = `${fechaVisita.getFullYear()}-${(fechaVisita.getMonth() + 1).toString().padStart(2, '0')}-${fechaVisita.getDate().toString().padStart(2, '0')}`;

            // Acceder al primer elemento del array incidencias
            const incidencia = cita.incidencias?.[0];

            // Para el número de solicitud: usar el campo directo de la cita o fallback al de la incidencia
            const numSolicitud = cita.num_solicitud || incidencia?.num_solicitud || '';

            // Para la descripción:
            // - Si es proveedor: usar descripcion_proveedor de proveedor_casos
            // - Si es cliente/gestor: usar descripcion de incidencias
            const proveedorCaso = cita.proveedor_casos?.[0];
            const descripcionCita = tipoInstitucion === 'Proveedor'
              ? (proveedorCaso?.descripcion_proveedor || cita.descripcion || '')
              : (incidencia?.descripcion || cita.descripcion || '');

            console.log("🔍 Procesando cita:", {
              id: cita.id,
              tipoInstitucion,
              incidencia_id: cita.incidencia_id,
              proveedor_id: cita.proveedor_id,
              centro_nombre: cita.centro_nombre,
              proveedor_nombre: cita.proveedor_nombre,
              num_solicitud_directo: cita.num_solicitud,
              descripcion_directa: cita.descripcion
            });

            return {
            id: cita.id,
            incidencia_id: cita.incidencia_id,
            fecha: fechaLocal,
            hora: cita.horario === 'mañana' ? 'Horario de mañana' : 'Horario de tarde',
            proveedor_nombre: cita.proveedor_nombre || 'Proveedor desconocido',
            centro_nombre: cita.centro_nombre || undefined,
            incidencia_num: numSolicitud,
            descripcion: descripcionCita,
            estado: cita.estado
          };
          });

          setCitas(citasFormateadas);
        }
      }
    } catch (error) {
      console.error("Error cargando citas:", error);
    } finally {
      setLoading(false);
    }
  };

  const obtenerDiasDelMes = () => {
    const año = fechaSeleccionada.getFullYear();
    const mes = fechaSeleccionada.getMonth();

    // Obtener el primer día del mes
    const primerDia = new Date(año, mes, 1);
    // getDay() retorna 0=Domingo, 1=Lunes, etc. Ajustamos para que Lunes=0
    let diaSemanaInicio = primerDia.getDay() - 1;
    if (diaSemanaInicio === -1) diaSemanaInicio = 6; // Si es domingo, lo ponemos al final

    const ultimoDia = new Date(año, mes + 1, 0);
    const diasEnMes = ultimoDia.getDate();

    // Añadir espacios vacíos al inicio
    const dias: (number | null)[] = [];
    for (let i = 0; i < diaSemanaInicio; i++) {
      dias.push(null);
    }

    // Añadir los días del mes
    for (let i = 1; i <= diasEnMes; i++) {
      dias.push(i);
    }

    return dias;
  };

  const obtenerCitasDelDia = (dia: number) => {
    const año = fechaSeleccionada.getFullYear();
    const mes = fechaSeleccionada.getMonth();
    const fechaBuscada = `${año}-${(mes + 1).toString().padStart(2, '0')}-${dia.toString().padStart(2, '0')}`;

    return citas.filter(cita => cita.fecha === fechaBuscada);
  };

  const obtenerCitasHoy = () => {
    const hoy = new Date();
    const fechaHoy = `${hoy.getFullYear()}-${(hoy.getMonth() + 1).toString().padStart(2, '0')}-${hoy.getDate().toString().padStart(2, '0')}`;
    return citas.filter(cita => cita.fecha === fechaHoy);
  };

  const cambiarMes = (direccion: number) => {
    const nuevaFecha = new Date(fechaSeleccionada);
    nuevaFecha.setMonth(nuevaFecha.getMonth() + direccion);
    setFechaSeleccionada(nuevaFecha);
  };

  const irAlChatIncidencia = (incidenciaId: string) => {
    if (esProveedor) {
      router.push(`/incidencias/${incidenciaId}/chat-proveedor`);
    } else if (perfil?.rol === 'Control') {
      // Control no navega a ningún chat por ahora
      console.log('Control no puede navegar al chat desde el calendario');
      return;
    } else {
      // Cliente/Gestor navega al chat control-cliente
      router.push(`/incidencias/${incidenciaId}/chat-control-cliente`);
    }
  };


  const abrirModalCancelar = (cita: Cita) => {
    setCitaSeleccionada(cita);
    setMostrarModalCancelar(true);
  };

  const cancelarVisita = async () => {
    if (!citaSeleccionada || !perfil) return;

    try {
      setEnviando(true);

      // Obtener el proveedor_caso_id asociado a esta cita
      const { data: citaData } = await supabase
        .from("citas_proveedores")
        .select("proveedor_id, incidencia_id")
        .eq("id", citaSeleccionada.id)
        .single();

      let proveedorCasoId = null;
      if (citaData) {
        const { data: proveedorCasoData } = await supabase
          .from("proveedor_casos")
          .select("id")
          .eq("incidencia_id", citaData.incidencia_id)
          .eq("proveedor_id", citaData.proveedor_id)
          .maybeSingle();

        proveedorCasoId = proveedorCasoData?.id;
      }

      // Actualizar estado de la cita
      const { error: errorCita } = await supabase
        .from("citas_proveedores")
        .update({ estado: 'cancelada' })
        .eq("id", citaSeleccionada.id);

      if (errorCita) throw errorCita;

      // Formatear fecha y horario igual que cuando se calendariza
      const fechaFormateada = new Date(citaSeleccionada.fecha).toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const horarioTexto = citaSeleccionada.hora.toLowerCase().includes('mañana')
        ? 'horario de mañana'
        : 'horario de tarde';

      const mensajeCancelacion = `Visita cancelada para el ${fechaFormateada} en ${horarioTexto}.`;

      // Crear comentario de sistema avisando de la cancelación
      console.log("Creando comentario de cancelación para incidencia:", citaSeleccionada.incidencia_id);
      const comentarioCreado = await crearComentario({
        incidencia_id: citaSeleccionada.incidencia_id,
        proveedor_caso_id: proveedorCasoId || undefined,
        ambito: 'ambos',
        autor_id: perfil.persona_id,
        autor_email: perfil.email,
        autor_rol: perfil.rol,
        cuerpo: mensajeCancelacion,
        es_sistema: true
      });

      if (!comentarioCreado) {
        console.error("Error creando comentario de cancelación");
        // No lanzamos error porque la cita ya está cancelada
      } else {
        console.log("Comentario de cancelación creado exitosamente:", comentarioCreado);
      }

      setMostrarModalCancelar(false);
      setCitaSeleccionada(null);

      // Recargar citas
      await cargarCitas();

    } catch (error) {
      console.error("Error cancelando visita:", error);
      alert('Error al cancelar la visita. Por favor, intente de nuevo.');
    } finally {
      setEnviando(false);
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: PALETA.bg }}>
        <div className="text-white">Cargando calendario...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: PALETA.bg }}>
      <div className="px-6 py-6">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-lg tracking-[0.3em]" style={{ color: PALETA.texto }}>
            {esProveedor ? 'MIS VISITAS PROGRAMADAS:' : 'CALENDARIO DE CITAS CON PROVEEDORES:'}
          </h1>
        </div>

        {/* Citas para hoy */}
        {obtenerCitasHoy().length > 0 && (
          <div className="mb-6 bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4" style={{ color: PALETA.textoOscuro }}>
              📅 Citas para hoy ({new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })})
            </h2>
            <div className="space-y-3">
              {obtenerCitasHoy().map(cita => (
                <div
                  key={cita.id}
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                  style={{ borderColor: PALETA.verdeSombra, backgroundColor: '#fefefe' }}
                  onClick={() => irAlChatIncidencia(cita.incidencia_id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className="px-3 py-1 rounded text-sm font-medium text-white"
                          style={{ backgroundColor: '#D4C5A9' }}
                        >
                          {cita.hora}
                        </span>
                        <span className="font-semibold" style={{ color: PALETA.textoOscuro }}>
                          {cita.incidencia_num}
                        </span>
                      </div>
                      {esProveedor ? (
                        <p className="text-sm mb-1" style={{ color: PALETA.textoOscuro }}>
                          <span className="font-medium">Centro:</span> {cita.centro_nombre || 'Centro desconocido'}
                        </p>
                      ) : (
                        <>
                          <p className="text-sm mb-1" style={{ color: PALETA.textoOscuro }}>
                            <span className="font-medium">Proveedor:</span> {cita.proveedor_nombre}
                          </p>
                          {cita.centro_nombre && (
                            <p className="text-sm mb-1" style={{ color: PALETA.textoOscuro }}>
                              <span className="font-medium">Centro:</span> {cita.centro_nombre}
                            </p>
                          )}
                        </>
                      )}
                      <p className="text-sm text-gray-600">
                        {cita.descripcion}
                      </p>
                    </div>
                    {esProveedor && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          abrirModalCancelar(cita);
                        }}
                        className="ml-4 px-3 py-1 text-xs rounded border hover:bg-red-50 transition-colors"
                        style={{ color: '#dc2626', borderColor: '#dc2626' }}
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Navegación del mes */}
        <div className="flex items-center justify-between mb-6 bg-white rounded-lg p-4 shadow">
          <button
            onClick={() => cambiarMes(-1)}
            className="px-4 py-2 rounded transition-colors"
            style={{ backgroundColor: PALETA.filtros, color: 'white' }}
          >
            ← Anterior
          </button>

          <h2 className="text-xl font-semibold" style={{ color: PALETA.textoOscuro }}>
            {fechaSeleccionada.toLocaleDateString('es-ES', {
              month: 'long',
              year: 'numeric'
            })}
          </h2>

          <button
            onClick={() => cambiarMes(1)}
            className="px-4 py-2 rounded transition-colors"
            style={{ backgroundColor: PALETA.filtros, color: 'white' }}
          >
            Siguiente →
          </button>
        </div>

        {/* Calendario */}
        <div className="bg-white rounded-lg shadow p-6">
          {/* Días de la semana */}
          <div className="grid grid-cols-7 gap-2 mb-4">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(dia => (
              <div key={dia} className="text-center font-semibold py-2" style={{ color: PALETA.textoOscuro }}>
                {dia}
              </div>
            ))}
          </div>

          {/* Días del mes */}
          <div className="grid grid-cols-7 gap-2">
            {obtenerDiasDelMes().map((dia, index) => {
              if (dia === null) {
                // Celda vacía para alinear el calendario
                return (
                  <div
                    key={`empty-${index}`}
                    className="min-h-[100px] border rounded p-2"
                    style={{ borderColor: PALETA.verdeSombra, backgroundColor: '#f9f9f9' }}
                  />
                );
              }

              const citasDelDia = obtenerCitasDelDia(dia);
              return (
                <div
                  key={dia}
                  className="min-h-[100px] border rounded p-2 bg-gray-50"
                  style={{ borderColor: PALETA.verdeSombra }}
                >
                  <div className="font-semibold mb-1" style={{ color: PALETA.textoOscuro }}>
                    {dia}
                  </div>

                  {citasDelDia.map(cita => {
                    const tooltipText = esProveedor
                      ? `${cita.hora} - ${cita.centro_nombre || 'Centro desconocido'}: ${cita.descripcion}`
                      : `${cita.hora} - ${cita.proveedor_nombre}${cita.centro_nombre ? ` - ${cita.centro_nombre}` : ''}: ${cita.descripcion}`;

                    return (
                    <div
                      key={cita.id}
                      className="text-xs p-1 mb-1 rounded text-white relative group"
                      style={{ backgroundColor: '#D4C5A9' }}
                      title={tooltipText}
                    >
                      <div
                        className="cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => irAlChatIncidencia(cita.incidencia_id)}
                      >
                        <div className="font-semibold">{cita.hora}</div>
                        {esProveedor ? (
                          <div className="truncate">{cita.centro_nombre || 'Centro desconocido'}</div>
                        ) : (
                          <>
                            <div className="truncate">{cita.proveedor_nombre}</div>
                            {cita.centro_nombre && (
                              <div className="truncate text-[10px] opacity-90">{cita.centro_nombre}</div>
                            )}
                          </>
                        )}
                        <div className="truncate">{cita.incidencia_num}</div>
                      </div>
                      {esProveedor && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            abrirModalCancelar(cita);
                          }}
                          className="absolute top-0 right-0 text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]"
                          title="Cancelar visita"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  );
                  })}
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Modal Cancelar Visita */}
      {mostrarModalCancelar && citaSeleccionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div
            className="rounded-lg shadow-lg border max-w-md w-full"
            style={{
              backgroundColor: PALETA.card,
              borderColor: PALETA.headerTable
            }}
          >
            <div
              className="px-6 py-4 border-b"
              style={{
                backgroundColor: '#fef2f2',
                borderColor: '#ef4444'
              }}
            >
              <h3 className="font-semibold text-lg" style={{ color: '#dc2626' }}>
                Cancelar Visita
              </h3>
            </div>

            <div className="p-6">
              <div className="bg-gray-50 p-3 rounded border" style={{ borderColor: PALETA.verdeSombra }}>
                <p className="text-sm font-semibold mb-1" style={{ color: PALETA.textoOscuro }}>
                  {citaSeleccionada.incidencia_num}
                </p>
                <p className="text-xs mb-1" style={{ color: PALETA.textoOscuro }}>
                  <span className="font-medium">Centro:</span> {citaSeleccionada.centro_nombre || 'Centro desconocido'}
                </p>
                <p className="text-xs mb-1" style={{ color: PALETA.textoOscuro }}>
                  <span className="font-medium">Fecha y horario:</span> {citaSeleccionada.fecha} - {citaSeleccionada.hora}
                </p>
                <p className="text-xs truncate" style={{ color: PALETA.textoOscuro }}>
                  <span className="font-medium">Descripción:</span> {citaSeleccionada.descripcion}
                </p>
              </div>
            </div>

            <div className="px-6 py-4 border-t flex gap-3 justify-end" style={{ borderColor: PALETA.verdeSombra }}>
              <button
                onClick={() => {
                  setMostrarModalCancelar(false);
                  setCitaSeleccionada(null);
                }}
                className="px-4 py-2 text-sm rounded border hover:bg-gray-50 transition-colors"
                style={{ color: PALETA.textoOscuro, borderColor: '#d1d5db' }}
                disabled={enviando}
              >
                No, mantener
              </button>
              <button
                onClick={cancelarVisita}
                disabled={enviando}
                className="px-6 py-2 text-sm text-white rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                style={{ backgroundColor: '#dc2626' }}
              >
                {enviando ? 'Cancelando...' : 'Sí, cancelar visita'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}