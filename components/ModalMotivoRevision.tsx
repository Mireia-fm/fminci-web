"use client";

import { useState } from "react";

const PALETA = {
  verdeClaro: "#5D6D52",
};

interface ModalMotivoRevisionProps {
  onClose: () => void;
  onEnviar: (motivo: string) => Promise<void>;
}

export default function ModalMotivoRevision({
  onClose,
  onEnviar
}: ModalMotivoRevisionProps) {
  const [motivoRevision, setMotivoRevision] = useState('');
  const [enviando, setEnviando] = useState(false);

  const handleEnviar = async () => {
    if (!motivoRevision.trim()) return;

    setEnviando(true);
    try {
      await onEnviar(motivoRevision);
      onClose();
    } catch (error) {
      console.error("Error enviando a revisar:", error);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4" style={{ color: PALETA.verdeClaro }}>
          Motivo de Revisión
        </h3>

        <textarea
          value={motivoRevision}
          onChange={(e) => setMotivoRevision(e.target.value)}
          placeholder="Explique por qué se rechaza el presupuesto"
          className="w-full p-3 border border-gray-300 rounded-md mb-4 focus:outline-none transition-all resize-none"
          rows={4}
          onFocus={(e) => {
            e.target.style.boxShadow = `0 0 0 2px ${PALETA.verdeClaro}`;
            e.target.style.borderColor = PALETA.verdeClaro;
          }}
          onBlur={(e) => {
            e.target.style.boxShadow = 'none';
            e.target.style.borderColor = '#D1D5DB';
          }}
        />

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={enviando}
            className="px-6 py-2.5 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleEnviar}
            disabled={!motivoRevision.trim() || enviando}
            className="px-6 py-2.5 text-white rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
            style={{ backgroundColor: PALETA.verdeClaro }}
          >
            {enviando ? 'Guardando sus cambios...' : 'Enviar a Revisar'}
          </button>
        </div>
      </div>

      {/* Overlay de envío */}
      {enviando && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70]">
          <div className="bg-white rounded-lg p-8 shadow-2xl flex flex-col items-center gap-4">
            <div
              className="w-16 h-16 border-4 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: `${PALETA.verdeClaro} ${PALETA.verdeClaro} transparent ${PALETA.verdeClaro}` }}
            ></div>
            <p className="text-lg font-medium">Enviando a revisar...</p>
            <p className="text-sm text-gray-600">Por favor, no cierres esta ventana</p>
          </div>
        </div>
      )}
    </div>
  );
}
