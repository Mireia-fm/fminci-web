"use client";

import { useState } from "react";

const PALETA = {
  verdeClaro: "#5D6D52",
  textoOscuro: "#4b4b4b",
};

interface ModalCerrarIncidenciaProps {
  onClose: () => void;
  onCerrar: (motivo: string) => Promise<void>;
}

export default function ModalCerrarIncidencia({
  onClose,
  onCerrar
}: ModalCerrarIncidenciaProps) {
  const [motivoCierre, setMotivoCierre] = useState('');
  const [enviando, setEnviando] = useState(false);

  const handleCerrar = async () => {
    setEnviando(true);
    try {
      const motivoFinal = motivoCierre.trim() || 'Aprobación de la resolución técnica y valoración económica.';
      await onCerrar(motivoFinal);
      onClose();
    } catch (error) {
      console.error("Error cerrando incidencia:", error);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4" style={{ color: PALETA.textoOscuro }}>
          Aprobar y Cerrar Incidencia
        </h3>
        <textarea
          value={motivoCierre}
          onChange={(e) => setMotivoCierre(e.target.value)}
          placeholder="Motivo del cierre (opcional)"
          className="w-full p-3 border rounded-md mb-4 focus:outline-none transition-all resize-none text-sm placeholder:text-sm placeholder:text-gray-500"
          style={{ borderColor: '#000000' }}
          rows={4}
          onFocus={(e) => {
            e.target.style.borderColor = PALETA.verdeClaro;
            e.target.style.boxShadow = `0 0 0 2px ${PALETA.verdeClaro}40`;
          }}
          onBlur={(e) => {
            e.target.style.borderColor = '#000000';
            e.target.style.boxShadow = '';
          }}
        />
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={enviando}
            className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleCerrar}
            disabled={enviando}
            className="px-4 py-2 text-sm text-white rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
            style={{ backgroundColor: PALETA.verdeClaro }}
          >
            {enviando ? 'Cerrando...' : 'Cerrar'}
          </button>
        </div>
      </div>

      {/* Overlay de envío */}
      {enviando && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-8 shadow-2xl flex flex-col items-center gap-4">
            <div
              className="w-16 h-16 border-4 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: `${PALETA.verdeClaro} ${PALETA.verdeClaro} transparent ${PALETA.verdeClaro}` }}
            ></div>
            <p className="text-lg font-medium">Cerrando su incidencia...</p>
            <p className="text-sm text-gray-600">Por favor, no cierre esta ventana</p>
          </div>
        </div>
      )}
    </div>
  );
}
