"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const PALETA = {
  fondo: "#5D6D52",
  headerTable: "#D9B6A9",
  card: "#F9FAF8",
  filtros: "#E8B5A8",
  texto: "#EDF0E9",
  textoOscuro: "#4b4b4b",
  verdeClaro: "#A9B88C",
  verdeSombra: "#7A8A6F",
};

type Incidencia = {
  id: string;
  num_solicitud: string;
  descripcion: string;
  estado_cliente: string;
  estado_proveedor?: string | null;
  centro?: string;
  fecha?: string;
  hora?: string;
  proveedor_id?: string | null;
  instituciones?: { 
    nombre: string;
  }[] | null;
  proveedores?: {
    nombre: string;
  } | null;
  comentarios_count?: number;
  enviada_a_proveedor?: boolean;
  proveedor_caso_id?: string | null;
  estado_proveedor_actual?: string | null;
};

type Proveedor = {
  id: string;
  nombre: string;
  tipo: string;
};

export default function GestionIncidencias() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filtro = searchParams.get('filtro');

  const [loading, setLoading] = useState(true);
  const [tipoUsuario, setTipoUsuario] = useState<string | null>(null);
  const [incidencias, setIncidencias] = useState<Incidencia[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [filtroActivo, setFiltroActivo] = useState(filtro || 'todas');
  const [filtroNumero, setFiltroNumero] = useState('');
  const [filtroCentro, setFiltroCentro] = useState('');
  const [accionEnCurso, setAccionEnCurso] = useState<string | null>(null);
  const [mostrarModalProveedor, setMostrarModalProveedor] = useState(false);
  const [incidenciaSeleccionada, setIncidenciaSeleccionada] = useState<string | null>(null);
  const [formularioProveedor, setFormularioProveedor] = useState({
    proveedor_id: '',
    descripcion_proveedor: '',
    prioridad: 'No crítico' as 'Crítico' | 'No crítico',
    estado_proveedor: 'Abierta'
  });
  const [centrosDisponibles, setCentrosDisponibles] = useState<string[]>([]);

  useEffect(() => {
    verificarAcceso();
  }, []);

  useEffect(() => {
    if (tipoUsuario === "Control") {
      cargarIncidencias();
      cargarProveedores();
    }
  }, [tipoUsuario, filtroActivo]);

  const verificarAcceso = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData.user?.email;

      if (!userEmail) {
        router.replace("/login");
        return;
      }

      const { data: persona, error: personaError } = await supabase
        .from("personas")
        .select("rol")
        .eq("email", userEmail)
        .maybeSingle();

      if (personaError || !persona || persona.rol !== "Control") {
        router.replace("/");
        return;
      }

      setTipoUsuario(persona.rol);
    } catch (error) {
      console.error("Error verificando acceso:", error);
      router.replace("/login");
    } finally {
      setLoading(false);
    }
  };

  const cargarIncidencias = async () => {
    try {
      console.log('Cargando incidencias con filtro:', filtroActivo);
      
      let incidenciasFiltradas = [];
      
      if (filtroActivo === 'proveedor') {
        // Para el filtro de proveedor, obtener directamente las incidencias que están en proveedor_casos
        const { data: proveedorCasos, error: proveedorError } = await supabase
          .from("proveedor_casos")
          .select("incidencia_id")
          .eq('activo', true);

        if (proveedorError) {
          console.error("Error cargando casos de proveedor:", proveedorError);
          setIncidencias([]);
          return;
        }

        const incidenciaIds = proveedorCasos?.map(pc => pc.incidencia_id) || [];
        
        if (incidenciaIds.length === 0) {
          setIncidencias([]);
          return;
        }

        // Obtener las incidencias usando los IDs
        const { data: incidenciasProveedor, error } = await supabase
          .from("incidencias")
          .select("*")
          .in('id', incidenciaIds)
          .order('reportado_at_utc', { ascending: false });

        if (error) {
          console.error("Error cargando incidencias:", error);
          setIncidencias([]);
          return;
        }

        incidenciasFiltradas = incidenciasProveedor || [];
        console.log('Incidencias con proveedor encontradas:', incidenciasFiltradas.length);
      } else {
        // Para otros filtros, cargar todas las incidencias
        const { data: todasIncidencias, error } = await supabase
          .from("incidencias")
          .select("*")
          .order('reportado_at_utc', { ascending: false })
          .limit(200);

        if (error) {
          console.error("Error cargando incidencias:", error);
          setIncidencias([]);
          return;
        }

        incidenciasFiltradas = todasIncidencias || [];
        
        // Filtro por estado para cerrar
        if (filtroActivo === 'cerrar') {
          incidenciasFiltradas = incidenciasFiltradas.filter(inc => 
            inc.estado_cliente === 'Resuelta'
          );
        }
      }

      console.log('Incidencias después del filtro principal:', incidenciasFiltradas.length);

      if (incidenciasFiltradas.length === 0) {
        setIncidencias([]);
        return;
      }

      // Extraer centros únicos para el filtro
      const centrosUnicos = [...new Set(incidenciasFiltradas.map(inc => inc.centro).filter(Boolean))];
      setCentrosDisponibles(centrosUnicos.sort());

      // Filtro por número de solicitud
      if (filtroNumero) {
        incidenciasFiltradas = incidenciasFiltradas.filter(inc => 
          inc.num_solicitud.toLowerCase().includes(filtroNumero.toLowerCase())
        );
      }

      // Filtro por centro
      if (filtroCentro) {
        incidenciasFiltradas = incidenciasFiltradas.filter(inc => 
          inc.centro === filtroCentro
        );
      }

      console.log('Incidencias filtradas:', incidenciasFiltradas.length);

      // Ordenar por reportado_at_utc (más recientes primero) después de filtrar
      incidenciasFiltradas.sort((a, b) => {
        const fechaA = new Date(a.reportado_at_utc || a.fecha || '1970-01-01');
        const fechaB = new Date(b.reportado_at_utc || b.fecha || '1970-01-01');
        return fechaB.getTime() - fechaA.getTime();
      });

      // Enriquecer con información adicional (solo las primeras 20 para mejor performance)
      const incidenciasLimitadas = incidenciasFiltradas.slice(0, 20);
      
      const incidenciasEnriquecidas = await Promise.all(
        incidenciasLimitadas.map(async (inc) => {
          try {
            let institucionNombre = inc.centro;
            let proveedorNombre = null;
            let comentariosCount = 0;
            let enviadaAProveedor = false;
            let proveedorCasoId = null;
            let estadoProveedorActual = null;

            // Intentar cargar nombre de institución
            if (inc.centro) {
              try {
                const { data: instData } = await supabase
                  .from("instituciones")
                  .select("nombre")
                  .eq("id", inc.centro)
                  .maybeSingle();
                if (instData?.nombre) {
                  institucionNombre = instData.nombre;
                }
              } catch (e) {
                // Mantener el ID si no se puede cargar el nombre
              }
            }

            // Verificar si está en proveedor_casos
            try {
              const { data: proveedorCaso, error: proveedorCasoError } = await supabase
                .from("proveedor_casos")
                .select("id, proveedor_id, estado_proveedor")
                .eq("incidencia_id", inc.id)
                .eq("activo", true)
                .maybeSingle();
                
              if (proveedorCasoError) {
                console.warn('Error consultando proveedor_casos:', proveedorCasoError);
              }
                
              if (proveedorCaso) {
                console.log(`Incidencia ${inc.num_solicitud} encontrada en proveedor_casos:`, proveedorCaso);
                console.log(`Estado proveedor obtenido:`, proveedorCaso.estado_proveedor);
                enviadaAProveedor = true;
                proveedorCasoId = proveedorCaso.id;
                estadoProveedorActual = proveedorCaso.estado_proveedor;
                
                // Buscar nombre del proveedor (institución) por separado
                if (proveedorCaso.proveedor_id) {
                  try {
                    const { data: instituciones } = await supabase
                      .from("instituciones")
                      .select("nombre")
                      .eq("id", proveedorCaso.proveedor_id)
                      .maybeSingle();
                    
                    if (instituciones?.nombre) {
                      proveedorNombre = instituciones.nombre;
                    } else {
                      proveedorNombre = `Proveedor (ID: ${proveedorCaso.proveedor_id.slice(0, 8)}...)`;
                    }
                  } catch (provError) {
                    console.warn('Error cargando nombre proveedor:', provError);
                    proveedorNombre = `Proveedor (ID: ${proveedorCaso.proveedor_id.slice(0, 8)}...)`;
                  }
                }
              } else {
                console.log(`Incidencia ${inc.num_solicitud} NO encontrada en proveedor_casos`);
              }
            } catch (e) {
              console.warn('Error verificando proveedor_casos:', e);
            }

            // Intentar contar comentarios
            try {
              const { count } = await supabase
                .from("comentarios")
                .select("*", { count: 'exact', head: true })
                .eq("incidencia_id", inc.id);
              comentariosCount = count || 0;
            } catch (e) {
              // No crítico si falla
            }

            const resultado = {
              ...inc,
              instituciones: institucionNombre ? [{ nombre: institucionNombre }] : null,
              proveedores: proveedorNombre ? { nombre: proveedorNombre } : null,
              comentarios_count: comentariosCount,
              enviada_a_proveedor: enviadaAProveedor,
              proveedor_caso_id: proveedorCasoId,
              estado_proveedor_actual: estadoProveedorActual
            };
            console.log(`Resultado final para incidencia ${inc.num_solicitud}:`, {
              enviada_a_proveedor: enviadaAProveedor,
              estado_proveedor_actual: estadoProveedorActual,
              proveedor_nombre: proveedorNombre
            });
            return resultado;
          } catch (enrichError) {
            console.warn('Error enriching incident:', inc.id, enrichError);
            return {
              ...inc,
              instituciones: inc.centro ? [{ nombre: inc.centro }] : null,
              proveedores: null,
              comentarios_count: 0,
              enviada_a_proveedor: false,
              proveedor_caso_id: null,
              estado_proveedor_actual: null
            };
          }
        })
      );

      console.log('Incidencias enriquecidas:', incidenciasEnriquecidas.length);
      setIncidencias(incidenciasEnriquecidas);
    } catch (error) {
      console.error("Error general cargando incidencias:", error);
      setIncidencias([]);
    }
  };

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

  const abrirModalProveedor = (incidenciaId: string) => {
    setIncidenciaSeleccionada(incidenciaId);
    setFormularioProveedor({
      proveedor_id: '',
      descripcion_proveedor: '',
      prioridad: 'No crítico',
      estado_proveedor: 'Abierta'
    });
    setMostrarModalProveedor(true);
  };

  const cerrarModalProveedor = () => {
    setMostrarModalProveedor(false);
    setIncidenciaSeleccionada(null);
    setFormularioProveedor({
      proveedor_id: '',
      descripcion_proveedor: '',
      prioridad: 'No crítico',
      estado_proveedor: 'Abierta'
    });
  };

  const asignarProveedorCompleto = async () => {
    if (!incidenciaSeleccionada || !formularioProveedor.proveedor_id) {
      return;
    }

    try {
      setAccionEnCurso(incidenciaSeleccionada);
      
      // Obtener datos del usuario actual para asignado_por
      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData.user?.email;
      
      let asignadoPorId = null;
      if (userEmail) {
        const { data: persona } = await supabase
          .from("personas")
          .select("id")
          .eq("email", userEmail)
          .maybeSingle();
        asignadoPorId = persona?.id;
      }

      // Verificar si ya existe un caso activo para esta incidencia
      const { data: casoExistente } = await supabase
        .from("proveedor_casos")
        .select("id")
        .eq("incidencia_id", incidenciaSeleccionada)
        .eq("activo", true)
        .maybeSingle();

      if (casoExistente) {
        // Actualizar el caso existente
        const { error } = await supabase
          .from("proveedor_casos")
          .update({
            proveedor_id: formularioProveedor.proveedor_id,
            descripcion_proveedor: formularioProveedor.descripcion_proveedor,
            prioridad: formularioProveedor.prioridad,
            estado_proveedor: formularioProveedor.estado_proveedor,
            asignado_por: asignadoPorId,
            asignado_en: new Date().toISOString(),
            actualizado_en: new Date().toISOString()
          })
          .eq("id", casoExistente.id);

        if (error) {
          console.error("Error actualizando caso de proveedor:", error);
          throw error;
        }
      } else {
        // Crear nuevo caso en proveedor_casos
        const { error } = await supabase
          .from("proveedor_casos")
          .insert({
            incidencia_id: incidenciaSeleccionada,
            proveedor_id: formularioProveedor.proveedor_id,
            descripcion_proveedor: formularioProveedor.descripcion_proveedor,
            prioridad: formularioProveedor.prioridad,
            estado_proveedor: formularioProveedor.estado_proveedor,
            asignado_por: asignadoPorId,
            asignado_en: new Date().toISOString(),
            activo: true
          });

        if (error) {
          console.error("Error creando caso de proveedor:", error);
          throw error;
        }
      }

      // Cambiar estado_cliente a "En tramitación"
      await supabase
        .from("incidencias")
        .update({ estado_cliente: 'En tramitación' })
        .eq("id", incidenciaSeleccionada);

      // Crear comentario del sistema en el chat del cliente
      const proveedor = proveedores.find(p => p.id === formularioProveedor.proveedor_id);
      
      if (proveedor) {
        await supabase
          .from("comentarios")
          .insert({
            incidencia_id: incidenciaSeleccionada,
            ambito: 'cliente',
            autor_id: asignadoPorId,
            autor_email: userEmail,
            autor_rol: 'Control',
            cuerpo: `La incidencia ha sido asignada al proveedor ${proveedor.nombre}.`,
            es_sistema: true
          });
      }

      cerrarModalProveedor();
      cargarIncidencias();
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setAccionEnCurso(null);
    }
  };

  const asignarProveedor = async (incidenciaId: string, proveedorId: string) => {
    try {
      setAccionEnCurso(incidenciaId);
      
      // Obtener datos del usuario actual para asignado_por
      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData.user?.email;
      
      let asignadoPorId = null;
      if (userEmail) {
        const { data: persona } = await supabase
          .from("personas")
          .select("id")
          .eq("email", userEmail)
          .maybeSingle();
        asignadoPorId = persona?.id;
      }

      // Verificar si ya existe un caso activo para esta incidencia
      const { data: casoExistente } = await supabase
        .from("proveedor_casos")
        .select("id")
        .eq("incidencia_id", incidenciaId)
        .eq("activo", true)
        .maybeSingle();

      if (casoExistente) {
        // Actualizar el caso existente
        const { error } = await supabase
          .from("proveedor_casos")
          .update({
            proveedor_id: proveedorId,
            asignado_por: asignadoPorId,
            asignado_en: new Date().toISOString(),
            actualizado_en: new Date().toISOString()
          })
          .eq("id", casoExistente.id);

        if (error) {
          console.error("Error actualizando caso de proveedor:", error);
          return;
        }
      } else {
        // Crear nuevo caso en proveedor_casos
        const { error } = await supabase
          .from("proveedor_casos")
          .insert({
            incidencia_id: incidenciaId,
            proveedor_id: proveedorId,
            estado_proveedor: 'Asignada',
            asignado_por: asignadoPorId,
            asignado_en: new Date().toISOString(),
            activo: true
          });

        if (error) {
          console.error("Error creando caso de proveedor:", error);
          return;
        }
      }

      // Cambiar estado_cliente a "En tramitación"
      await supabase
        .from("incidencias")
        .update({ estado_cliente: 'En tramitación' })
        .eq("id", incidenciaSeleccionada);

      // Crear comentario del sistema
      const proveedor = proveedores.find(p => p.id === proveedorId);
      if (proveedor) {
        await supabase
          .from("comentarios")
          .insert({
            incidencia_id: incidenciaId,
            ambito: 'cliente',
            autor_email: 'sistema@fminci.com',
            autor_rol: 'Sistema',
            cuerpo: `Incidencia asignada al proveedor: ${proveedor.nombre}`,
            es_sistema: true
          });
      }

      cargarIncidencias();
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setAccionEnCurso(null);
    }
  };

  const cambiarEstado = async (incidenciaId: string, nuevoEstado: string) => {
    try {
      setAccionEnCurso(incidenciaId);
      
      const { error } = await supabase
        .from("incidencias")
        .update({ estado_cliente: nuevoEstado })
        .eq("id", incidenciaId);

      if (error) {
        console.error("Error cambiando estado:", error);
        return;
      }

      // Cambiar estado_cliente a "En tramitación"
      await supabase
        .from("incidencias")
        .update({ estado_cliente: 'En tramitación' })
        .eq("id", incidenciaSeleccionada);

      // Crear comentario del sistema
      await supabase
        .from("comentarios")
        .insert({
          incidencia_id: incidenciaId,
          ambito: 'cliente',
          autor_email: 'sistema@fminci.com',
          autor_rol: 'Sistema',
          cuerpo: `Estado cambiado a: ${nuevoEstado}`,
          es_sistema: true
        });

      cargarIncidencias();
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setAccionEnCurso(null);
    }
  };

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'Abierta':
        return '#ef4444'; // rojo
      case 'En espera':
        return '#f59e0b'; // amarillo
      case 'En tramitación':
        return '#3b82f6'; // azul
      case 'Cerrada':
      case 'Resuelta':
        return '#10b981'; // verde
      case 'Anulada':
        return '#6b7280'; // gris
      default:
        return '#6b7280';
    }
  };

  const getEstadoProveedorColor = (estado: string) => {
    switch (estado) {
      case 'Abierta':
        return '#ef4444'; // rojo
      case 'En resolución':
        return '#f59e0b'; // amarillo
      case 'Ofertada':
        return '#8b5cf6'; // púrpura
      case 'Oferta aprobada':
        return '#10b981'; // verde
      case 'Oferta a revisar':
        return '#f59e0b'; // amarillo
      case 'Resuelta':
        return '#10b981'; // verde
      case 'Cerrada':
        return '#6b7280'; // gris
      case 'Anulada':
        return '#6b7280'; // gris
      case 'Valorada':
        return '#10b981'; // verde
      case 'Pendiente valoración':
        return '#f59e0b'; // amarillo
      default:
        return '#6b7280';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center" style={{ backgroundColor: PALETA.fondo }}>
        <span className="text-white">Verificando acceso...</span>
      </div>
    );
  }

  if (tipoUsuario !== "Control") {
    return null;
  }

  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: PALETA.fondo }}>
      <div className="px-6 py-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <button
              onClick={() => router.push("/control")}
              className="text-white text-sm hover:underline mb-2"
            >
              ← Volver al Panel de Control
            </button>
            <h1 className="text-lg tracking-[0.3em]" style={{ color: PALETA.texto }}>
              GESTIÓN DE INCIDENCIAS
            </h1>
          </div>
        </div>

        {/* Filtros */}
        <div className="mb-6">
          {/* Filtros de estado */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {[
              { key: 'todas', label: 'Todas', color: PALETA.headerTable },
              { key: 'proveedor', label: 'Proveedor', color: PALETA.verdeClaro },
              { key: 'cerrar', label: 'Cerrar', color: PALETA.filtros }
            ].map(filtro => (
              <button
                key={filtro.key}
                onClick={() => setFiltroActivo(filtro.key)}
                className={`px-4 py-2 rounded text-sm font-medium transition-opacity ${
                  filtroActivo === filtro.key ? 'opacity-100' : 'opacity-70 hover:opacity-90'
                }`}
                style={{ 
                  backgroundColor: filtro.color, 
                  color: PALETA.textoOscuro,
                  border: filtroActivo === filtro.key ? `2px solid ${PALETA.fondo}` : '2px solid transparent'
                }}
              >
                {filtro.label}
              </button>
            ))}
          </div>
          
          {/* Filtros adicionales */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: PALETA.texto }}>
                Buscar por número:
              </label>
              <input
                type="text"
                value={filtroNumero}
                onChange={(e) => setFiltroNumero(e.target.value)}
                placeholder="Ej: 20346"
                className="w-full text-sm p-2 border rounded focus:outline-none"
                style={{ backgroundColor: 'white', color: PALETA.textoOscuro }}
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: PALETA.texto }}>
                Filtrar por centro:
              </label>
              <select
                value={filtroCentro}
                onChange={(e) => setFiltroCentro(e.target.value)}
                className="w-full text-sm p-2 border rounded focus:outline-none"
                style={{ backgroundColor: 'white', color: PALETA.textoOscuro }}
              >
                <option value="">Todos los centros</option>
                {centrosDisponibles.map(centro => (
                  <option key={centro} value={centro}>
                    {centro}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex items-end">
              <button
                onClick={() => {
                  setFiltroNumero('');
                  setFiltroCentro('');
                  setFiltroActivo('todas');
                }}
                className="px-4 py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity"
                style={{ backgroundColor: PALETA.fondo, color: PALETA.texto }}
              >
                Limpiar filtros
              </button>
            </div>
          </div>
        </div>

        {/* Lista de Incidencias */}
        <div className="space-y-4">
          {incidencias.length === 0 ? (
            <div className="text-center py-8">
              <span style={{ color: PALETA.texto }}>No hay incidencias para mostrar</span>
            </div>
          ) : (
            incidencias.map((incidencia) => (
              <div
                key={incidencia.id}
                className="rounded-lg p-6 shadow-sm"
                style={{ backgroundColor: PALETA.card }}
              >
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
                  {/* Información básica */}
                  <div className="lg:col-span-2">
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      <h3 className="font-semibold text-lg" style={{ color: PALETA.textoOscuro }}>
                        #{incidencia.num_solicitud}
                      </h3>
                      
                      {/* Estado Cliente */}
                      <div className="flex flex-col gap-1">
                        <span className="text-xs" style={{ color: PALETA.textoOscuro }}>Estado Cliente:</span>
                        <span
                          className="px-2 py-1 rounded text-xs font-medium text-white"
                          style={{ backgroundColor: getEstadoColor(incidencia.estado_cliente) }}
                        >
                          {incidencia.estado_cliente}
                        </span>
                      </div>

                      {/* Estado Proveedor */}
                      {incidencia.enviada_a_proveedor && incidencia.estado_proveedor_actual && (
                        <div className="flex flex-col gap-1">
                          <span className="text-xs" style={{ color: PALETA.textoOscuro }}>Estado Proveedor:</span>
                          <span
                            className="px-2 py-1 rounded text-xs font-medium text-white"
                            style={{ backgroundColor: getEstadoProveedorColor(incidencia.estado_proveedor_actual) }}
                          >
                            {incidencia.estado_proveedor_actual}
                          </span>
                        </div>
                      )}

                      {/* Indicador de enviada a proveedor */}
                      {incidencia.enviada_a_proveedor && (
                        <span
                          className="px-3 py-1 rounded text-xs font-medium flex items-center gap-1"
                          style={{ backgroundColor: '#059669', color: 'white' }}
                          title="Incidencia enviada a proveedor"
                        >
                          🚀 ENVIADA A PROVEEDOR
                        </span>
                      )}
                      
                      {/* Proveedor asignado */}
                      {incidencia.proveedores && (
                        <span
                          className="px-2 py-1 rounded text-xs"
                          style={{ backgroundColor: PALETA.verdeClaro, color: PALETA.textoOscuro }}
                        >
                          👤 {incidencia.proveedores.nombre}
                        </span>
                      )}
                    </div>
                    
                    <p className="text-sm mb-2" style={{ color: PALETA.textoOscuro }}>
                      {incidencia.descripcion}
                    </p>
                    
                    <div className="text-xs space-y-1" style={{ color: PALETA.textoOscuro }}>
                      <div>
                        <strong>Centro:</strong> {incidencia.instituciones?.[0]?.nombre || incidencia.centro || "-"}
                      </div>
                      {incidencia.fecha && incidencia.hora && (
                        <div>
                          <strong>Fecha:</strong> {new Date(incidencia.fecha + 'T' + incidencia.hora).toLocaleDateString('es-ES', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      )}
                      <div>
                        <strong>Comentarios:</strong> {incidencia.comentarios_count}
                      </div>
                    </div>
                  </div>

                  {/* Acciones de gestión */}
                  <div className="lg:col-span-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Asignar Proveedor */}
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: PALETA.textoOscuro }}>
                          Asignar Proveedor:
                        </label>
                        <button
                          onClick={() => abrirModalProveedor(incidencia.id)}
                          disabled={accionEnCurso === incidencia.id}
                          className="w-full text-xs p-2 border rounded hover:opacity-80 transition-opacity"
                          style={{ 
                            backgroundColor: PALETA.fondo, 
                            color: 'white',
                            opacity: accionEnCurso === incidencia.id ? 0.5 : 1
                          }}
                        >
                          {incidencia.enviada_a_proveedor ? 'Reasignar Proveedor' : 'Asignar a Proveedor'}
                        </button>
                      </div>

                      {/* Cambiar Estado */}
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: PALETA.textoOscuro }}>
                          Cambiar Estado:
                        </label>
                        <select
                          value={incidencia.estado_cliente}
                          onChange={(e) => cambiarEstado(incidencia.id, e.target.value)}
                          disabled={accionEnCurso === incidencia.id}
                          className="w-full text-xs p-2 border rounded"
                          style={{ backgroundColor: 'white', color: PALETA.textoOscuro }}
                        >
                          <option value="Abierta">Abierta</option>
                          <option value="En espera">En espera</option>
                          <option value="En tramitación">En tramitación</option>
                          <option value="Resuelta">Resuelta</option>
                          <option value="Cerrada">Cerrada</option>
                          <option value="Anulada">Anulada</option>
                        </select>
                      </div>

                      {/* Acciones de Chat */}
                      <button
                        onClick={() => router.push(`/incidencias/${incidencia.id}/chat-control-cliente`)}
                        className="text-xs px-3 py-2 rounded font-medium hover:opacity-90 transition-opacity"
                        style={{ backgroundColor: PALETA.fondo, color: PALETA.texto }}
                      >
                        💬 Chat Cliente
                      </button>

                      {incidencia.enviada_a_proveedor && (
                        <button
                          onClick={() => router.push(`/incidencias/${incidencia.id}/chat-proveedor`)}
                          className="text-xs px-3 py-2 rounded font-medium hover:opacity-90 transition-opacity"
                          style={{ backgroundColor: PALETA.verdeClaro, color: PALETA.textoOscuro }}
                        >
                          🔧 Chat Proveedor
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal para asignar proveedor */}
      {mostrarModalProveedor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div 
            className="rounded-lg p-8 max-w-lg w-full mx-4 shadow"
            style={{ backgroundColor: PALETA.card }}
          >
            <h3 className="text-xl font-semibold mb-6" style={{ color: PALETA.textoOscuro }}>
              Asignar Incidencia a Proveedor
            </h3>
            
            <form onSubmit={(e) => { e.preventDefault(); asignarProveedorCompleto(); }}>
              <div className="space-y-6">
                {/* Selección de Proveedor */}
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                    Proveedor *
                  </label>
                  <select
                    value={formularioProveedor.proveedor_id}
                    onChange={(e) => setFormularioProveedor(prev => ({
                      ...prev,
                      proveedor_id: e.target.value
                    }))}
                    className="w-full h-9 rounded border px-3 text-sm outline-none focus:ring-2 focus:ring-[#C9D7A7] appearance-none pr-6"
                    required
                  >
                    <option value="">Seleccionar proveedor...</option>
                    {proveedores.map(proveedor => (
                      <option key={proveedor.id} value={proveedor.id}>
                        {proveedor.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Descripción para el Proveedor */}
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                    Descripción para el Proveedor
                  </label>
                  <textarea
                    value={formularioProveedor.descripcion_proveedor}
                    onChange={(e) => setFormularioProveedor(prev => ({
                      ...prev,
                      descripcion_proveedor: e.target.value
                    }))}
                    placeholder="Instrucciones específicas o detalles adicionales para el proveedor..."
                    className="min-h-[80px] w-full rounded border p-3 text-sm outline-none focus:ring-2 focus:ring-[#C9D7A7]"
                  />
                </div>

                {/* Prioridad */}
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                    Prioridad
                  </label>
                  <select
                    value={formularioProveedor.prioridad}
                    onChange={(e) => setFormularioProveedor(prev => ({
                      ...prev,
                      prioridad: e.target.value as 'Crítico' | 'No crítico'
                    }))}
                    className="w-full h-9 rounded border px-3 text-sm outline-none focus:ring-2 focus:ring-[#C9D7A7] appearance-none pr-6"
                  >
                    <option value="No crítico">No crítico</option>
                    <option value="Crítico">Crítico</option>
                  </select>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-8">
                <button
                  type="button"
                  onClick={cerrarModalProveedor}
                  className="px-4 py-2 text-sm rounded border hover:bg-gray-50 transition-colors"
                  style={{ color: PALETA.textoOscuro, borderColor: '#d1d5db' }}
                  disabled={accionEnCurso === incidenciaSeleccionada}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!formularioProveedor.proveedor_id || accionEnCurso === incidenciaSeleccionada}
                  className="px-6 py-2 text-sm text-white rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                  style={{ 
                    backgroundColor: PALETA.fondo,
                    opacity: (!formularioProveedor.proveedor_id || accionEnCurso === incidenciaSeleccionada) ? 0.5 : 1
                  }}
                >
                  {accionEnCurso === incidenciaSeleccionada ? 'Asignando...' : 'Asignar Proveedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}