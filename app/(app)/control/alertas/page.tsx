"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

// Force dynamic rendering
export const dynamic = 'force-dynamic';

const PALETA = {
  fondo: "#5D6D52",
  headerTable: "#D9B6A9",
  card: "#F9FAF8",
  filtros: "#E8B5A8",
  texto: "#EDF0E9",
  textoOscuro: "#4b4b4b",
};

type Alerta = {
  id: string;
  tipo: 'critica' | 'sla' | 'proveedor' | 'escalada';
  titulo: string;
  descripcion: string;
  incidencia_id?: string;
  num_solicitud?: string;
  prioridad: 'alta' | 'media' | 'baja';
  fecha: string;
  centro?: string;
  proveedor?: string;
};

export default function DashboardAlertas() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filtroTipo = searchParams.get('tipo');

  const [loading, setLoading] = useState(true);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [filtroActivo, setFiltroActivo] = useState<string>(filtroTipo || 'todas');

  useEffect(() => {
    cargarAlertas();
  }, [filtroActivo]);

  const cargarAlertas = async () => {
    try {
      setLoading(true);
      const alertasGeneradas: Alerta[] = [];

      // 1. Incidencias críticas sin atender (más de 4 horas sin comentarios)
      if (filtroActivo === 'todas' || filtroActivo === 'criticas') {
        const fechaLimite = new Date();
        fechaLimite.setHours(fechaLimite.getHours() - 4);

        const { data: incidenciasCriticas } = await supabase
          .from("incidencias")
          .select(`
            id,
            num_solicitud,
            descripcion,
            centro,
            creado_en,
            estado_cliente
          `)
          .in("estado_cliente", ["Abierta", "En espera"])
          .lt("creado_en", fechaLimite.toISOString())
          .order("creado_en", { ascending: true });

        if (incidenciasCriticas) {
          for (const inc of incidenciasCriticas) {
            // Verificar si tiene comentarios recientes
            const { count } = await supabase
              .from("comentarios")
              .select("*", { count: "exact", head: true })
              .eq("incidencia_id", inc.id)
              .gte("creado_en", fechaLimite.toISOString());

            if ((count || 0) === 0) {
              alertasGeneradas.push({
                id: `critica-${inc.id}`,
                tipo: 'critica',
                titulo: `Incidencia crítica sin atender`,
                descripcion: `${inc.num_solicitud} - ${inc.descripcion?.substring(0, 100)}...`,
                incidencia_id: inc.id,
                num_solicitud: inc.num_solicitud,
                prioridad: 'alta',
                fecha: inc.creado_en,
                centro: inc.centro
              });
            }
          }
        }
      }

      // 2. Proveedores sin respuesta en 24+ horas
      if (filtroActivo === 'todas' || filtroActivo === 'proveedores') {
        const fechaLimite24h = new Date();
        fechaLimite24h.setHours(fechaLimite24h.getHours() - 24);

        const { data: proveedorCasos } = await supabase
          .from("proveedor_casos")
          .select(`
            id,
            asignado_en,
            incidencia_id,
            proveedor_id,
            estado_proveedor,
            incidencias (num_solicitud, descripcion),
            instituciones (nombre)
          `)
          .eq("activo", true)
          .eq("estado_proveedor", "Abierta")
          .lt("asignado_en", fechaLimite24h.toISOString());

        if (proveedorCasos) {
          for (const caso of proveedorCasos) {
            // Verificar si el proveedor ha comentado
            const { count } = await supabase
              .from("comentarios")
              .select("*", { count: "exact", head: true })
              .eq("incidencia_id", caso.incidencia_id)
              .eq("ambito", "proveedor")
              .gte("creado_en", caso.asignado_en);

            if ((count || 0) === 0) {
              const incidenciasData = caso.incidencias;
              const numSolicitud = Array.isArray(incidenciasData) ? incidenciasData[0]?.num_solicitud : (incidenciasData as { num_solicitud?: string })?.num_solicitud;

              const institucionesData = caso.instituciones;
              const nombreInstitucion = Array.isArray(institucionesData) ? institucionesData[0]?.nombre : (institucionesData as { nombre?: string })?.nombre;

              alertasGeneradas.push({
                id: `proveedor-${caso.id}`,
                tipo: 'proveedor',
                titulo: `Proveedor sin respuesta +24h`,
                descripcion: `${numSolicitud} - Asignado a ${nombreInstitucion}`,
                incidencia_id: caso.incidencia_id,
                num_solicitud: numSolicitud,
                prioridad: 'media',
                fecha: caso.asignado_en,
                proveedor: nombreInstitucion
              });
            }
          }
        }
      }

      // 3. SLA próximos a vencer (simulado - 48h para resolución)
      if (filtroActivo === 'todas' || filtroActivo === 'sla') {
        const fechaSLA = new Date();
        fechaSLA.setHours(fechaSLA.getHours() - 40); // 8 horas antes del vencimiento

        const { data: incidenciasSLA } = await supabase
          .from("incidencias")
          .select("id, num_solicitud, descripcion, centro, creado_en")
          .in("estado_cliente", ["Abierta", "En espera", "En tramitación"])
          .lt("creado_en", fechaSLA.toISOString());

        if (incidenciasSLA) {
          incidenciasSLA.forEach(inc => {
            alertasGeneradas.push({
              id: `sla-${inc.id}`,
              tipo: 'sla',
              titulo: `SLA próximo a vencer`,
              descripcion: `${inc.num_solicitud} - Vence en menos de 8 horas`,
              incidencia_id: inc.id,
              num_solicitud: inc.num_solicitud,
              prioridad: 'alta',
              fecha: inc.creado_en,
              centro: inc.centro
            });
          });
        }
      }

      // Ordenar por prioridad y fecha
      alertasGeneradas.sort((a, b) => {
        const prioridadOrden = { alta: 3, media: 2, baja: 1 };
        const prioridadDiff = prioridadOrden[b.prioridad] - prioridadOrden[a.prioridad];
        if (prioridadDiff !== 0) return prioridadDiff;
        return new Date(a.fecha).getTime() - new Date(b.fecha).getTime();
      });

      setAlertas(alertasGeneradas);
    } catch (error) {
      console.error("Error cargando alertas:", error);
    } finally {
      setLoading(false);
    }
  };

  const filtros = [
    { key: 'todas', label: 'Todas', color: '#607d8b' },
    { key: 'criticas', label: 'Críticas', color: '#ff6b6b' },
    { key: 'sla', label: 'SLA', color: '#ffa726' },
    { key: 'proveedores', label: 'Proveedores', color: '#ab47bc' },
    { key: 'escaladas', label: 'Escaladas', color: '#5c6bc0' }
  ];

  const alertasFiltradas = filtroActivo === 'todas'
    ? alertas
    : alertas.filter(a => a.tipo === filtroActivo);

  const getPrioridadColor = (prioridad: string) => {
    switch (prioridad) {
      case 'alta': return '#ff6b6b';
      case 'media': return '#ffa726';
      case 'baja': return '#66bb6a';
      default: return '#607d8b';
    }
  };

  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case 'critica': return '🚨';
      case 'sla': return '⏰';
      case 'proveedor': return '👥';
      case 'escalada': return '📈';
      default: return '📋';
    }
  };

  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: PALETA.fondo }}>
      <div className="px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-lg tracking-[0.3em]" style={{ color: PALETA.texto }}>
            DASHBOARD DE ALERTAS:
          </h1>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 rounded text-white hover:opacity-90"
            style={{ backgroundColor: PALETA.filtros }}
          >
            ← Volver
          </button>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3 mb-6">
          {filtros.map(filtro => (
            <button
              key={filtro.key}
              onClick={() => setFiltroActivo(filtro.key)}
              className={`px-4 py-2 rounded text-white text-sm font-medium transition-opacity ${
                filtroActivo === filtro.key ? 'opacity-100' : 'opacity-70'
              }`}
              style={{ backgroundColor: filtro.color }}
            >
              {filtro.label}
            </button>
          ))}
        </div>

        {/* Resumen */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 rounded-lg" style={{ backgroundColor: PALETA.card }}>
            <h3 className="text-sm font-medium text-gray-600 mb-1">Total Alertas</h3>
            <p className="text-2xl font-bold" style={{ color: PALETA.textoOscuro }}>
              {alertas.length}
            </p>
          </div>
          <div className="p-4 rounded-lg" style={{ backgroundColor: PALETA.card }}>
            <h3 className="text-sm font-medium text-gray-600 mb-1">Críticas</h3>
            <p className="text-2xl font-bold text-red-600">
              {alertas.filter(a => a.prioridad === 'alta').length}
            </p>
          </div>
          <div className="p-4 rounded-lg" style={{ backgroundColor: PALETA.card }}>
            <h3 className="text-sm font-medium text-gray-600 mb-1">Proveedores</h3>
            <p className="text-2xl font-bold text-purple-600">
              {alertas.filter(a => a.tipo === 'proveedor').length}
            </p>
          </div>
          <div className="p-4 rounded-lg" style={{ backgroundColor: PALETA.card }}>
            <h3 className="text-sm font-medium text-gray-600 mb-1">SLA</h3>
            <p className="text-2xl font-bold text-orange-600">
              {alertas.filter(a => a.tipo === 'sla').length}
            </p>
          </div>
        </div>

        {/* Lista de Alertas */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12">
              <p className="text-white/80">Cargando alertas...</p>
            </div>
          ) : alertasFiltradas.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-white/80">No hay alertas para mostrar</p>
            </div>
          ) : (
            alertasFiltradas.map(alerta => (
              <div
                key={alerta.id}
                className="p-4 rounded-lg border-l-4 cursor-pointer hover:opacity-90 transition-opacity"
                style={{
                  backgroundColor: PALETA.card,
                  borderLeftColor: getPrioridadColor(alerta.prioridad)
                }}
                onClick={() => {
                  if (alerta.incidencia_id) {
                    router.push(`/incidencias/${alerta.incidencia_id}/chat-control-cliente`);
                  }
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-lg">{getTipoIcon(alerta.tipo)}</span>
                      <h3 className="font-semibold" style={{ color: PALETA.textoOscuro }}>
                        {alerta.titulo}
                      </h3>
                      <span
                        className="px-2 py-1 rounded text-xs font-medium text-white"
                        style={{ backgroundColor: getPrioridadColor(alerta.prioridad) }}
                      >
                        {alerta.prioridad.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      {alerta.descripcion}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>📅 {new Date(alerta.fecha).toLocaleDateString('es-ES')}</span>
                      {alerta.centro && <span>🏫 {alerta.centro}</span>}
                      {alerta.proveedor && <span>🏢 {alerta.proveedor}</span>}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (alerta.incidencia_id) {
                        router.push(`/incidencias/${alerta.incidencia_id}/chat-control-cliente`);
                      }
                    }}
                    className="ml-4 px-3 py-1 text-xs font-medium rounded text-white hover:opacity-90"
                    style={{ backgroundColor: PALETA.fondo }}
                  >
                    Ver Incidencia
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}