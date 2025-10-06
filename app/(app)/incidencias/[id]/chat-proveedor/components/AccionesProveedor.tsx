import { PALETA } from '@/lib/theme';

/**
 * Tipos
 */
type Incidencia = {
  id: string;
  num_solicitud: string;
  estado_proveedor?: string;
  tipo_revision?: string | null;
};

interface Props {
  incidencia: Incidencia;
  tuvoOfertaAprobada: boolean;
  onCalendarizarVisita: () => void;
  onOfertarPresupuesto: () => void;
  onResolverIncidencia: () => void;
  onValorar: () => void;
}

/**
 * Componente de acciones disponibles para el rol Proveedor
 */
export default function AccionesProveedor({
  incidencia,
  tuvoOfertaAprobada,
  onCalendarizarVisita,
  onOfertarPresupuesto,
  onResolverIncidencia,
  onValorar
}: Props) {
  const estado = incidencia.estado_proveedor;

  // Definir disponibilidad de botones según estado
  const botonesDisponibles = {
    calendarizar: false,
    ofertar: false,
    resolver: false,
    valorar: false
  };

  // Mensajes informativos por estado
  let mensaje = '';

  switch (estado) {
    case "Abierta":
    case "En resolución":
    case "Asignada":
      botonesDisponibles.calendarizar = true;
      botonesDisponibles.ofertar = true;
      botonesDisponibles.resolver = true;
      break;

    case "Ofertada":
      mensaje = '⏳ Esperando respuesta de Control sobre la oferta enviada';
      break;

    case "Oferta aprobada":
      botonesDisponibles.calendarizar = true;
      botonesDisponibles.resolver = true;
      break;

    case "Oferta a revisar":
      botonesDisponibles.ofertar = true;
      mensaje = '🔄 Oferta rechazada - Debe revisar y presentar una nueva oferta';
      break;

    case "Resuelta":
      botonesDisponibles.valorar = true;
      mensaje = '✅ Incidencia resuelta - Puede proceder con la valoración económica';
      break;

    case "Pendiente valoración":
      botonesDisponibles.valorar = true;
      mensaje = '📋 Incidencia lista para valorar';
      break;

    case "Revisar resolución":
      // Habilitar botones según el tipo de revisión solicitado
      const tipoRevision = incidencia.tipo_revision;
      if (tipoRevision === 'tecnica') {
        botonesDisponibles.resolver = true;
        mensaje = '🔄 Resolución técnica rechazada - Debe revisar y corregir la resolución técnica';
      } else if (tipoRevision === 'economica') {
        botonesDisponibles.valorar = true;
        mensaje = '🔄 Valoración económica rechazada - Debe revisar y corregir la valoración económica';
      } else if (tipoRevision === 'ambas') {
        botonesDisponibles.resolver = true;
        botonesDisponibles.valorar = true;
        mensaje = '🔄 Resolución y valoración rechazadas - Debe revisar y corregir ambos aspectos';
      } else {
        // Fallback si no se especificó tipo_revision (no debería pasar)
        botonesDisponibles.resolver = true;
        botonesDisponibles.valorar = true;
        mensaje = '🔄 Resolución rechazada - Revise los comentarios de Control';
      }
      break;

    case "Valorada":
    case "Cerrada":
    case "Anulada":
      mensaje = '🔒 Incidencia finalizada - No hay acciones disponibles';
      break;

    default:
      // Estados no contemplados - no habilitar botones por seguridad
      mensaje = '⚠️ Estado desconocido - Contacte con soporte si persiste';
  }

  // Si alguna vez se aprobó una oferta, no permitir ofertar de nuevo
  if (tuvoOfertaAprobada) {
    botonesDisponibles.ofertar = false;
  }

  return (
    <div className="px-6 mb-12">
      <div className="rounded-lg shadow-lg" style={{ backgroundColor: PALETA.card }}>
        <div
          className="px-6 py-3 border-b rounded-t-lg"
          style={{
            backgroundColor: PALETA.headerTable,
            color: PALETA.textoOscuro
          }}
        >
          <h2 className="text-lg font-semibold">ACCIONES DISPONIBLES</h2>
        </div>
        <div className="px-6 py-4">
          {/* Mostrar mensaje si existe */}
          {mensaje && (
            <div className="text-center py-4">
              <p className="text-sm text-gray-600 mb-2">{mensaje}</p>
              {!botonesDisponibles.valorar && mensaje.includes('Esperando') && (
                <p className="text-xs text-gray-500">
                  Las acciones estarán disponibles cuando Control responda.
                </p>
              )}
            </div>
          )}

          {/* Botones principales */}
          {(botonesDisponibles.calendarizar || botonesDisponibles.ofertar || botonesDisponibles.resolver) && (
            <div className="flex gap-3 justify-center flex-wrap">
              {botonesDisponibles.calendarizar && (
                <button
                  type="button"
                  onClick={onCalendarizarVisita}
                  className="px-4 py-2 text-white rounded hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: PALETA.verdeClaro }}
                >
                  Calendarizar Visita
                </button>
              )}

              {botonesDisponibles.ofertar && (
                <button
                  type="button"
                  onClick={onOfertarPresupuesto}
                  className="px-4 py-2 text-white rounded hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: PALETA.verdeClaro }}
                >
                  Ofertar Presupuesto
                </button>
              )}

              {botonesDisponibles.resolver && (
                <button
                  type="button"
                  onClick={onResolverIncidencia}
                  className="px-4 py-2 text-white rounded hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: PALETA.verdeClaro }}
                >
                  Resolver Incidencia
                </button>
              )}
            </div>
          )}

          {/* Botón de valorar */}
          {botonesDisponibles.valorar && (
            <div className="flex justify-center mt-4">
              <button
                type="button"
                onClick={onValorar}
                className="px-4 py-2 text-white rounded hover:opacity-90 transition-opacity"
                style={{ backgroundColor: PALETA.verdeClaro }}
              >
                Valorar Incidencia
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
