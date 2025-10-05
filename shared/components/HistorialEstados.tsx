import { PALETA } from '@/lib/theme';

interface CambioEstado {
  id: string;
  estado_anterior: string | null;
  estado_nuevo: string;
  cambiado_en: string;
  motivo: string | null;
}

interface HistorialEstadosProps {
  cambios: CambioEstado[];
  titulo: string;
}

export default function HistorialEstados({ cambios, titulo }: HistorialEstadosProps) {
  if (cambios.length === 0) return null;

  // Invertir el orden: más nuevo abajo
  const cambiosOrdenados = [...cambios].reverse();

  return (
    <div className="rounded-lg shadow-lg" style={{ backgroundColor: PALETA.card }}>
      <div
        className="px-6 py-4 border-b rounded-t-lg"
        style={{
          backgroundColor: PALETA.headerTable,
          color: PALETA.textoOscuro
        }}
      >
        <h2 className="text-lg font-semibold">{titulo}</h2>
      </div>

      <div className="px-6 py-4">
        <div className="relative">
          {/* Línea vertical del timeline */}
          <div
            className="absolute left-2.5 top-0 bottom-0 w-0.5"
            style={{ backgroundColor: PALETA.bg }}
          />

          <div className="space-y-2">
            {cambiosOrdenados.map((cambio) => (
              <div key={cambio.id} className="relative pl-8 flex items-center gap-3 py-1">
                {/* Círculo del timeline */}
                <div
                  className="absolute left-0 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor: PALETA.card,
                    borderColor: PALETA.bg
                  }}
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: PALETA.bg }}
                  />
                </div>

                {/* Estados */}
                <div className="flex items-center gap-2 min-w-[200px]">
                  {cambio.estado_anterior && (
                    <>
                      <span
                        className="px-2 py-0.5 text-xs rounded font-medium"
                        style={{ backgroundColor: '#e5e7eb', color: PALETA.textoOscuro }}
                      >
                        {cambio.estado_anterior}
                      </span>
                      <span className="text-xs" style={{ color: PALETA.textoOscuro }}>→</span>
                    </>
                  )}
                  <span
                    className="px-2 py-0.5 text-xs rounded font-medium text-white"
                    style={{ backgroundColor: PALETA.bg }}
                  >
                    {cambio.estado_nuevo}
                  </span>
                </div>

                {/* Fecha */}
                <div className="text-sm min-w-[130px]" style={{ color: '#6b7280' }}>
                  {new Date(cambio.cambiado_en).toLocaleString('es-ES', {
                    day: '2-digit',
                    month: '2-digit',
                    year: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>

                {/* Motivo */}
                {cambio.motivo && (
                  <div className="text-sm flex-1" style={{ color: PALETA.textoOscuro }}>
                    <span className="font-medium">Motivo:</span> {cambio.motivo}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
