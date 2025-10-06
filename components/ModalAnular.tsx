"use client";

import { useState } from "react";
import { PALETA } from "@/lib/theme";

interface ModalAnularProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (motivo: string, esDuplicada?: boolean) => Promise<void>;
}

export default function ModalAnular({
  isOpen,
  onClose,
  onConfirm
}: ModalAnularProps) {
  const [motivo, setMotivo] = useState("");
  const [esDuplicada, setEsDuplicada] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const handleConfirm = async () => {
    // Solo requerir motivo si NO está marcada como duplicada
    if (!esDuplicada && !motivo.trim()) {
      alert("Por favor ingrese un motivo de anulación");
      return;
    }

    try {
      setEnviando(true);
      // Si está marcada como duplicada, usar "Duplicación" como motivo
      const motivoFinal = esDuplicada ? "Duplicación" : motivo;
      await onConfirm(motivoFinal, esDuplicada);
      setMotivo("");
      setEsDuplicada(false);
      onClose();
    } catch (error) {
      console.error("Error al anular:", error);
    } finally {
      setEnviando(false);
    }
  };

  const handleClose = () => {
    setMotivo("");
    setEsDuplicada(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-xl font-semibold mb-4" style={{ color: PALETA.textoOscuro }}>
          Anular Incidencia
        </h3>

        {/* Checkbox para incidencia duplicada */}
        <div className="mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={esDuplicada}
              onChange={(e) => setEsDuplicada(e.target.checked)}
              className="w-4 h-4"
              style={{ accentColor: PALETA.verdeClaro }}
              disabled={enviando}
            />
            <span className="text-sm font-medium" style={{ color: PALETA.textoOscuro }}>
              Esta incidencia está duplicada
            </span>
          </label>
          {esDuplicada && (
            <p className="text-xs text-gray-600 mt-2 ml-6">
              Se registrará con el motivo &quot;Duplicación&quot; para llevar un seguimiento estadístico
            </p>
          )}
        </div>

        {/* Mostrar campo de motivo solo si NO está marcada como duplicada */}
        {!esDuplicada && (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
              Motivo de la anulación <span className="text-red-500">*</span>
            </label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Describa el motivo de la anulación"
              className="w-full p-2 border rounded text-sm focus:outline-none"
              rows={3}
              onFocus={(e) => e.target.style.boxShadow = `0 0 0 2px ${PALETA.verdeClaro}80`}
              onBlur={(e) => e.target.style.boxShadow = ''}
              disabled={enviando}
            />
          </div>
        )}
        <div className="flex justify-end gap-3">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm rounded border hover:bg-gray-50 transition-colors"
            style={{ color: PALETA.textoOscuro, borderColor: '#d1d5db' }}
            disabled={enviando}
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 text-sm text-white rounded hover:opacity-90 transition-opacity"
            style={{ backgroundColor: PALETA.bg }}
            disabled={enviando}
          >
            {enviando ? 'Procesando su solicitud...' : 'Anular'}
          </button>
        </div>
      </div>
    </div>
  );
}
