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

export default function CalendarioPage() {
  const router = useRouter();
  const { perfil, loading: loadingAuth, proveedorId } = useAuth();
  const [citas, setCitas] = useState<Cita[]>([]);
  const [loading, setLoading] = useState(true);
  const [fechaSeleccionada, setFechaSeleccionada] = useState(new Date());
  const [esProveedor, setEsProveedor] = useState(false);

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

    const ultimoDia = new Date(año, mes + 1, 0);
    const diasEnMes = ultimoDia.getDate();

    const dias = [];
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
        <h1 className="text-lg tracking-[0.3em] mb-8" style={{ color: PALETA.texto }}>
          {esProveedor ? 'MIS VISITAS PROGRAMADAS:' : 'CALENDARIO DE CITAS CON PROVEEDORES:'}
        </h1>

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
            {obtenerDiasDelMes().map(dia => {
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
                      className="text-xs p-1 mb-1 rounded text-white cursor-pointer hover:opacity-80 transition-opacity"
                      style={{ backgroundColor: '#D4C5A9' }}
                      title={`${cita.hora} - ${cita.proveedor_nombre}: ${cita.descripcion}${perfil?.rol !== 'Control' ? ' (Click para ir al chat)' : ''}`}
                      onClick={() => irAlChatIncidencia(cita.incidencia_id)}
                    >
                      <div className="font-semibold">{cita.hora}</div>
                      <div className="truncate">{cita.proveedor_nombre}</div>
                      <div className="truncate">{cita.incidencia_num}</div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}