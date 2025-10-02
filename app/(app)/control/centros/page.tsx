"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { PALETA } from "@/lib/theme";

type Centro = {
  id: string;
  nombre: string;
  tipo: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  activo: boolean;
  fecha_registro: string;
  responsable?: string;
  estadisticas: {
    totalIncidencias: number;
    abiertas: number;
    cerradas: number;
    promedioDias: number;
    ultimaIncidencia?: string;
  };
  personal: number;
};

export default function GestionCentros() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [centros, setCentros] = useState<Centro[]>([]);
  const [mostrarModalNuevo, setMostrarModalNuevo] = useState(false);
  const [nuevoCentro, setNuevoCentro] = useState({
    nombre: '',
    tipo: 'Centro',
    direccion: '',
    telefono: '',
    email: '',
    responsable: ''
  });

  useEffect(() => {
    cargarCentros();
  }, []);

  const cargarCentros = async () => {
    try {
      setLoading(true);

      // Obtener instituciones que no sean proveedores
      const { data: instituciones } = await supabase
        .from("instituciones")
        .select("*")
        .neq("tipo", "Proveedor")
        .order("nombre");

      if (instituciones) {
        const centrosConEstadisticas = await Promise.all(
          instituciones.map(async (inst) => {
            // Obtener estadísticas de incidencias
            const { data: incidencias } = await supabase
              .from("incidencias")
              .select("id, estado_cliente, creado_en")
              .eq("centro", inst.nombre);

            const totalIncidencias = incidencias?.length || 0;
            const abiertas = incidencias?.filter(inc =>
              ["Abierta", "En espera", "En tramitación"].includes(inc.estado_cliente)
            ).length || 0;
            const cerradas = totalIncidencias - abiertas;

            // Calcular promedio de días para cerrar
            const incidenciasCerradas = incidencias?.filter(inc =>
              ["Cerrada", "Resuelta", "Anulada"].includes(inc.estado_cliente)
            ) || [];

            let promedioDias = 0;
            if (incidenciasCerradas.length > 0) {
              const totalDias = incidenciasCerradas.reduce((sum, inc) => {
                const fechaCreacion = new Date(inc.creado_en);
                const ahora = new Date();
                const dias = Math.ceil((ahora.getTime() - fechaCreacion.getTime()) / (1000 * 60 * 60 * 24));
                return sum + dias;
              }, 0);
              promedioDias = Math.round(totalDias / incidenciasCerradas.length);
            }

            // Obtener fecha de última incidencia
            const ultimaIncidencia = incidencias && incidencias.length > 0
              ? incidencias.sort((a, b) => new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime())[0].creado_en
              : undefined;

            // Contar personal asociado
            const { count: personal } = await supabase
              .from("personas_instituciones")
              .select("*", { count: "exact", head: true })
              .eq("institucion_id", inst.id);

            return {
              id: inst.id,
              nombre: inst.nombre,
              tipo: inst.tipo,
              direccion: inst.direccion,
              telefono: inst.telefono,
              email: inst.email,
              activo: inst.activo,
              fecha_registro: inst.creado_en,
              responsable: inst.responsable,
              estadisticas: {
                totalIncidencias,
                abiertas,
                cerradas,
                promedioDias,
                ultimaIncidencia
              },
              personal: personal || 0
            };
          })
        );

        setCentros(centrosConEstadisticas);
      }
    } catch (error) {
      console.error("Error cargando centros:", error);
    } finally {
      setLoading(false);
    }
  };

  const crearCentro = async () => {
    try {
      if (!nuevoCentro.nombre.trim()) {
        alert("El nombre es obligatorio");
        return;
      }

      const { error } = await supabase
        .from("instituciones")
        .insert({
          nombre: nuevoCentro.nombre.trim(),
          tipo: nuevoCentro.tipo,
          direccion: nuevoCentro.direccion.trim() || null,
          telefono: nuevoCentro.telefono.trim() || null,
          email: nuevoCentro.email.trim() || null,
          responsable: nuevoCentro.responsable.trim() || null,
          activo: true
        });

      if (error) {
        console.error("Error creando centro:", error);
        alert("Error al crear el centro");
        return;
      }

      setMostrarModalNuevo(false);
      setNuevoCentro({
        nombre: '',
        tipo: 'Centro',
        direccion: '',
        telefono: '',
        email: '',
        responsable: ''
      });
      cargarCentros();
    } catch (error) {
      console.error("Error:", error);
      alert("Error al crear el centro");
    }
  };

  const toggleActivo = async (centroId: string, activo: boolean) => {
    try {
      const { error } = await supabase
        .from("instituciones")
        .update({ activo: !activo })
        .eq("id", centroId);

      if (error) {
        console.error("Error actualizando centro:", error);
        return;
      }

      cargarCentros();
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const getIncidenciasColor = (abiertas: number, total: number) => {
    if (total === 0) return "#9e9e9e";
    const porcentaje = (abiertas / total) * 100;
    if (porcentaje > 50) return "#ff6b6b";
    if (porcentaje > 25) return "#ffa726";
    return "#66bb6a";
  };

  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: PALETA.bg }}>
      <div className="px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-lg tracking-[0.3em]" style={{ color: PALETA.texto }}>
            GESTIÓN DE CENTROS:
          </h1>
          <div className="flex gap-3">
            <button
              onClick={() => setMostrarModalNuevo(true)}
              className="px-4 py-2 rounded text-white hover:opacity-90"
              style={{ backgroundColor: "#42a5f5" }}
            >
              + Nuevo Centro
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
            <h3 className="text-sm font-medium text-gray-600 mb-1">Total Centros</h3>
            <p className="text-2xl font-bold" style={{ color: PALETA.textoOscuro }}>
              {centros.length}
            </p>
          </div>
          <div className="p-4 rounded-lg" style={{ backgroundColor: PALETA.card }}>
            <h3 className="text-sm font-medium text-gray-600 mb-1">Activos</h3>
            <p className="text-2xl font-bold text-green-600">
              {centros.filter(c => c.activo).length}
            </p>
          </div>
          <div className="p-4 rounded-lg" style={{ backgroundColor: PALETA.card }}>
            <h3 className="text-sm font-medium text-gray-600 mb-1">Total Personal</h3>
            <p className="text-2xl font-bold text-blue-600">
              {centros.reduce((sum, c) => sum + c.personal, 0)}
            </p>
          </div>
          <div className="p-4 rounded-lg" style={{ backgroundColor: PALETA.card }}>
            <h3 className="text-sm font-medium text-gray-600 mb-1">Incidencias Abiertas</h3>
            <p className="text-2xl font-bold text-orange-600">
              {centros.reduce((sum, c) => sum + c.estadisticas.abiertas, 0)}
            </p>
          </div>
        </div>

        {/* Lista de Centros */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12">
              <p className="text-white/80">Cargando centros...</p>
            </div>
          ) : centros.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-white/80">No hay centros registrados</p>
            </div>
          ) : (
            centros.map(centro => (
              <div
                key={centro.id}
                className="p-6 rounded-lg"
                style={{ backgroundColor: PALETA.card }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold" style={{ color: PALETA.textoOscuro }}>
                        {centro.nombre}
                      </h3>
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                        {centro.tipo}
                      </span>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          centro.activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {centro.activo ? 'ACTIVO' : 'INACTIVO'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                      <div>
                        <p><strong>Dirección:</strong> {centro.direccion || 'No especificada'}</p>
                        <p><strong>Teléfono:</strong> {centro.telefono || 'No especificado'}</p>
                        <p><strong>Email:</strong> {centro.email || 'No especificado'}</p>
                      </div>
                      <div>
                        <p><strong>Responsable:</strong> {centro.responsable || 'No asignado'}</p>
                        <p><strong>Personal:</strong> {centro.personal} personas</p>
                        <p><strong>Registro:</strong> {new Date(centro.fecha_registro).toLocaleDateString('es-ES')}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => router.push(`/control/centros/${centro.id}/personal`)}
                      className="px-3 py-1 bg-blue-100 text-blue-800 hover:bg-blue-200 rounded text-xs font-medium"
                    >
                      👥 Personal
                    </button>
                    <button
                      onClick={() => toggleActivo(centro.id, centro.activo)}
                      className={`px-3 py-1 rounded text-xs font-medium ${
                        centro.activo
                          ? 'bg-red-100 text-red-800 hover:bg-red-200'
                          : 'bg-green-100 text-green-800 hover:bg-green-200'
                      }`}
                    >
                      {centro.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </div>

                {/* Estadísticas de Incidencias */}
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3" style={{ color: PALETA.textoOscuro }}>
                    📊 Estadísticas de Incidencias
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold" style={{ color: PALETA.textoOscuro }}>
                        {centro.estadisticas.totalIncidencias}
                      </p>
                      <p className="text-xs text-gray-600">Total</p>
                    </div>
                    <div className="text-center">
                      <p
                        className="text-2xl font-bold"
                        style={{ color: getIncidenciasColor(centro.estadisticas.abiertas, centro.estadisticas.totalIncidencias) }}
                      >
                        {centro.estadisticas.abiertas}
                      </p>
                      <p className="text-xs text-gray-600">Abiertas</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">
                        {centro.estadisticas.cerradas}
                      </p>
                      <p className="text-xs text-gray-600">Cerradas</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">
                        {centro.estadisticas.promedioDias || '-'}
                      </p>
                      <p className="text-xs text-gray-600">Días Promedio</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-purple-600">
                        {centro.estadisticas.ultimaIncidencia
                          ? new Date(centro.estadisticas.ultimaIncidencia).toLocaleDateString('es-ES')
                          : 'Nunca'
                        }
                      </p>
                      <p className="text-xs text-gray-600">Última Incidencia</p>
                    </div>
                  </div>
                </div>

                {/* Acciones rápidas */}
                <div className="border-t pt-4 mt-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => router.push(`/incidencias?centro=${encodeURIComponent(centro.nombre)}`)}
                      className="px-3 py-1 bg-gray-100 text-gray-800 hover:bg-gray-200 rounded text-xs font-medium"
                    >
                      📋 Ver Incidencias
                    </button>
                    <button
                      onClick={() => router.push(`/control/reportes/centros?centro=${centro.id}`)}
                      className="px-3 py-1 bg-purple-100 text-purple-800 hover:bg-purple-200 rounded text-xs font-medium"
                    >
                      📊 Reporte Detallado
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal Nuevo Centro */}
      {mostrarModalNuevo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div
            className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
            style={{ backgroundColor: PALETA.card }}
          >
            <h3 className="text-xl font-semibold mb-4" style={{ color: PALETA.textoOscuro }}>
              Nuevo Centro
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: PALETA.textoOscuro }}>
                  Nombre *
                </label>
                <input
                  type="text"
                  value={nuevoCentro.nombre}
                  onChange={(e) => setNuevoCentro({...nuevoCentro, nombre: e.target.value})}
                  className="w-full p-2 border rounded"
                  placeholder="Nombre del centro"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: PALETA.textoOscuro }}>
                  Tipo
                </label>
                <select
                  value={nuevoCentro.tipo}
                  onChange={(e) => setNuevoCentro({...nuevoCentro, tipo: e.target.value})}
                  className="w-full p-2 border rounded"
                >
                  <option value="Centro">Centro</option>
                  <option value="Sede">Sede</option>
                  <option value="Delegación">Delegación</option>
                  <option value="Oficina">Oficina</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: PALETA.textoOscuro }}>
                  Dirección
                </label>
                <input
                  type="text"
                  value={nuevoCentro.direccion}
                  onChange={(e) => setNuevoCentro({...nuevoCentro, direccion: e.target.value})}
                  className="w-full p-2 border rounded"
                  placeholder="Dirección completa"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: PALETA.textoOscuro }}>
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={nuevoCentro.telefono}
                    onChange={(e) => setNuevoCentro({...nuevoCentro, telefono: e.target.value})}
                    className="w-full p-2 border rounded"
                    placeholder="123456789"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: PALETA.textoOscuro }}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={nuevoCentro.email}
                    onChange={(e) => setNuevoCentro({...nuevoCentro, email: e.target.value})}
                    className="w-full p-2 border rounded"
                    placeholder="email@centro.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: PALETA.textoOscuro }}>
                  Responsable
                </label>
                <input
                  type="text"
                  value={nuevoCentro.responsable}
                  onChange={(e) => setNuevoCentro({...nuevoCentro, responsable: e.target.value})}
                  className="w-full p-2 border rounded"
                  placeholder="Nombre del responsable"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setMostrarModalNuevo(false);
                  setNuevoCentro({
                    nombre: '',
                    tipo: 'Centro',
                    direccion: '',
                    telefono: '',
                    email: '',
                    responsable: ''
                  });
                }}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                Cancelar
              </button>
              <button
                onClick={crearCentro}
                className="px-4 py-2 text-sm text-white rounded hover:opacity-90"
                style={{ backgroundColor: "#42a5f5" }}
              >
                Crear Centro
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}