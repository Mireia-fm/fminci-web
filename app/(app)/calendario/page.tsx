"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { PALETA } from "@/lib/theme";

type Cita = {
  id: string;
  incidencia_id: string;
  fecha: string;
  hora: string;
  proveedor_nombre: string;
  incidencia_num: string;
  descripcion: string;
  estado: string;
};

type Incidencia = {
  id: string;
  num_solicitud: string;
  descripcion: string;
};

export default function CalendarioPage() {
  const router = useRouter();
  const { perfil, loading: loadingAuth, proveedorId } = useAuth();
  const [citas, setCitas] = useState<Cita[]>([]);
  const [loading, setLoading] = useState(true);
  const [fechaSeleccionada, setFechaSeleccionada] = useState(new Date());
  const [esProveedor, setEsProveedor] = useState(false);
  const [mostrarModalNuevaVisita, setMostrarModalNuevaVisita] = useState(false);
  const [incidenciasDisponibles, setIncidenciasDisponibles] = useState<Incidencia[]>([]);
  const [formularioVisita, setFormularioVisita] = useState({
    incidencia_id: '',
    fecha_visita: '',
    horario: 'mañana'
  });
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
        let citasData;

        if (tipoInstitucion === 'Proveedor') {
          setEsProveedor(true);
          // Vista para proveedores: mostrar las visitas que HA calendarizado
          const { data } = await supabase
            .from("citas_proveedores")
            .select(`
              id,
              fecha_visita,
              horario,
              estado,
              incidencias!inner(
                id,
                num_solicitud,
                descripcion,
                instituciones!institucion_id(nombre)
              )
            `)
            .eq("proveedor_id", institucionId)
            .eq("estado", "programada")
            .order("fecha_visita", { ascending: true });

          citasData = data;
        } else {
          // Vista para clientes/centros: mostrar las visitas calendarizadas para sus incidencias
          const { data } = await supabase
            .from("citas_proveedores")
            .select(`
              id,
              fecha_visita,
              horario,
              estado,
              incidencias!inner(
                id,
                num_solicitud,
                descripcion,
                institucion_id
              ),
              instituciones!proveedor_id(
                nombre
              )
            `)
            .eq("incidencias.institucion_id", institucionId)
            .eq("estado", "programada")
            .order("fecha_visita", { ascending: true });

          citasData = data;
        }

        if (citasData) {
          const citasFormateadas: Cita[] = citasData.map((cita: { id: string; fecha_visita: string; horario: string; estado: string; incidencias?: { id?: string; num_solicitud?: string; descripcion?: string; instituciones?: { nombre?: string } }; instituciones?: { nombre?: string } }) => {
            const fechaVisita = new Date(cita.fecha_visita);
            const fechaLocal = `${fechaVisita.getFullYear()}-${(fechaVisita.getMonth() + 1).toString().padStart(2, '0')}-${fechaVisita.getDate().toString().padStart(2, '0')}`;

            return {
            id: cita.id,
            incidencia_id: cita.incidencias?.id || '',
            fecha: fechaLocal,
            hora: cita.horario === 'mañana' ? 'Horario de mañana' : 'Horario de tarde',
            proveedor_nombre: tipoInstitucion === 'Proveedor'
              ? cita.incidencias?.instituciones?.nombre || 'Centro desconocido'
              : cita.instituciones?.nombre || 'Proveedor desconocido',
            incidencia_num: cita.incidencias?.num_solicitud || '',
            descripcion: cita.incidencias?.descripcion || '',
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

  const abrirModalNuevaVisita = async () => {
    if (!perfil || !esProveedor) return;

    // Cargar incidencias asignadas al proveedor que no estén cerradas/anuladas
    const institucionId = perfil.instituciones?.[0]?.institucion_id;

    const { data: incidencias } = await supabase
      .from("incidencias")
      .select(`
        id,
        num_solicitud,
        descripcion,
        proveedor_casos!inner(estado_proveedor, activo)
      `)
      .eq("proveedor_casos.proveedor_id", institucionId)
      .eq("proveedor_casos.activo", true)
      .in("proveedor_casos.estado_proveedor", ["Abierta", "En resolución", "Ofertada", "Oferta aprobada", "Resuelta", "Valorada"])
      .order("num_solicitud", { ascending: false });

    if (incidencias) {
      setIncidenciasDisponibles(incidencias.map(inc => ({
        id: inc.id,
        num_solicitud: inc.num_solicitud,
        descripcion: inc.descripcion
      })));
    }

    setMostrarModalNuevaVisita(true);
  };

  const crearVisita = async () => {
    if (!formularioVisita.incidencia_id || !formularioVisita.fecha_visita || !perfil) {
      alert('Por favor, complete todos los campos');
      return;
    }

    try {
      setEnviando(true);

      const institucionId = perfil.instituciones?.[0]?.institucion_id;

      const { error } = await supabase
        .from("citas_proveedores")
        .insert({
          incidencia_id: formularioVisita.incidencia_id,
          proveedor_id: institucionId,
          fecha_visita: formularioVisita.fecha_visita,
          horario: formularioVisita.horario,
          estado: 'programada'
        });

      if (error) throw error;

      // Resetear formulario y cerrar modal
      setFormularioVisita({
        incidencia_id: '',
        fecha_visita: '',
        horario: 'mañana'
      });
      setMostrarModalNuevaVisita(false);

      // Recargar citas
      await cargarCitas();

    } catch (error) {
      console.error("Error creando visita:", error);
      alert('Error al crear la visita. Por favor, intente de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  const abrirModalCancelar = (cita: Cita) => {
    setCitaSeleccionada(cita);
    setMostrarModalCancelar(true);
  };

  const cancelarVisita = async () => {
    if (!citaSeleccionada) return;

    try {
      setEnviando(true);

      const { error } = await supabase
        .from("citas_proveedores")
        .update({ estado: 'cancelada' })
        .eq("id", citaSeleccionada.id);

      if (error) throw error;

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

          {esProveedor && (
            <button
              onClick={abrirModalNuevaVisita}
              className="px-4 py-2 text-sm text-white rounded hover:opacity-90 transition-opacity"
              style={{ backgroundColor: PALETA.verdeClaro }}
            >
              + Nueva Visita
            </button>
          )}
        </div>

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

                  {citasDelDia.map(cita => (
                    <div
                      key={cita.id}
                      className="text-xs p-1 mb-1 rounded text-white relative group"
                      style={{ backgroundColor: '#D4C5A9' }}
                      title={`${cita.hora} - ${cita.proveedor_nombre}: ${cita.descripcion}`}
                    >
                      <div
                        className="cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => irAlChatIncidencia(cita.incidencia_id)}
                      >
                        <div className="font-semibold">{cita.hora}</div>
                        <div className="truncate">{cita.proveedor_nombre}</div>
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
                  ))}
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Modal Nueva Visita */}
      {mostrarModalNuevaVisita && (
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
                backgroundColor: PALETA.headerTable,
                borderColor: PALETA.verdeSombra
              }}
            >
              <h3 className="font-semibold text-lg" style={{ color: PALETA.textoOscuro }}>
                Nueva Visita
              </h3>
            </div>

            <div className="p-6 space-y-4">
              {/* Seleccionar incidencia */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                  Incidencia
                </label>
                <select
                  value={formularioVisita.incidencia_id}
                  onChange={(e) => setFormularioVisita({ ...formularioVisita, incidencia_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2"
                  style={{
                    borderColor: PALETA.verdeSombra,
                    focusRingColor: PALETA.verdeClaro
                  }}
                >
                  <option value="">Seleccione una incidencia</option>
                  {incidenciasDisponibles.map(inc => (
                    <option key={inc.id} value={inc.id}>
                      {inc.num_solicitud} - {inc.descripcion.substring(0, 50)}...
                    </option>
                  ))}
                </select>
              </div>

              {/* Fecha */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                  Fecha de la visita
                </label>
                <input
                  type="date"
                  value={formularioVisita.fecha_visita}
                  onChange={(e) => setFormularioVisita({ ...formularioVisita, fecha_visita: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2"
                  style={{
                    borderColor: PALETA.verdeSombra
                  }}
                />
              </div>

              {/* Horario */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                  Horario
                </label>
                <select
                  value={formularioVisita.horario}
                  onChange={(e) => setFormularioVisita({ ...formularioVisita, horario: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2"
                  style={{
                    borderColor: PALETA.verdeSombra
                  }}
                >
                  <option value="mañana">Horario de mañana</option>
                  <option value="tarde">Horario de tarde</option>
                </select>
              </div>
            </div>

            <div className="px-6 py-4 border-t flex gap-3 justify-end" style={{ borderColor: PALETA.verdeSombra }}>
              <button
                onClick={() => {
                  setMostrarModalNuevaVisita(false);
                  setFormularioVisita({ incidencia_id: '', fecha_visita: '', horario: 'mañana' });
                }}
                className="px-4 py-2 text-sm rounded border hover:bg-gray-50 transition-colors"
                style={{ color: PALETA.textoOscuro, borderColor: '#d1d5db' }}
                disabled={enviando}
              >
                Cancelar
              </button>
              <button
                onClick={crearVisita}
                disabled={enviando}
                className="px-6 py-2 text-sm text-white rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                style={{ backgroundColor: PALETA.verdeClaro }}
              >
                {enviando ? 'Creando...' : 'Crear Visita'}
              </button>
            </div>
          </div>
        </div>
      )}

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
              <p className="text-sm mb-4" style={{ color: PALETA.textoOscuro }}>
                ¿Está seguro de que desea cancelar esta visita?
              </p>
              <div className="bg-gray-50 p-3 rounded border" style={{ borderColor: PALETA.verdeSombra }}>
                <p className="text-sm font-semibold" style={{ color: PALETA.textoOscuro }}>
                  {citaSeleccionada.incidencia_num}
                </p>
                <p className="text-xs" style={{ color: PALETA.textoOscuro }}>
                  {citaSeleccionada.fecha} - {citaSeleccionada.hora}
                </p>
                <p className="text-xs truncate" style={{ color: PALETA.textoOscuro }}>
                  {citaSeleccionada.descripcion}
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