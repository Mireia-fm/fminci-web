import { supabase } from '../supabaseClient';

/**
 * Servicio centralizado para operaciones con comentarios
 */

export type AmbitoComentario = 'cliente' | 'proveedor' | 'ambos';

export interface NuevoComentario {
  incidencia_id: string;
  ambito: AmbitoComentario;
  autor_id: string;
  autor_email: string;
  autor_rol: string;
  cuerpo: string;
  es_sistema?: boolean;
}

export interface Comentario {
  id: string;
  incidencia_id: string;
  ambito: AmbitoComentario;
  autor_id: string;
  autor_email: string;
  autor_rol: string;
  cuerpo: string;
  es_sistema: boolean;
  creado_en: string;
  adjuntos?: Adjunto[];
  personas?: {
    nombre: string | null;
    email: string;
  };
}

export interface Adjunto {
  id: string;
  comentario_id: string;
  incidencia_id: string;
  storage_key: string;
  nombre_archivo: string;
  tipo: string;
  creado_en: string;
  url_firmada?: string | null;
}

/**
 * Obtiene comentarios de una incidencia filtrados por ámbito
 */
export async function obtenerComentarios(
  incidenciaId: string,
  ambito?: AmbitoComentario
): Promise<Comentario[]> {
  try {
    let query = supabase
      .from('comentarios')
      .select(`
        *,
        adjuntos(*),
        personas(nombre, email)
      `)
      .eq('incidencia_id', incidenciaId)
      .order('creado_en', { ascending: true });

    // Filtrar por ámbito si se especifica
    if (ambito) {
      query = query.or(`ambito.eq.${ambito},ambito.eq.ambos`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error obteniendo comentarios:', error);
      return [];
    }

    return data as Comentario[] || [];
  } catch (err) {
    console.error('Error inesperado en obtenerComentarios:', err);
    return [];
  }
}

/**
 * Crea un nuevo comentario
 * Retorna el comentario creado con su ID
 */
export async function crearComentario(
  comentario: NuevoComentario
): Promise<Comentario | null> {
  try {
    const { data, error } = await supabase
      .from('comentarios')
      .insert({
        incidencia_id: comentario.incidencia_id,
        ambito: comentario.ambito,
        autor_id: comentario.autor_id,
        autor_email: comentario.autor_email,
        autor_rol: comentario.autor_rol,
        cuerpo: comentario.cuerpo,
        es_sistema: comentario.es_sistema || false
      })
      .select(`
        *,
        personas(nombre, email)
      `)
      .single();

    if (error) {
      console.error('Error creando comentario:', error);
      return null;
    }

    return data as Comentario;
  } catch (err) {
    console.error('Error inesperado en crearComentario:', err);
    return null;
  }
}

/**
 * Crea múltiples comentarios en diferentes ámbitos
 * Útil para notificaciones que deben ir tanto a cliente como proveedor
 */
export async function crearComentariosMultiples(
  comentarios: NuevoComentario[]
): Promise<Comentario[]> {
  const resultados: Comentario[] = [];

  for (const comentario of comentarios) {
    const resultado = await crearComentario(comentario);
    if (resultado) {
      resultados.push(resultado);
    }
  }

  return resultados;
}

/**
 * Actualiza un comentario existente
 */
export async function actualizarComentario(
  comentarioId: string,
  cuerpo: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('comentarios')
      .update({ cuerpo })
      .eq('id', comentarioId);

    if (error) {
      console.error('Error actualizando comentario:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error inesperado en actualizarComentario:', err);
    return false;
  }
}

/**
 * Elimina un comentario
 */
export async function eliminarComentario(comentarioId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('comentarios')
      .delete()
      .eq('id', comentarioId);

    if (error) {
      console.error('Error eliminando comentario:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error inesperado en eliminarComentario:', err);
    return false;
  }
}

/**
 * Crea registros de adjuntos asociados a un comentario
 */
export async function crearAdjuntos(
  comentarioId: string,
  incidenciaId: string,
  archivos: Array<{ storage_key: string; nombre_archivo: string; tipo: string }>
): Promise<boolean> {
  try {
    const adjuntos = archivos.map(archivo => ({
      comentario_id: comentarioId,
      incidencia_id: incidenciaId,
      storage_key: archivo.storage_key,
      nombre_archivo: archivo.nombre_archivo,
      tipo: archivo.tipo
    }));

    const { error } = await supabase
      .from('adjuntos')
      .insert(adjuntos);

    if (error) {
      console.error('Error creando adjuntos:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error inesperado en crearAdjuntos:', err);
    return false;
  }
}

/**
 * Obtiene adjuntos de un comentario específico
 */
export async function obtenerAdjuntosComentario(
  comentarioId: string
): Promise<Adjunto[]> {
  try {
    const { data, error } = await supabase
      .from('adjuntos')
      .select('*')
      .eq('comentario_id', comentarioId);

    if (error) {
      console.error('Error obteniendo adjuntos:', error);
      return [];
    }

    return data as Adjunto[] || [];
  } catch (err) {
    console.error('Error inesperado en obtenerAdjuntosComentario:', err);
    return [];
  }
}

/**
 * Obtiene todos los adjuntos de una incidencia
 */
export async function obtenerAdjuntosIncidencia(
  incidenciaId: string
): Promise<Adjunto[]> {
  try {
    const { data, error } = await supabase
      .from('adjuntos')
      .select('*')
      .eq('incidencia_id', incidenciaId)
      .order('creado_en', { ascending: false });

    if (error) {
      console.error('Error obteniendo adjuntos de incidencia:', error);
      return [];
    }

    return data as Adjunto[] || [];
  } catch (err) {
    console.error('Error inesperado en obtenerAdjuntosIncidencia:', err);
    return [];
  }
}

/**
 * Elimina un adjunto (solo el registro, no el archivo de storage)
 */
export async function eliminarAdjunto(adjuntoId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('adjuntos')
      .delete()
      .eq('id', adjuntoId);

    if (error) {
      console.error('Error eliminando adjunto:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error inesperado en eliminarAdjunto:', err);
    return false;
  }
}
