import { useState, useEffect } from 'react';
import { obtenerUrlFirmada, obtenerUrlsMultiples } from '@/lib/services/storageService';

/**
 * Custom hook para manejar URLs firmadas de Storage
 * Gestiona automáticamente la carga y actualización de URLs
 */

export interface Adjunto {
  id: string;
  storage_key?: string | null;
}

/**
 * Hook para obtener URL firmada de un solo archivo
 */
export function useSignedUrl(storageKey: string | null | undefined, bucket: string = 'incidencias') {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!storageKey) {
      setUrl(null);
      return;
    }

    let isMounted = true;

    const loadUrl = async () => {
      setLoading(true);
      setError(null);

      try {
        // Limpiar URLs completas para extraer solo el path
        let cleanPath = storageKey;
        if (storageKey.startsWith('https://')) {
          if (storageKey.includes('/storage/v1/object/public/incidencias/')) {
            const parts = storageKey.split('/storage/v1/object/public/incidencias/');
            if (parts.length > 1) {
              cleanPath = parts[1];
            }
          }
        }

        const { url: signedUrl, error: urlError } = await obtenerUrlFirmada(cleanPath, bucket);

        if (isMounted) {
          if (urlError) {
            setError(urlError);
            setUrl(null);
          } else {
            setUrl(signedUrl);
          }
        }
      } catch (err) {
        if (isMounted) {
          setError('Error inesperado al cargar URL');
          setUrl(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadUrl();

    return () => {
      isMounted = false;
    };
  }, [storageKey, bucket]);

  return { url, loading, error };
}

/**
 * Hook para obtener URLs firmadas de múltiples archivos
 * Útil para listas de adjuntos
 */
export function useSignedUrls(
  adjuntos: Adjunto[] | undefined,
  bucket: string = 'incidencias'
) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Crear una key estable basada en los IDs de adjuntos para evitar re-renders infinitos
  const adjuntosKey = adjuntos?.map(a => a.id).join(',') || '';

  useEffect(() => {
    if (!adjuntos || adjuntos.length === 0) {
      setUrls({});
      return;
    }

    let isMounted = true;

    const loadUrls = async () => {
      setLoading(true);
      setError(null);

      try {
        const storageKeys = adjuntos
          .filter(adj => adj.storage_key)
          .map(adj => adj.storage_key!);

        if (storageKeys.length === 0) {
          if (isMounted) {
            setUrls({});
            setLoading(false);
          }
          return;
        }

        const urlMap = await obtenerUrlsMultiples(storageKeys, bucket);

        if (isMounted) {
          // Convertir Map a Record con IDs de adjuntos como claves
          const urlRecord: Record<string, string> = {};
          adjuntos.forEach(adjunto => {
            if (adjunto.storage_key) {
              const url = urlMap.get(adjunto.storage_key);
              if (url) {
                urlRecord[adjunto.id] = url;
              }
            }
          });

          setUrls(urlRecord);
        }
      } catch (err) {
        if (isMounted) {
          setError('Error inesperado al cargar URLs');
          setUrls({});
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadUrls();

    return () => {
      isMounted = false;
    };
  }, [adjuntosKey, bucket]); // eslint-disable-line react-hooks/exhaustive-deps

  return { urls, loading, error };
}

/**
 * Hook para manejar URLs de adjuntos de comentarios
 * Maneja tanto campos legacy (imagen_url, documento_url) como adjuntos modernos
 */
export interface Comentario {
  id: string;
  imagen_url?: string | null;
  documento_url?: string | null;
  adjuntos?: Adjunto[];
}

export function useComentarioUrls(
  comentarios: Comentario[],
  bucket: string = 'incidencias'
) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Crear una key estable basada en los IDs de comentarios para evitar re-renders infinitos
  const comentariosKey = comentarios?.map(c => c.id).join(',') || '';

  useEffect(() => {
    if (!comentarios || comentarios.length === 0) {
      setUrls({});
      return;
    }

    let isMounted = true;

    const loadUrls = async () => {
      setLoading(true);
      setError(null);

      try {
        const urlRecord: Record<string, string> = {};

        // Procesar cada comentario
        for (const comentario of comentarios) {
          // Cargar imagen_url
          if (comentario.imagen_url) {
            const { url } = await obtenerUrlFirmada(comentario.imagen_url, bucket);
            if (url) {
              urlRecord[`imagen_${comentario.id}`] = url;
            }
          }

          // Cargar documento_url
          if (comentario.documento_url) {
            const { url } = await obtenerUrlFirmada(comentario.documento_url, bucket);
            if (url) {
              urlRecord[`documento_${comentario.id}`] = url;
            }
          }

          // Cargar adjuntos modernos
          if (comentario.adjuntos) {
            for (const adjunto of comentario.adjuntos) {
              if (adjunto.storage_key) {
                const { url } = await obtenerUrlFirmada(adjunto.storage_key, bucket);
                if (url) {
                  urlRecord[adjunto.id] = url;
                }
              }
            }
          }
        }

        if (isMounted) {
          setUrls(urlRecord);
        }
      } catch (err) {
        if (isMounted) {
          setError('Error inesperado al cargar URLs de comentarios');
          setUrls({});
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadUrls();

    return () => {
      isMounted = false;
    };
  }, [comentariosKey, bucket]); // eslint-disable-line react-hooks/exhaustive-deps

  return { urls, loading, error };
}

/**
 * Hook para refrescar URLs firmadas cuando están por expirar
 * Útil para sesiones largas (URLs expiran en 4 horas)
 */
export function useAutoRefreshUrls(
  storageKeys: string[],
  bucket: string = 'incidencias',
  refreshInterval: number = 3 * 60 * 60 * 1000 // 3 horas por defecto
) {
  const [urls, setUrls] = useState<Map<string, string>>(new Map());
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    if (storageKeys.length === 0) {
      setUrls(new Map());
      return;
    }

    let isMounted = true;

    const loadUrls = async () => {
      const urlMap = await obtenerUrlsMultiples(storageKeys, bucket);
      if (isMounted) {
        // Filtrar URLs nulas
        const filteredUrls = new Map<string, string>();
        urlMap.forEach((value, key) => {
          if (value !== null) {
            filteredUrls.set(key, value);
          }
        });
        setUrls(filteredUrls);
        setLastRefresh(new Date());
      }
    };

    // Carga inicial
    loadUrls();

    // Configurar refresh automático
    const intervalId = setInterval(() => {
      loadUrls();
    }, refreshInterval);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [storageKeys, bucket, refreshInterval]);

  return { urls, lastRefresh };
}
