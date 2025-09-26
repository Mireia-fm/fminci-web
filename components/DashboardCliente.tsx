"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Row = { estado_cliente: string | null; n: number };

const PALETA = {
  bg: "#5D6D52",
  btn: "#C9D7A7",
  texto: "#EDF0E9",
  b1: "#E8D36A",  // Amarillo - Abierta
  b2: "#E8B5A8",  // Rosa - En resolución
  b3: "#A9B88C",  // Verde - Ofertada, Valorada, Anulada
  b4: "#8F9B83",  // Verde oscuro - Oferta aprobada, Pendiente valoración
  b5: "#D4C5A9",  // Beige cálido - Resuelta
  b6: "#C8B8A8",  // Beige rosado - En espera, Cerrada
  b7: "#C7A88F",  // Marrón claro - Oferta a revisar
  b8: "#9AAD7F",  // Verde suave - Estados secundarios
};

export default function DashboardCliente() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [vistaActiva, setVistaActiva] = useState<'cliente' | 'proveedor'>('cliente');
  const [metricasProveedor, setMetricasProveedor] = useState<Row[]>([]);
  const [tipoUsuario, setTipoUsuario] = useState<string | null>(null);
  const [centrosGestor, setCentrosGestor] = useState<{nombre: string, incidencias: Row[]}[]>([]);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      // Obtener datos del usuario actual
      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData.user?.email;

      if (userEmail) {
        const { data: persona } = await supabase
          .from("personas")
          .select("rol")
          .eq("email", userEmail)
          .maybeSingle();

        if (persona) {
          setTipoUsuario(persona.rol);
        }
      }

      // Cargar métricas de cliente
      if (userEmail) {
        // Verificar si es usuario de Control
        const { data: persona } = await supabase
          .from("personas")
          .select("rol")
          .eq("email", userEmail)
          .maybeSingle();

        if (persona?.rol === "Control") {
          // Para Control: usar la vista global
          const { data } = await supabase.from("v_incidencias_por_estado").select("*");
          setRows((data ?? []) as Row[]);
        } else {
          // Para otros usuarios: verificar si es Gestor o Cliente
          // Primero obtener datos del usuario y verificar acceso_todos_centros
          const { data: personaData } = await supabase
            .from("personas")
            .select("id, rol, acceso_todos_centros")
            .eq("email", userEmail)
            .maybeSingle();

          if (personaData?.acceso_todos_centros) {
            // Usuario con acceso a todos los centros - usar vista global
            const { data } = await supabase.from("v_incidencias_por_estado").select("*");
            setRows((data ?? []) as Row[]);
          } else if (personaData) {
            // Usuario con instituciones específicas
            const { data: personaInstituciones } = await supabase
              .from("personas")
              .select(`
                id,
                rol,
                personas_instituciones!inner(
                  institucion_id,
                  instituciones!inner(id, nombre, tipo)
                )
              `)
              .eq("email", userEmail);

            if (personaInstituciones && personaInstituciones.length > 0) {
            const esGestor = personaInstituciones[0].rol === 'Gestor';

            if (esGestor) {
              // Para Gestores: cargar todas sus instituciones
              const todasInstituciones = personaInstituciones[0].personas_instituciones;
              const centrosData = [];
              let contadoresGlobales = new Map<string, number>();

              for (const instituciones of todasInstituciones) {
                const { data: incidenciasData } = await supabase
                  .from("incidencias")
                  .select("id, estado_cliente")
                  .eq("institucion_id", instituciones.institucion_id);

                if (incidenciasData) {
                  const contadoresCentro = incidenciasData.reduce((acc, inc) => {
                    const estado = inc.estado_cliente || "Sin estado";
                    const existing = acc.find(item => item.estado_cliente === estado);
                    if (existing) {
                      existing.n++;
                    } else {
                      acc.push({ estado_cliente: estado, n: 1 });
                    }
                    return acc;
                  }, [] as Row[]);

                  centrosData.push({
                    nombre: (instituciones.instituciones as any)?.nombre || 'Centro sin nombre',
                    incidencias: contadoresCentro
                  });

                  // Agregar a contadores globales
                  contadoresCentro.forEach(contador => {
                    const estado = contador.estado_cliente || "Sin estado";
                    const actual = contadoresGlobales.get(estado) || 0;
                    contadoresGlobales.set(estado, actual + contador.n);
                  });
                }
              }

              // Convertir map a array para setRows
              const contadoresArray = Array.from(contadoresGlobales.entries()).map(([estado, n]) => ({
                estado_cliente: estado,
                n
              }));

              setRows(contadoresArray);
              setCentrosGestor(centrosData);
            } else {
              // Para Clientes: usar solo su institución
              const institucionId = personaInstituciones[0].personas_instituciones?.[0]?.institucion_id;

              if (institucionId) {
                const { data: incidenciasData } = await supabase
                  .from("incidencias")
                  .select("id, estado_cliente")
                  .eq("institucion_id", institucionId);

                if (incidenciasData) {
                  const contadores = incidenciasData.reduce((acc, inc) => {
                    const estado = inc.estado_cliente || "Sin estado";
                    const existing = acc.find(item => item.estado_cliente === estado);
                    if (existing) {
                      existing.n++;
                    } else {
                      acc.push({ estado_cliente: estado, n: 1 });
                    }
                    return acc;
                  }, [] as Row[]);

                  setRows(contadores);
                }
              }
            }
            }
          }
        }
      }

      // Cargar métricas de proveedor
      const { data: proveedorCasos } = await supabase
        .from("proveedor_casos")
        .select("estado_proveedor")
        .eq("activo", true)
        .not("estado_proveedor", "is", null);

      if (proveedorCasos) {
        const metricasProveedor = proveedorCasos.reduce((acc, caso) => {
          const estado = caso.estado_proveedor;
          const existing = acc.find(item => item.estado_cliente === estado);
          if (existing) {
            existing.n++;
          } else {
            acc.push({ estado_cliente: estado, n: 1 });
          }
          return acc;
        }, [] as Row[]);

        setMetricasProveedor(metricasProveedor);
      }

      setLoading(false);
    } catch (error) {
      console.error("Error cargando datos:", error);
      setLoading(false);
    }
  };

  const cards = useMemo(() => {
    if (vistaActiva === 'cliente') {
      const by = new Map(rows.map(r => [r.estado_cliente ?? "—", r.n]));
      return [
        { key: "Abierta",        color: PALETA.b1, n: by.get("Abierta") ?? 0 },
        { key: "En tramitación", color: PALETA.b2, n: by.get("En tramitación") ?? 0 },
        { key: "Resuelta",       color: PALETA.b5, n: by.get("Resuelta") ?? 0 },
        { key: "Cerrada",        color: PALETA.b3, n: by.get("Cerrada") ?? 0 },
        { key: "En espera",      color: PALETA.b6, n: by.get("En espera") ?? 0 },
        { key: "Anulada",        color: PALETA.b4, n: by.get("Anulada") ?? 0 },
      ];
    } else {
      const by = new Map(metricasProveedor.map(r => [r.estado_cliente ?? "—", r.n]));
      return [
        { key: "Abierta",               color: PALETA.b1, n: by.get("Abierta") ?? 0 },
        { key: "En resolución",         color: PALETA.b2, n: by.get("En resolución") ?? 0 },
        { key: "Ofertada",              color: PALETA.b3, n: by.get("Ofertada") ?? 0 },
        { key: "Oferta aprobada",       color: PALETA.b4, n: by.get("Oferta aprobada") ?? 0 },
        { key: "Oferta a revisar",      color: PALETA.b7, n: by.get("Oferta a revisar") ?? 0 },
        { key: "Resuelta",              color: PALETA.b5, n: by.get("Resuelta") ?? 0 },
        { key: "Cerrada",               color: PALETA.b6, n: by.get("Cerrada") ?? 0 },
        { key: "Anulada",               color: PALETA.b8, n: by.get("Anulada") ?? 0 },
        { key: "Valorada",              color: PALETA.b4, n: by.get("Valorada") ?? 0 },
        { key: "Pendiente valoración",  color: PALETA.b8, n: by.get("Pendiente valoración") ?? 0 },
      ];
    }
  }, [rows, metricasProveedor, vistaActiva]);

  const handleCircleClick = (estado: string) => {
    const params = new URLSearchParams();

    if (vistaActiva === 'cliente') {
      params.set('filtroEstado', estado);
      router.push(`/incidencias?${params.toString()}`);
    } else {
      // Para vista proveedor, redirigir a página de incidencias con filtro de estado proveedor
      router.push(`/incidencias?estado_proveedor=${encodeURIComponent(estado)}`);
    }
  };

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
        {tipoUsuario === 'Control' && (
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

      <section className="px-6 pb-12">
        {loading ? (
          <p className="text-white/80">Cargando…</p>
        ) : (
          <div className="space-y-4">
            {vistaActiva === 'cliente' ? (
              /* Layout cliente: 4 + 2 */
              <div className="relative max-w-4xl mx-auto">
                {/* Primera fila - estados originales */}
                <div className="flex justify-center gap-6 mb-4">
                  {cards.slice(0, 4).map(c => (
                    <div
                      key={c.key}
                      onClick={() => handleCircleClick(c.key)}
                      className="flex flex-col items-center justify-center rounded-full cursor-pointer hover:scale-105 transition-transform"
                      style={{
                        width: 190, height: 190, backgroundColor: c.color,
                        boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
                      }}
                    >
                      <div className="text-5xl font-semibold text-white">{c.n}</div>
                      <div className="mt-2 text-white/90">{c.key}</div>
                    </div>
                  ))}
                </div>

                {/* Segunda fila - estados nuevos centrados exactamente */}
                <div className="flex justify-center">
                  <div className="flex" style={{ gap: '262px' }}>
                    {cards.slice(4, 6).map(c => (
                      <div
                        key={c.key}
                        onClick={() => handleCircleClick(c.key)}
                        className="flex flex-col items-center justify-center rounded-full cursor-pointer hover:scale-105 transition-transform"
                        style={{
                          width: 190, height: 190, backgroundColor: c.color,
                          boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
                        }}
                      >
                        <div className="text-5xl font-semibold text-white">{c.n}</div>
                        <div className="mt-2 text-white/90">{c.key}</div>
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
                      <div className="text-4xl font-semibold text-white">{c.n}</div>
                      <div className="mt-2 text-white/90 text-sm text-center px-2">{c.key}</div>
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
                      <div className="text-4xl font-semibold text-white">{c.n}</div>
                      <div className="mt-2 text-white/90 text-sm text-center px-2">{c.key}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Sección de centros para Gestores */}
      {tipoUsuario === 'Gestor' && centrosGestor.length > 0 && (
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
                    // Redirigir a incidencias filtradas por este centro
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