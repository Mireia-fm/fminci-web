import { PALETA } from '@/lib/theme';

/**
 * Tipos
 */
type PresupuestoType = {
  id: string;
  importe_total: number;
  importe_total_sin_iva?: number;
  presupuesto_detallado_url?: string;
  estado: string;
  fecha_estimada_inicio?: string;
  duracion_estimada?: string;
  descripcion_breve?: string;
};

type Incidencia = {
  id: string;
  num_solicitud: string;
  descripcion: string;
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  presupuesto: PresupuestoType | null;
  incidencia: Incidencia | null;
  nombreProveedor: string | null;
  documentoUrl: string | null;
  loading: boolean;
  enviando: boolean;
  onAprobar: () => void;
  onMandarARevisar: () => void;
}

/**
 * Modal para gestionar presupuestos (aprobar/rechazar)
 */
export default function ModalGestionPresupuesto({
  isOpen,
  onClose,
  presupuesto,
  incidencia,
  nombreProveedor,
  documentoUrl,
  loading,
  enviando,
  onAprobar,
  onMandarARevisar
}: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        className="rounded-lg shadow-lg border max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        style={{
          backgroundColor: PALETA.card,
          borderColor: PALETA.headerTable
        }}
      >
        {/* Header del modal */}
        <div
          className="px-6 py-4 border-b flex justify-between items-center"
          style={{
            backgroundColor: PALETA.headerTable,
            color: PALETA.textoOscuro
          }}
        >
          <h3 className="text-xl font-semibold">
            DETALLE DEL PRESUPUESTO #{incidencia?.num_solicitud}
          </h3>
          <button
            onClick={onClose}
            className="text-2xl hover:opacity-70 transition-opacity"
            style={{ color: PALETA.textoOscuro }}
          >
            ×
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-600">Cargando presupuesto...</p>
            </div>
          ) : !presupuesto ? (
            <div className="text-center py-8">
              <p className="text-red-600">No se encontró el presupuesto para esta incidencia.</p>
            </div>
          ) : (
            <>
              {/* Grid de información */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Información del proveedor */}
                <div
                  className="border rounded-lg p-4"
                  style={{ borderColor: PALETA.verdeSombra }}
                >
                  <h4 className="font-semibold mb-4 text-center text-sm" style={{ color: PALETA.textoOscuro }}>
                    INFORMACIÓN DEL PROVEEDOR
                  </h4>
                  <table className="w-full text-xs">
                    <tbody>
                      <tr>
                        <td className="py-2 font-semibold" style={{ color: PALETA.textoOscuro }}>
                          Proveedor:
                        </td>
                        <td className="py-2" style={{ color: PALETA.textoOscuro }}>
                          {nombreProveedor || 'No especificado'}
                        </td>
                      </tr>
                      <tr style={{ backgroundColor: `${PALETA.headerTable}20` }}>
                        <td className="py-2 font-semibold" style={{ color: PALETA.textoOscuro }}>
                          Estado:
                        </td>
                        <td className="py-2">
                          <span
                            className="px-2 py-1 rounded text-xs font-medium text-white"
                            style={{ backgroundColor: PALETA.verdeClaro }}
                          >
                            Pendiente revisión
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Detalles financieros */}
                <div
                  className="border rounded-lg p-4"
                  style={{ borderColor: PALETA.verdeSombra }}
                >
                  <h4 className="font-semibold mb-4 text-center text-sm" style={{ color: PALETA.textoOscuro }}>
                    DETALLES
                  </h4>
                  <table className="w-full text-xs">
                    <tbody>
                      <tr>
                        <td className="py-2 font-semibold" style={{ color: PALETA.textoOscuro }}>
                          Importe sin IVA:
                        </td>
                        <td className="py-2 font-bold text-base" style={{ color: PALETA.bg }}>
                          {presupuesto.importe_total_sin_iva}€
                        </td>
                      </tr>
                      <tr style={{ backgroundColor: `${PALETA.headerTable}20` }}>
                        <td className="py-2 font-semibold" style={{ color: PALETA.textoOscuro }}>
                          Fecha estimada de inicio:
                        </td>
                        <td className="py-2" style={{ color: PALETA.textoOscuro }}>
                          {presupuesto.fecha_estimada_inicio
                            ? new Date(presupuesto.fecha_estimada_inicio).toLocaleDateString('es-ES')
                            : 'No especificada'}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 font-semibold" style={{ color: PALETA.textoOscuro }}>
                          Duración estimada:
                        </td>
                        <td className="py-2" style={{ color: PALETA.textoOscuro }}>
                          {presupuesto.duracion_estimada || 'No especificada'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Descripción del trabajo */}
              <div className="mb-6">
                <div
                  className="border rounded-lg"
                  style={{ borderColor: PALETA.verdeSombra }}
                >
                  <div
                    className="px-4 py-3 border-b"
                    style={{
                      backgroundColor: `${PALETA.headerTable}40`,
                      borderColor: PALETA.verdeSombra
                    }}
                  >
                    <h4 className="font-semibold text-sm" style={{ color: PALETA.textoOscuro }}>
                      DESCRIPCIÓN DEL TRABAJO
                    </h4>
                  </div>
                  <div className="p-4">
                    <p className="text-sm" style={{ color: PALETA.textoOscuro }}>
                      {presupuesto.descripcion_breve || 'No especificada'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Descripción de la incidencia */}
              <div className="mb-6">
                <div
                  className="border rounded-lg"
                  style={{ borderColor: PALETA.verdeSombra }}
                >
                  <div
                    className="px-4 py-3 border-b"
                    style={{
                      backgroundColor: `${PALETA.headerTable}40`,
                      borderColor: PALETA.verdeSombra
                    }}
                  >
                    <h4 className="font-semibold text-sm" style={{ color: PALETA.textoOscuro }}>
                      DESCRIPCIÓN DE LA INCIDENCIA
                    </h4>
                  </div>
                  <div className="p-4">
                    <p className="text-sm" style={{ color: PALETA.textoOscuro }}>
                      {incidencia?.descripcion || 'No especificada'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Documento adjunto */}
              {presupuesto.presupuesto_detallado_url && (
                <div className="mb-6">
                  <div
                    className="border rounded-lg"
                    style={{ borderColor: PALETA.verdeSombra }}
                  >
                    <div
                      className="px-4 py-3 border-b"
                      style={{
                        backgroundColor: `${PALETA.headerTable}40`,
                        borderColor: PALETA.verdeSombra
                      }}
                    >
                      <h4 className="font-semibold text-sm" style={{ color: PALETA.textoOscuro }}>
                        DOCUMENTO ADJUNTO
                      </h4>
                    </div>
                    <div className="p-4">
                      {documentoUrl ? (
                        <a
                          href={documentoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 rounded border transition-colors text-sm"
                          style={{
                            borderColor: PALETA.verdeSombra,
                            color: PALETA.bg
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = PALETA.headerTable;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          📎 Visualizar detalle del presupuesto
                        </a>
                      ) : (
                        <div
                          className="inline-flex items-center gap-2 px-4 py-2 rounded border text-sm"
                          style={{
                            borderColor: '#d1d5db',
                            color: '#9ca3af'
                          }}
                        >
                          📎 Cargando documento...
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Botones de acción */}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm rounded border hover:bg-gray-50 transition-colors"
                  style={{ color: PALETA.textoOscuro, borderColor: '#d1d5db' }}
                  disabled={enviando}
                >
                  Cancelar
                </button>
                <button
                  onClick={onMandarARevisar}
                  disabled={enviando}
                  className="px-6 py-2 text-sm text-white rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                  style={{ backgroundColor: '#d4a574' }}
                >
                  Mandar a revisar
                </button>
                <button
                  onClick={onAprobar}
                  disabled={enviando}
                  className="px-6 py-2 text-sm text-white rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                  style={{ backgroundColor: PALETA.verdeClaro }}
                >
                  {enviando ? 'Procesando su solicitud...' : 'Aprobar Presupuesto'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
