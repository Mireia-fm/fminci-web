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
  imagenes_excluidas?: string[]; // IDs de imágenes a excluir
  documentos_incluidos?: string[]; // IDs de documentos del chat anterior a incluir
  imagenes_adicionales?: File[]; // Nuevas imágenes para subir
};

type Imagen = {
  id: string;
  storage_key: string;
  nombre_archivo: string;
  url?: string;
};

type Documento = {
  id: string;
  storage_key: string;
  nombre_archivo: string;
  autor_rol: string;
  creado_en: string;
};

interface ModalAsignarProveedorProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formulario: FormularioProveedor) => Promise<void>;
  descripcionInicial?: string;
  enviando?: boolean;
  incidenciaId?: string;
  esReasignacion?: boolean;
}

export default function ModalAsignarProveedor({
  isOpen,
  onClose,
  onSubmit,
  descripcionInicial = "",
  enviando = false,
  incidenciaId,
  esReasignacion = false
}: ModalAsignarProveedorProps) {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [formulario, setFormulario] = useState<FormularioProveedor>({
    proveedor_id: '',
    descripcion_proveedor: descripcionInicial,
    prioridad: '',
    estado_proveedor: 'Abierta',
    imagenes_excluidas: [],
    documentos_incluidos: []
  });
  const [imagenes, setImagenes] = useState<Imagen[]>([]);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [imagenesAdicionales, setImagenesAdicionales] = useState<File[]>([]);
  const [cargandoRecursos, setCargandoRecursos] = useState(false);

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

  const cargarDescripcionIncidencia = async () => {
    if (!incidenciaId) return;

    try {
      const { data, error } = await supabase
        .from("incidencias")
        .select("descripcion")
        .eq("id", incidenciaId)
        .single();

      if (!error && data) {
        setFormulario(prev => ({
          ...prev,
          descripcion_proveedor: data.descripcion || ''
        }));
      }
    } catch (error) {
      console.error("Error cargando descripción de incidencia:", error);
    }
  };

  const cargarImagenes = async () => {
    if (!incidenciaId) return;

    try {
      setCargandoRecursos(true);

      // Obtener imágenes principales de la incidencia
      const { data: adjuntos } = await supabase
        .from("adjuntos")
        .select("id, storage_key, nombre_archivo")
        .eq("incidencia_id", incidenciaId)
        .eq("tipo", "imagen")
        .eq("categoria", "imagen_principal");

      if (adjuntos) {
        // Obtener URLs firmadas para preview
        const imagenesConUrl = await Promise.all(
          adjuntos.map(async (adj) => {
            const { data } = await supabase.storage
              .from('incidencias')
              .createSignedUrl(adj.storage_key, 3600);

            return {
              id: adj.id,
              storage_key: adj.storage_key,
              nombre_archivo: adj.nombre_archivo || 'imagen.jpg',
              url: data?.signedUrl
            };
          })
        );

        setImagenes(imagenesConUrl);
      }
    } catch (error) {
      console.error("Error cargando imágenes:", error);
    } finally {
      setCargandoRecursos(false);
    }
  };

  const cargarDocumentos = async () => {
    if (!incidenciaId) return;

    try {
      // Obtener documentos del chat del proveedor anterior
      const { data: adjuntos } = await supabase
        .from("adjuntos")
        .select("id, storage_key, nombre_archivo, comentarios!inner(autor_rol, creado_en)")
        .eq("incidencia_id", incidenciaId)
        .eq("tipo", "documento")
        .order("comentarios(creado_en)", { ascending: false });

      if (adjuntos) {
        const docs = adjuntos.map((adj) => ({
          id: adj.id,
          storage_key: adj.storage_key,
          nombre_archivo: adj.nombre_archivo || 'documento',
          autor_rol: (adj as { comentarios?: { autor_rol?: string } }).comentarios?.autor_rol || 'Desconocido',
          creado_en: (adj as { comentarios?: { creado_en?: string } }).comentarios?.creado_en || ''
        }));

        setDocumentos(docs);
      }
    } catch (error) {
      console.error("Error cargando documentos:", error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      // Ejecutar todas las cargas en paralelo
      const cargas = [cargarProveedores()];

      if (incidenciaId) {
        cargas.push(cargarDescripcionIncidencia());
        cargas.push(cargarImagenes());
        if (esReasignacion) {
          cargas.push(cargarDocumentos());
        }
      }

      // Esperar a que todas terminen en paralelo
      Promise.all(cargas).catch(err =>
        console.error("Error cargando datos del modal:", err)
      );

      setFormulario(prev => ({
        ...prev,
        proveedor_id: '',
        prioridad: '',
        imagenes_excluidas: [],
        documentos_incluidos: []
      }));
    }
  }, [isOpen, incidenciaId, esReasignacion]);

  const toggleImagenExcluida = (imagenId: string) => {
    setFormulario(prev => {
      const excluidas = prev.imagenes_excluidas || [];
      const yaExcluida = excluidas.includes(imagenId);

      return {
        ...prev,
        imagenes_excluidas: yaExcluida
          ? excluidas.filter(id => id !== imagenId)
          : [...excluidas, imagenId]
      };
    });
  };

  const toggleDocumentoIncluido = (documentoId: string) => {
    setFormulario(prev => {
      const incluidos = prev.documentos_incluidos || [];
      const yaIncluido = incluidos.includes(documentoId);

      return {
        ...prev,
        documentos_incluidos: yaIncluido
          ? incluidos.filter(id => id !== documentoId)
          : [...incluidos, documentoId]
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      ...formulario,
      imagenes_adicionales: imagenesAdicionales
    });
  };

  const handleClose = () => {
    setImagenesAdicionales([]);
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div
        className="rounded-lg p-6 max-w-3xl w-full mx-4 shadow my-4"
        style={{ backgroundColor: PALETA.card }}
      >
        <h3 className="text-xl font-semibold mb-4" style={{ color: PALETA.textoOscuro }}>
          {esReasignacion ? 'Reasignar Incidencia a Proveedor' : 'Asignar Incidencia a Proveedor'}
        </h3>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
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

            {/* Gestión de Imagen Principal */}
            {imagenes.length > 0 && (
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                  Imagen Principal
                </label>
                <div className="border rounded-lg p-3" style={{ borderColor: '#000000' }}>

                {cargandoRecursos ? (
                  <p className="text-sm text-gray-500">Cargando imagen...</p>
                ) : (
                  <div>
                    {imagenes.map((imagen) => {
                      const excluida = formulario.imagenes_excluidas?.includes(imagen.id);
                      return (
                        <div key={imagen.id} className="space-y-3">
                          {imagen.url && (
                            <div className="flex items-start gap-3">
                              {/* Thumbnail pequeño */}
                              <div
                                className="relative flex-shrink-0 cursor-pointer overflow-hidden rounded"
                                onClick={() => window.open(imagen.url, '_blank')}
                                title="Click para ver imagen completa"
                              >
                                <img
                                  src={imagen.url}
                                  alt={imagen.nombre_archivo}
                                  className="w-24 h-24 object-cover rounded border border-gray-300 hover:scale-110 transition-transform duration-200"
                                />
                              </div>

                              {/* Checkbox junto al thumbnail */}
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    id={`imagen-${imagen.id}`}
                                    checked={!excluida}
                                    onChange={() => toggleImagenExcluida(imagen.id)}
                                    className="w-4 h-4"
                                    style={{ accentColor: PALETA.verdeClaro }}
                                  />
                                  <label
                                    htmlFor={`imagen-${imagen.id}`}
                                    className="text-sm cursor-pointer"
                                    style={{ color: PALETA.textoOscuro }}
                                  >
                                    Incluir esta imagen en el chat del proveedor
                                  </label>
                                </div>
                                {excluida && (
                                  <p className="text-sm text-red-600 italic mt-2">
                                    Esta imagen NO será visible para el proveedor
                                  </p>
                                )}
                                <p className="text-sm text-gray-500 mt-1">
                                  Click en la imagen para verla completa
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                </div>
              </div>
            )}

            {/* Subir Imágenes Adicionales */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                Imágenes Adicionales
              </label>
              <div className="border rounded-lg p-3" style={{ borderColor: '#000000' }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="px-4 py-2 text-sm font-medium rounded border cursor-pointer hover:bg-gray-50 transition-colors" style={{ borderColor: '#000000', color: PALETA.textoOscuro }}>
                    Seleccionar archivos
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        setImagenesAdicionales(prev => [...prev, ...files]);
                      }}
                      className="hidden"
                    />
                  </label>
                  {imagenesAdicionales.map((file, index) => (
                    <div key={index} className="flex items-center gap-1 text-xs px-2 py-1 bg-gray-100 rounded" style={{ color: PALETA.textoOscuro }}>
                      <span className="max-w-[120px] truncate">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => setImagenesAdicionales(prev => prev.filter((_, i) => i !== index))}
                        className="text-red-600 hover:text-red-800 ml-1"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Documentos del Chat Anterior (solo en reasignación) */}
            {esReasignacion && documentos.length > 0 && (
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                  Documentos del Proveedor Anterior
                </label>
                <div className="border rounded-lg p-3" style={{ borderColor: '#000000' }}>
                  <p className="text-sm mb-2" style={{ color: '#6b7280' }}>
                    Selecciona los documentos que quieres compartir con el nuevo proveedor
                  </p>

                <div className="space-y-2">
                  {documentos.map((doc) => {
                    const incluido = formulario.documentos_incluidos?.includes(doc.id);
                    return (
                      <div
                        key={doc.id}
                        className="flex items-center gap-3 p-3 border rounded cursor-pointer transition-all hover:bg-gray-50"
                        style={{
                          borderColor: incluido ? '#4b5563' : '#e5e7eb',
                          backgroundColor: incluido ? '#f3f4f6' : 'white'
                        }}
                        onClick={() => toggleDocumentoIncluido(doc.id)}
                      >
                        <input
                          type="checkbox"
                          checked={incluido}
                          onChange={() => {}}
                          className="w-4 h-4"
                          style={{ accentColor: PALETA.verdeClaro }}
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium" style={{ color: PALETA.textoOscuro }}>
                            {doc.nombre_archivo}
                          </p>
                          <p className="text-sm" style={{ color: '#6b7280' }}>
                            Subido por {doc.autor_rol} • {new Date(doc.creado_en).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                </div>
              </div>
            )}
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