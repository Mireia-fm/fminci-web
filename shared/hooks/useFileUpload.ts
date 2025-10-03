import { useState } from 'react';
import { subirArchivo, subirMultiples } from '@/lib/services/storageService';

/**
 * Custom hook para manejar subida de archivos
 * Gestiona estado de carga, errores y archivos seleccionados
 */

export type TipoArchivo = 'imagen' | 'documento';

export interface ArchivoSeleccionado {
  file: File;
  tipo: TipoArchivo;
  preview?: string; // Para previews de imágenes
}

/**
 * Hook básico para subida de un solo archivo
 */
export function useFileUpload(bucket: string = 'incidencias') {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const upload = async (file: File, ruta: string) => {
    setUploading(true);
    setError(null);
    setProgress(0);

    try {
      const { ruta: storagePath, error: uploadError } = await subirArchivo(file, ruta, bucket);

      if (uploadError) {
        setError(uploadError);
        return null;
      }

      setProgress(100);
      return storagePath;
    } catch (err) {
      setError('Error inesperado al subir archivo');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setError(null);
    setProgress(0);
  };

  return { upload, uploading, error, progress, reset };
}

/**
 * Hook para manejar selección y subida de múltiples archivos
 */
export function useMultipleFileUpload(bucket: string = 'incidencias') {
  const [archivos, setArchivos] = useState<ArchivoSeleccionado[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const agregarArchivo = (file: File, tipo: TipoArchivo) => {
    // Crear preview para imágenes
    let preview: string | undefined;
    if (tipo === 'imagen' && file.type.startsWith('image/')) {
      preview = URL.createObjectURL(file);
    }

    setArchivos(prev => [...prev, { file, tipo, preview }]);
  };

  const removerArchivo = (index: number) => {
    setArchivos(prev => {
      const nuevo = [...prev];
      // Liberar preview URL si existe
      if (nuevo[index].preview) {
        URL.revokeObjectURL(nuevo[index].preview!);
      }
      nuevo.splice(index, 1);
      return nuevo;
    });
  };

  const limpiarArchivos = () => {
    // Liberar todos los preview URLs
    archivos.forEach(archivo => {
      if (archivo.preview) {
        URL.revokeObjectURL(archivo.preview);
      }
    });
    setArchivos([]);
    setError(null);
  };

  const uploadAll = async (rutaBase: string) => {
    if (archivos.length === 0) return [];

    setUploading(true);
    setError(null);

    try {
      const files = archivos.map(a => a.file);
      const rutas = await subirMultiples(files, rutaBase, bucket);

      if (rutas.length !== files.length) {
        setError('Algunos archivos no se pudieron subir');
      }

      return rutas;
    } catch (err) {
      setError('Error inesperado al subir archivos');
      return [];
    } finally {
      setUploading(false);
    }
  };

  return {
    archivos,
    agregarArchivo,
    removerArchivo,
    limpiarArchivos,
    uploadAll,
    uploading,
    error
  };
}

/**
 * Hook específico para manejar imagen + documento en comentarios de chat
 * Replica la lógica actual de los chats
 */
export function useChatFileUpload(numSolicitud: string, bucket: string = 'incidencias') {
  const [imagenSeleccionada, setImagenSeleccionada] = useState<File | null>(null);
  const [documentoSeleccionado, setDocumentoSeleccionado] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const seleccionarImagen = (file: File | null) => {
    setImagenSeleccionada(file);
  };

  const seleccionarDocumento = (file: File | null) => {
    setDocumentoSeleccionado(file);
  };

  const limpiar = () => {
    setImagenSeleccionada(null);
    setDocumentoSeleccionado(null);
    setError(null);
  };

  /**
   * Sube ambos archivos si existen y retorna sus rutas
   */
  const uploadFiles = async () => {
    if (!imagenSeleccionada && !documentoSeleccionado) {
      return { imagenUrl: null, documentoUrl: null };
    }

    setUploading(true);
    setError(null);

    try {
      let imagenUrl: string | null = null;
      let documentoUrl: string | null = null;

      // Subir imagen si existe
      if (imagenSeleccionada) {
        const nombreArchivo = `${Date.now()}_${imagenSeleccionada.name}`;
        const ruta = `incidencias/${numSolicitud}/comentarios/${nombreArchivo}`;
        const { ruta: storagePath, error: uploadError } = await subirArchivo(
          imagenSeleccionada,
          ruta,
          bucket
        );

        if (uploadError) {
          setError(`Error subiendo imagen: ${uploadError}`);
        } else {
          imagenUrl = storagePath;
        }
      }

      // Subir documento si existe
      if (documentoSeleccionado) {
        const nombreArchivo = `${Date.now()}_${documentoSeleccionado.name}`;
        const ruta = `incidencias/${numSolicitud}/comentarios/${nombreArchivo}`;
        const { ruta: storagePath, error: uploadError } = await subirArchivo(
          documentoSeleccionado,
          ruta,
          bucket
        );

        if (uploadError) {
          setError(`Error subiendo documento: ${uploadError}`);
        } else {
          documentoUrl = storagePath;
        }
      }

      return { imagenUrl, documentoUrl };
    } catch (err) {
      setError('Error inesperado al subir archivos');
      return { imagenUrl: null, documentoUrl: null };
    } finally {
      setUploading(false);
    }
  };

  return {
    imagenSeleccionada,
    documentoSeleccionado,
    seleccionarImagen,
    seleccionarDocumento,
    limpiar,
    uploadFiles,
    uploading,
    error,
    tieneArchivos: !!(imagenSeleccionada || documentoSeleccionado)
  };
}

/**
 * Hook para validación de archivos
 */
export function useFileValidation() {
  const validarImagen = (file: File): { valido: boolean; error?: string } => {
    const tiposPermitidos = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const tamañoMax = 10 * 1024 * 1024; // 10MB

    if (!tiposPermitidos.includes(file.type)) {
      return {
        valido: false,
        error: 'Tipo de archivo no permitido. Solo se permiten imágenes (JPG, PNG, GIF, WebP)'
      };
    }

    if (file.size > tamañoMax) {
      return {
        valido: false,
        error: 'El archivo es demasiado grande. Tamaño máximo: 10MB'
      };
    }

    return { valido: true };
  };

  const validarDocumento = (file: File): { valido: boolean; error?: string } => {
    const tiposPermitidos = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv'
    ];
    const tamañoMax = 20 * 1024 * 1024; // 20MB

    if (!tiposPermitidos.includes(file.type)) {
      return {
        valido: false,
        error: 'Tipo de archivo no permitido. Solo se permiten documentos (PDF, DOC, DOCX, XLS, XLSX, TXT, CSV)'
      };
    }

    if (file.size > tamañoMax) {
      return {
        valido: false,
        error: 'El archivo es demasiado grande. Tamaño máximo: 20MB'
      };
    }

    return { valido: true };
  };

  return { validarImagen, validarDocumento };
}
