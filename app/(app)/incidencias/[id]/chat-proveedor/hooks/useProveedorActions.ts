import { useState } from 'react';
import { resolverIncidencia as resolverIncidenciaService } from '@/lib/services/resolucionProveedorService';

/**
 * Tipos
 */
interface Perfil {
  persona_id: string;
  email: string;
  rol: string;
}

type Incidencia = {
  id: string;
  num_solicitud: string;
};

/**
 * Hook para gestionar las acciones específicas del Proveedor
 * (Resolver incidencia)
 */
export function useProveedorActions(
  incidenciaId: string,
  incidencia: Incidencia | null,
  perfil: Perfil | null,
  tieneOfertaAprobada: boolean,
  cargarDatos: () => void
) {
  // Estados del modal de resolución
  const [mostrarModalResolver, setMostrarModalResolver] = useState(false);
  const [solucionAplicada, setSolucionAplicada] = useState('');
  const [fechaRealizacion, setFechaRealizacion] = useState('');
  const [imagenesResolucion, setImagenesResolucion] = useState<File[]>([]);
  const [documentoResolucion, setDocumentoResolucion] = useState<File | null>(null);

  // Estado de envío
  const [enviando, setEnviando] = useState(false);

  /**
   * Resolver incidencia (por el proveedor)
   */
  const handleResolverIncidencia = async () => {
    if (!solucionAplicada || !solucionAplicada.trim()) {
      alert('Por favor, complete la solución aplicada');
      return;
    }

    if (!fechaRealizacion) {
      alert('Por favor, ingrese la fecha de realización del trabajo');
      return;
    }

    if (!perfil || !incidencia) {
      alert('Error: no se pudo identificar el usuario');
      return;
    }

    try {
      setEnviando(true);

      const result = await resolverIncidenciaService({
        incidenciaId,
        numeroIncidencia: incidencia.num_solicitud,
        solucionAplicada,
        fechaRealizacion,
        imagenesResolucion: imagenesResolucion.length > 0 ? imagenesResolucion : undefined,
        documentoResolucion: documentoResolucion || undefined,
        tieneOfertaAprobada,
        autorId: perfil.persona_id,
        autorEmail: perfil.email
      });

      if (result.success) {
        cerrarModal();
        cargarDatos();
      } else {
        alert(result.error || 'Error al resolver la incidencia');
      }
    } catch (error) {
      console.error("Error resolviendo incidencia:", error);
      alert('Error al resolver la incidencia. Por favor, inténtelo de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  /**
   * Cerrar modal y limpiar formulario
   */
  const cerrarModal = () => {
    setMostrarModalResolver(false);
    setSolucionAplicada('');
    setFechaRealizacion('');
    setImagenesResolucion([]);
    setDocumentoResolucion(null);
  };

  return {
    // Estados del modal
    mostrarModalResolver,
    setMostrarModalResolver,

    // Estados del formulario
    solucionAplicada,
    setSolucionAplicada,
    fechaRealizacion,
    setFechaRealizacion,
    imagenesResolucion,
    setImagenesResolucion,
    documentoResolucion,
    setDocumentoResolucion,

    // Estado de envío
    enviando,

    // Funciones
    handleResolverIncidencia,
    cerrarModal
  };
}
