"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { obtenerConteoPorEstado } from "@/lib/incidenciasService";
import { PALETA, COLORES_ESTADOS_PROVEEDOR, ESTADOS_PROVEEDOR } from "@/lib/theme";
import { supabase } from "@/lib/supabaseClient";

type Row = { estado: string; n: number };

type Notificacion = {
  id: string;
  num_solicitud: string;
  descripcion: string;
  fecha_asignacion: string;
  institucion_nombre?: string;
  tipo: 'nueva' | 'revision' | 'anulacion';
};

export default function DashboardProveedor() {
  const router = useRouter();
  const { perfil, loading: loadingAuth, proveedorId } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [loadingNotificaciones, setLoadingNotificaciones] = useState(true);

  useEffect(() => {
    if (!loadingAuth && perfil) {
      cargarDatos();
    }
  }, [loadingAuth, perfil]);

  const cargarDatos = async () => {
    if (!perfil) return;

    try {
      // Usar el servicio centralizado
      const conteos = await obtenerConteoPorEstado(perfil, "proveedor");
      setRows(conteos);

      // Cargar notificaciones
      if (proveedorId) {
        await cargarNotificaciones(proveedorId);
      }
    } catch (error) {
      console.error("Error cargando datos:", error);
    } finally {
      setLoading(false);
      setLoadingNotificaciones(false);
    }
  };

  const cargarNotificaciones = async (proveedorIdParam: string) => {
    try {
      const { data: notificacionesData } = await supabase
        .from("proveedor_notificaciones")
        .select(`
          *,
          incidencias (
            num_solicitud,
            descripcion,
            centro,
            instituciones (nombre)
          ),
          proveedor_casos!inner (
            descripcion_proveedor
          )
        `)
        .eq("proveedor_id", proveedorIdParam)
        .eq("notificacion_vista", false)
        .order("fecha_creacion", { ascending: false });

      if (notificacionesData) {
        const notificacionesFormateadas: Notificacion[] = notificacionesData.map((notif: {
          incidencia_id?: string;
          fecha_creacion?: string;
          tipo_notificacion?: string;
          incidencias?: { num_solicitud?: string; descripcion?: string; centro?: string; instituciones?: { nombre?: string } };
          proveedor_casos?: { descripcion_proveedor?: string };
        }) => ({
          id: notif.incidencia_id || '',
          num_solicitud: notif.incidencias?.num_solicitud || "",
          descripcion: notif.proveedor_casos?.descripcion_proveedor || notif.incidencias?.descripcion || "",
          fecha_asignacion: notif.fecha_creacion || '',
          institucion_nombre: notif.incidencias?.instituciones?.nombre || notif.incidencias?.centro,
          tipo: (notif.tipo_notificacion === 'revision' ? 'revision' : notif.tipo_notificacion === 'anulacion' ? 'anulacion' : 'nueva') as 'nueva' | 'revision' | 'anulacion'
        }));

        setNotificaciones(notificacionesFormateadas);
      }
    } catch (error) {
      console.error("Error cargando notificaciones:", error);
    }
  };

  const marcarNotificacionVista = async (incidenciaId: string) => {
    if (!proveedorId) return;

    try {
      await supabase
        .from("proveedor_notificaciones")
        .update({
          notificacion_vista: true,
          fecha_vista: new Date().toISOString()
        })
        .eq("proveedor_id", proveedorId)
        .eq("incidencia_id", incidenciaId);

      router.push(`/incidencias/${incidenciaId}/chat-proveedor`);
    } catch (error) {
      console.error("Error marcando notificación como vista:", error);
      router.push(`/incidencias/${incidenciaId}/chat-proveedor`);
    }
  };

  const limpiarNotificaciones = async () => {
    if (!proveedorId) return;

    try {
      await supabase
        .from("proveedor_notificaciones")
        .update({
          notificacion_vista: true,
          fecha_vista: new Date().toISOString()
        })
        .eq("proveedor_id", proveedorId)
        .eq("notificacion_vista", false);

      setNotificaciones([]);
    } catch (error) {
      console.error("Error limpiando notificaciones:", error);
    }
  };

  const cards = useMemo(() => {
    const estadosMap = new Map(rows.map(r => [r.estado, r.n]));

    return ESTADOS_PROVEEDOR.map(estado => ({
      key: estado,
      color: COLORES_ESTADOS_PROVEEDOR[estado],
      n: estadosMap.get(estado) ?? 0
    }));
  }, [rows]);

  const navegarAIncidencias = (estado: string) => {
    router.push(`/incidencias?estado_proveedor=${encodeURIComponent(estado)}`);
  };

  if (loadingAuth || loading) {
    return (
      <main className="min-h-[calc(100vh-80px)] flex items-center justify-center" style={{ backgroundColor: PALETA.bg }}>
        <p className="text-white/80">Cargando…</p>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-80px)]" style={{ backgroundColor: PALETA.bg }}>

      {/* Sección de Notificaciones */}
      {!loadingNotificaciones && notificaciones.length > 0 && (
        <section className="px-6 mb-8">
          <div className="mb-4">
            <h3 className="text-base font-semibold" style={{ color: PALETA.texto }}>
              🔔 NOTIFICACIONES ({notificaciones.length})
            </h3>
          </div>
          <div className="space-y-3">
            {notificaciones.map((notif) => (
              <div
                key={notif.id}
                className="p-4 rounded-lg shadow-sm border-l-4"
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.95)",
                  borderLeftColor: notif.tipo === 'revision' ? PALETA.b2 : PALETA.b1
                }}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-semibold text-gray-800">
                        #{notif.num_solicitud}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        notif.tipo === 'anulacion'
                          ? 'bg-gray-200 text-gray-700'
                          : notif.tipo === 'revision'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-orange-100 text-orange-800'
                      }`}>
                        {notif.tipo === 'anulacion' ? 'ANULADA' : notif.tipo === 'revision' ? 'REQUIERE REVISIÓN' : 'NUEVA'}
                      </span>
                    </div>
                    <p className="text-gray-700 text-sm mb-2">
                      {notif.descripcion}
                    </p>
                    <div className="text-xs text-gray-500">
                      <span>Centro: {notif.institucion_nombre || "Sin especificar"}</span>
                      <span className="mx-2">•</span>
                      <span>
                        {notif.tipo === 'revision' ? 'Fecha asignación' : 'Asignada'}: {new Date(notif.fecha_asignacion).toLocaleDateString('es-ES', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => marcarNotificacionVista(notif.id)}
                    className="ml-4 px-3 py-1 text-xs font-medium rounded text-white hover:opacity-90"
                    style={{ backgroundColor: PALETA.bg }}
                  >
                    Ver Chat
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-right">
            <button
              onClick={limpiarNotificaciones}
              className="px-4 py-2 text-xs font-medium rounded text-white hover:opacity-90 transition-opacity"
              style={{ backgroundColor: PALETA.b10 }}
            >
              🗑️ Limpiar notificaciones
            </button>
          </div>
        </section>
      )}

      <section className="px-6 pb-12 pt-16">
        <div className="max-w-6xl mx-auto">
          {/* Desktop: Primera fila - 5 contadores */}
          <div className="hidden md:flex justify-center gap-4 mb-4">
            {cards.slice(0, 5).map(c => (
              <div
                key={c.key}
                className="flex flex-col items-center justify-center rounded-full cursor-pointer transition-transform hover:scale-105"
                style={{
                  width: 170, height: 170, backgroundColor: c.color,
                  boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
                }}
                onClick={() => navegarAIncidencias(c.key)}
              >
                <div className="text-4xl font-semibold text-white">{c.n}</div>
                <div className="mt-2 text-white/90 text-sm text-center px-2">{c.key}</div>
              </div>
            ))}
          </div>

          {/* Desktop: Segunda fila - 5 contadores */}
          <div className="hidden md:flex justify-center gap-4">
            {cards.slice(5, 10).map(c => (
              <div
                key={c.key}
                className="flex flex-col items-center justify-center rounded-full cursor-pointer transition-transform hover:scale-105"
                style={{
                  width: 170, height: 170, backgroundColor: c.color,
                  boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
                }}
                onClick={() => navegarAIncidencias(c.key)}
              >
                <div className="text-4xl font-semibold text-white">{c.n}</div>
                <div className="mt-2 text-white/90 text-sm text-center px-2">{c.key}</div>
              </div>
            ))}
          </div>

          {/* Móvil: Grid de 2 columnas con todos los estados */}
          <div className="grid grid-cols-2 gap-3 md:hidden">
            {cards.map(c => (
              <div
                key={c.key}
                onClick={() => navegarAIncidencias(c.key)}
                className="flex flex-col items-center justify-center rounded-full cursor-pointer hover:scale-105 transition-transform mx-auto"
                style={{
                  width: 'clamp(120px, 35vw, 150px)',
                  height: 'clamp(120px, 35vw, 150px)',
                  backgroundColor: c.color,
                  boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
                }}
              >
                <div className="text-xl font-semibold text-white">{c.n}</div>
                <div className="mt-1 text-white/90 text-[9px] text-center px-1 leading-tight">{c.key}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
