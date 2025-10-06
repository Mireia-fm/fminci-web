import { supabase } from "@/lib/supabaseClient";
import { registrarCambioEstado } from "@/lib/historialEstados";
import { sanitizarNombreArchivo } from "./storageService";
import { crearComentario } from "./comentariosService";

export interface ResolverIncidenciaParams {
  incidenciaId: string;
  solucionAplicada: string;
  fechaRealizacion: string;
  imagenesResolucion?: File[];
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
  valoracionExistenteId?: string | null;
  esEdicion?: boolean;
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
    const nombreSanitizado = sanitizarNombreArchivo(archivo.name);
    const nombreArchivo = `${Date.now()}_${nombreSanitizado}`;
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
    fechaRealizacion,
    imagenesResolucion = [],
    documentoResolucion,
    tieneOfertaAprobada,
    autorId,
    autorEmail,
    numeroIncidencia
  } = params;

  try {
    // 1. Subir archivos si existen
    const imagenesUrls: string[] = [];
    let documentoUrl = null;

    // Subir todas las imágenes
    if (imagenesResolucion && imagenesResolucion.length > 0) {
      for (const imagen of imagenesResolucion) {
        const url = await subirArchivo(imagen, numeroIncidencia, 'imagenes');
        if (url) {
          imagenesUrls.push(url);
        }
      }
    }

    if (documentoResolucion) {
      documentoUrl = await subirArchivo(documentoResolucion, numeroIncidencia, 'documentos');
    }

    // 2. Obtener proveedor_caso_id activo
    const { data: proveedorCaso } = await supabase
      .from("proveedor_casos")
      .select("id")
      .eq("incidencia_id", incidenciaId)
      .eq("activo", true)
      .single();

    if (!proveedorCaso) {
      return {
        success: false,
        error: 'No se encontró el caso del proveedor activo'
      };
    }

    // 3. Verificar si ya existe una resolución técnica (para saber si es CREADA o EDITADA)
    const { data: resolucionExistente } = await supabase
      .from("resoluciones_tecnicas")
      .select("id")
      .eq("incidencia_id", incidenciaId)
      .eq("proveedor_caso_id", proveedorCaso.id)
      .single();

    const accion = resolucionExistente ? 'EDITADA' : 'CREADA';

    // 4. Guardar o actualizar en la tabla resoluciones_tecnicas
    if (resolucionExistente) {
      // Actualizar resolución existente
      const { error: updateError } = await supabase
        .from("resoluciones_tecnicas")
        .update({
          solucion_aplicada: solucionAplicada,
          fecha_realizacion: fechaRealizacion,
          actualizado_en: new Date().toISOString()
        })
        .eq("id", resolucionExistente.id);

      if (updateError) {
        console.error("Error actualizando resolución técnica:", updateError);
        return {
          success: false,
          error: 'Error al actualizar la resolución técnica'
        };
      }
    } else {
      // Insertar nueva resolución
      const { error: insertError } = await supabase
        .from("resoluciones_tecnicas")
        .insert({
          incidencia_id: incidenciaId,
          proveedor_caso_id: proveedorCaso.id,
          solucion_aplicada: solucionAplicada,
          fecha_realizacion: fechaRealizacion,
          creado_por: autorId
        });

      if (insertError) {
        console.error("Error guardando resolución técnica:", insertError);
        return {
          success: false,
          error: 'Error al guardar la resolución técnica'
        };
      }
    }

    // 5. Obtener estados anteriores
    const { data: casoActual } = await supabase
      .from("proveedor_casos")
      .select("estado_proveedor, tipo_revision")
      .eq("incidencia_id", incidenciaId)
      .eq("activo", true)
      .single();

    const estadoProveedorAnterior = casoActual?.estado_proveedor || null;
    const tipoRevisionActual = casoActual?.tipo_revision || null;

    const { data: incidenciaActual } = await supabase
      .from("incidencias")
      .select("estado_cliente")
      .eq("id", incidenciaId)
      .single();

    const estadoClienteAnterior = incidenciaActual?.estado_cliente || null;

    // 6. Cambiar estados según el caso:
    // - Si está en "Revisar resolución" con tipo 'tecnica' o 'ambas' -> "Resuelta"
    // - Si está en "Revisar resolución" con tipo 'economica' (ya corrigió técnica) -> "Valorada"
    // - Si está en "Valorada" -> mantener "Valorada" (solo edición)
    // - Otros casos -> cambiar a "Resuelta" (resolución normal)
    const esCorreccionRevision = estadoProveedorAnterior === 'Revisar resolución';
    const debeActualizarEstado = estadoProveedorAnterior !== 'Valorada';

    if (debeActualizarEstado) {
      // Determinar nuevo estado y tipo_revision
      let nuevoEstadoProveedor = "Resuelta";
      let nuevoTipoRevision = null;

      if (esCorreccionRevision) {
        // Si era 'ambas', pasa a 'Resuelta' y cambia tipo_revision a 'economica' (falta económica)
        // Si era solo 'tecnica', pasa a 'Valorada' (corrección completa)
        // Si era 'economica' (no debería pasar por aquí en resolverIncidencia), pasa a 'Valorada'
        if (tipoRevisionActual === 'ambas') {
          nuevoEstadoProveedor = 'Resuelta';
          nuevoTipoRevision = 'economica'; // Falta corregir económica
        } else {
          // Solo técnica -> directo a Valorada para que Control pueda cerrar
          nuevoEstadoProveedor = 'Valorada';
          nuevoTipoRevision = null;
        }
      }

      await supabase
        .from("proveedor_casos")
        .update({
          estado_proveedor: nuevoEstadoProveedor,
          tipo_revision: nuevoTipoRevision
        })
        .eq("incidencia_id", incidenciaId)
        .eq("activo", true)
        .neq("estado_proveedor", "Anulada");

      await supabase
        .from("incidencias")
        .update({ estado_cliente: "Resuelta" })
        .eq("id", incidenciaId);
    }

    // 7. Registrar cambios de estado en el historial
    const metadatosResolucion: Record<string, string | number | boolean> = {
      solucion_aplicada: solucionAplicada,
      fecha_realizacion: fechaRealizacion,
      tiene_oferta_aprobada: tieneOfertaAprobada,
      accion: accion === 'EDITADA' ? 'editar_resolucion' : 'resolver_incidencia'
    };

    // Solo registrar cambio de estado si se actualizó
    if (debeActualizarEstado) {
      const nuevoEstadoProveedor = esCorreccionRevision ? "Valorada" : "Resuelta";
      let motivoProveedor = 'Incidencia resuelta por proveedor';
      let motivoCliente = 'Incidencia resuelta por proveedor';

      if (esCorreccionRevision) {
        motivoProveedor = 'Resolución técnica corregida - lista para revisión final de Control';
        motivoCliente = 'Resolución técnica corregida por el proveedor';
        metadatosResolucion.accion = 'corregir_resolucion_tecnica';
      } else if (accion === 'EDITADA') {
        motivoProveedor = 'Resolución editada por el proveedor';
        motivoCliente = 'Resolución editada por el proveedor';
      }

      await registrarCambioEstado({
        incidenciaId,
        tipoEstado: 'proveedor',
        estadoAnterior: estadoProveedorAnterior || undefined,
        estadoNuevo: nuevoEstadoProveedor,
        autorId,
        motivo: motivoProveedor,
        metadatos: metadatosResolucion
      });

      await registrarCambioEstado({
        incidenciaId,
        tipoEstado: 'cliente',
        estadoAnterior: estadoClienteAnterior || undefined,
        estadoNuevo: 'Resuelta',
        autorId,
        motivo: motivoCliente,
        metadatos: metadatosResolucion
      });
    } else {
      // Si está valorada, solo registrar la edición sin cambiar estado
      await registrarCambioEstado({
        incidenciaId,
        tipoEstado: 'proveedor',
        estadoAnterior: 'Valorada',
        estadoNuevo: 'Valorada',
        autorId,
        motivo: 'Resolución técnica editada (incidencia ya valorada)',
        metadatos: metadatosResolucion
      });
    }

    // 8. Crear comentario con información de resolución
    const mensajeSolucion = `RESOLUCIÓN TÉCNICA ${accion}

Solución aplicada: ${solucionAplicada}
Fecha de realización: ${new Date(fechaRealizacion).toLocaleDateString('es-ES')}${
  imagenesResolucion && imagenesResolucion.length > 0 ? `\nImágenes de evidencia: ${imagenesResolucion.length} archivo(s)` : ''
}${
  documentoResolucion ? `\nParte de trabajo adjunto` : ''
}`;

    const comentarioCreado = await crearComentario({
      incidencia_id: incidenciaId,
      proveedor_caso_id: proveedorCaso.id,
      ambito: 'proveedor',
      autor_id: autorId,
      autor_email: autorEmail,
      autor_rol: 'Proveedor',
      cuerpo: mensajeSolucion,
      es_sistema: false
    });

    if (!comentarioCreado) {
      throw new Error("Error creando comentario de resolución");
    }

    // 9. Agregar adjuntos si existen
    const adjuntos = [];

    // Agregar todas las imágenes como adjuntos
    if (imagenesUrls.length > 0 && comentarioCreado && imagenesResolucion) {
      imagenesResolucion.forEach((imagen, index) => {
        if (imagenesUrls[index]) {
          adjuntos.push({
            incidencia_id: incidenciaId,
            comentario_id: comentarioCreado.id,
            tipo: 'imagen',
            categoria: 'evidencia_resolucion',
            nombre_archivo: imagen.name,
            storage_key: imagenesUrls[index]
          });
        }
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
    numeroIncidencia,
    valoracionExistenteId,
    esEdicion = false
  } = params;

  try {
    // Validar si el documento es requerido
    const importeActual = parseFloat(importeSinIva) || 0;
    const importeOferta = presupuestoActual?.importe_total_sin_iva
      ? parseFloat(String(presupuestoActual.importe_total_sin_iva))
      : 0;
    const importeCoincide = tieneOfertaAprobada && importeActual === importeOferta && importeActual > 0;

    // 1. Obtener proveedor_caso_id activo
    const { data: proveedorCasoActual, error: proveedorCasoError } = await supabase
      .from("proveedor_casos")
      .select("id, estado_proveedor, tipo_revision")
      .eq("incidencia_id", incidenciaId)
      .eq("activo", true)
      .single();

    if (proveedorCasoError || !proveedorCasoActual) {
      return {
        success: false,
        error: 'No se encontró el caso del proveedor activo'
      };
    }

    const estadoAnterior = proveedorCasoActual.estado_proveedor || null;
    const tipoRevisionActual = proveedorCasoActual.tipo_revision || null;

    // 2. Obtener resolucion_tecnica_id si existe
    const { data: resolucionTecnica } = await supabase
      .from("resoluciones_tecnicas")
      .select("id")
      .eq("incidencia_id", incidenciaId)
      .eq("proveedor_caso_id", proveedorCasoActual.id)
      .single();

    // 3. Crear o actualizar valoración económica
    let valoracionCreada;
    const accion = esEdicion ? 'EDITADA' : 'CREADA';

    if (esEdicion && valoracionExistenteId) {
      // Modo edición: UPDATE
      const { data, error: valoracionError } = await supabase
        .from("valoraciones_economicas")
        .update({
          importe_sin_iva: parseFloat(importeSinIva),
          porcentaje_iva: parseInt(porcentajeIva),
          importe_con_iva: parseFloat(importeConIva),
          actualizado_en: new Date().toISOString()
        })
        .eq("id", valoracionExistenteId)
        .select()
        .single();

      if (valoracionError) {
        console.error("Error actualizando valoración económica:", valoracionError);
        return {
          success: false,
          error: 'Error al actualizar la valoración económica'
        };
      }
      valoracionCreada = data;
    } else {
      // Modo creación: INSERT
      const { data, error: valoracionError } = await supabase
        .from("valoraciones_economicas")
        .insert({
          incidencia_id: incidenciaId,
          proveedor_caso_id: proveedorCasoActual.id,
          resolucion_tecnica_id: resolucionTecnica?.id || null,
          importe_sin_iva: parseFloat(importeSinIva),
          porcentaje_iva: parseInt(porcentajeIva),
          importe_con_iva: parseFloat(importeConIva),
          creado_por: autorId
        })
        .select()
        .single();

      if (valoracionError) {
        console.error("Error guardando valoración económica:", valoracionError);
        return {
          success: false,
          error: 'Error al guardar la valoración económica'
        };
      }
      valoracionCreada = data;
    }

    // 4. Cambiar estado_proveedor a "Valorada" si corresponde
    // Casos donde cambia a "Valorada":
    // - No es edición Y no está en "Valorada" (valoración nueva)
    // - Estado anterior es "Revisar resolución" (corrección después de rechazo)
    const debeActualizarAValorada = !esEdicion && estadoAnterior !== 'Valorada';
    const esCorreccionRevision = estadoAnterior === 'Revisar resolución';

    if (debeActualizarAValorada || esCorreccionRevision) {
      // Determinar nuevo tipo_revision
      // Si corrige económica pero el tipo_revision era 'ambas', ya corrigió técnica antes
      // por lo que ahora se limpia completamente
      // Si era solo 'economica', se limpia también
      let nuevoTipoRevision = null;
      // En el caso de valoración económica, si llegamos aquí y era 'ambas',
      // significa que ya corrigió la técnica, así que se limpia

      await supabase
        .from("proveedor_casos")
        .update({
          estado_proveedor: "Valorada",
          tipo_revision: nuevoTipoRevision
        })
        .eq("incidencia_id", incidenciaId)
        .eq("activo", true)
        .neq("estado_proveedor", "Anulada");

      const motivoRegistro = esCorreccionRevision
        ? 'Valoración económica corregida - lista para revisión final de Control'
        : 'Valoración económica completada';

      // Registrar cambio de estado en historial
      await registrarCambioEstado({
        incidenciaId,
        tipoEstado: 'proveedor',
        estadoAnterior,
        estadoNuevo: 'Valorada',
        autorId,
        motivo: motivoRegistro,
        metadatos: {
          importe_sin_iva: parseFloat(importeSinIva),
          porcentaje_iva: parseInt(porcentajeIva),
          importe_con_iva: parseFloat(importeConIva),
          tiene_oferta_aprobada: tieneOfertaAprobada,
          accion: esCorreccionRevision ? 'corregir_valoracion_economica' : 'crear_valoracion'
        }
      });
    } else if (esEdicion && estadoAnterior === 'Valorada') {
      // En modo edición desde "Valorada", solo registrar la actualización en metadatos
      await registrarCambioEstado({
        incidenciaId,
        tipoEstado: 'proveedor',
        estadoAnterior: 'Valorada',
        estadoNuevo: 'Valorada',
        autorId,
        motivo: 'Valoración económica editada',
        metadatos: {
          importe_sin_iva: parseFloat(importeSinIva),
          porcentaje_iva: parseInt(porcentajeIva),
          importe_con_iva: parseFloat(importeConIva),
          tiene_oferta_aprobada: tieneOfertaAprobada,
          accion: 'editar_valoracion'
        }
      });
    }

    // 5. Crear mensaje de valoración económica
    const importeSinIvaNum = parseFloat(importeSinIva);
    const importeConIvaNum = parseFloat(importeConIva);
    const importeIva = importeConIvaNum - importeSinIvaNum;

    const mensajeValoracion = `VALORACIÓN ECONÓMICA ${accion}

Importe sin IVA: ${importeSinIvaNum.toFixed(2)}€
IVA (${porcentajeIva}%): ${importeIva.toFixed(2)}€
Importe total con IVA: ${importeConIvaNum.toFixed(2)}€${
  documentoJustificativo ? `\nDocumento justificativo adjunto` : ''
}`;

    // 6. Insertar comentario solo en chat de proveedor
    const comentarioCreado = await crearComentario({
      incidencia_id: incidenciaId,
      proveedor_caso_id: proveedorCasoActual.id,
      ambito: 'proveedor',
      autor_id: autorId,
      autor_email: autorEmail,
      autor_rol: 'Proveedor',
      cuerpo: mensajeValoracion,
      es_sistema: false
    });

    if (!comentarioCreado) {
      throw new Error("Error creando comentario de valoración");
    }

    // 8. Subir documento justificativo como adjunto si existe
    if (documentoJustificativo && !importeCoincide && comentarioCreado && valoracionCreada) {
      const nombreSanitizado = sanitizarNombreArchivo(documentoJustificativo.name);
      const fileName = `justificante_${Date.now()}_${nombreSanitizado}`;
      const storagePath = `incidencias/${numeroIncidencia}/valoracion/${fileName}`;

      const { data: storageData, error: uploadError } = await supabase.storage
        .from('incidencias')
        .upload(storagePath, documentoJustificativo, { upsert: false });

      if (uploadError) {
        console.error("Error subiendo documento justificativo:", uploadError);
        throw uploadError;
      }

      // Crear adjunto vinculado al comentario y a la valoración económica
      const { data: adjuntoCreado, error: adjuntoError } = await supabase
        .from("adjuntos")
        .insert({
          incidencia_id: incidenciaId,
          comentario_id: comentarioCreado.id,
          valoracion_economica_id: valoracionCreada.id,
          tipo: "documento",
          categoria: "justificante_economico",
          storage_key: storageData.path,
          nombre_archivo: documentoJustificativo.name,
          visible_proveedor: true
        })
        .select()
        .single();

      if (adjuntoError) {
        console.error("Error guardando adjunto:", adjuntoError);
        throw adjuntoError;
      }

      // Actualizar la valoración económica con la referencia al adjunto
      if (adjuntoCreado) {
        await supabase
          .from("valoraciones_economicas")
          .update({ documento_adjunto_id: adjuntoCreado.id })
          .eq("id", valoracionCreada.id);
      }
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
