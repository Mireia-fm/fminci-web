import { supabase } from "@/lib/supabaseClient";
import { registrarCambioEstado } from "@/lib/historialEstados";
import { crearComentario } from "./comentariosService";
import { sanitizarNombreArchivo } from "./storageService";

export type FormularioAsignacionProveedor = {
  proveedor_id: string;
  descripcion_proveedor: string;
  prioridad: string;
  estado_proveedor: string;
  imagenes_excluidas?: string[];
  documentos_incluidos?: string[];
  imagenes_adicionales?: File[];
  es_proveedor_externo?: boolean;
  cif_proveedor_externo?: string;
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

  // Si es proveedor externo, crear o buscar el proveedor en instituciones
  let proveedorIdFinal = formulario.proveedor_id;

  if (formulario.es_proveedor_externo && formulario.cif_proveedor_externo) {
    // Buscar si ya existe un proveedor externo con este CIF
    const { data: proveedorExistente } = await supabase
      .from("instituciones")
      .select("id")
      .eq("tipo", "Proveedor")
      .eq("cif", formulario.cif_proveedor_externo)
      .maybeSingle();

    if (proveedorExistente) {
      // Usar el proveedor existente
      proveedorIdFinal = proveedorExistente.id;
    } else {
      // Crear nuevo proveedor externo
      const { data: nuevoProveedor, error: errorProveedor } = await supabase
        .from("instituciones")
        .insert({
          nombre: `Proveedor Externo - ${formulario.cif_proveedor_externo}`,
          tipo: "Proveedor",
          cif: formulario.cif_proveedor_externo,
          activo: true
        })
        .select("id")
        .single();

      if (errorProveedor) {
        throw new Error(`Error al crear proveedor externo: ${errorProveedor.message}`);
      }

      proveedorIdFinal = nuevoProveedor.id;
    }
  }

  // Verificar si ya existe un caso activo
  const { data: casoExistente } = await supabase
    .from("proveedor_casos")
    .select("id, estado_proveedor")
    .eq("incidencia_id", incidenciaId)
    .eq("activo", true)
    .maybeSingle();

  let esReasignacion = false;
  let nuevoProveedorCasoId: string | null = null;

  if (casoExistente) {
    // Si el caso existe y está anulado, crear uno nuevo (sin tocar el anterior)
    if (casoExistente.estado_proveedor === 'Anulada') {
      esReasignacion = true;

      // Crear nuevo caso para el nuevo proveedor con estado "Abierta"
      const { data: nuevoCaso, error: insertError } = await supabase
        .from("proveedor_casos")
        .insert({
          incidencia_id: incidenciaId,
          proveedor_id: proveedorIdFinal,
          descripcion_proveedor: formulario.descripcion_proveedor,
          prioridad: formulario.prioridad,
          estado_proveedor: 'Abierta', // Nuevo caso siempre empieza como "Abierta"
          asignado_por: asignadoPorId,
          asignado_en: new Date().toISOString(),
          activo: true
        })
        .select('id')
        .single();

      if (insertError) {
        console.error("Error creando nuevo proveedor_caso:", insertError);
        throw new Error(`Error al reasignar proveedor: ${insertError.message}`);
      }

      nuevoProveedorCasoId = nuevoCaso?.id || null;
    } else {
      // Actualizar caso existente (no anulado)
      await supabase
        .from("proveedor_casos")
        .update({
          proveedor_id: proveedorIdFinal,
          descripcion_proveedor: formulario.descripcion_proveedor,
          prioridad: formulario.prioridad,
          estado_proveedor: formulario.estado_proveedor,
          asignado_por: asignadoPorId,
          asignado_en: new Date().toISOString(),
          actualizado_en: new Date().toISOString()
        })
        .eq("id", casoExistente.id);

      nuevoProveedorCasoId = casoExistente.id;
    }
  } else {
    // Crear nuevo caso (primera asignación) - siempre empieza como "Abierta"
    const { data: nuevoCaso, error: insertError } = await supabase
      .from("proveedor_casos")
      .insert({
        incidencia_id: incidenciaId,
        proveedor_id: proveedorIdFinal,
        descripcion_proveedor: formulario.descripcion_proveedor,
        prioridad: formulario.prioridad,
        estado_proveedor: 'Abierta', // Primera asignación siempre empieza como "Abierta"
        asignado_por: asignadoPorId,
        asignado_en: new Date().toISOString(),
        activo: true
      })
      .select('id')
      .single();

    if (insertError) {
      console.error("Error creando proveedor_caso:", insertError);
      throw new Error(`Error al asignar proveedor: ${insertError.message}`);
    }

    nuevoProveedorCasoId = nuevoCaso?.id || null;
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
        proveedor_id: proveedorIdFinal,
        es_proveedor_externo: formulario.es_proveedor_externo || false,
        ...(formulario.cif_proveedor_externo && { cif_proveedor_externo: formulario.cif_proveedor_externo })
      }
    });
  }

  await registrarCambioEstado({
    incidenciaId,
    tipoEstado: 'proveedor',
    estadoAnterior: null,
    estadoNuevo: formulario.estado_proveedor,
    autorId: asignadoPorId || undefined,
    motivo: esReasignacion ? 'Proveedor reasignado tras anulación' : (casoExistente ? 'Proveedor reasignado' : 'Proveedor asignado'),
    metadatos: {
      accion: esReasignacion ? 'reasignar_proveedor_tras_anulacion' : (casoExistente ? 'reasignar_proveedor' : 'asignar_proveedor'),
      proveedor_id: proveedorIdFinal,
      prioridad: formulario.prioridad,
      es_proveedor_externo: formulario.es_proveedor_externo || false,
      ...(formulario.cif_proveedor_externo && { cif_proveedor_externo: formulario.cif_proveedor_externo })
    }
  });

  // Procesar todas las operaciones en paralelo
  const operaciones = [];

  // Procesar imágenes excluidas
  if (formulario.imagenes_excluidas && formulario.imagenes_excluidas.length > 0) {
    operaciones.push(procesarImagenesExcluidas(formulario.imagenes_excluidas));
  }

  // Procesar documentos incluidos (con proveedor_caso_id)
  if (formulario.documentos_incluidos && formulario.documentos_incluidos.length > 0) {
    operaciones.push(
      procesarDocumentosIncluidos(
        incidenciaId,
        nuevoProveedorCasoId,
        formulario.documentos_incluidos,
        asignadoPorId,
        userEmail
      )
    );
  }

  // Procesar imágenes adicionales (con proveedor_caso_id)
  if (formulario.imagenes_adicionales && formulario.imagenes_adicionales.length > 0) {
    operaciones.push(
      procesarImagenesAdicionales(
        incidenciaId,
        nuevoProveedorCasoId,
        numSolicitud,
        formulario.imagenes_adicionales,
        asignadoPorId,
        userEmail
      )
    );
  }

  // Crear comentario de asignación (cliente - sin proveedor_caso_id)
  operaciones.push(
    crearComentarioAsignacion(
      incidenciaId,
      proveedorIdFinal,
      asignadoPorId,
      userEmail,
      formulario.es_proveedor_externo || false,
      formulario.cif_proveedor_externo
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
  proveedorCasoId: string | null,
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
          proveedor_caso_id: proveedorCasoId || undefined,
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
  proveedorCasoId: string | null,
  numSolicitud: string,
  imagenes: File[],
  autorId: string | null,
  userEmail: string | null
): Promise<void> {
  // Subir todos los archivos en paralelo
  const uploadPromises = imagenes.map(async (archivo, index) => {
    const safeName = sanitizarNombreArchivo(archivo.name);
    const path = `incidencias/${numSolicitud}/${Date.now()}_${index}_${safeName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("incidencias")
      .upload(path, archivo, { upsert: false });

    if (!uploadError && uploadData) {
      // Determinar tipo de archivo basado en la extensión
      const extension = archivo.name.split('.').pop()?.toLowerCase() || '';
      const tiposImagen = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
      const tipo = tiposImagen.includes(extension) ? 'imagen' : 'documento';

      return {
        storage_key: uploadData.path,
        nombre_archivo: archivo.name,
        tipo
      };
    }
    return null;
  });

  const uploadResults = await Promise.all(uploadPromises);
  const archivosSubidos = uploadResults.filter((result): result is { storage_key: string; nombre_archivo: string; tipo: string } => result !== null);

  // Si hay archivos subidos, crear un solo comentario y adjuntos en paralelo
  if (archivosSubidos.length > 0) {
    const comentario = await crearComentario({
      incidencia_id: incidenciaId,
      proveedor_caso_id: proveedorCasoId || undefined,
      ambito: 'proveedor',
      autor_id: autorId || '',
      autor_email: userEmail || '',
      autor_rol: 'Control',
      cuerpo: `${archivosSubidos.length} archivo${archivosSubidos.length > 1 ? 's' : ''} adicional${archivosSubidos.length > 1 ? 'es' : ''} compartido${archivosSubidos.length > 1 ? 's' : ''} por Control`,
      es_sistema: true
    });

    if (comentario) {
      // Insertar todos los adjuntos en paralelo
      const adjuntosData = archivosSubidos.map(archivo => ({
        incidencia_id: incidenciaId,
        comentario_id: comentario.id,
        storage_key: archivo.storage_key,
        nombre_archivo: archivo.nombre_archivo,
        tipo: archivo.tipo,
        categoria: 'archivo_comentario',
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
  userEmail: string | null,
  esProveedorExterno: boolean = false,
  cifProveedorExterno?: string
): Promise<void> {
  const { data: proveedor } = await supabase
    .from("instituciones")
    .select("nombre")
    .eq("id", proveedorId)
    .single();

  if (proveedor) {
    const mensajeBase = `La incidencia ha sido asignada al proveedor ${proveedor.nombre}`;
    const mensajeCIF = esProveedorExterno && cifProveedorExterno
      ? ` (CIF: ${cifProveedorExterno})`
      : '';

    await crearComentario({
      incidencia_id: incidenciaId,
      ambito: 'cliente',
      autor_id: autorId || '',
      autor_email: userEmail || '',
      autor_rol: 'Control',
      cuerpo: `${mensajeBase}${mensajeCIF}.`,
      es_sistema: true
    });
  }
}
