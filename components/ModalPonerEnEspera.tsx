"use client";

import { useState } from "react";
import { PALETA } from "@/lib/theme";

interface ModalPonerEnEsperaProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (motivo: string) => Promise<void>;
}

export default function ModalPonerEnEspera({
  isOpen,
  onClose,
  onConfirm
}: ModalPonerEnEsperaProps) {
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);

  const handleConfirm = async () => {
    if (!motivo.trim()) {
      alert("Por favor ingresa un motivo");
      return;
    }

    try {
      setEnviando(true);
      await onConfirm(motivo);
      setMotivo("");
      onClose();
    } catch (error) {
      console.error("Error al poner en espera:", error);
    } finally {
      setEnviando(false);
    }
  };

  const handleClose = () => {
    setMotivo("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-xl font-semibold mb-4" style={{ color: PALETA.textoOscuro }}>
          Poner Incidencia en Espera
        </h3>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Motivo de la espera..."
          className="w-full p-2 border rounded mb-4 text-sm focus:outline-none"
          rows={3}
          onFocus={(e) => e.target.style.boxShadow = `0 0 0 2px ${PALETA.verdeClaro}80`}
          onBlur={(e) => e.target.style.boxShadow = ''}
          disabled={enviando}
        />
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
            {enviando ? 'Procesando su solicitud...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
