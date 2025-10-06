import { PALETA } from "@/lib/theme";
import SearchableSelect from "@/components/SearchableSelect";

interface ModalValoracionProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  importeSinIva: string;
  setImporteSinIva: (value: string) => void;
  porcentajeIva: string;
  setPorcentajeIva: (value: string) => void;
  importeConIva: string;
  setImporteConIva: (value: string) => void;
  documentoJustificativo: File | null;
  setDocumentoJustificativo: (file: File | null) => void;
  tieneOfertaAprobada: boolean;
  presupuestoActual?: { importe_total_sin_iva?: number | string } | null;
  enviando: boolean;
  esEdicion?: boolean;
}

export default function ModalValoracion({
  isOpen,
  onClose,
  onSubmit,
  importeSinIva,
  setImporteSinIva,
  porcentajeIva,
  setPorcentajeIva,
  importeConIva,
  setImporteConIva,
  documentoJustificativo,
  setDocumentoJustificativo,
  tieneOfertaAprobada,
  presupuestoActual,
  enviando,
  esEdicion = false
}: ModalValoracionProps) {

  if (!isOpen) return null;

  const handleClose = () => {
    setImporteSinIva('');
    setImporteConIva('');
    setPorcentajeIva('');
    setDocumentoJustificativo(null);
    onClose();
  };

  const handleImporteSinIvaChange = (value: string) => {
    const sinIva = parseFloat(value) || 0;
    setImporteSinIva(value);

    if (porcentajeIva) {
      const iva = parseFloat(porcentajeIva) || 0;
      const multiplier = 1 + (iva / 100);
      const conIva = (sinIva * multiplier).toFixed(2);
      setImporteConIva(conIva);
    }
  };

  const handleIvaChange = (value: string) => {
    setPorcentajeIva(value);

    // Recalcular el importe con IVA
    const sinIva = parseFloat(importeSinIva) || 0;
    const iva = parseFloat(value) || 0;
    const multiplier = 1 + (iva / 100);
    const conIva = (sinIva * multiplier).toFixed(2);
    setImporteConIva(conIva);
  };

  // Lógica de validación del documento
  const importeActual = parseFloat(importeSinIva) || 0;
  const importeOferta = presupuestoActual?.importe_total_sin_iva
    ? parseFloat(String(presupuestoActual.importe_total_sin_iva))
    : 0;
  const importeHaCambiado = tieneOfertaAprobada && importeActual !== importeOferta;
  const importeCoincide = tieneOfertaAprobada && !importeHaCambiado && importeActual > 0;
  const documentoRequerido = !tieneOfertaAprobada || importeHaCambiado;

  const isDisabled = (() => {
    if (importeCoincide) {
      return !importeSinIva || !importeConIva || enviando;
    }
    return !importeSinIva || !importeConIva || (documentoRequerido && !documentoJustificativo) || enviando;
  })();

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div
          className="rounded-lg p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow"
          style={{ backgroundColor: PALETA.card }}
        >
        <h3 className="text-xl font-semibold mb-6" style={{ color: PALETA.textoOscuro }}>
          Valoración Económica
          {tieneOfertaAprobada && (
            <span className="text-sm block mt-1" style={{ color: PALETA.verdeClaro }}>
              Incidencia con oferta aprobada
            </span>
          )}
        </h3>

        <div className="space-y-6">
          {/* Importe sin IVA */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
              Importe sin IVA (€) *
            </label>
            <input
              type="number"
              step="0.01"
              value={importeSinIva}
              onChange={(e) => handleImporteSinIvaChange(e.target.value)}
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

          {/* Porcentaje de IVA */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
              Porcentaje de IVA (%) *
            </label>
            <SearchableSelect
              value={porcentajeIva}
              onChange={handleIvaChange}
              placeholder="Seleccione"
              options={[
                { value: "0", label: "0% - Exento" },
                { value: "4", label: "4% - Tipo super reducido" },
                { value: "10", label: "10% - Tipo reducido" },
                { value: "21", label: "21% - Tipo general" }
              ]}
              focusColor={`${PALETA.verdeClaro}40`}
            />
          </div>

          {/* Importe con IVA */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
              Importe con IVA (€) *
            </label>
            <input
              type="number"
              step="0.01"
              value={importeConIva}
              onChange={(e) => setImporteConIva(e.target.value)}
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
            <p className="text-xs text-gray-600 mt-1">
              Se calcula automáticamente al introducir el importe sin IVA y el porcentaje de IVA
            </p>
          </div>

          {/* Documento justificativo - Condicional */}
          {importeCoincide ? (
            <div>
              <p className="text-xs mt-1" style={{ color: PALETA.verdeClaro }}>
                El importe coincide con la oferta aprobada (€{importeOferta}). No se requiere documento justificativo.
              </p>
            </div>
          ) : documentoRequerido ? (
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                Documento justificativo
                <span className="text-red-500"> *</span>
              </label>
              {!documentoJustificativo ? (
                <div>
                  <input
                    id="file-input-justificativo"
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setDocumentoJustificativo(e.target.files?.[0] || null)}
                    className="hidden"
                    required={true}
                  />
                  <label
                    htmlFor="file-input-justificativo"
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
                    <p className="text-sm text-gray-700">{documentoJustificativo.name}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {(documentoJustificativo.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDocumentoJustificativo(null)}
                    className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors text-xs"
                    title="Quitar archivo"
                  >
                    ✕
                  </button>
                </div>
              )}
              {!tieneOfertaAprobada && (
                <p className="text-xs text-red-600 mt-1">
                  Este documento es obligatorio para incidencias sin oferta previa aprobada
                </p>
              )}
              {tieneOfertaAprobada && importeHaCambiado && (
                <p className="text-xs mt-1" style={{ color: '#d97706' }}>
                  El importe ha cambiado respecto a la oferta aprobada (€{importeOferta}). Documento requerido.
                </p>
              )}
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-3 mt-6">
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
            disabled={isDisabled}
            className="px-6 py-2 text-sm text-white rounded hover:opacity-90 transition-opacity disabled:opacity-50"
            style={{ backgroundColor: PALETA.bg }}
          >
            {enviando ? (esEdicion ? 'Guardando sus cambios...' : 'Guardando su valoración...') : (esEdicion ? 'Guardar cambios' : 'Marcar como Valorada')}
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
            {esEdicion ? 'Guardando sus cambios...' : 'Guardando su valoración...'}
          </p>
          <p className="text-sm text-gray-500">Por favor, no cierres esta ventana</p>
        </div>
      </div>
    )}
  </>
  );
}
