import { supabase } from "@/lib/supabaseClient";
import { registrarCambioEstado } from "@/lib/historialEstados";
import { crearComentario } from "./comentariosService";

export type FormularioAsignacionProveedor = {
  proveedor_id: string;
  descripcion_proveedor: string;
  prioridad: string;
  estado_proveedor: string;
  imagenes_excluidas?: string[];
  documentos_incluidos?: string[];
  imagenes_adicionales?: File[];
};

export async function asignarProveedorCompleto(
  incidenciaId: string,
  numSolicitud: string,
  estadoClienteAnterior: string,
  formulario: FormularioAsignacionProveedor,
  autorId: string | null,
  userEmail: string | null
): Promise<void> {
  // Obtener datos del usuario actual
  let asignadoPorId = autorId;

  if (!asignadoPorId && userEmail) {
    const { data: persona } = await supabase
      .from("personas")
      .select("id")
      .eq("email", userEmail)
      .maybeSingle();
    asignadoPorId = persona?.id || null;
  }

  // Verificar si ya existe un caso activo
  const { data: casoExistente } = await supabase
    .from("proveedor_casos")
    .select("id")
    .eq("incidencia_id", incidenciaId)
    .eq("activo", true)
    .maybeSingle();

  if (casoExistente) {
    // Actualizar caso existente
    await supabase
      .from("proveedor_casos")
      .update({
        proveedor_id: formulario.proveedor_id,
        descripcion_proveedor: formulario.descripcion_proveedor,
        prioridad: formulario.prioridad,
        estado_proveedor: formulario.estado_proveedor,
        asignado_por: asignadoPorId,
        asignado_en: new Date().toISOString(),
        actualizado_en: new Date().toISOString()
      })
      .eq("id", casoExistente.id);
  } else {
    // Crear nuevo caso
    const { error: insertError } = await supabase
      .from("proveedor_casos")
      .insert({
        incidencia_id: incidenciaId,
        proveedor_id: formulario.proveedor_id,
        descripcion_proveedor: formulario.descripcion_proveedor,
        prioridad: formulario.prioridad,
        estado_proveedor: formulario.estado_proveedor,
        asignado_por: asignadoPorId,
        asignado_en: new Date().toISOString(),
        activo: true
      });

    if (insertError) {
      console.error("Error creando proveedor_caso:", insertError);
      throw new Error(`Error al asignar proveedor: ${insertError.message}`);
    }
  }

  // Cambiar estado de la incidencia a "En tramitación" SOLO si no está ya en ese estado
  const cambioEstadoCliente = estadoClienteAnterior !== "En tramitación";

  if (cambioEstadoCliente) {
    await supabase
      .from("incidencias")
      .update({ estado_cliente: "En tramitación" })
      .eq("id", incidenciaId);

    // Registrar cambio de estado del cliente SOLO si cambió
    await registrarCambioEstado({
      incidenciaId,
      tipoEstado: 'cliente',
      estadoAnterior: estadoClienteAnterior,
      estadoNuevo: 'En tramitación',
      autorId: asignadoPorId || undefined,
      motivo: 'Proveedor asignado',
      metadatos: {
        accion: casoExistente ? 'reasignar_proveedor' : 'asignar_proveedor',
        proveedor_id: formulario.proveedor_id
      }
    });
  }

  await registrarCambioEstado({
    incidenciaId,
    tipoEstado: 'proveedor',
    estadoAnterior: null,
    estadoNuevo: formulario.estado_proveedor,
    autorId: asignadoPorId || undefined,
    motivo: casoExistente ? 'Proveedor reasignado' : 'Proveedor asignado',
    metadatos: {
      accion: casoExistente ? 'reasignar_proveedor' : 'asignar_proveedor',
      proveedor_id: formulario.proveedor_id,
      prioridad: formulario.prioridad
    }
  });

  // Procesar todas las operaciones en paralelo
  const operaciones = [];

  // Procesar imágenes excluidas
  if (formulario.imagenes_excluidas && formulario.imagenes_excluidas.length > 0) {
    operaciones.push(procesarImagenesExcluidas(formulario.imagenes_excluidas));
  }

  // Procesar documentos incluidos
  if (formulario.documentos_incluidos && formulario.documentos_incluidos.length > 0) {
    operaciones.push(
      procesarDocumentosIncluidos(
        incidenciaId,
        formulario.documentos_incluidos,
        asignadoPorId,
        userEmail
      )
    );
  }

  // Procesar imágenes adicionales
  if (formulario.imagenes_adicionales && formulario.imagenes_adicionales.length > 0) {
    operaciones.push(
      procesarImagenesAdicionales(
        incidenciaId,
        numSolicitud,
        formulario.imagenes_adicionales,
        asignadoPorId,
        userEmail
      )
    );
  }

  // Crear comentario de asignación
  operaciones.push(
    crearComentarioAsignacion(
      incidenciaId,
      formulario.proveedor_id,
      asignadoPorId,
      userEmail
    )
  );

  // Ejecutar todo en paralelo
  await Promise.all(operaciones);
}

async function procesarImagenesExcluidas(imagenesIds: string[]): Promise<void> {
  // Actualizar todas las imágenes en paralelo
  await Promise.all(
    imagenesIds.map(imagenId =>
      supabase
        .from("adjuntos")
        .update({ visible_proveedor: false })
        .eq("id", imagenId)
    )
  );
}

async function procesarDocumentosIncluidos(
  incidenciaId: string,
  documentosIds: string[],
  autorId: string | null,
  userEmail: string | null
): Promise<void> {
  // Obtener todos los adjuntos en paralelo
  const adjuntosPromises = documentosIds.map(docId =>
    supabase
      .from("adjuntos")
      .select("storage_key, nombre_archivo")
      .eq("id", docId)
      .single()
  );

  const adjuntosResults = await Promise.all(adjuntosPromises);

  // Procesar cada documento en paralelo
  await Promise.all(
    adjuntosResults.map(async ({ data: adjunto }) => {
      if (adjunto) {
        const comentario = await crearComentario({
          incidencia_id: incidenciaId,
          ambito: 'proveedor',
          autor_id: autorId || '',
          autor_email: userEmail || '',
          autor_rol: 'Control',
          cuerpo: `Documento del proveedor anterior incluido por Control.`,
          es_sistema: true
        });

        if (comentario) {
          await supabase
            .from("adjuntos")
            .insert({
              incidencia_id: incidenciaId,
              comentario_id: comentario.id,
              storage_key: adjunto.storage_key,
              nombre_archivo: adjunto.nombre_archivo,
              tipo: 'documento'
            });
        }
      }
    })
  );
}

async function procesarImagenesAdicionales(
  incidenciaId: string,
  numSolicitud: string,
  imagenes: File[],
  autorId: string | null,
  userEmail: string | null
): Promise<void> {
  // Subir todas las imágenes en paralelo
  const uploadPromises = imagenes.map(async (imagenFile, index) => {
    const safeName = imagenFile.name.replace(/\s+/g, "_");
    const path = `incidencias/${numSolicitud}/${Date.now()}_${index}_${safeName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("incidencias")
      .upload(path, imagenFile, { upsert: false });

    if (!uploadError && uploadData) {
      return {
        storage_key: uploadData.path,
        nombre_archivo: imagenFile.name
      };
    }
    return null;
  });

  const uploadResults = await Promise.all(uploadPromises);
  const imagenesSubidas = uploadResults.filter((result): result is { storage_key: string; nombre_archivo: string } => result !== null);

  // Si hay imágenes subidas, crear un solo comentario y adjuntos en paralelo
  if (imagenesSubidas.length > 0) {
    const comentario = await crearComentario({
      incidencia_id: incidenciaId,
      ambito: 'proveedor',
      autor_id: autorId || '',
      autor_email: userEmail || '',
      autor_rol: 'Control',
      cuerpo: `${imagenesSubidas.length} imagen${imagenesSubidas.length > 1 ? 'es' : ''} adicional${imagenesSubidas.length > 1 ? 'es' : ''} compartida${imagenesSubidas.length > 1 ? 's' : ''} por Control`,
      es_sistema: true
    });

    if (comentario) {
      // Insertar todos los adjuntos en paralelo
      const adjuntosData = imagenesSubidas.map(img => ({
        incidencia_id: incidenciaId,
        comentario_id: comentario.id,
        storage_key: img.storage_key,
        nombre_archivo: img.nombre_archivo,
        tipo: 'imagen',
        categoria: 'imagen_comentario',
        visible_proveedor: true
      }));

      await supabase.from("adjuntos").insert(adjuntosData);
    }
  }
}

async function crearComentarioAsignacion(
  incidenciaId: string,
  proveedorId: string,
  autorId: string | null,
  userEmail: string | null
): Promise<void> {
  const { data: proveedor } = await supabase
    .from("instituciones")
    .select("nombre")
    .eq("id", proveedorId)
    .single();

  if (proveedor) {
    await crearComentario({
      incidencia_id: incidenciaId,
      ambito: 'cliente',
      autor_id: autorId || '',
      autor_email: userEmail || '',
      autor_rol: 'Control',
      cuerpo: `La incidencia ha sido asignada al proveedor ${proveedor.nombre}.`,
      es_sistema: true
    });
  }
}
