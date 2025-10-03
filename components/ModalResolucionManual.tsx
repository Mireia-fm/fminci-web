"use client";

import { useState } from "react";
import { PALETA } from "@/lib/theme";

export type FormularioResolucionManual = {
  descripcion: string;           // Obligatorio
  proveedor_externo?: string;    // Opcional (solo sin proveedor)
  importe?: number;              // Opcional
  documentos?: File[];           // Opcional
  observaciones?: string;        // Opcional (solo con proveedor)
};

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formulario: FormularioResolucionManual) => Promise<void>;
  tieneProveedor: boolean;       // Determina qué campos mostrar
  enviando: boolean;
}

export default function ModalResolucionManual({
  isOpen,
  onClose,
  onSubmit,
  tieneProveedor,
  enviando
}: ModalProps) {
  const [formulario, setFormulario] = useState<FormularioResolucionManual>({
    descripcion: '',
    proveedor_externo: '',
    importe: undefined,
    documentos: [],
    observaciones: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formulario.descripcion.trim()) {
      alert('La descripción es obligatoria');
      return;
    }
    await onSubmit(formulario);
    // Resetear formulario
    setFormulario({
      descripcion: '',
      proveedor_externo: '',
      importe: undefined,
      documentos: [],
      observaciones: ''
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFormulario(prev => ({
        ...prev,
        documentos: Array.from(e.target.files || [])
      }));
    }
  };

  const handleClose = () => {
    setFormulario({
      descripcion: '',
      proveedor_externo: '',
      importe: undefined,
      documentos: [],
      observaciones: ''
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        className="rounded-lg p-6 max-w-2xl w-full mx-4 shadow max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: PALETA.card }}
      >
        <h3 className="text-xl font-semibold mb-4" style={{ color: PALETA.textoOscuro }}>
          {tieneProveedor
            ? 'Resolver Incidencia Manualmente (Control)'
            : 'Resolver Incidencia Manualmente'}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Descripción (obligatorio) */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
              {tieneProveedor ? 'Motivo de resolución manual *' : 'Descripción de la resolución *'}
            </label>
            <textarea
              value={formulario.descripcion}
              onChange={(e) => setFormulario(prev => ({ ...prev, descripcion: e.target.value }))}
              placeholder="Describe cómo se resolvió la incidencia..."
              className="w-full h-24 p-3 border rounded resize-none focus:outline-none"
              onFocus={(e) => e.target.style.boxShadow = `0 0 0 2px ${PALETA.verdeClaro}80`}
              onBlur={(e) => e.target.style.boxShadow = ''}
              required
            />
          </div>

          {/* Campos solo para resolución SIN proveedor */}
          {!tieneProveedor && (
            <>
              {/* Proveedor externo */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                  Proveedor externo (opcional)
                </label>
                <input
                  type="text"
                  value={formulario.proveedor_externo}
                  onChange={(e) => setFormulario(prev => ({ ...prev, proveedor_externo: e.target.value }))}
                  placeholder="Ej: Fontanería García SL"
                  className="w-full p-2 border rounded focus:outline-none"
                  onFocus={(e) => e.target.style.boxShadow = `0 0 0 2px ${PALETA.verdeClaro}80`}
                  onBlur={(e) => e.target.style.boxShadow = ''}
                />
              </div>

              {/* Importe */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                  Importe (€, opcional)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formulario.importe || ''}
                  onChange={(e) => setFormulario(prev => ({
                    ...prev,
                    importe: e.target.value ? parseFloat(e.target.value) : undefined
                  }))}
                  placeholder="0.00"
                  className="w-full p-2 border rounded focus:outline-none"
                  onFocus={(e) => e.target.style.boxShadow = `0 0 0 2px ${PALETA.verdeClaro}80`}
                  onBlur={(e) => e.target.style.boxShadow = ''}
                />
              </div>
            </>
          )}

          {/* Observaciones (solo con proveedor) */}
          {tieneProveedor && (
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                Observaciones adicionales (opcional)
              </label>
              <textarea
                value={formulario.observaciones}
                onChange={(e) => setFormulario(prev => ({ ...prev, observaciones: e.target.value }))}
                placeholder="Información adicional sobre la resolución..."
                className="w-full h-20 p-3 border rounded resize-none focus:outline-none"
                onFocus={(e) => e.target.style.boxShadow = `0 0 0 2px ${PALETA.verdeClaro}80`}
                onBlur={(e) => e.target.style.boxShadow = ''}
              />
            </div>
          )}

          {/* Adjuntar documentos */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
              Adjuntar documentos (facturas, fotos, etc.)
            </label>
            <input
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={handleFileChange}
              className="w-full p-2 border rounded"
            />
            {formulario.documentos && formulario.documentos.length > 0 && (
              <div className="mt-2 text-sm text-gray-600">
                {formulario.documentos.length} archivo(s) seleccionado(s):
                <ul className="list-disc list-inside mt-1">
                  {Array.from(formulario.documentos).map((doc, idx) => (
                    <li key={idx} className="text-xs">{doc.name}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm rounded border hover:bg-gray-50"
              style={{ color: PALETA.textoOscuro, borderColor: '#d1d5db' }}
              disabled={enviando}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando || !formulario.descripcion.trim()}
              className="px-6 py-2 text-sm text-white rounded hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: PALETA.verdeClaro }}
            >
              {enviando ? 'Resolviendo...' : 'Resolver Incidencia'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
