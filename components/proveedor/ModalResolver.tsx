import { PALETA } from "@/lib/theme";

interface ModalResolverProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  solucionAplicada: string;
  setSolucionAplicada: (value: string) => void;
  imagenResolucion: File | null;
  setImagenResolucion: (file: File | null) => void;
  documentoResolucion: File | null;
  setDocumentoResolucion: (file: File | null) => void;
  tieneOfertaAprobada: boolean;
  enviando: boolean;
}

export default function ModalResolver({
  isOpen,
  onClose,
  onSubmit,
  solucionAplicada,
  setSolucionAplicada,
  imagenResolucion,
  setImagenResolucion,
  documentoResolucion,
  setDocumentoResolucion,
  tieneOfertaAprobada,
  enviando
}: ModalResolverProps) {
  if (!isOpen) return null;

  const handleClose = () => {
    setSolucionAplicada('');
    setImagenResolucion(null);
    setDocumentoResolucion(null);
    onClose();
  };

  return (
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
              className="w-full h-24 rounded border px-3 py-2 text-sm outline-none resize-none"
              onFocus={(e) => {
                e.target.style.borderColor = PALETA.verdeClaro;
                e.target.style.boxShadow = `0 0 0 2px ${PALETA.verdeClaro}40`;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '';
                e.target.style.boxShadow = '';
              }}
              placeholder="Describe la solución aplicada..."
              required
            />
          </div>

          {/* Imagen de evidencia */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
              Imagen de evidencia (opcional)
            </label>
            <div className="relative">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImagenResolucion(e.target.files?.[0] || null)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="w-full h-9 rounded border px-3 text-sm bg-white flex items-center justify-center cursor-pointer hover:bg-gray-50">
                <span className="text-3xl">+</span>
              </div>
            </div>
            {imagenResolucion && (
              <p className="text-xs text-gray-600 mt-1">{imagenResolucion.name}</p>
            )}
          </div>

          {/* Documento de parte de trabajo */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
              Documento de parte de trabajo (opcional)
            </label>
            <div className="relative">
              <input
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx"
                onChange={(e) => setDocumentoResolucion(e.target.files?.[0] || null)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="w-full h-9 rounded border px-3 text-sm bg-white flex items-center justify-center cursor-pointer hover:bg-gray-50">
                <span className="text-3xl">+</span>
              </div>
            </div>
            {documentoResolucion && (
              <p className="text-xs text-gray-600 mt-1">{documentoResolucion.name}</p>
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
            disabled={!solucionAplicada?.trim() || enviando}
            className="px-6 py-2 text-sm text-white rounded hover:opacity-90 transition-opacity disabled:opacity-50"
            style={{ backgroundColor: PALETA.verdeClaro }}
          >
            {enviando ? 'Resolviendo...' : 'Marcar como Resuelta'}
          </button>
        </div>
      </div>
    </div>
  );
}
