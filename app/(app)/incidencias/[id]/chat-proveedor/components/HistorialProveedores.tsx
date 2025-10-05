import { PALETA } from '@/lib/theme';

/**
 * Tipos
 */
type ProveedorHistorico = {
  proveedor_nombre: string;
  fecha_asignacion: string;
  fecha_anulacion?: string | null;
  motivo_anulacion?: string | null;
  estado_proveedor: string;
  activo: boolean;
};

interface Props {
  historial: ProveedorHistorico[];
}

/**
 * Componente para mostrar el historial de proveedores asignados
 * Solo se muestra si hay proveedores anulados (inactivos)
 */
export default function HistorialProveedores({ historial }: Props) {
  // Solo mostrar si hay proveedores inactivos
  const proveedoresAnulados = historial.filter(p => !p.activo);

  if (proveedoresAnulados.length === 0) {
    return null;
  }

  return (
    <div className="px-6 mb-6">
      <div className="rounded-lg shadow-lg" style={{ backgroundColor: PALETA.card }}>
        <div
          className="px-6 py-4 border-b rounded-t-lg"
          style={{
            backgroundColor: PALETA.headerTable,
            color: PALETA.textoOscuro
          }}
        >
          <h2 className="text-lg font-semibold">HISTORIAL DE PROVEEDORES</h2>
        </div>

        <div className="px-6 py-4">
          <div className="space-y-4">
            {proveedoresAnulados.map((prov, index) => (
              <div
                key={index}
                className="border-l-4 pl-4 py-3 rounded-r"
                style={{
                  borderColor: '#9ca3af',
                  backgroundColor: '#f9fafb'
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold" style={{ color: PALETA.textoOscuro }}>
                        {prov.proveedor_nombre}
                      </span>
                      <span className="px-2 py-1 text-xs rounded bg-gray-400 text-white font-medium">
                        ANULADO
                      </span>
                    </div>

                    <div className="text-sm space-y-1">
                      <p style={{ color: PALETA.textoOscuro }}>
                        <span className="font-medium">Asignado:</span>{' '}
                        {new Date(prov.fecha_asignacion).toLocaleDateString('es-ES', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>

                      {prov.fecha_anulacion && (
                        <p style={{ color: PALETA.textoOscuro }}>
                          <span className="font-medium">Anulado:</span>{' '}
                          {new Date(prov.fecha_anulacion).toLocaleDateString('es-ES', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      )}

                      <p style={{ color: PALETA.textoOscuro }}>
                        <span className="font-medium">Estado final:</span>{' '}
                        <span
                          className="px-2 py-0.5 rounded text-xs text-white"
                          style={{ backgroundColor: '#6b7280' }}
                        >
                          {prov.estado_proveedor}
                        </span>
                      </p>

                      {prov.motivo_anulacion && (
                        <p style={{ color: PALETA.textoOscuro }}>
                          <span className="font-medium">Motivo:</span>{' '}
                          {prov.motivo_anulacion}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
