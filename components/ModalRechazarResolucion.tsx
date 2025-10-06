"use client";

import { useState } from "react";
import SearchableSelect from "@/components/SearchableSelect";

const PALETA = {
  verdeClaro: "#5D6D52",
  textoOscuro: "#4b4b4b",
};

type TipoRechazo = 'tecnica' | 'economica' | 'ambas';

interface ModalRechazarResolucionProps {
  onClose: () => void;
  onRechazar: (tipoRechazo: TipoRechazo, motivo: string) => Promise<void>;
}

export default function ModalRechazarResolucion({
  onClose,
  onRechazar
}: ModalRechazarResolucionProps) {
  const [tipoRechazo, setTipoRechazo] = useState<TipoRechazo>('ambas');
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [enviando, setEnviando] = useState(false);

  const handleRechazar = async () => {
    if (!motivoRechazo.trim()) return;

    setEnviando(true);
    try {
      await onRechazar(tipoRechazo, motivoRechazo);
      onClose();
    } catch (error) {
      console.error("Error rechazando resolución:", error);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
        <h3 className="text-lg font-semibold mb-4" style={{ color: PALETA.textoOscuro }}>
          Rechazar Resolución
        </h3>

        {/* Selector de tipo de rechazo */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
            ¿Qué necesita ser corregido? *
          </label>
          <SearchableSelect
            value={tipoRechazo}
            onChange={(value) => setTipoRechazo(value as TipoRechazo)}
            options={[
              { value: "tecnica", label: "Resolución técnica" },
              { value: "economica", label: "Valoración económica" },
              { value: "ambas", label: "Ambas (técnica y económica)" }
            ]}
            placeholder="Seleccione qué necesita corrección"
            focusColor={`${PALETA.verdeClaro}40`}
          />
        </div>

        {/* Campo de motivo detallado */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
            Motivo *
          </label>
          <textarea
            value={motivoRechazo}
            onChange={(e) => setMotivoRechazo(e.target.value)}
            placeholder="Sea específico para que el proveedor entienda qué debe modificar"
            className="w-full p-3 border rounded-md focus:outline-none transition-all resize-none text-sm placeholder:text-sm placeholder:text-gray-500"
            style={{ borderColor: '#000000' }}
            rows={5}
            onFocus={(e) => {
              e.target.style.borderColor = PALETA.verdeClaro;
              e.target.style.boxShadow = `0 0 0 2px ${PALETA.verdeClaro}40`;
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#000000';
              e.target.style.boxShadow = '';
            }}
          />
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={enviando}
            className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleRechazar}
            disabled={!motivoRechazo.trim() || enviando}
            className="px-4 py-2 text-sm text-white rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
            style={{ backgroundColor: PALETA.verdeClaro }}
          >
            {enviando ? 'Guardando sus cambios...' : 'Mandar a Revisar'}
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
            <p className="text-lg font-medium">Mandando a revisar...</p>
            <p className="text-sm text-gray-600">Por favor, no cierres esta ventana</p>
          </div>
        </div>
      )}
    </div>
  );
}
