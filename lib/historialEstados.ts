import { supabase } from './supabaseClient';

export type TipoEstado = 'cliente' | 'proveedor';

export interface CambioEstado {
  incidenciaId: string;
  tipoEstado: TipoEstado;
  estadoAnterior: string | null;
  estadoNuevo: string;
  autorId?: string;
  motivo?: string;
  metadatos?: Record<string, any>;
}

/**
 * Registra un cambio de estado en el historial
 */
export const registrarCambioEstado = async (cambio: CambioEstado) => {
  try {
    const { error } = await supabase
      .from('historial_estados')
      .insert({
        incidencia_id: cambio.incidenciaId,
        tipo_estado: cambio.tipoEstado,
        estado_anterior: cambio.estadoAnterior,
        estado_nuevo: cambio.estadoNuevo,
        cambiado_por: cambio.autorId,
        motivo: cambio.motivo,
        metadatos: cambio.metadatos
      });

    if (error) {
      console.error('Error registrando cambio de estado:', error);
      throw error;
    }

    console.log(`Estado registrado: ${cambio.tipoEstado} ${cambio.estadoAnterior} → ${cambio.estadoNuevo}`);
  } catch (error) {
    console.error('Error en registrarCambioEstado:', error);
    // No lanzamos el error para no romper el flujo principal
  }
};

/**
 * Obtiene el historial de estados de una incidencia
 */
export const obtenerHistorialEstados = async (incidenciaId: string) => {
  try {
    const { data, error } = await supabase
      .from('historial_estados')
      .select(`
        *,
        personas(nombre, email)
      `)
      .eq('incidencia_id', incidenciaId)
      .order('cambiado_en', { ascending: true });

    if (error) {
      console.error('Error obteniendo historial:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error en obtenerHistorialEstados:', error);
    return [];
  }
};

/**
 * Helper para registrar múltiples cambios de estado en una transacción
 */
export const registrarCambiosEstado = async (cambios: CambioEstado[]) => {
  try {
    const registros = cambios.map(cambio => ({
      incidencia_id: cambio.incidenciaId,
      tipo_estado: cambio.tipoEstado,
      estado_anterior: cambio.estadoAnterior,
      estado_nuevo: cambio.estadoNuevo,
      cambiado_por: cambio.autorId,
      motivo: cambio.motivo,
      metadatos: cambio.metadatos
    }));

    const { error } = await supabase
      .from('historial_estados')
      .insert(registros);

    if (error) {
      console.error('Error registrando cambios de estado:', error);
      throw error;
    }

    console.log(`Registrados ${cambios.length} cambios de estado`);
  } catch (error) {
    console.error('Error en registrarCambiosEstado:', error);
  }
};