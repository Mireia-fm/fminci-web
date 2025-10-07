import { PALETA } from "@/lib/theme";

interface ModalOfertaProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  numeroIncidencia: string;
  fechaEstimadaInicio: string;
  setFechaEstimadaInicio: (value: string) => void;
  duracionEstimada: string;
  setDuracionEstimada: (value: string) => void;
  importeTotalSinIva: string;
  setImporteTotalSinIva: (value: string) => void;
  documentoPresupuesto: File | null;
  setDocumentoPresupuesto: (file: File | null) => void;
  descripcionPresupuesto: string;
  setDescripcionPresupuesto: (value: string) => void;
  enviando: boolean;
}

export default function ModalOferta({
  isOpen,
  onClose,
  onSubmit,
  numeroIncidencia,
  fechaEstimadaInicio,
  setFechaEstimadaInicio,
  duracionEstimada,
  setDuracionEstimada,
  importeTotalSinIva,
  setImporteTotalSinIva,
  documentoPresupuesto,
  setDocumentoPresupuesto,
  descripcionPresupuesto,
  setDescripcionPresupuesto,
  enviando
}: ModalOfertaProps) {
  if (!isOpen) return null;

  const handleClose = () => {
    setFechaEstimadaInicio('');
    setDuracionEstimada('');
    setImporteTotalSinIva('');
    setDocumentoPresupuesto(null);
    setDescripcionPresupuesto('');
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div
          className="rounded-lg p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow"
          style={{ backgroundColor: PALETA.card }}
        >
        <h3 className="text-xl font-semibold mb-6" style={{ color: PALETA.textoOscuro }}>
          Datos presupuesto
        </h3>

        <div className="space-y-6">
          {/* Número de incidencia */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
              N° incidencia
            </label>
            <input
              type="text"
              value={numeroIncidencia}
              disabled
              className="w-full h-9 rounded border px-3 text-sm bg-gray-100"
            />
          </div>

          {/* Fecha estimada de inicio y Duración estimada */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                Fecha estimada de inicio *
              </label>
              <input
                type="date"
                value={fechaEstimadaInicio}
                onChange={(e) => setFechaEstimadaInicio(e.target.value)}
                className="w-full h-9 rounded border border-black px-3 text-sm outline-none"
                style={{
                  colorScheme: 'light',
                  color: fechaEstimadaInicio ? '#000000' : '#9ca3af'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = PALETA.verdeClaro;
                  e.target.style.boxShadow = `0 0 0 2px ${PALETA.verdeClaro}40`;
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#000000';
                  e.target.style.boxShadow = '';
                }}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                Duración estimada *
              </label>
              <input
                type="text"
                value={duracionEstimada}
                onChange={(e) => setDuracionEstimada(e.target.value)}
                className="w-full h-9 rounded border border-black px-3 text-sm outline-none placeholder:text-gray-500"
                onFocus={(e) => {
                  e.target.style.borderColor = PALETA.verdeClaro;
                  e.target.style.boxShadow = `0 0 0 2px ${PALETA.verdeClaro}40`;
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#000000';
                  e.target.style.boxShadow = '';
                }}
                placeholder="ej: 2 días, 1 semana..."
                required
              />
            </div>
          </div>

          {/* Importe total sin IVA y Presupuesto detallado */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                Importe total sin IVA (€) *
              </label>
              <input
                type="number"
                step="0.01"
                value={importeTotalSinIva}
                onChange={(e) => setImporteTotalSinIva(e.target.value)}
                className="w-full h-9 rounded border border-black px-3 text-sm outline-none placeholder:text-gray-500"
                onFocus={(e) => {
                  e.target.style.borderColor = PALETA.verdeClaro;
                  e.target.style.boxShadow = `0 0 0 2px ${PALETA.verdeClaro}40`;
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#000000';
                  e.target.style.boxShadow = '';
                }}
                placeholder="0.00"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                Presupuesto detallado *
              </label>
              {!documentoPresupuesto ? (
                <div>
                  <input
                    id="file-input-presupuesto"
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx"
                    onChange={(e) => setDocumentoPresupuesto(e.target.files?.[0] || null)}
                    className="hidden"
                    required
                  />
                  <label
                    htmlFor="file-input-presupuesto"
                    className="inline-block px-3 py-2 rounded text-sm font-medium cursor-pointer transition-all"
                    style={{ backgroundColor: PALETA.verdeClaro, color: '#4b4b4b' }}
                    onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(0.95)'}
                    onMouseLeave={(e) => e.currentTarget.style.filter = 'brightness(1)'}
                  >
                    Seleccionar archivo
                  </label>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded border border-gray-300">
                  <div className="flex-1">
                    <p className="text-sm text-gray-700">{documentoPresupuesto.name}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {(documentoPresupuesto.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDocumentoPresupuesto(null)}
                    className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors text-xs"
                    title="Quitar archivo"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Descripción del trabajo */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
              Descripción del trabajo *
            </label>
            <textarea
              value={descripcionPresupuesto}
              onChange={(e) => setDescripcionPresupuesto(e.target.value)}
              className="w-full h-24 rounded border border-black px-3 py-2 text-sm outline-none resize-none placeholder:text-gray-500"
              onFocus={(e) => {
                e.target.style.borderColor = PALETA.verdeClaro;
                e.target.style.boxShadow = `0 0 0 2px ${PALETA.verdeClaro}40`;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#000000';
                e.target.style.boxShadow = '';
              }}
              placeholder="Descripción del trabajo a realizar..."
              required
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-8">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm rounded border hover:bg-gray-50 transition-colors"
            style={{ color: PALETA.textoOscuro, borderColor: '#d1d5db' }}
            disabled={enviando}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!fechaEstimadaInicio || !duracionEstimada || !importeTotalSinIva || !documentoPresupuesto || !descripcionPresupuesto || enviando}
            className="px-6 py-2 text-sm text-white rounded hover:opacity-90 transition-opacity disabled:opacity-50"
            style={{ backgroundColor: '#7A8A6F' }}
          >
            {enviando ? 'Guardando sus cambios...' : 'Enviar a revisión'}
          </button>
        </div>
      </div>
    </div>

    {/* Overlay de carga */}
    {enviando && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
        <div className="bg-white rounded-lg p-8 shadow-2xl flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${PALETA.verdeClaro} ${PALETA.verdeClaro} transparent ${PALETA.verdeClaro}` }}></div>
          <p className="text-lg font-medium" style={{ color: PALETA.textoOscuro }}>
            Enviando su presupuesto...
          </p>
          <p className="text-sm text-gray-500">Por favor, no cierre esta ventana</p>
        </div>
      </div>
    )}
  </>
  );
}
