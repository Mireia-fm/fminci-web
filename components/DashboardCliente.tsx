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
  b1: "#E8D36A",
  b2: "#E8B5A8",
  b3: "#A9B88C",
  b4: "#8F9B83",
  b5: "#D4C5A9", // Para "Resuelta" - tono beige cálido
  b6: "#C8B8A8", // Para "En espera" - beige rosado
};

export default function DashboardCliente() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("v_incidencias_por_estado").select("*");
      setRows((data ?? []) as Row[]);
      setLoading(false);
    })();
  }, []);

  const cards = useMemo(() => {
    const by = new Map(rows.map(r => [r.estado_cliente ?? "—", r.n]));
    // Primera fila: Abierta, En tramitación, Resuelta, Cerrada
    // Segunda fila: En espera (entre Abierta y En tramitación), Anulada (entre Resuelta y Cerrada)
    return [
      { key: "Abierta",        color: PALETA.b1, n: by.get("Abierta") ?? 0 },
      { key: "En tramitación", color: PALETA.b2, n: by.get("En tramitación") ?? 0 },
      { key: "Resuelta",       color: PALETA.b5, n: by.get("Resuelta") ?? 0 },
      { key: "Cerrada",        color: PALETA.b3, n: by.get("Cerrada") ?? 0 },
      { key: "En espera",      color: PALETA.b6, n: by.get("En espera") ?? 0 },
      { key: "Anulada",        color: PALETA.b4, n: by.get("Anulada") ?? 0 },
    ];
  }, [rows]);

  const handleCircleClick = (estado: string) => {
    const params = new URLSearchParams();
    params.set('filtroEstado', estado);
    router.push(`/incidencias?${params.toString()}`);
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

      <div className="px-6 mt-16 mb-8">
        <h2 className="text-lg tracking-[0.3em]" style={{ color: PALETA.texto }}>
          RESUMEN INCIDENCIAS:
        </h2>
      </div>

      <section className="px-6 pb-12">
        {loading ? (
          <p className="text-white/80">Cargando…</p>
        ) : (
          <div className="space-y-4">
            {/* Contenedor principal con posicionamiento exacto */}
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
                  <div
                    onClick={() => handleCircleClick(cards[4].key)}
                    className="flex flex-col items-center justify-center rounded-full cursor-pointer hover:scale-105 transition-transform"
                    style={{
                      width: 190, height: 190, backgroundColor: cards[4].color,
                      boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
                    }}
                  >
                    <div className="text-5xl font-semibold text-white">{cards[4].n}</div>
                    <div className="mt-2 text-white/90">{cards[4].key}</div>
                  </div>
                  <div
                    onClick={() => handleCircleClick(cards[5].key)}
                    className="flex flex-col items-center justify-center rounded-full cursor-pointer hover:scale-105 transition-transform"
                    style={{
                      width: 190, height: 190, backgroundColor: cards[5].color,
                      boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
                    }}
                  >
                    <div className="text-5xl font-semibold text-white">{cards[5].n}</div>
                    <div className="mt-2 text-white/90">{cards[5].key}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}