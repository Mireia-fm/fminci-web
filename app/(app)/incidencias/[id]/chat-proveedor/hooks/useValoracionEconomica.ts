import { useState, useEffect } from 'react';
import { valoracionEconomica as valoracionEconomicaService } from '@/lib/services/resolucionProveedorService';

/**
 * Tipo de presupuesto
 */
type PresupuestoType = {
  id: string;
  importe_total: number;
  importe_total_sin_iva?: number;
  presupuesto_detallado_url?: string;
  estado: string;
};

type Incidencia = {
  id: string;
  num_solicitud: string;
};

interface Perfil {
  persona_id: string;
  email: string;
  rol: string;
}

/**
 * Hook para gestionar la valoración económica de incidencias
 */
export function useValoracionEconomica(
  incidenciaId: string,
  incidencia: Incidencia | null,
  perfil: Perfil | null,
  presupuestoActual: PresupuestoType | null,
  tieneOfertaAprobada: boolean,
  cargarDatos: () => void
) {
  // Estados del modal
  const [mostrarModalValorarIncidencia, setMostrarModalValorarIncidencia] = useState(false);

  // Estados del formulario
  const [importeSinIva, setImporteSinIva] = useState('');
  const [importeConIva, setImporteConIva] = useState('');
  const [porcentajeIva, setPorcentajeIva] = useState('');
  const [documentoJustificativo, setDocumentoJustificativo] = useState<File | null>(null);

  // Estado de envío
  const [enviando, setEnviando] = useState(false);

  /**
   * Limpiar documento justificativo cuando el importe coincide con la oferta aprobada
   */
  useEffect(() => {
    if (tieneOfertaAprobada && presupuestoActual && importeSinIva) {
      const importeActual = parseFloat(importeSinIva) || 0;
      const importeOferta = presupuestoActual?.importe_total_sin_iva
        ? parseFloat(String(presupuestoActual.importe_total_sin_iva))
        : 0;
      const importeCoincide = importeActual > 0 && importeActual === importeOferta;

      if (importeCoincide && documentoJustificativo) {
        setDocumentoJustificativo(null);
      }
    }
  }, [tieneOfertaAprobada, presupuestoActual, importeSinIva, documentoJustificativo]);

  /**
   * Enviar valoración económica
   */
  const handleValoracionEconomica = async () => {
    // Validar si el documento es requerido
    const importeActual = parseFloat(importeSinIva) || 0;
    const importeOferta = presupuestoActual?.importe_total_sin_iva
      ? parseFloat(String(presupuestoActual.importe_total_sin_iva))
      : 0;
    const importeHaCambiado = tieneOfertaAprobada && importeActual !== importeOferta;
    const importeCoincide = tieneOfertaAprobada && !importeHaCambiado && importeActual > 0;
    const documentoRequerido = !tieneOfertaAprobada || importeHaCambiado;

    // Validaciones
    if (importeCoincide) {
      if (!importeSinIva || !importeConIva || !perfil || !incidencia) {
        alert('Complete todos los campos obligatorios');
        return;
      }
    } else {
      if (!importeSinIva || !importeConIva || (documentoRequerido && !documentoJustificativo) || !perfil || !incidencia) {
        alert('Complete todos los campos obligatorios');
        return;
      }
    }

    try {
      setEnviando(true);

      const result = await valoracionEconomicaService({
        incidenciaId,
        numeroIncidencia: incidencia.num_solicitud,
        importeSinIva,
        porcentajeIva,
        importeConIva,
        documentoJustificativo: (documentoRequerido && documentoJustificativo) ? documentoJustificativo : undefined,
        tieneOfertaAprobada,
        autorId: perfil.persona_id,
        autorEmail: perfil.email
      });

      if (result.success) {
        cerrarModal();
        cargarDatos();
      } else {
        alert(result.error || 'Error en la valoración económica');
      }
    } catch (error) {
      console.error("Error en valoración económica:", error);
      alert('Error en la valoración económica. Por favor, inténtelo de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  /**
   * Cerrar modal y limpiar formulario
   */
  const cerrarModal = () => {
    setMostrarModalValorarIncidencia(false);
    setImporteSinIva('');
    setImporteConIva('');
    setPorcentajeIva('');
    setDocumentoJustificativo(null);
  };

  return {
    // Estados del modal
    mostrarModalValorarIncidencia,
    setMostrarModalValorarIncidencia,

    // Estados del formulario
    importeSinIva,
    setImporteSinIva,
    importeConIva,
    setImporteConIva,
    porcentajeIva,
    setPorcentajeIva,
    documentoJustificativo,
    setDocumentoJustificativo,

    // Estado de envío
    enviando,

    // Funciones
    handleValoracionEconomica,
    cerrarModal
  };
}
