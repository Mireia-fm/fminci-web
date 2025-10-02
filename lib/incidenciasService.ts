import { supabase } from "./supabaseClient";
import type { Perfil } from "@/contexts/AuthContext";

export type Incidencia = {
  id: string;
  num_solicitud: string;
  fecha: string;
  estado_cliente: string;
  centro?: string;
  descripcion: string;
  catalogacion?: string;
  prioridad?: string;
  institucion_id?: string;
  email?: string;
  instituciones?: {
    nombre: string;
  }[] | null;
  proveedor_casos?: {
    estado_proveedor: string;
    prioridad?: string;
    activo?: boolean;
    proveedor_id?: string;
  }[] | null;
};

const SELECT_INCIDENCIAS_BASE = `
  id,
  num_solicitud,
  fecha,
  estado_cliente,
  centro,
  descripcion,
  catalogacion,
  prioridad,
  institucion_id,
  email,
  instituciones(nombre),
  proveedor_casos(estado_proveedor, prioridad, activo, proveedor_id)
`;

/**
 * Obtiene todas las incidencias del sistema (para usuarios Control o con acceso total)
 */
export async function obtenerTodasIncidencias(): Promise<Incidencia[]> {
  const { data, error } = await supabase
    .from("incidencias")
    .select(SELECT_INCIDENCIAS_BASE)
    .order("fecha_creacion", { ascending: false });

  if (error) {
    console.error("Error cargando incidencias:", error);
    return [];
  }

  return deduplicarIncidencias(data || []);
}

/**
 * Obtiene incidencias asignadas a un proveedor específico
 */
export async function obtenerIncidenciasProveedor(proveedorId: string): Promise<Incidencia[]> {
  const { data, error } = await supabase
    .from("incidencias")
    .select(`
      id,
      num_solicitud,
      fecha,
      estado_cliente,
      centro,
      descripcion,
      catalogacion,
      institucion_id,
      instituciones(nombre),
      proveedor_casos!inner(
        estado_proveedor,
        prioridad,
        activo
      )
    `)
    .eq("proveedor_casos.proveedor_id", proveedorId)
    .eq("proveedor_casos.activo", true)
    .order("fecha_creacion", { ascending: false });

  if (error) {
    console.error("Error cargando incidencias de proveedor:", error);
    return [];
  }

  return deduplicarIncidencias(data || []);
}

/**
 * Obtiene incidencias para instituciones específicas
 */
export async function obtenerIncidenciasPorInstituciones(institucionIds: string[]): Promise<Incidencia[]> {
  if (institucionIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("incidencias")
    .select(SELECT_INCIDENCIAS_BASE)
    .in("institucion_id", institucionIds)
    .order("fecha_creacion", { ascending: false });

  if (error) {
    console.error("Error cargando incidencias por instituciones:", error);
    return [];
  }

  return deduplicarIncidencias(data || []);
}

/**
 * Obtiene incidencias basadas en el perfil del usuario
 */
export async function obtenerIncidenciasPorPerfil(perfil: Perfil): Promise<Incidencia[]> {
  // Control: todas las incidencias
  if (perfil.rol === "Control") {
    return obtenerTodasIncidencias();
  }

  // Usuario con acceso a todos los centros
  if (perfil.acceso_todos_centros) {
    return obtenerTodasIncidencias();
  }

  // Proveedor: incidencias asignadas
  if (perfil.rol === "Proveedor") {
    const proveedorId = perfil.instituciones?.[0]?.institucion_id;
    if (!proveedorId) return [];
    return obtenerIncidenciasProveedor(proveedorId);
  }

  // Gestor o Cliente: incidencias de sus instituciones
  const institucionIds = perfil.instituciones?.map(i => i.institucion_id) || [];
  return obtenerIncidenciasPorInstituciones(institucionIds);
}

/**
 * Busca una incidencia específica por número de solicitud
 */
export async function buscarIncidenciaPorNumero(
  numeroSolicitud: string,
  perfil: Perfil
): Promise<Incidencia[]> {
  // Solo Control puede buscar cualquier incidencia
  if (perfil.rol !== "Control") {
    return [];
  }

  const { data, error } = await supabase
    .from("incidencias")
    .select(SELECT_INCIDENCIAS_BASE)
    .eq("num_solicitud", numeroSolicitud);

  if (error) {
    console.error("Error en búsqueda específica:", error);
    return [];
  }

  return data || [];
}

/**
 * Obtiene el conteo de incidencias por estado para el dashboard
 * OPTIMIZADO: Hace COUNT en la base de datos en lugar de cargar todas las incidencias
 */
export async function obtenerConteoPorEstado(
  perfil: Perfil,
  tipoEstado: "cliente" | "proveedor" = "cliente"
): Promise<{ estado: string; n: number }[]> {
  if (tipoEstado === "proveedor") {
    // Para vista proveedor: contar CASOS de proveedor activos, no incidencias
    // Esto permite que una incidencia tenga múltiples proveedores
    const { data, error } = await supabase
      .from("proveedor_casos")
      .select("estado_proveedor")
      .eq("activo", true);

    if (error || !data) {
      console.error("Error cargando casos de proveedor:", error);
      return [];
    }

    // Contar por estado
    const conteo: Record<string, number> = {};
    data.forEach(caso => {
      const estado = caso.estado_proveedor || "Sin estado";
      conteo[estado] = (conteo[estado] || 0) + 1;
    });

    return Object.entries(conteo).map(([estado, n]) => ({ estado, n }));
  }

  // Vista cliente: usar RPC para contar (evita límite de 1000 filas)

  // Control o acceso todos los centros: contar TODAS
  if (perfil.rol === "Control" || perfil.acceso_todos_centros) {
    const { data, error } = await supabase.rpc("contar_incidencias_por_estado", {
      p_rol: "Control",
    });

    if (error) {
      console.error("Error contando incidencias (RPC):", error);
      return [];
    }

    return (data || []).map((row: { estado: string; n: number }) => ({
      estado: row.estado,
      n: Number(row.n),
    }));
  }

  // Gestor/Cliente: contar incidencias de sus instituciones
  const institucionIds = perfil.instituciones?.map(i => i.institucion_id) || [];

  // Proveedor: necesita lógica diferente (filtrar por proveedor_casos)
  if (perfil.rol === "Proveedor" && institucionIds.length > 0) {
    const proveedorId = institucionIds[0];

    const { data, error } = await supabase
      .from("incidencias")
      .select("estado_cliente, proveedor_casos!inner(proveedor_id)")
      .eq("proveedor_casos.proveedor_id", proveedorId)
      .eq("proveedor_casos.activo", true);

    if (error || !data) {
      console.error("Error contando incidencias de proveedor:", error);
      return [];
    }

    const conteo: Record<string, number> = {};
    data.forEach(inc => {
      const estado = inc.estado_cliente || "Sin estado";
      conteo[estado] = (conteo[estado] || 0) + 1;
    });

    return Object.entries(conteo).map(([estado, n]) => ({ estado, n }));
  }

  // Gestor/Cliente con instituciones
  if (institucionIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase.rpc("contar_incidencias_por_estado", {
    p_rol: perfil.rol,
    p_institucion_ids: institucionIds,
  });

  if (error) {
    console.error("Error contando incidencias por instituciones (RPC):", error);
    return [];
  }

  return (data || []).map((row: { estado: string; n: number }) => ({
    estado: row.estado,
    n: Number(row.n),
  }));
}

/**
 * Obtiene conteo de incidencias agrupadas por centro (para Gestores)
 */
export async function obtenerConteoPorCentro(
  perfil: Perfil
): Promise<{ nombre: string; incidencias: { estado_cliente: string; n: number }[] }[]> {
  if (perfil.rol !== "Gestor") {
    return [];
  }

  const institucionIds = perfil.instituciones?.map(i => i.institucion_id) || [];
  if (institucionIds.length === 0) {
    return [];
  }

  // Una sola query para todas las instituciones
  const { data, error } = await supabase
    .from("incidencias")
    .select("id, estado_cliente, institucion_id, instituciones(nombre)")
    .in("institucion_id", institucionIds);

  if (error || !data) {
    console.error("Error cargando incidencias por centro:", error);
    return [];
  }

  // Agrupar por institución
  const porCentro: Record<string, { nombre: string; estados: Record<string, number> }> = {};

  data.forEach(inc => {
    const institucionNombre = (inc.instituciones as { nombre?: string } | null)?.nombre || "Sin nombre";
    const estado = inc.estado_cliente || "Sin estado";

    if (!porCentro[inc.institucion_id]) {
      porCentro[inc.institucion_id] = { nombre: institucionNombre, estados: {} };
    }

    porCentro[inc.institucion_id].estados[estado] =
      (porCentro[inc.institucion_id].estados[estado] || 0) + 1;
  });

  // Convertir a formato esperado
  return Object.values(porCentro).map(centro => ({
    nombre: centro.nombre,
    incidencias: Object.entries(centro.estados).map(([estado_cliente, n]) => ({
      estado_cliente,
      n,
    })),
  }));
}

/**
 * Deduplicar incidencias por ID y consolidar casos de proveedor
 * IMPORTANTE: Mantiene el orden original de la query
 */
function deduplicarIncidencias(incidencias: Incidencia[]): Incidencia[] {
  const mapa = new Map<string, Incidencia>();
  const orden: string[] = []; // Mantener orden original

  incidencias.forEach(inc => {
    const existente = mapa.get(inc.id);

    if (existente) {
      // Consolidar casos de proveedor
      if (inc.proveedor_casos && inc.proveedor_casos.length > 0) {
        if (!existente.proveedor_casos) {
          existente.proveedor_casos = [];
        }
        inc.proveedor_casos.forEach(caso => {
          if (!existente.proveedor_casos!.some(c =>
            c.estado_proveedor === caso.estado_proveedor &&
            c.activo === caso.activo &&
            c.proveedor_id === caso.proveedor_id
          )) {
            existente.proveedor_casos!.push(caso);
          }
        });
      }
    } else {
      mapa.set(inc.id, inc);
      orden.push(inc.id); // Guardar orden de primera aparición
    }
  });

  // Retornar en el mismo orden que llegaron
  return orden.map(id => mapa.get(id)!);
}
