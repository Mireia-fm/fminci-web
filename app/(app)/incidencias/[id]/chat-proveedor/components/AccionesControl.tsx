import { PALETA } from '@/lib/theme';

/**
 * Tipos
 */
type Incidencia = {
  id: string;
  num_solicitud: string;
  estado_cliente: string;
  estado_proveedor?: string;
};

interface Props {
  incidencia: Incidencia;
  onAnular: () => void;
  onCerrar: () => void;
  onValorar: () => void;
  onGestionarPresupuesto: () => void;
  onCambiarAChatCliente: () => void;
  onResolverManual: () => void;
}

/**
 * Componente de acciones disponibles para el rol Control
 * en el chat proveedor
 */
export default function AccionesControl({
  incidencia,
  onAnular,
  onCerrar,
  onValorar,
  onGestionarPresupuesto,
  onCambiarAChatCliente,
  onResolverManual
}: Props) {
  const estado = incidencia.estado_proveedor;
  const incidenciaCerrada = incidencia.estado_cliente === "Cerrada" && estado === "Cerrada";

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
          <h2 className="text-lg font-semibold">ACCIONES DE CONTROL</h2>
        </div>
        <div className="px-6 py-4">
          <div className="flex gap-3 justify-center flex-wrap">
            {/* Botón Anular - siempre disponible hasta que la incidencia esté completamente cerrada */}
            {!incidenciaCerrada && estado !== "Anulada" && (
              <button
                type="button"
                onClick={onAnular}
                className="px-3 py-2 text-sm border border-red-500 text-red-600 bg-white rounded hover:bg-red-50 transition-colors"
              >
                Anular asignación proveedor
              </button>
            )}

            {/* Botón Reasignar - disponible cuando está anulada */}
            {estado === "Anulada" && (
              <button
                type="button"
                onClick={onCambiarAChatCliente}
                className="px-4 py-2 text-white rounded hover:opacity-90 transition-opacity"
                style={{ backgroundColor: PALETA.verdeClaro }}
              >
                Reasignar Proveedor
              </button>
            )}

            {/* Botón Cerrar - disponible solo cuando está Valorada */}
            {estado === "Valorada" && (
              <button
                type="button"
                onClick={onCerrar}
                className="px-4 py-2 text-white rounded hover:opacity-90 transition-opacity"
                style={{ backgroundColor: PALETA.verdeClaro }}
              >
                Cerrar Incidencia
              </button>
            )}

            {/* Botón Gestionar Presupuesto - solo si está Ofertada */}
            {estado === "Ofertada" && (
              <button
                type="button"
                onClick={onGestionarPresupuesto}
                className="px-4 py-2 text-white rounded hover:opacity-90 transition-opacity"
                style={{ backgroundColor: PALETA.verdeClaro }}
              >
                Gestionar Presupuesto
              </button>
            )}

            {/* Botón Valorar Incidencia - solo si está Resuelta */}
            {estado === "Resuelta" && (
              <button
                type="button"
                onClick={onValorar}
                className="px-4 py-2 text-white rounded hover:opacity-90 transition-opacity"
                style={{ backgroundColor: "#059669" }}
              >
                Valorar Incidencia
              </button>
            )}

            {/* Botón Cambiar al Chat Cliente - siempre disponible */}
            <button
              type="button"
              onClick={onCambiarAChatCliente}
              className="px-4 py-2 text-sm border rounded hover:bg-gray-50 transition-colors"
              style={{
                borderColor: PALETA.bg,
                color: PALETA.bg
              }}
            >
              Cambiar al Chat Cliente
            </button>

            {/* Botón Resolver Manualmente - disponible si no está cerrada ni anulada */}
            {estado !== 'Cerrada' && estado !== 'Anulada' && (
              <button
                type="button"
                onClick={onResolverManual}
                className="px-4 py-2 text-sm text-white rounded hover:opacity-90 transition-opacity"
                style={{ backgroundColor: PALETA.verdeClaro }}
              >
                🔧 Resolver Manualmente
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
