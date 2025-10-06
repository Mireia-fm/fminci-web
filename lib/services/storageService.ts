import { supabase } from '../supabaseClient';

/**
 * Servicio centralizado para operaciones de Storage de Supabase
 * Maneja URLs firmadas y subida de archivos
 */

export interface UrlFirmadaResult {
  url: string | null;
  error?: string;
}

export interface SubidaArchivoResult {
  ruta: string | null;
  error?: string;
}

/**
 * Sanitiza el nombre de archivo removiendo caracteres especiales
 * para evitar errores en Supabase Storage
 */
export function sanitizarNombreArchivo(nombre: string): string {
  // Remover caracteres no válidos y espacios
  // Mantener solo letras, números, guiones, puntos y guiones bajos
  return nombre
    .normalize('NFD') // Descomponer caracteres acentuados
    .replace(/[\u0300-\u036f]/g, '') // Eliminar marcas diacríticas
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Reemplazar caracteres especiales por guión bajo
    .replace(/_{2,}/g, '_') // Reemplazar múltiples guiones bajos por uno solo
    .replace(/^[._-]+|[._-]+$/g, ''); // Eliminar guiones/puntos al inicio o final
}

/**
 * Obtiene URL firmada para un archivo en Storage
 * Incluye lógica de fallback para buscar archivo si no se encuentra en ruta exacta
 */
export async function obtenerUrlFirmada(
  storageKey: string,
  bucket: string = 'incidencias',
  expiresIn: number = 14400 // 4 horas por defecto
): Promise<UrlFirmadaResult> {
  if (!storageKey) {
    return { url: null, error: 'storageKey vacío' };
  }

  try {
    // Limpiar la ruta: extraer solo el path si es una URL completa
    let cleanPath = storageKey;

    if (storageKey.startsWith('https://') || storageKey.startsWith('http://')) {
      // Extraer path de URL completa
      if (storageKey.includes('/storage/v1/object/public/incidencias/')) {
        const parts = storageKey.split('/storage/v1/object/public/incidencias/');
        cleanPath = parts.length > 1 ? parts[1] : storageKey;
      } else if (storageKey.includes('/storage/v1/object/sign/incidencias/')) {
        const parts = storageKey.split('/storage/v1/object/sign/incidencias/');
        cleanPath = parts.length > 1 ? parts[1] : storageKey;
      }
    }

    // Intentar obtener URL firmada directamente
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(cleanPath, expiresIn);

    if (error) {
      console.warn(`Error obteniendo URL firmada para ${storageKey}:`, error.message);

      // Fallback: buscar archivo por nombre en toda la carpeta
      const nombreArchivo = storageKey.split('/').pop();
      if (nombreArchivo) {
        const carpetaBase = storageKey.split('/').slice(0, -1).join('/');

        const { data: listaArchivos, error: errorLista } = await supabase.storage
          .from(bucket)
          .list(carpetaBase);

        if (!errorLista && listaArchivos) {
          const archivoEncontrado = listaArchivos.find(f => f.name === nombreArchivo);

          if (archivoEncontrado) {
            const rutaCorregida = `${carpetaBase}/${archivoEncontrado.name}`;
            const { data: dataCorregida, error: errorCorregido } = await supabase.storage
              .from(bucket)
              .createSignedUrl(rutaCorregida, expiresIn);

            if (!errorCorregido && dataCorregida) {
              return { url: dataCorregida.signedUrl };
            }
          }
        }
      }

      return { url: null, error: error.message };
    }

    return { url: data.signedUrl };
  } catch (err) {
    console.error('Error inesperado en obtenerUrlFirmada:', err);
    return { url: null, error: 'Error inesperado' };
  }
}

/**
 * Obtiene URLs firmadas para múltiples archivos
 * Útil para procesar adjuntos de comentarios
 */
export async function obtenerUrlsMultiples(
  storageKeys: string[],
  bucket: string = 'incidencias',
  expiresIn: number = 14400
): Promise<Map<string, string | null>> {
  const resultados = new Map<string, string | null>();

  await Promise.all(
    storageKeys.map(async (key) => {
      const { url } = await obtenerUrlFirmada(key, bucket, expiresIn);
      resultados.set(key, url);
    })
  );

  return resultados;
}

/**
 * Sube un archivo a Storage
 */
export async function subirArchivo(
  file: File,
  ruta: string,
  bucket: string = 'incidencias'
): Promise<SubidaArchivoResult> {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(ruta, file);

    if (error) {
      console.error(`Error subiendo archivo ${ruta}:`, error.message);
      return { ruta: null, error: error.message };
    }

    return { ruta: data.path };
  } catch (err) {
    console.error('Error inesperado en subirArchivo:', err);
    return { ruta: null, error: 'Error inesperado' };
  }
}

/**
 * Sube múltiples archivos a Storage
 * Retorna array de rutas exitosas
 */
export async function subirMultiples(
  files: File[],
  rutaBase: string,
  bucket: string = 'incidencias'
): Promise<string[]> {
  const rutasExitosas: string[] = [];

  for (const file of files) {
    const nombreSanitizado = sanitizarNombreArchivo(file.name);
    const nombreArchivo = `${Date.now()}_${nombreSanitizado}`;
    const rutaCompleta = `${rutaBase}/${nombreArchivo}`;

    const { ruta, error } = await subirArchivo(file, rutaCompleta, bucket);

    if (ruta && !error) {
      rutasExitosas.push(ruta);
    }
  }

  return rutasExitosas;
}

/**
 * Elimina un archivo de Storage
 */
export async function eliminarArchivo(
  storageKey: string,
  bucket: string = 'incidencias'
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([storageKey]);

    if (error) {
      console.error(`Error eliminando archivo ${storageKey}:`, error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('Error inesperado en eliminarArchivo:', err);
    return { success: false, error: 'Error inesperado' };
  }
}

/**
 * Elimina múltiples archivos de Storage
 */
export async function eliminarMultiples(
  storageKeys: string[],
  bucket: string = 'incidencias'
): Promise<{ success: boolean; errores: string[] }> {
  const errores: string[] = [];

  for (const key of storageKeys) {
    const { success, error } = await eliminarArchivo(key, bucket);
    if (!success && error) {
      errores.push(`${key}: ${error}`);
    }
  }

  return {
    success: errores.length === 0,
    errores
  };
}
