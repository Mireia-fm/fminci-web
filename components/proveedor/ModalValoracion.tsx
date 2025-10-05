import { useState, useMemo } from "react";
import { PALETA } from "@/lib/theme";

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
  enviando
}: ModalValoracionProps) {
  const [busquedaIva, setBusquedaIva] = useState('');
  const [mostrarOpcionesIva, setMostrarOpcionesIva] = useState(false);

  const opcionesIva = [
    { valor: '4', texto: '4% - Tipo super reducido' },
    { valor: '10', texto: '10% - Tipo reducido' },
    { valor: '21', texto: '21% - Tipo general' }
  ];

  const opcionesFiltradas = useMemo(() => {
    if (!busquedaIva) return opcionesIva;
    return opcionesIva.filter(opcion =>
      opcion.texto.toLowerCase().includes(busquedaIva.toLowerCase()) ||
      opcion.valor.includes(busquedaIva)
    );
  }, [busquedaIva]);

  if (!isOpen) return null;

  const handleClose = () => {
    setImporteSinIva('');
    setImporteConIva('');
    setPorcentajeIva('');
    setBusquedaIva('');
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

  const handleIvaSelect = (opcion: { valor: string; texto: string }) => {
    setPorcentajeIva(opcion.valor);
    setBusquedaIva(opcion.texto);
    setMostrarOpcionesIva(false);

    // Recalcular el importe con IVA
    const sinIva = parseFloat(importeSinIva) || 0;
    const iva = parseFloat(opcion.valor) || 0;
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
              className="w-full h-9 rounded border px-3 text-sm outline-none"
              onFocus={(e) => {
                e.target.style.borderColor = PALETA.verdeClaro;
                e.target.style.boxShadow = `0 0 0 2px ${PALETA.verdeClaro}40`;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '';
                e.target.style.boxShadow = '';
              }}
              placeholder="0.00"
              required
            />
          </div>

          {/* Porcentaje de IVA */}
          <div className="relative">
            <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
              Porcentaje de IVA (%) *
            </label>
            <div className="relative">
              <input
                type="text"
                value={busquedaIva}
                onChange={(e) => {
                  setBusquedaIva(e.target.value);
                  setMostrarOpcionesIva(true);
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = PALETA.verdeClaro;
                  e.target.style.boxShadow = `0 0 0 2px ${PALETA.verdeClaro}40`;
                  setMostrarOpcionesIva(true);
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '';
                  e.target.style.boxShadow = '';
                  setTimeout(() => setMostrarOpcionesIva(false), 200);
                }}
                className="w-full h-9 rounded border px-3 text-sm outline-none"
                placeholder="Seleccionar porcentaje de IVA..."
                required
              />

              {/* Dropdown de opciones */}
              {mostrarOpcionesIva && opcionesFiltradas.length > 0 && (
                <div
                  className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-md shadow-lg z-50 max-h-40 overflow-y-auto"
                  style={{ marginTop: '2px' }}
                >
                  {opcionesFiltradas.map((opcion) => (
                    <div
                      key={opcion.valor}
                      className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                      onClick={() => handleIvaSelect(opcion)}
                    >
                      {opcion.texto}
                    </div>
                  ))}
                </div>
              )}
            </div>
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
              className="w-full h-9 rounded border px-3 text-sm outline-none"
              onFocus={(e) => {
                e.target.style.borderColor = PALETA.verdeClaro;
                e.target.style.boxShadow = `0 0 0 2px ${PALETA.verdeClaro}40`;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '';
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
              <div className="relative">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                  onChange={(e) => setDocumentoJustificativo(e.target.files?.[0] || null)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  required={true}
                />
                <div className="w-full h-9 rounded border px-3 text-sm bg-white flex items-center justify-center cursor-pointer hover:bg-gray-50">
                  <span className="text-3xl">+</span>
                </div>
              </div>
              {documentoJustificativo && (
                <p className="text-xs text-gray-600 mt-1">{documentoJustificativo.name}</p>
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
            style={{ backgroundColor: PALETA.verdeClaro }}
          >
            {enviando ? 'Valorando...' : 'Confirmar Valoración Económica'}
          </button>
        </div>
      </div>
    </div>
  );
}
