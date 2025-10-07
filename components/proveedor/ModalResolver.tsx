import { PALETA } from "@/lib/theme";

interface ModalResolverProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  solucionAplicada: string;
  setSolucionAplicada: (value: string) => void;
  fechaRealizacion: string;
  setFechaRealizacion: (value: string) => void;
  imagenesResolucion: File[];
  setImagenesResolucion: (files: File[]) => void;
  documentoResolucion: File | null;
  setDocumentoResolucion: (file: File | null) => void;
  tieneOfertaAprobada: boolean;
  enviando: boolean;
  esEdicion?: boolean;
}

export default function ModalResolver({
  isOpen,
  onClose,
  onSubmit,
  solucionAplicada,
  setSolucionAplicada,
  fechaRealizacion,
  setFechaRealizacion,
  imagenesResolucion,
  setImagenesResolucion,
  documentoResolucion,
  setDocumentoResolucion,
  tieneOfertaAprobada,
  enviando,
  esEdicion = false
}: ModalResolverProps) {
  if (!isOpen) return null;

  const handleClose = () => {
    setSolucionAplicada('');
    setFechaRealizacion('');
    setImagenesResolucion([]);
    setDocumentoResolucion(null);
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
          Resolver Incidencia
          {tieneOfertaAprobada && (
            <span className="text-sm block mt-1" style={{ color: PALETA.verdeClaro }}>
              Incidencia con oferta aprobada
            </span>
          )}
        </h3>

        <div className="space-y-6">
          {/* Solución aplicada */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
              Solución aplicada *
            </label>
            <textarea
              value={solucionAplicada}
              onChange={(e) => setSolucionAplicada(e.target.value)}
              className="w-full h-24 rounded border border-black px-3 py-2 text-sm outline-none resize-none placeholder:text-gray-500"
              onFocus={(e) => {
                e.target.style.borderColor = PALETA.verdeClaro;
                e.target.style.boxShadow = `0 0 0 2px ${PALETA.verdeClaro}40`;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#000000';
                e.target.style.boxShadow = '';
              }}
              placeholder="Describa la solución aplicada"
              required
            />
          </div>

          {/* Fecha de realización del trabajo */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
              Fecha de realización del trabajo *
            </label>
            <input
              type="date"
              value={fechaRealizacion}
              onChange={(e) => setFechaRealizacion(e.target.value)}
              className="w-full h-9 rounded border border-black px-3 text-sm outline-none"
              style={{
                colorScheme: 'light',
                color: fechaRealizacion ? '#000000' : '#9ca3af'
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

          {/* Imágenes de evidencia */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
              Imágenes de evidencia
            </label>
            <div>
              <input
                id="file-input-imagenes-resolucion"
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  setImagenesResolucion([...imagenesResolucion, ...files]);
                }}
                className="hidden"
              />
              <label
                htmlFor="file-input-imagenes-resolucion"
                className="inline-block px-3 py-2 rounded text-sm font-medium cursor-pointer transition-all"
                style={{ backgroundColor: PALETA.verdeClaro, color: '#4b4b4b' }}
                onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(0.95)'}
                onMouseLeave={(e) => e.currentTarget.style.filter = 'brightness(1)'}
              >
                Seleccionar imágenes
              </label>
            </div>
            {imagenesResolucion.length > 0 && (
              <div className="mt-2 space-y-2">
                {imagenesResolucion.map((file, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded border border-gray-300">
                    <img
                      src={URL.createObjectURL(file)}
                      alt={`Vista previa ${index + 1}`}
                      className="w-16 h-16 object-cover rounded border border-gray-300 flex-shrink-0"
                    />
                    <div className="flex-1">
                      <p className="text-sm text-gray-700">{file.name}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setImagenesResolucion(imagenesResolucion.filter((_, i) => i !== index))}
                      className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors text-xs"
                      title="Quitar imagen"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Documento parte de trabajo */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
              Documento parte de trabajo
            </label>
            {!documentoResolucion ? (
              <div>
                <input
                  id="file-input-documento-resolucion"
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx"
                  onChange={(e) => setDocumentoResolucion(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <label
                  htmlFor="file-input-documento-resolucion"
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
                  <p className="text-sm text-gray-700">{documentoResolucion.name}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {(documentoResolucion.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDocumentoResolucion(null)}
                  className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors text-xs"
                  title="Quitar archivo"
                >
                  ✕
                </button>
              </div>
            )}
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
            disabled={!solucionAplicada?.trim() || !fechaRealizacion || enviando}
            className="px-6 py-2 text-sm text-white rounded hover:opacity-90 transition-opacity disabled:opacity-50"
            style={{ backgroundColor: PALETA.bg }}
          >
            {enviando ? (esEdicion ? 'Guardando sus cambios...' : 'Guardando su resolución...') : (esEdicion ? 'Guardar cambios' : 'Marcar como Resuelta')}
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
            {esEdicion ? 'Guardando sus cambios...' : 'Guardando su resolución...'}
          </p>
          <p className="text-sm text-gray-500">Por favor, no cierre esta ventana</p>
        </div>
      </div>
    )}
  </>
  );
}
