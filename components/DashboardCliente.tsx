"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { obtenerConteoPorEstado, obtenerConteoPorCentro } from "@/lib/incidenciasService";
import { PALETA, COLORES_ESTADOS_CLIENTE, COLORES_ESTADOS_PROVEEDOR, ESTADOS_CLIENTE, ESTADOS_PROVEEDOR } from "@/lib/theme";

type Row = { estado: string; n: number };
type CentroData = {
  nombre: string;
  incidencias: { estado_cliente: string; n: number; }[]
};

export default function DashboardCliente() {
  const router = useRouter();
  const { perfil, loading: loadingAuth } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [vistaActiva, setVistaActiva] = useState<'cliente' | 'proveedor'>('cliente');
  const [metricasProveedor, setMetricasProveedor] = useState<Row[]>([]);
  const [centrosGestor, setCentrosGestor] = useState<CentroData[]>([]);

  useEffect(() => {
    if (!loadingAuth && perfil) {
      cargarDatos();
    }
  }, [loadingAuth, perfil]);

  const cargarDatos = async () => {
    if (!perfil) return;

    try {
      // Cargar métricas de cliente usando servicio centralizado
      const conteosCliente = await obtenerConteoPorEstado(perfil, "cliente");
      setRows(conteosCliente.map(c => ({ estado: c.estado, n: c.n })));

      // Para Gestores: cargar datos por centro (ahora optimizado, sin N+1)
      if (perfil.rol === "Gestor") {
        const centros = await obtenerConteoPorCentro(perfil);
        setCentrosGestor(centros);
      }

      // Para Control: cargar también métricas de proveedor
      if (perfil.rol === "Control") {
        const conteosProveedor = await obtenerConteoPorEstado(perfil, "proveedor");
        setMetricasProveedor(conteosProveedor.map(c => ({ estado: c.estado, n: c.n })));
      }
    } catch (error) {
      console.error("Error cargando datos:", error);
    } finally {
      setLoading(false);
    }
  };

  const cards = useMemo(() => {
    if (vistaActiva === 'cliente') {
      const estadosMap = new Map(rows.map(r => [r.estado, r.n]));
      return ESTADOS_CLIENTE.map(estado => ({
        key: estado,
        color: COLORES_ESTADOS_CLIENTE[estado],
        n: estadosMap.get(estado) ?? 0
      }));
    } else {
      const estadosMap = new Map(metricasProveedor.map(r => [r.estado, r.n]));
      return ESTADOS_PROVEEDOR.map(estado => ({
        key: estado,
        color: COLORES_ESTADOS_PROVEEDOR[estado],
        n: estadosMap.get(estado) ?? 0
      }));
    }
  }, [rows, metricasProveedor, vistaActiva]);

  const handleCircleClick = (estado: string) => {
    const params = new URLSearchParams();

    if (vistaActiva === 'cliente') {
      params.set('filtroEstado', estado);
      router.push(`/incidencias?${params.toString()}`);
    } else {
      router.push(`/incidencias?estado_proveedor=${encodeURIComponent(estado)}`);
    }
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
      <div className="px-6 pt-6">
        <Link
          href="/incidencias/nueva"
          className="inline-flex items-center gap-2 rounded px-4 py-2 hover:scale-105 transition-transform"
          style={{ backgroundColor: PALETA.btn, color: "#2b2b2b" }}
        >
          <span className="text-xl">＋</span>
          <span className="tracking-wide">Añadir nueva incidencia</span>
        </Link>
      </div>

      <div className="px-6 mt-24 mb-8">
        {/* Botones de alternancia solo para usuarios Control */}
        {perfil?.rol === 'Control' && (
          <div className="flex justify-center gap-2 mb-6">
            <button
              onClick={() => setVistaActiva('cliente')}
              className={`px-6 py-3 rounded-lg text-sm font-medium transition-all ${
                vistaActiva === 'cliente' ? 'shadow-lg' : 'hover:shadow-md'
              }`}
              style={{
                backgroundColor: 'white',
                color: PALETA.bg,
                border: `2px solid ${PALETA.bg}`,
                fontWeight: vistaActiva === 'cliente' ? 'bold' : 'normal'
              }}
            >
              Vista Cliente
            </button>
            <button
              onClick={() => setVistaActiva('proveedor')}
              className={`px-6 py-3 rounded-lg text-sm font-medium transition-all ${
                vistaActiva === 'proveedor' ? 'shadow-lg' : 'hover:shadow-md'
              }`}
              style={{
                backgroundColor: 'white',
                color: PALETA.bg,
                border: `2px solid ${PALETA.bg}`,
                fontWeight: vistaActiva === 'proveedor' ? 'bold' : 'normal'
              }}
            >
              Vista Proveedor
            </button>
          </div>
        )}
      </div>

      <section className="px-6 pb-12 main-content-mobile">
        <div className="space-y-4">
          {vistaActiva === 'cliente' ? (
            /* Layout cliente: 4 + 2 */
            <div className="relative max-w-4xl mx-auto">
              {/* Primera fila - estados originales */}
              <div className="flex justify-center gap-6 mb-4 dashboard-cards-mobile flex-wrap">
                {cards.slice(0, 4).map(c => (
                  <div
                    key={c.key}
                    onClick={() => handleCircleClick(c.key)}
                    className="flex flex-col items-center justify-center rounded-full cursor-pointer hover:scale-105 transition-transform dashboard-card-circle"
                    style={{
                      width: 190, height: 190, backgroundColor: c.color,
                      boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
                    }}
                  >
                    <div className="text-3xl md:text-5xl font-semibold text-white">{c.n}</div>
                    <div className="mt-2 text-white/90 text-xs md:text-base text-center px-2">{c.key}</div>
                  </div>
                ))}
              </div>

              {/* Segunda fila - estados nuevos centrados exactamente */}
              <div className="flex justify-center">
                <div className="flex dashboard-cards-mobile flex-wrap justify-center" style={{ gap: '262px' }}>
                  {cards.slice(4, 6).map(c => (
                    <div
                      key={c.key}
                      onClick={() => handleCircleClick(c.key)}
                      className="flex flex-col items-center justify-center rounded-full cursor-pointer hover:scale-105 transition-transform dashboard-card-circle"
                      style={{
                        width: 190, height: 190, backgroundColor: c.color,
                        boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
                      }}
                    >
                      <div className="text-3xl md:text-5xl font-semibold text-white">{c.n}</div>
                      <div className="mt-2 text-white/90 text-xs md:text-base text-center px-2">{c.key}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Layout proveedor: 5 + 5 */
            <div className="relative max-w-6xl mx-auto">
              {/* Primera fila - 5 estados */}
              <div className="flex justify-center gap-4 mb-4">
                {cards.slice(0, 5).map(c => (
                  <div
                    key={c.key}
                    onClick={() => handleCircleClick(c.key)}
                    className="flex flex-col items-center justify-center rounded-full cursor-pointer hover:scale-105 transition-transform"
                    style={{
                      width: 170, height: 170, backgroundColor: c.color,
                      boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
                    }}
                  >
                    <div className="text-2xl md:text-4xl font-semibold text-white">{c.n}</div>
                    <div className="mt-2 text-white/90 text-xs md:text-sm text-center px-2">{c.key}</div>
                  </div>
                ))}
              </div>

              {/* Segunda fila - 5 estados */}
              <div className="flex justify-center gap-4">
                {cards.slice(5, 10).map(c => (
                  <div
                    key={c.key}
                    onClick={() => handleCircleClick(c.key)}
                    className="flex flex-col items-center justify-center rounded-full cursor-pointer hover:scale-105 transition-transform"
                    style={{
                      width: 170, height: 170, backgroundColor: c.color,
                      boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
                    }}
                  >
                    <div className="text-2xl md:text-4xl font-semibold text-white">{c.n}</div>
                    <div className="mt-2 text-white/90 text-xs md:text-sm text-center px-2">{c.key}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Sección de centros para Gestores */}
      {perfil?.rol === 'Gestor' && centrosGestor.length > 0 && (
        <section className="px-6 pb-12">
          <h2 className="text-lg tracking-[0.3em] mb-8" style={{ color: PALETA.texto }}>
            MIS CENTROS:
          </h2>
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {centrosGestor.map((centro, index) => {
              const totalIncidencias = centro.incidencias.reduce((total, row) => total + row.n, 0);
              const abiertas = centro.incidencias.find(row => row.estado_cliente === 'Abierta')?.n || 0;
              const enTramitacion = centro.incidencias.find(row => row.estado_cliente === 'En tramitación')?.n || 0;
              const cerradas = centro.incidencias.find(row => row.estado_cliente === 'Cerrada')?.n || 0;

              return (
                <div
                  key={index}
                  className="p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer"
                  style={{ backgroundColor: 'white' }}
                  onClick={() => {
                    router.push(`/incidencias?centro=${encodeURIComponent(centro.nombre)}`);
                  }}
                >
                  <h3 className="font-medium text-lg mb-3 text-gray-800 truncate" title={centro.nombre}>
                    {centro.nombre}
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span style={{ color: PALETA.b1 }}>Abiertas:</span>
                      <span className="font-medium">{abiertas}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span style={{ color: PALETA.b2 }}>En tramitación:</span>
                      <span className="font-medium">{enTramitacion}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span style={{ color: PALETA.b3 }}>Cerradas:</span>
                      <span className="font-medium">{cerradas}</span>
                    </div>
                    <hr className="my-2" />
                    <div className="flex justify-between text-sm font-semibold">
                      <span>Total:</span>
                      <span>{totalIncidencias}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
