import { supabase } from '../supabaseClient';
import type { EstadoProveedor, PrioridadProveedor } from '../theme';

/**
 * Servicio centralizado para operaciones con proveedor_casos
 */

export interface ProveedorCaso {
  id: string;
  incidencia_id: string;
  proveedor_id: string;
  estado_proveedor: EstadoProveedor;
  prioridad: PrioridadProveedor;
  activo: boolean;
  asignado_en: string;
  asignado_por: string | null;
  desasignado_en: string | null;
  desasignado_por: string | null;
  motivo_desasignacion: string | null;
  proveedores?: {
    id: string;
    nombre: string;
    email: string;
    telefono: string | null;
    especialidad: string | null;
  };
}

export interface NuevoProveedorCaso {
  incidencia_id: string;
  proveedor_id: string;
  estado_proveedor?: EstadoProveedor;
  prioridad: PrioridadProveedor;
  asignado_por?: string;
}

export interface ActualizarProveedorCaso {
  estado_proveedor?: EstadoProveedor;
  prioridad?: PrioridadProveedor;
  activo?: boolean;
  desasignado_en?: string;
  desasignado_por?: string;
  motivo_desasignacion?: string;
}

/**
 * Obtiene el proveedor activo de una incidencia
 */
export async function obtenerProveedorActivo(
  incidenciaId: string
): Promise<ProveedorCaso | null> {
  try {
    const { data, error } = await supabase
      .from('proveedor_casos')
      .select(`
        *,
        proveedores(id, nombre, email, telefono, especialidad)
      `)
      .eq('incidencia_id', incidenciaId)
      .eq('activo', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No hay proveedor activo (es esperado en algunos casos)
        return null;
      }
      console.error('Error obteniendo proveedor activo:', error);
      return null;
    }

    return data as ProveedorCaso;
  } catch (err) {
    console.error('Error inesperado en obtenerProveedorActivo:', err);
    return null;
  }
}

/**
 * Obtiene todos los proveedores (activos e inactivos) de una incidencia
 */
export async function obtenerHistorialProveedores(
  incidenciaId: string
): Promise<ProveedorCaso[]> {
  try {
    const { data, error } = await supabase
      .from('proveedor_casos')
      .select(`
        *,
        proveedores(id, nombre, email, telefono, especialidad)
      `)
      .eq('incidencia_id', incidenciaId)
      .order('asignado_en', { ascending: false });

    if (error) {
      console.error('Error obteniendo historial de proveedores:', error);
      return [];
    }

    return data as ProveedorCaso[] || [];
  } catch (err) {
    console.error('Error inesperado en obtenerHistorialProveedores:', err);
    return [];
  }
}

/**
 * Asigna un proveedor a una incidencia
 */
export async function asignarProveedor(
  nuevoProveedorCaso: NuevoProveedorCaso
): Promise<ProveedorCaso | null> {
  try {
    // Primero, desactivar cualquier proveedor activo anterior
    await desactivarProveedoresActivos(nuevoProveedorCaso.incidencia_id);

    // Crear nuevo registro activo
    const { data, error } = await supabase
      .from('proveedor_casos')
      .insert({
        incidencia_id: nuevoProveedorCaso.incidencia_id,
        proveedor_id: nuevoProveedorCaso.proveedor_id,
        estado_proveedor: nuevoProveedorCaso.estado_proveedor || 'Abierta',
        prioridad: nuevoProveedorCaso.prioridad,
        asignado_por: nuevoProveedorCaso.asignado_por,
        activo: true
      })
      .select(`
        *,
        proveedores(id, nombre, email, telefono, especialidad)
      `)
      .single();

    if (error) {
      console.error('Error asignando proveedor:', error);
      return null;
    }

    return data as ProveedorCaso;
  } catch (err) {
    console.error('Error inesperado en asignarProveedor:', err);
    return null;
  }
}

/**
 * Reasigna una incidencia a otro proveedor
 */
export async function reasignarProveedor(
  incidenciaId: string,
  nuevoProveedorId: string,
  prioridad: PrioridadProveedor,
  motivoDesasignacion: string,
  usuarioId: string
): Promise<ProveedorCaso | null> {
  try {
    // 1. Desactivar proveedor actual
    const { error: errorDesactivar } = await supabase
      .from('proveedor_casos')
      .update({
        activo: false,
        desasignado_en: new Date().toISOString(),
        desasignado_por: usuarioId,
        motivo_desasignacion: motivoDesasignacion
      })
      .eq('incidencia_id', incidenciaId)
      .eq('activo', true);

    if (errorDesactivar) {
      console.error('Error desactivando proveedor anterior:', errorDesactivar);
      return null;
    }

    // 2. Asignar nuevo proveedor
    return await asignarProveedor({
      incidencia_id: incidenciaId,
      proveedor_id: nuevoProveedorId,
      estado_proveedor: 'Abierta',
      prioridad,
      asignado_por: usuarioId
    });
  } catch (err) {
    console.error('Error inesperado en reasignarProveedor:', err);
    return null;
  }
}

/**
 * Actualiza el estado o prioridad del proveedor activo
 */
export async function actualizarProveedorActivo(
  incidenciaId: string,
  actualizacion: ActualizarProveedorCaso
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('proveedor_casos')
      .update(actualizacion)
      .eq('incidencia_id', incidenciaId)
      .eq('activo', true);

    if (error) {
      console.error('Error actualizando proveedor activo:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error inesperado en actualizarProveedorActivo:', err);
    return false;
  }
}

/**
 * Desactiva todos los proveedores activos de una incidencia
 * Útil antes de asignar un nuevo proveedor
 */
export async function desactivarProveedoresActivos(
  incidenciaId: string,
  motivo?: string,
  usuarioId?: string
): Promise<boolean> {
  try {
    const actualizacion: Record<string, unknown> = {
      activo: false,
      desasignado_en: new Date().toISOString()
    };

    if (motivo) actualizacion.motivo_desasignacion = motivo;
    if (usuarioId) actualizacion.desasignado_por = usuarioId;

    const { error } = await supabase
      .from('proveedor_casos')
      .update(actualizacion)
      .eq('incidencia_id', incidenciaId)
      .eq('activo', true);

    if (error) {
      console.error('Error desactivando proveedores:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error inesperado en desactivarProveedoresActivos:', err);
    return false;
  }
}

/**
 * Obtiene todas las incidencias asignadas a un proveedor
 */
export async function obtenerIncidenciasProveedor(
  proveedorId: string,
  soloActivas: boolean = true
): Promise<ProveedorCaso[]> {
  try {
    let query = supabase
      .from('proveedor_casos')
      .select(`
        *,
        incidencias(*)
      `)
      .eq('proveedor_id', proveedorId);

    if (soloActivas) {
      query = query.eq('activo', true);
    }

    query = query.order('asignado_en', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('Error obteniendo incidencias del proveedor:', error);
      return [];
    }

    return data as ProveedorCaso[] || [];
  } catch (err) {
    console.error('Error inesperado en obtenerIncidenciasProveedor:', err);
    return [];
  }
}

/**
 * Actualiza el estado del proveedor (usado frecuentemente)
 */
export async function actualizarEstadoProveedor(
  incidenciaId: string,
  nuevoEstado: EstadoProveedor
): Promise<boolean> {
  return await actualizarProveedorActivo(incidenciaId, {
    estado_proveedor: nuevoEstado
  });
}

/**
 * Actualiza la prioridad del proveedor
 */
export async function actualizarPrioridadProveedor(
  incidenciaId: string,
  nuevaPrioridad: PrioridadProveedor
): Promise<boolean> {
  return await actualizarProveedorActivo(incidenciaId, {
    prioridad: nuevaPrioridad
  });
}

/**
 * Verifica si una incidencia tiene proveedor activo
 */
export async function tieneProveedorActivo(incidenciaId: string): Promise<boolean> {
  const proveedor = await obtenerProveedorActivo(incidenciaId);
  return proveedor !== null;
}
