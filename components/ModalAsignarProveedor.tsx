"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import SearchableSelect from "./SearchableSelect";

// Paleta de colores consistente
const PALETA = {
  fondo: "#5D6D52",
  headerTable: "#D9B6A9",
  card: "#F9FAF8",
  filtros: "#E8B5A8",
  texto: "#EDF0E9",
  textoOscuro: "#4b4b4b",
  verdeClaro: "#A9B88C",
};

type Proveedor = {
  id: string;
  nombre: string;
  tipo: string;
};

type FormularioProveedor = {
  proveedor_id: string;
  descripcion_proveedor: string;
  prioridad: string;
  estado_proveedor: string;
};

interface ModalAsignarProveedorProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formulario: FormularioProveedor) => Promise<void>;
  descripcionInicial?: string;
  enviando?: boolean;
}

export default function ModalAsignarProveedor({
  isOpen,
  onClose,
  onSubmit,
  descripcionInicial = "",
  enviando = false
}: ModalAsignarProveedorProps) {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [formulario, setFormulario] = useState<FormularioProveedor>({
    proveedor_id: '',
    descripcion_proveedor: descripcionInicial,
    prioridad: '',
    estado_proveedor: 'Abierta'
  });

  useEffect(() => {
    if (isOpen) {
      cargarProveedores();
      setFormulario(prev => ({
        ...prev,
        descripcion_proveedor: descripcionInicial,
        proveedor_id: '',
        prioridad: ''
      }));
    }
  }, [isOpen, descripcionInicial]);

  const cargarProveedores = async () => {
    try {
      const { data, error } = await supabase
        .from("instituciones")
        .select("id, nombre, tipo")
        .eq("tipo", "Proveedor")
        .eq("activo", true)
        .order("nombre");

      if (!error && data) {
        setProveedores(data);
      }
    } catch (error) {
      console.error("Error cargando proveedores:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formulario);
  };

  const handleClose = () => {
    setFormulario({
      proveedor_id: '',
      descripcion_proveedor: '',
      prioridad: '',
      estado_proveedor: 'Abierta'
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div
        className="rounded-lg p-8 max-w-lg w-full mx-4 shadow"
        style={{ backgroundColor: PALETA.card }}
      >
        <h3 className="text-xl font-semibold mb-6" style={{ color: PALETA.textoOscuro }}>
          Asignar Incidencia a Proveedor
        </h3>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Selección de Proveedor */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                Proveedor *
              </label>
              <SearchableSelect
                value={formulario.proveedor_id}
                onChange={(value) => setFormulario(prev => ({
                  ...prev,
                  proveedor_id: value
                }))}
                options={proveedores.map(proveedor => ({
                  value: proveedor.id,
                  label: proveedor.nombre
                }))}
                placeholder="Seleccionar proveedor"
                focusColor={PALETA.verdeClaro}
              />
            </div>

            {/* Descripción para el Proveedor */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                Descripción para el Proveedor
              </label>
              <textarea
                value={formulario.descripcion_proveedor}
                onChange={(e) => setFormulario(prev => ({
                  ...prev,
                  descripcion_proveedor: e.target.value
                }))}
                placeholder="Instrucciones específicas o detalles adicionales para el proveedor..."
                className="min-h-[80px] w-full rounded border p-3 text-sm outline-none"
                onFocus={(e) => {
                  e.target.style.boxShadow = `0 0 0 2px ${PALETA.verdeClaro}80`;
                }}
                onBlur={(e) => {
                  e.target.style.boxShadow = '';
                }}
              />
            </div>

            {/* Prioridad */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                Prioridad *
              </label>
              <SearchableSelect
                value={formulario.prioridad}
                onChange={(value) => setFormulario(prev => ({
                  ...prev,
                  prioridad: value as 'Crítico' | 'No crítico'
                }))}
                options={[
                  { value: "No crítico", label: "No crítico" },
                  { value: "Crítico", label: "Crítico" }
                ]}
                placeholder="Seleccionar prioridad"
                focusColor={PALETA.verdeClaro}
              />
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
              type="submit"
              disabled={!formulario.proveedor_id || !formulario.prioridad || enviando}
              className="px-6 py-2 text-sm text-white rounded hover:opacity-90 transition-opacity disabled:opacity-50"
              style={{
                backgroundColor: PALETA.fondo,
                opacity: (!formulario.proveedor_id || !formulario.prioridad || enviando) ? 0.5 : 1
              }}
            >
              {enviando ? 'Asignando...' : 'Asignar Proveedor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}