"use client";

import { useState } from "react";
import { PALETA } from "@/lib/theme";

interface ModalAnularAsignacionProveedorProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  motivo: string;
  setMotivo: (motivo: string) => void;
  enviando: boolean;
}

export default function ModalAnularAsignacionProveedor({
  isOpen,
  onClose,
  onConfirm,
  motivo,
  setMotivo,
  enviando
}: ModalAnularAsignacionProveedorProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h3 className="text-lg font-semibold mb-4">Anular Asignación de Proveedor</h3>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Motivo de la anulación"
          className="w-full p-3 border rounded mb-4 focus:outline-none placeholder:text-sm placeholder:text-gray-500"
          rows={4}
          onFocus={(e) => e.target.style.boxShadow = '0 0 0 2px #C9D7A7'}
          onBlur={(e) => e.target.style.boxShadow = ''}
        />
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => {
              onClose();
              setMotivo('');
            }}
            className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50"
            disabled={enviando}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={!motivo.trim() || enviando}
            className="px-3 py-1.5 text-sm text-white rounded hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: PALETA.bg }}
          >
            {enviando ? 'Anulando...' : 'Anular'}
          </button>
        </div>
      </div>
    </div>
  );
}
