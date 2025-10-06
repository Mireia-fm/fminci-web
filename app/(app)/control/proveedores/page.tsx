"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { PALETA } from "@/lib/theme";

type Proveedor = {
  id: string;
  nombre: string;
  email?: string;
  telefono?: string;
  especialidades?: string[];
  activo: boolean;
  fecha_registro: string;
  metricas: {
    totalIncidencias: number;
    resueltas: number;
    promedioDias: number;
    valoracionPromedio: number;
    tiempoRespuesta: number;
  };
};

export default function GestionProveedores() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [mostrarModalNuevo, setMostrarModalNuevo] = useState(false);
  const [nuevoProveedor, setNuevoProveedor] = useState({
    nombre: '',
    email: '',
    telefono: '',
    especialidades: ''
  });

  useEffect(() => {
    cargarProveedores();
  }, []);

  const cargarProveedores = async () => {
    try {
      setLoading(true);

      // Obtener instituciones tipo Proveedor
      const { data: instituciones } = await supabase
        .from("instituciones")
        .select("*")
        .eq("tipo", "Proveedor")
        .order("nombre");

      if (instituciones) {
        const proveedoresConMetricas = await Promise.all(
          instituciones.map(async (inst) => {
            // Calcular métricas para cada proveedor
            const { data: casos } = await supabase
              .from("proveedor_casos")
              .select(`
                id,
                estado_proveedor,
                asignado_en,
                incidencia_id,
                incidencias (
                  creado_en,
                  estado_cliente
                )
              `)
              .eq("proveedor_id", inst.id);

            const totalIncidencias = casos?.length || 0;
            const resueltas = casos?.filter(c =>
              ["Resuelta", "Cerrada", "Valorada"].includes(c.estado_proveedor)
            ).length || 0;

            // Calcular promedio de días para resolver
            const casosResueltos = casos?.filter(c =>
              ["Resuelta", "Cerrada", "Valorada"].includes(c.estado_proveedor)
            ) || [];

            let promedioDias = 0;
            if (casosResueltos.length > 0) {
              const totalDias = casosResueltos.reduce((sum, caso) => {
                const fechaAsignacion = new Date(caso.asignado_en);
                const incidenciasData = caso.incidencias;
                const creadoEn = Array.isArray(incidenciasData) ? incidenciasData[0]?.creado_en : (incidenciasData as { creado_en?: string })?.creado_en;
                const fechaCreacion = new Date(creadoEn || caso.asignado_en);
                const dias = Math.ceil((fechaAsignacion.getTime() - fechaCreacion.getTime()) / (1000 * 60 * 60 * 24));
                return sum + Math.max(dias, 1);
              }, 0);
              promedioDias = Math.round(totalDias / casosResueltos.length);
            }

            // Calcular valoración promedio (simulado)
            const valoracionPromedio = Math.random() * 2 + 3; // Entre 3 y 5

            // Calcular tiempo de respuesta promedio en horas (simulado)
            const tiempoRespuesta = Math.random() * 20 + 4; // Entre 4 y 24 horas

            return {
              id: inst.id,
              nombre: inst.nombre,
              email: inst.email,
              telefono: inst.telefono,
              especialidades: inst.especialidades || [],
              activo: inst.activo,
              fecha_registro: inst.creado_en,
              metricas: {
                totalIncidencias,
                resueltas,
                promedioDias,
                valoracionPromedio,
                tiempoRespuesta
              }
            };
          })
        );

        setProveedores(proveedoresConMetricas);
      }
    } catch (error) {
      console.error("Error cargando proveedores:", error);
    } finally {
      setLoading(false);
    }
  };

  const crearProveedor = async () => {
    try {
      if (!nuevoProveedor.nombre.trim()) {
        alert("El nombre es obligatorio");
        return;
      }

      const { error } = await supabase
        .from("instituciones")
        .insert({
          nombre: nuevoProveedor.nombre.trim(),
          tipo: "Proveedor",
          email: nuevoProveedor.email.trim() || null,
          telefono: nuevoProveedor.telefono.trim() || null,
          especialidades: nuevoProveedor.especialidades.split(',').map(s => s.trim()).filter(s => s),
          activo: true
        });

      if (error) {
        console.error("Error creando proveedor:", error);
        alert("Error al crear el proveedor");
        return;
      }

      setMostrarModalNuevo(false);
      setNuevoProveedor({ nombre: '', email: '', telefono: '', especialidades: '' });
      cargarProveedores();
    } catch (error) {
      console.error("Error:", error);
      alert("Error al crear el proveedor");
    }
  };

  const toggleActivo = async (proveedorId: string, activo: boolean) => {
    try {
      const { error } = await supabase
        .from("instituciones")
        .update({ activo: !activo })
        .eq("id", proveedorId);

      if (error) {
        console.error("Error actualizando proveedor:", error);
        return;
      }

      cargarProveedores();
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const getRatingStars = (rating: number) => {
    const stars = Math.round(rating);
    return "★".repeat(stars) + "☆".repeat(5 - stars);
  };

  const getPerformanceColor = (percentage: number) => {
    if (percentage >= 80) return "#66bb6a";
    if (percentage >= 60) return "#ffa726";
    return "#ff6b6b";
  };

  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: PALETA.bg }}>
      <div className="px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-lg tracking-[0.3em]" style={{ color: PALETA.texto }}>
            GESTIÓN DE PROVEEDORES:
          </h1>
          <div className="flex gap-3">
            <button
              onClick={() => setMostrarModalNuevo(true)}
              className="px-4 py-2 rounded text-white hover:opacity-90"
              style={{ backgroundColor: "#66bb6a" }}
            >
              + Nuevo Proveedor
            </button>
            <button
              onClick={() => router.back()}
              className="px-4 py-2 rounded text-white hover:opacity-90"
              style={{ backgroundColor: PALETA.filtros }}
            >
              ← Volver
            </button>
          </div>
        </div>

        {/* Resumen General */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 rounded-lg" style={{ backgroundColor: PALETA.card }}>
            <h3 className="text-sm font-medium text-gray-600 mb-1">Total Proveedores</h3>
            <p className="text-2xl font-bold" style={{ color: PALETA.textoOscuro }}>
              {proveedores.length}
            </p>
          </div>
          <div className="p-4 rounded-lg" style={{ backgroundColor: PALETA.card }}>
            <h3 className="text-sm font-medium text-gray-600 mb-1">Activos</h3>
            <p className="text-2xl font-bold text-green-600">
              {proveedores.filter(p => p.activo).length}
            </p>
          </div>
          <div className="p-4 rounded-lg" style={{ backgroundColor: PALETA.card }}>
            <h3 className="text-sm font-medium text-gray-600 mb-1">Promedio Resolución</h3>
            <p className="text-2xl font-bold text-blue-600">
              {Math.round(proveedores.reduce((sum, p) => sum + p.metricas.promedioDias, 0) / proveedores.length || 0)} días
            </p>
          </div>
          <div className="p-4 rounded-lg" style={{ backgroundColor: PALETA.card }}>
            <h3 className="text-sm font-medium text-gray-600 mb-1">Valoración Promedio</h3>
            <p className="text-2xl font-bold text-yellow-600">
              {(proveedores.reduce((sum, p) => sum + p.metricas.valoracionPromedio, 0) / proveedores.length || 0).toFixed(1)}
            </p>
          </div>
        </div>

        {/* Lista de Proveedores */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12">
              <p className="text-white/80">Cargando proveedores...</p>
            </div>
          ) : proveedores.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-white/80">No hay proveedores registrados</p>
            </div>
          ) : (
            proveedores.map(proveedor => {
              const porcentajeExito = proveedor.metricas.totalIncidencias > 0
                ? Math.round((proveedor.metricas.resueltas / proveedor.metricas.totalIncidencias) * 100)
                : 0;

              return (
                <div
                  key={proveedor.id}
                  className="p-6 rounded-lg"
                  style={{ backgroundColor: PALETA.card }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold" style={{ color: PALETA.textoOscuro }}>
                          {proveedor.nombre}
                        </h3>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            proveedor.activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {proveedor.activo ? 'ACTIVO' : 'INACTIVO'}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                        <div>
                          <p><strong>Email:</strong> {proveedor.email || 'No especificado'}</p>
                          <p><strong>Teléfono:</strong> {proveedor.telefono || 'No especificado'}</p>
                          <p><strong>Registro:</strong> {new Date(proveedor.fecha_registro).toLocaleDateString('es-ES')}</p>
                        </div>
                        <div>
                          <p><strong>Especialidades:</strong></p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {proveedor.especialidades?.length ? (
                              proveedor.especialidades.map((esp, idx) => (
                                <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                                  {esp}
                                </span>
                              ))
                            ) : (
                              <span className="text-gray-400">No especificadas</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleActivo(proveedor.id, proveedor.activo)}
                      className={`px-3 py-1 rounded text-xs font-medium ${
                        proveedor.activo
                          ? 'bg-red-100 text-red-800 hover:bg-red-200'
                          : 'bg-green-100 text-green-800 hover:bg-green-200'
                      }`}
                    >
                      {proveedor.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>

                  {/* Métricas de Rendimiento */}
                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-3" style={{ color: PALETA.textoOscuro }}>
                      Métricas de Rendimiento
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold" style={{ color: PALETA.textoOscuro }}>
                          {proveedor.metricas.totalIncidencias}
                        </p>
                        <p className="text-xs text-gray-600">Total Incidencias</p>
                      </div>
                      <div className="text-center">
                        <p
                          className="text-2xl font-bold"
                          style={{ color: getPerformanceColor(porcentajeExito) }}
                        >
                          {porcentajeExito}%
                        </p>
                        <p className="text-xs text-gray-600">Éxito</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-blue-600">
                          {proveedor.metricas.promedioDias}
                        </p>
                        <p className="text-xs text-gray-600">Días Promedio</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-yellow-600">
                          {getRatingStars(proveedor.metricas.valoracionPromedio)}
                        </p>
                        <p className="text-xs text-gray-600">
                          {proveedor.metricas.valoracionPromedio.toFixed(1)} Valoración
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-purple-600">
                          {Math.round(proveedor.metricas.tiempoRespuesta)}h
                        </p>
                        <p className="text-xs text-gray-600">Tiempo Respuesta</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal Nuevo Proveedor */}
      {mostrarModalNuevo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div
            className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
            style={{ backgroundColor: PALETA.card }}
          >
            <h3 className="text-xl font-semibold mb-4" style={{ color: PALETA.textoOscuro }}>
              Nuevo Proveedor
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: PALETA.textoOscuro }}>
                  Nombre *
                </label>
                <input
                  type="text"
                  value={nuevoProveedor.nombre}
                  onChange={(e) => setNuevoProveedor({...nuevoProveedor, nombre: e.target.value})}
                  className="w-full p-2 border rounded"
                  placeholder="Nombre del proveedor"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: PALETA.textoOscuro }}>
                  Email
                </label>
                <input
                  type="email"
                  value={nuevoProveedor.email}
                  onChange={(e) => setNuevoProveedor({...nuevoProveedor, email: e.target.value})}
                  className="w-full p-2 border rounded"
                  placeholder="email@ejemplo.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: PALETA.textoOscuro }}>
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={nuevoProveedor.telefono}
                  onChange={(e) => setNuevoProveedor({...nuevoProveedor, telefono: e.target.value})}
                  className="w-full p-2 border rounded"
                  placeholder="123456789"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: PALETA.textoOscuro }}>
                  Especialidades
                </label>
                <input
                  type="text"
                  value={nuevoProveedor.especialidades}
                  onChange={(e) => setNuevoProveedor({...nuevoProveedor, especialidades: e.target.value})}
                  className="w-full p-2 border rounded"
                  placeholder="Electricidad, Fontanería, etc. (separar por comas)"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setMostrarModalNuevo(false);
                  setNuevoProveedor({ nombre: '', email: '', telefono: '', especialidades: '' });
                }}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                Cancelar
              </button>
              <button
                onClick={crearProveedor}
                className="px-4 py-2 text-sm text-white rounded hover:opacity-90"
                style={{ backgroundColor: "#66bb6a" }}
              >
                Crear Proveedor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}