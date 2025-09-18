"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Row = { estado_proveedor: string | null; n: number };

const PALETA = {
  bg: "#5D6D52",
  texto: "#EDF0E9",
  b1: "#E8D36A", // Abierta
  b2: "#E8B5A8", // En resolución
  b3: "#A9B88C", // Ofertada / Aprobada
  b4: "#8F9B83", // Resuelta
  b5: "#D4C65A", // Oferta a revisar (variación de b1)
  b6: "#C7A88F", // Cerrada (variación de b2)
  b7: "#9AAD7F", // Anulada (variación de b3)
  b8: "#7A8A6F", // Valorada (variación de b4)
  b9: "#B8C99D", // Pendiente valoración (variación clara de b3)
  b10: "#6B7A60", // Estado adicional (variación oscura de bg)
};

type Notificacion = {
  id: string;
  num_solicitud: string;
  descripcion: string;
  fecha_asignacion: string;
  institucion_nombre?: string;
};

export default function DashboardProveedor() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [loadingNotificaciones, setLoadingNotificaciones] = useState(true);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      // Obtener email del usuario actual
      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData.user?.email;
      
      if (!userEmail) {
        setLoading(false);
        return;
      }

      // Obtener persona_id del usuario
      const { data: persona } = await supabase
        .from("personas")
        .select("id")
        .eq("email", userEmail)
        .maybeSingle();

      if (!persona) {
        setLoading(false);
        return;
      }

      // Obtener institución del proveedor
      const { data: personaInst } = await supabase
        .from("personas_instituciones")
        .select("institucion_id")
        .eq("persona_id", persona.id)
        .maybeSingle();

      if (!personaInst) {
        setLoading(false);
        return;
      }

      // Cargar resumen de casos para este proveedor específico
      const { data } = await supabase
        .from("proveedor_casos")
        .select("estado_proveedor")
        .eq("proveedor_id", personaInst.institucion_id)
        .eq("activo", true);

      // Contar casos por estado
      const conteoEstados = (data || []).reduce((acc: Record<string, number>, caso) => {
        const estado = caso.estado_proveedor || "Sin estado";
        acc[estado] = (acc[estado] || 0) + 1;
        return acc;
      }, {});

      // Convertir a formato Row[]
      const rowsData = Object.entries(conteoEstados).map(([estado, count]) => ({
        estado_proveedor: estado,
        n: count
      }));
      
      setRows(rowsData as Row[]);
      
      // Cargar notificaciones de nuevas incidencias (últimas 48 horas)
      await cargarNotificaciones(personaInst);
      
    } catch (error) {
      console.error("Error cargando datos:", error);
    } finally {
      setLoading(false);
      setLoadingNotificaciones(false);
    }
  };

  const cargarNotificaciones = async (personaInst: { institucion_id: string } | null) => {
    try {
      if (!personaInst) return;

      // Buscar incidencias asignadas en las últimas 48 horas
      const fechaLimite = new Date();
      fechaLimite.setHours(fechaLimite.getHours() - 48);

      const { data: casosRecientes } = await supabase
        .from("proveedor_casos")
        .select(`
          id,
          incidencia_id,
          asignado_en,
          incidencias (
            num_solicitud,
            descripcion,
            centro,
            instituciones (nombre)
          )
        `)
        .eq("proveedor_id", personaInst.institucion_id)
        .eq("activo", true)
        .gte("asignado_en", fechaLimite.toISOString())
        .order("asignado_en", { ascending: false });

      if (casosRecientes) {
        const notificacionesFormateadas = casosRecientes.map(caso => ({
          id: caso.incidencia_id,
          num_solicitud: caso.incidencias?.num_solicitud || "",
          descripcion: caso.incidencias?.descripcion || "",
          fecha_asignacion: caso.asignado_en,
          institucion_nombre: caso.incidencias?.instituciones?.nombre || caso.incidencias?.centro
        }));
        
        setNotificaciones(notificacionesFormateadas);
      }
    } catch (error) {
      console.error("Error cargando notificaciones:", error);
    }
  };

  const cards = useMemo(() => {
    const by = new Map(rows.map(r => [r.estado_proveedor ?? "—", r.n]));
    return [
      { key: "Abierta",              color: PALETA.b1, n: by.get("Abierta") ?? 0 },              // Amarillo FMinci
      { key: "En resolución",        color: PALETA.b2, n: by.get("En resolución") ?? 0 },        // Rosa FMinci
      { key: "Ofertada",             color: PALETA.b3, n: by.get("Ofertada") ?? 0 },             // Verde FMinci
      { key: "Oferta aprobada",      color: PALETA.b4, n: by.get("Oferta aprobada") ?? 0 },      // Verde oscuro FMinci
      { key: "Oferta a revisar",     color: PALETA.b5, n: by.get("Oferta a revisar") ?? 0 },     // Amarillo variación
      { key: "Resuelta",             color: PALETA.b4, n: by.get("Resuelta") ?? 0 },             // Verde oscuro FMinci
      { key: "Cerrada",              color: PALETA.b6, n: by.get("Cerrada") ?? 0 },              // Rosa variación
      { key: "Anulada",              color: PALETA.b7, n: by.get("Anulada") ?? 0 },              // Verde variación
      { key: "Valorada",             color: PALETA.b8, n: by.get("Valorada") ?? 0 },             // Verde oscuro variación
      { key: "Pendiente valoración", color: PALETA.b9, n: by.get("Pendiente valoración") ?? 0 }, // Verde claro
    ];
  }, [rows]);

  const navegarAIncidencias = (estado: string) => {
    // Navegar a la página de incidencias con filtro por estado_proveedor
    router.push(`/incidencias?estado_proveedor=${encodeURIComponent(estado)}`);
  };

  return (
    <main className="min-h-[calc(100vh-80px)]" style={{ backgroundColor: PALETA.bg }}>
      <div className="px-6 mt-10 mb-8">
        <h2 className="text-lg tracking-[0.3em]" style={{ color: PALETA.texto }}>
          RESUMEN CASOS PROVEEDOR:
        </h2>
      </div>

      {/* Sección de Notificaciones */}
      {!loadingNotificaciones && notificaciones.length > 0 && (
        <section className="px-6 mb-8">
          <div className="mb-4">
            <h3 className="text-base font-semibold" style={{ color: PALETA.texto }}>
              🔔 NUEVAS INCIDENCIAS ASIGNADAS ({notificaciones.length})
            </h3>
          </div>
          <div className="space-y-3">
            {notificaciones.map((notif) => (
              <div
                key={notif.id}
                className="p-4 rounded-lg shadow-sm border-l-4"
                style={{ 
                  backgroundColor: "rgba(255, 255, 255, 0.95)",
                  borderLeftColor: PALETA.b1
                }}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-semibold text-gray-800">
                        #{notif.num_solicitud}
                      </span>
                      <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                        NUEVA
                      </span>
                    </div>
                    <p className="text-gray-700 text-sm mb-2">
                      {notif.descripcion}
                    </p>
                    <div className="text-xs text-gray-500">
                      <span>Centro: {notif.institucion_nombre || "Sin especificar"}</span>
                      <span className="mx-2">•</span>
                      <span>
                        Asignada: {new Date(notif.fecha_asignacion).toLocaleDateString('es-ES', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => window.location.href = `/incidencias/${notif.id}/chat-proveedor`}
                    className="ml-4 px-3 py-1 text-xs font-medium rounded text-white hover:opacity-90"
                    style={{ backgroundColor: PALETA.bg }}
                  >
                    Ver Chat
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="px-6 pb-12">
        {loading ? (
          <p className="text-white/80">Cargando…</p>
        ) : (
          <div className="flex flex-wrap gap-6">
            {cards.map(c => (
              <div
                key={c.key}
                className="flex flex-col items-center justify-center rounded-full cursor-pointer transition-transform hover:scale-105"
                style={{
                  width: 190, height: 190, backgroundColor: c.color,
                  boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
                }}
                onClick={() => navegarAIncidencias(c.key)}
              >
                <div className="text-5xl font-semibold text-white">{c.n}</div>
                <div className="mt-2 text-white/90">{c.key}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}