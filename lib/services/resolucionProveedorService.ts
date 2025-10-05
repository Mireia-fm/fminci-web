import { supabase } from "@/lib/supabaseClient";
import { registrarCambioEstado } from "@/lib/historialEstados";

export interface ResolverIncidenciaParams {
  incidenciaId: string;
  solucionAplicada: string;
  imagenResolucion?: File | null;
  documentoResolucion?: File | null;
  tieneOfertaAprobada: boolean;
  autorId: string;
  autorEmail: string;
  numeroIncidencia: string;
}

export interface ValoracionEconomicaParams {
  incidenciaId: string;
  importeSinIva: string;
  importeConIva: string;
  porcentajeIva: string;
  documentoJustificativo?: File | null;
  tieneOfertaAprobada: boolean;
  presupuestoActual?: { importe_total_sin_iva: string | number } | null;
  autorId: string;
  autorEmail: string;
  numeroIncidencia: string;
}

export interface ResultadoOperacion {
  success: boolean;
  error?: string;
}

/**
 * Sube un archivo al storage
 */
async function subirArchivo(
  archivo: File,
  numeroIncidencia: string,
  carpeta: 'imagenes' | 'documentos'
): Promise<string | null> {
  try {
    const nombreArchivo = `${Date.now()}_${archivo.name}`;
    const ruta = `incidencias/${numeroIncidencia}/${carpeta}/${nombreArchivo}`;

    const { error } = await supabase.storage
      .from('incidencias')
      .upload(ruta, archivo);

    if (error) {
      console.error(`Error subiendo ${carpeta}:`, error);
      return null;
    }

    return ruta;
  } catch (error) {
    console.error(`Error en subida de ${carpeta}:`, error);
    return null;
  }
}

/**
 * Resuelve una incidencia como proveedor
 */
export async function resolverIncidencia(
  params: ResolverIncidenciaParams
): Promise<ResultadoOperacion> {
  const {
    incidenciaId,
    solucionAplicada,
    imagenResolucion,
    documentoResolucion,
    tieneOfertaAprobada,
    autorId,
    autorEmail,
    numeroIncidencia
  } = params;

  try {
    // 1. Subir archivos si existen
    let imagenUrl = null;
    let documentoUrl = null;

    if (imagenResolucion) {
      imagenUrl = await subirArchivo(imagenResolucion, numeroIncidencia, 'imagenes');
    }

    if (documentoResolucion) {
      documentoUrl = await subirArchivo(documentoResolucion, numeroIncidencia, 'documentos');
    }

    // 2. Obtener estados anteriores
    const { data: casoActual } = await supabase
      .from("proveedor_casos")
      .select("estado_proveedor")
      .eq("incidencia_id", incidenciaId)
      .eq("activo", true)
      .single();

    const estadoProveedorAnterior = casoActual?.estado_proveedor || null;

    const { data: incidenciaActual } = await supabase
      .from("incidencias")
      .select("estado_cliente")
      .eq("id", incidenciaId)
      .single();

    const estadoClienteAnterior = incidenciaActual?.estado_cliente || null;

    // 3. Cambiar ambos estados a "Resuelta"
    await supabase
      .from("proveedor_casos")
      .update({ estado_proveedor: "Resuelta" })
      .eq("incidencia_id", incidenciaId)
      .eq("activo", true);

    await supabase
      .from("incidencias")
      .update({ estado_cliente: "Resuelta" })
      .eq("id", incidenciaId);

    // 4. Registrar cambios de estado en el historial
    const metadatosResolucion: Record<string, string | number | boolean> = {
      solucion_aplicada: solucionAplicada,
      tiene_oferta_aprobada: tieneOfertaAprobada,
      accion: 'resolver_incidencia'
    };

    await registrarCambioEstado({
      incidenciaId,
      tipoEstado: 'proveedor',
      estadoAnterior: estadoProveedorAnterior || undefined,
      estadoNuevo: 'Resuelta',
      autorId,
      motivo: 'Incidencia resuelta por proveedor',
      metadatos: metadatosResolucion
    });

    await registrarCambioEstado({
      incidenciaId,
      tipoEstado: 'cliente',
      estadoAnterior: estadoClienteAnterior || undefined,
      estadoNuevo: 'Resuelta',
      autorId,
      motivo: 'Incidencia resuelta por proveedor',
      metadatos: metadatosResolucion
    });

    // 5. Crear comentario con información de resolución
    const mensajeSolucion = `Incidencia resuelta
Solución aplicada: ${solucionAplicada}`;

    const { data: comentarioCreado, error: comentarioError } = await supabase
      .from("comentarios")
      .insert({
        incidencia_id: incidenciaId,
        ambito: 'proveedor',
        autor_id: autorId,
        autor_email: autorEmail,
        autor_rol: 'Proveedor',
        cuerpo: mensajeSolucion,
        es_sistema: false
      })
      .select()
      .single();

    if (comentarioError) {
      console.error("Error creando comentario:", comentarioError);
      throw comentarioError;
    }

    // 6. Agregar adjuntos si existen
    const adjuntos = [];

    if (imagenUrl && comentarioCreado) {
      adjuntos.push({
        incidencia_id: incidenciaId,
        comentario_id: comentarioCreado.id,
        tipo: 'imagen',
        categoria: 'evidencia_resolucion',
        nombre_archivo: imagenResolucion?.name,
        storage_key: imagenUrl
      });
    }

    if (documentoUrl && comentarioCreado) {
      adjuntos.push({
        incidencia_id: incidenciaId,
        comentario_id: comentarioCreado.id,
        tipo: 'documento',
        categoria: 'documento_resolucion',
        nombre_archivo: documentoResolucion?.name,
        storage_key: documentoUrl
      });
    }

    if (adjuntos.length > 0) {
      const { error: adjuntosError } = await supabase
        .from("adjuntos")
        .insert(adjuntos);

      if (adjuntosError) {
        console.error("Error guardando adjuntos:", adjuntosError);
      }
    }

    // 7. Crear comentario para ambos chats
    await supabase
      .from("comentarios")
      .insert({
        incidencia_id: incidenciaId,
        ambito: 'ambos',
        autor_id: autorId,
        autor_email: autorEmail || 'proveedor@sistema.com',
        autor_rol: 'Proveedor',
        cuerpo: "La incidencia ha sido resuelta técnicamente.",
        es_sistema: true
      });

    return { success: true };

  } catch (error) {
    console.error("Error resolviendo incidencia:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

/**
 * Registra la valoración económica de una incidencia
 */
export async function valoracionEconomica(
  params: ValoracionEconomicaParams
): Promise<ResultadoOperacion> {
  const {
    incidenciaId,
    importeSinIva,
    importeConIva,
    porcentajeIva,
    documentoJustificativo,
    tieneOfertaAprobada,
    presupuestoActual,
    autorId,
    autorEmail,
    numeroIncidencia
  } = params;

  try {
    // Validar si el documento es requerido
    const importeActual = parseFloat(importeSinIva) || 0;
    const importeOferta = presupuestoActual?.importe_total_sin_iva
      ? parseFloat(String(presupuestoActual.importe_total_sin_iva))
      : 0;
    const importeCoincide = tieneOfertaAprobada && importeActual === importeOferta && importeActual > 0;

    // 1. Subir documento justificativo si existe y es requerido
    let documentoUrl = null;
    if (documentoJustificativo && !importeCoincide) {
      const fileName = `${Date.now()}-${documentoJustificativo.name}`;
      const storagePath = `${numeroIncidencia}/comentarios/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('incidencias')
        .upload(storagePath, documentoJustificativo);

      if (uploadError) {
        throw uploadError;
      }

      const { data: urlData } = supabase.storage
        .from('incidencias')
        .getPublicUrl(storagePath);

      documentoUrl = urlData.publicUrl;
    }

    // 2. Obtener estado actual del proveedor antes de cambiar
    const { data: proveedorCasoActual } = await supabase
      .from("proveedor_casos")
      .select("estado_proveedor")
      .eq("incidencia_id", incidenciaId)
      .eq("activo", true)
      .single();

    const estadoAnterior = proveedorCasoActual?.estado_proveedor || null;

    // 3. Cambiar estado_proveedor a "Valorada"
    await supabase
      .from("proveedor_casos")
      .update({ estado_proveedor: "Valorada" })
      .eq("incidencia_id", incidenciaId)
      .eq("activo", true);

    // 4. Registrar cambio de estado en historial
    await registrarCambioEstado({
      incidenciaId,
      tipoEstado: 'proveedor',
      estadoAnterior,
      estadoNuevo: 'Valorada',
      autorId,
      motivo: 'Valoración económica completada'
    });

    // 5. Crear mensaje de valoración económica
    const mensajeValoracion = `Valoración económica completada:
• Importe sin IVA: €${importeSinIva}
• Porcentaje IVA: ${porcentajeIva}%
• Importe con IVA: €${importeConIva}${tieneOfertaAprobada ? '\n• Incidencia con oferta previa aprobada' : ''}`;

    // 6. Insertar comentario solo en chat de proveedor
    const { error: comentarioError } = await supabase
      .from("comentarios")
      .insert({
        incidencia_id: incidenciaId,
        ambito: 'proveedor',
        autor_id: autorId,
        autor_email: autorEmail,
        autor_rol: 'Proveedor',
        cuerpo: mensajeValoracion,
        documento_url: documentoUrl,
        es_sistema: false
      });

    if (comentarioError) {
      throw comentarioError;
    }

    return { success: true };

  } catch (error) {
    console.error("Error en valoración económica:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}
