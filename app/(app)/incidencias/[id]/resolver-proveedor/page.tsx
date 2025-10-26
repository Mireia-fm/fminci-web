"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { PALETA } from "@/lib/theme";
import { useAuth } from "@/contexts/AuthContext";
import SearchableSelect from "@/components/SearchableSelect";
import { registrarCambioEstado } from "@/lib/historialEstados";

type Incidencia = {
  id: string;
  num_solicitud: string;
  descripcion: string;
  estado_cliente: string;
  estado_proveedor?: string;
  centro?: string;
  instituciones?: {
    nombre: string;
  }[] | null;
  proveedor_casos?: {
    activo: boolean;
    proveedor_id: string;
    proveedor?: {
      nombre: string;
    } | {
      nombre: string;
    }[];
  }[] | null;
};

type FormularioResolucion = {
  // Resolución Técnica
  solucion_aplicada: string;
  imagenes_evidencia: File[];
  documento_parte_trabajo: File | null;
  fecha_realizacion: string;

  // Valoración Económica
  importe_sin_iva: number | undefined;
  porcentaje_iva: '0' | '4' | '10' | '21' | '';
  importe_con_iva: number;
  documento_justificativo: File | null;
};

export default function ResolverComoProveedor() {
  const params = useParams();
  const router = useRouter();
  const incidenciaId = params.id as string;
  const { perfil, loading: authLoading } = useAuth();

  const [incidencia, setIncidencia] = useState<Incidencia | null>(null);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [resolucionExistenteId, setResolucionExistenteId] = useState<string | null>(null);
  const [valoracionExistenteId, setValoracionExistenteId] = useState<string | null>(null);

  const [formulario, setFormulario] = useState<FormularioResolucion>({
    solucion_aplicada: '',
    imagenes_evidencia: [],
    documento_parte_trabajo: null,
    fecha_realizacion: new Date().toISOString().split('T')[0],
    importe_sin_iva: undefined,
    porcentaje_iva: '',
    importe_con_iva: 0,
    documento_justificativo: null
  });

  useEffect(() => {
    if (!authLoading && perfil) {
      if (perfil.rol !== 'Control') {
        router.push(`/incidencias/${incidenciaId}/chat-proveedor`);
        return;
      }
      cargarIncidencia();
    }
  }, [authLoading, perfil, incidenciaId]);

  // Calcular importe con IVA automáticamente
  useEffect(() => {
    if (formulario.importe_sin_iva && formulario.porcentaje_iva) {
      const sinIva = formulario.importe_sin_iva;
      const iva = parseFloat(formulario.porcentaje_iva);
      const conIva = sinIva * (1 + iva / 100);
      setFormulario(prev => ({
        ...prev,
        importe_con_iva: Math.round(conIva * 100) / 100
      }));
    } else {
      setFormulario(prev => ({ ...prev, importe_con_iva: 0 }));
    }
  }, [formulario.importe_sin_iva, formulario.porcentaje_iva]);

  const cargarIncidencia = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("incidencias")
        .select(`
          id,
          num_solicitud,
          descripcion,
          estado_cliente,
          centro,
          instituciones(nombre),
          proveedor_casos(
            activo,
            proveedor_id,
            proveedor:instituciones!proveedor_casos_proveedor_id_fkey(nombre)
          )
        `)
        .eq("id", incidenciaId)
        .single();

      if (error) throw error;
      setIncidencia(data);

      // Verificar si ya existe una resolución técnica para esta incidencia
      const { data: resolucionData } = await supabase
        .from("resoluciones_tecnicas")
        .select("id, solucion_aplicada, fecha_realizacion")
        .eq("incidencia_id", incidenciaId)
        .order("creado_en", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (resolucionData) {
        setModoEdicion(true);
        setResolucionExistenteId(resolucionData.id);

        // Cargar datos de la resolución existente en el formulario
        setFormulario(prev => ({
          ...prev,
          solucion_aplicada: resolucionData.solucion_aplicada || '',
          fecha_realizacion: resolucionData.fecha_realizacion || new Date().toISOString().split('T')[0]
        }));

        // Verificar si existe valoración económica
        const { data: valoracionData } = await supabase
          .from("valoraciones_economicas")
          .select("id, importe_sin_iva, porcentaje_iva, importe_con_iva")
          .eq("resolucion_tecnica_id", resolucionData.id)
          .maybeSingle();

        if (valoracionData) {
          setValoracionExistenteId(valoracionData.id);
          setFormulario(prev => ({
            ...prev,
            importe_sin_iva: valoracionData.importe_sin_iva || undefined,
            porcentaje_iva: valoracionData.porcentaje_iva?.toString() as '0' | '4' | '10' | '21' | '' || '',
            importe_con_iva: valoracionData.importe_con_iva || 0
          }));
        }
      }
    } catch (error) {
      console.error("Error cargando incidencia:", error);
      alert("Error al cargar la incidencia");
      router.push(`/incidencias/${incidenciaId}/chat-proveedor`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validaciones
    if (!formulario.solucion_aplicada.trim()) {
      alert("La solución aplicada es obligatoria");
      return;
    }

    if (!formulario.fecha_realizacion) {
      alert("La fecha de realización es obligatoria");
      return;
    }

    if (formulario.importe_sin_iva && !formulario.porcentaje_iva) {
      alert("Si introduces un importe, debes seleccionar el porcentaje de IVA");
      return;
    }

    if (formulario.importe_sin_iva && formulario.porcentaje_iva && !formulario.documento_justificativo) {
      alert("El documento justificativo es obligatorio cuando se proporciona una valoración económica");
      return;
    }

    try {
      setEnviando(true);

      // Obtener datos del usuario actual y proveedor caso en paralelo
      const [{ data: userData }, casoActivo] = await Promise.all([
        supabase.auth.getUser(),
        Promise.resolve(incidencia?.proveedor_casos?.find(pc => pc.activo))
      ]);

      const userEmail = userData.user?.email;

      // Obtener personaId y proveedorCasoId en paralelo
      const [personaData, proveedorCasoId] = await Promise.all([
        userEmail ? supabase.from("personas").select("id").eq("email", userEmail).maybeSingle() : Promise.resolve({ data: null }),
        casoActivo ? obtenerProveedorCasoId(incidenciaId, casoActivo.proveedor_id) : Promise.resolve(null)
      ]);

      const personaId = personaData.data?.id || null;

      // 1. CREAR O ACTUALIZAR RESOLUCIÓN TÉCNICA
      let resolucionTecnica;
      if (modoEdicion && resolucionExistenteId) {
        // Modo edición: UPDATE
        const { data, error: errorResolucion } = await supabase
          .from("resoluciones_tecnicas")
          .update({
            solucion_aplicada: formulario.solucion_aplicada,
            fecha_realizacion: formulario.fecha_realizacion
          })
          .eq("id", resolucionExistenteId)
          .select()
          .single();

        if (errorResolucion) throw errorResolucion;
        resolucionTecnica = data;
      } else {
        // Modo creación: INSERT
        const { data, error: errorResolucion } = await supabase
          .from("resoluciones_tecnicas")
          .insert({
            incidencia_id: incidenciaId,
            proveedor_caso_id: proveedorCasoId,
            solucion_aplicada: formulario.solucion_aplicada,
            fecha_realizacion: formulario.fecha_realizacion,
            creado_por: personaId
          })
          .select()
          .single();

        if (errorResolucion) throw errorResolucion;
        resolucionTecnica = data;
      }

      // 2. CREAR O ACTUALIZAR VALORACIÓN ECONÓMICA (si se proporcionó)
      let valoracionEconomica = null;
      if (formulario.importe_sin_iva && formulario.porcentaje_iva) {
        if (valoracionExistenteId) {
          // Modo edición: UPDATE
          const { data: valoracion, error: errorValoracion } = await supabase
            .from("valoraciones_economicas")
            .update({
              importe_sin_iva: formulario.importe_sin_iva,
              porcentaje_iva: parseInt(formulario.porcentaje_iva),
              importe_con_iva: formulario.importe_con_iva
            })
            .eq("id", valoracionExistenteId)
            .select()
            .single();

          if (errorValoracion) throw errorValoracion;
          valoracionEconomica = valoracion;
        } else {
          // Modo creación: INSERT
          const { data: valoracion, error: errorValoracion } = await supabase
            .from("valoraciones_economicas")
            .insert({
              incidencia_id: incidenciaId,
              proveedor_caso_id: proveedorCasoId,
              resolucion_tecnica_id: resolucionTecnica.id,
              importe_sin_iva: formulario.importe_sin_iva,
              porcentaje_iva: parseInt(formulario.porcentaje_iva),
              importe_con_iva: formulario.importe_con_iva,
              creado_por: personaId
            })
            .select()
            .single();

          if (errorValoracion) throw errorValoracion;
          valoracionEconomica = valoracion;
        }
      } else if (valoracionExistenteId) {
        // Si existía una valoración pero ahora se quitó, eliminarla
        await supabase
          .from("valoraciones_economicas")
          .delete()
          .eq("id", valoracionExistenteId);
      }

      // 3. CREAR COMENTARIOS (SIEMPRE SE CREAN NUEVOS PARA MANTENER HISTORIAL)

      // Comentario 1: Resolución Técnica
      const accion = modoEdicion ? 'EDITADA' : 'CREADA';
      const mensajeResolucionTecnica = `RESOLUCIÓN TÉCNICA ${accion}

Solución aplicada: ${formulario.solucion_aplicada}
Fecha de realización: ${new Date(formulario.fecha_realizacion).toLocaleDateString('es-ES')}${
  formulario.imagenes_evidencia.length > 0 ? `\nImágenes de evidencia: ${formulario.imagenes_evidencia.length} archivo(s)` : ''
}${
  formulario.documento_parte_trabajo ? `\nParte de trabajo adjunto` : ''
}`;

      const { data: comentarioTecnico } = await supabase.from("comentarios").insert({
        incidencia_id: incidenciaId,
        ambito: 'proveedor',
        autor_id: personaId,
        autor_email: userEmail,
        autor_rol: 'Control',
        cuerpo: mensajeResolucionTecnica,
        es_sistema: false
      }).select().single();

      // Comentario 2: Valoración Económica (si existe)
      let comentarioValoracion = null;
      if (valoracionEconomica) {
        const mensajeValoracion = `VALORACIÓN ECONÓMICA ${accion}

Importe sin IVA: ${formulario.importe_sin_iva?.toFixed(2)}€
IVA (${formulario.porcentaje_iva}%): ${((formulario.importe_con_iva - (formulario.importe_sin_iva || 0))).toFixed(2)}€
Importe total con IVA: ${formulario.importe_con_iva.toFixed(2)}€${
  formulario.documento_justificativo ? `\nDocumento justificativo adjunto` : ''
}`;

        const { data: comentarioVal } = await supabase.from("comentarios").insert({
          incidencia_id: incidenciaId,
          ambito: 'proveedor',
          autor_id: personaId,
          autor_email: userEmail,
          autor_rol: 'Control',
          cuerpo: mensajeValoracion,
          es_sistema: false
        }).select().single();

        comentarioValoracion = comentarioVal;
      }

      // 4. SUBIR ARCHIVOS Y VINCULARLOS DIRECTAMENTE A LOS COMENTARIOS

      // Subir imágenes de evidencia
      if (comentarioTecnico && formulario.imagenes_evidencia.length > 0) {
        const imagenesAdjuntos = await Promise.all(
          formulario.imagenes_evidencia.map(async (imagen) => {
            const safeName = limpiarNombreArchivo(imagen.name);
            const path = `incidencias/${incidencia?.num_solicitud}/resolucion/${Date.now()}_${safeName}`;

            const { data: storageData, error: storageError } = await supabase.storage
              .from("incidencias")
              .upload(path, imagen, { upsert: false });

            if (storageError) throw storageError;

            return {
              incidencia_id: incidenciaId,
              comentario_id: comentarioTecnico.id,
              resolucion_tecnica_id: resolucionTecnica.id,
              tipo: "imagen",
              categoria: "imagen_evidencia",
              storage_key: storageData.path,
              nombre_archivo: imagen.name,
              visible_proveedor: true
            };
          })
        );

        await supabase.from("adjuntos").insert(imagenesAdjuntos);
      }

      // Subir documento parte de trabajo
      if (comentarioTecnico && formulario.documento_parte_trabajo) {
        const safeName = limpiarNombreArchivo(formulario.documento_parte_trabajo.name);
        const path = `incidencias/${incidencia?.num_solicitud}/resolucion/parte_trabajo_${Date.now()}_${safeName}`;

        const { data: storageData, error: storageError } = await supabase.storage
          .from("incidencias")
          .upload(path, formulario.documento_parte_trabajo, { upsert: false });

        if (storageError) throw storageError;

        await supabase.from("adjuntos").insert({
          incidencia_id: incidenciaId,
          comentario_id: comentarioTecnico.id,
          resolucion_tecnica_id: resolucionTecnica.id,
          tipo: "documento",
          categoria: "parte_trabajo",
          storage_key: storageData.path,
          nombre_archivo: formulario.documento_parte_trabajo.name,
          visible_proveedor: true
        });
      }

      // Subir documento justificativo
      if (comentarioValoracion && formulario.documento_justificativo && valoracionEconomica) {
        const safeName = limpiarNombreArchivo(formulario.documento_justificativo.name);
        const path = `incidencias/${incidencia?.num_solicitud}/valoracion/justificante_${Date.now()}_${safeName}`;

        const { data: storageData, error: storageError } = await supabase.storage
          .from("incidencias")
          .upload(path, formulario.documento_justificativo, { upsert: false });

        if (storageError) throw storageError;

        // Crear adjunto y obtener su ID
        const { data: adjuntoCreado, error: adjuntoError } = await supabase.from("adjuntos").insert({
          incidencia_id: incidenciaId,
          comentario_id: comentarioValoracion.id,
          valoracion_economica_id: valoracionEconomica.id,
          tipo: "documento",
          categoria: "justificante_economico",
          storage_key: storageData.path,
          nombre_archivo: formulario.documento_justificativo.name,
          visible_proveedor: true
        }).select().single();

        if (adjuntoError) throw adjuntoError;

        // Actualizar valoración económica con el ID del adjunto
        if (adjuntoCreado) {
          await supabase
            .from("valoraciones_economicas")
            .update({ documento_adjunto_id: adjuntoCreado.id })
            .eq("id", valoracionEconomica.id);
        }
      }

      // 7. ACTUALIZAR ESTADOS A "CERRADA" (SOLO EN MODO CREACIÓN)
      if (!modoEdicion) {
        // Obtener estados actuales para el historial
        const { data: incidenciaActual, error: errorIncidenciaActual } = await supabase
          .from("incidencias")
          .select("estado_cliente")
          .eq("id", incidenciaId)
          .single();

        if (errorIncidenciaActual) {
          console.error("Error obteniendo estado actual:", errorIncidenciaActual);
        }

        let estadoProveedorAnterior = null;
        if (proveedorCasoId) {
          const { data: casoActual } = await supabase
            .from("proveedor_casos")
            .select("estado_proveedor")
            .eq("id", proveedorCasoId)
            .single();
          estadoProveedorAnterior = casoActual?.estado_proveedor || null;
        }

        const motivo = "Resolución manual por parte de Control";

        // Actualizar estado_cliente a "Cerrada"
        const { error: errorUpdateCliente } = await supabase
          .from("incidencias")
          .update({
            estado_cliente: 'Cerrada'
          })
          .eq("id", incidenciaId);

        if (errorUpdateCliente) {
          console.error("Error actualizando estado_cliente:", errorUpdateCliente);
          throw new Error("No se pudo actualizar el estado del cliente: " + errorUpdateCliente.message);
        }

        // Actualizar estado_proveedor a "Cerrada" y mes_cierre
        if (proveedorCasoId) {
          const fechaCierre = new Date();
          const mesCierre = fechaCierre.toLocaleDateString('es-ES', { month: 'long' });
          const { error: errorUpdateProveedor } = await supabase
            .from("proveedor_casos")
            .update({
              estado_proveedor: 'Cerrada',
              actualizado_en: fechaCierre.toISOString(),
              mes_cierre: mesCierre
            })
            .eq("id", proveedorCasoId);

          if (errorUpdateProveedor) {
            console.error("Error actualizando estado_proveedor:", errorUpdateProveedor);
          }
        }

        // Registrar cambios en el historial (en paralelo)
        const operacionesHistorial = [
          registrarCambioEstado({
            incidenciaId,
            tipoEstado: 'cliente',
            estadoAnterior: incidenciaActual?.estado_cliente || null,
            estadoNuevo: 'Cerrada',
            autorId: personaId || undefined,
            motivo
          })
        ];

        if (proveedorCasoId) {
          operacionesHistorial.push(
            registrarCambioEstado({
              incidenciaId,
              tipoEstado: 'proveedor',
              estadoAnterior: estadoProveedorAnterior,
              estadoNuevo: 'Cerrada',
              autorId: personaId || undefined,
              motivo
            })
          );
        }

        await Promise.all(operacionesHistorial);
      }

      // Redirigir directamente sin alert
      router.push(`/incidencias/${incidenciaId}/chat-proveedor`);

    } catch (error) {
      console.error("Error al resolver incidencia:", error);
      alert("Error al resolver la incidencia: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setEnviando(false);
    }
  };

  // Función auxiliar para limpiar nombres de archivo
  const limpiarNombreArchivo = (nombre: string): string => {
    // Eliminar caracteres especiales y acentos, mantener solo alfanuméricos, puntos, guiones y guiones bajos
    return nombre
      .normalize("NFD") // Descomponer caracteres acentuados
      .replace(/[\u0300-\u036f]/g, "") // Eliminar marcas de acento
      .replace(/[^a-zA-Z0-9._-]/g, "_") // Reemplazar caracteres especiales por guión bajo
      .replace(/_{2,}/g, "_") // Reemplazar múltiples guiones bajos por uno solo
      .substring(0, 100); // Limitar longitud a 100 caracteres
  };

  // Función auxiliar para obtener el ID del proveedor_caso
  const obtenerProveedorCasoId = async (incidenciaId: string, proveedorId: string): Promise<string | null> => {
    const { data, error } = await supabase
      .from("proveedor_casos")
      .select("id")
      .eq("incidencia_id", incidenciaId)
      .eq("proveedor_id", proveedorId)
      .eq("activo", true)
      .maybeSingle();

    if (error) {
      console.error("Error obteniendo proveedor_caso:", error);
      return null;
    }

    return data?.id || null;
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: PALETA.bg }}>
        <div className="text-white">Cargando...</div>
      </div>
    );
  }

  if (!incidencia) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: PALETA.bg }}>
        <div className="text-white">Incidencia no encontrada</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: PALETA.bg }}>
      {/* Header */}
      <div className="flex justify-between items-center p-6">
        <button
          onClick={() => router.push(`/incidencias/${incidenciaId}/chat-proveedor`)}
          className="text-white text-sm hover:underline"
        >
          ← Volver al chat proveedor
        </button>
      </div>

      {/* Contenido */}
      <div className="px-6 pb-6 max-w-4xl mx-auto">
        {/* Título */}
        <div className="mb-12 text-center">
          <h2 className="text-lg font-semibold text-white mb-1 tracking-wider">
            {modoEdicion ? 'EDITAR RESOLUCIÓN' : 'RESOLVER COMO PROVEEDOR'}
          </h2>
          <p className="text-sm text-white opacity-80">
            #{incidencia.num_solicitud}
          </p>
          {(() => {
            const casoActivo = incidencia.proveedor_casos?.find(pc => pc.activo);
            if (casoActivo?.proveedor) {
              const nombreProveedor = Array.isArray(casoActivo.proveedor)
                ? casoActivo.proveedor[0]?.nombre
                : casoActivo.proveedor.nombre;
              return (
                <p className="text-sm text-white opacity-70 mt-1">
                  {nombreProveedor}
                </p>
              );
            }
            return null;
          })()}
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Sección: Resolución Técnica */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div
              className="mb-4 pb-3 border-b-2"
              style={{ borderColor: PALETA.verdeClaro }}
            >
              <h2 className="text-lg font-semibold" style={{ color: PALETA.textoOscuro }}>
                RESOLUCIÓN TÉCNICA
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Información sobre cómo se resolvió la incidencia
              </p>
            </div>

            <div className="space-y-4">
              {/* Solución aplicada */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                  Solución aplicada *
                </label>
                <textarea
                  value={formulario.solucion_aplicada}
                  onChange={(e) => setFormulario(prev => ({ ...prev, solucion_aplicada: e.target.value }))}
                  placeholder="Describa la solución aplicada"
                  className="w-full h-32 p-3 border rounded resize-none focus:outline-none text-sm placeholder:text-gray-500"
                  onFocus={(e) => e.target.style.boxShadow = `0 0 0 2px ${PALETA.verdeClaro}80`}
                  onBlur={(e) => e.target.style.boxShadow = ''}
                  required
                />
              </div>

              {/* Fecha de realización */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                  Fecha de realización del trabajo *
                </label>
                <input
                  type="date"
                  value={formulario.fecha_realizacion}
                  onChange={(e) => setFormulario(prev => ({ ...prev, fecha_realizacion: e.target.value }))}
                  className="w-full p-2 border rounded outline-none text-sm focus:ring-2 focus:ring-[#C9D7A7]"
                  style={{
                    colorScheme: 'light',
                    color: formulario.fecha_realizacion ? '#000000' : '#6b7280'
                  }}
                  max={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>

              {/* Imágenes evidencia */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                  Imágenes de evidencia
                </label>
                <div>
                  <input
                    id="file-input-imagenes"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setFormulario(prev => ({
                        ...prev,
                        imagenes_evidencia: [...prev.imagenes_evidencia, ...files]
                      }));
                    }}
                    className="hidden"
                  />
                  <label
                    htmlFor="file-input-imagenes"
                    className="inline-block px-3 py-2 rounded text-sm font-medium cursor-pointer transition-all"
                    style={{ backgroundColor: '#C9D7A7', color: '#4b4b4b' }}
                    onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(0.95)'}
                    onMouseLeave={(e) => e.currentTarget.style.filter = 'brightness(1)'}
                  >
                    Seleccionar imágenes
                  </label>
                </div>
                {formulario.imagenes_evidencia.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {formulario.imagenes_evidencia.map((file, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded border border-gray-300">
                        <img
                          src={URL.createObjectURL(file)}
                          alt="Vista previa"
                          className="w-16 h-16 object-cover rounded border border-gray-300"
                        />
                        <div className="flex-1">
                          <p className="text-sm text-gray-700">{file.name}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {(file.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFormulario(prev => ({
                            ...prev,
                            imagenes_evidencia: prev.imagenes_evidencia.filter((_, i) => i !== index)
                          }))}
                          className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors text-xs"
                          title="Quitar imagen"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Documento parte de trabajo */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                  Documento parte de trabajo
                </label>
                {!formulario.documento_parte_trabajo ? (
                  <div>
                    <input
                      id="file-input-parte-trabajo"
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => setFormulario(prev => ({
                        ...prev,
                        documento_parte_trabajo: e.target.files?.[0] || null
                      }))}
                      className="hidden"
                    />
                    <label
                      htmlFor="file-input-parte-trabajo"
                      className="inline-block px-3 py-2 rounded text-sm font-medium cursor-pointer transition-all"
                      style={{ backgroundColor: '#C9D7A7', color: '#4b4b4b' }}
                      onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(0.95)'}
                      onMouseLeave={(e) => e.currentTarget.style.filter = 'brightness(1)'}
                    >
                      Seleccionar documento
                    </label>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded border border-gray-300">
                    <div className="flex-1">
                      <p className="text-sm text-gray-700">{formulario.documento_parte_trabajo.name}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {(formulario.documento_parte_trabajo.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormulario(prev => ({ ...prev, documento_parte_trabajo: null }))}
                      className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors text-xs"
                      title="Quitar documento"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sección: Valoración Económica */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div
              className="mb-4 pb-3 border-b-2"
              style={{ borderColor: PALETA.verdeClaro }}
            >
              <h2 className="text-lg font-semibold" style={{ color: PALETA.textoOscuro }}>
                VALORACIÓN ECONÓMICA
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Coste del servicio prestado
              </p>
            </div>

            <div className="space-y-4">
              {/* Importe sin IVA */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                  Importe sin IVA (€) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formulario.importe_sin_iva || ''}
                  onChange={(e) => setFormulario(prev => ({
                    ...prev,
                    importe_sin_iva: e.target.value ? parseFloat(e.target.value) : undefined
                  }))}
                  placeholder="0.00"
                  className="w-full h-8 px-3 border rounded focus:outline-none text-sm placeholder:text-gray-500"
                  onFocus={(e) => e.target.style.boxShadow = `0 0 0 2px ${PALETA.verdeClaro}80`}
                  onBlur={(e) => e.target.style.boxShadow = ''}
                  required
                />
              </div>

              {/* Porcentaje IVA */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                  Porcentaje de IVA (%) *
                </label>
                <SearchableSelect
                  value={formulario.porcentaje_iva}
                  onChange={(value) => setFormulario(prev => ({
                    ...prev,
                    porcentaje_iva: value as '0' | '4' | '10' | '21' | ''
                  }))}
                  placeholder="Seleccione"
                  options={[
                    { value: "0", label: "0% - Exento" },
                    { value: "4", label: "4% - Tipo super reducido" },
                    { value: "10", label: "10% - Tipo reducido" },
                    { value: "21", label: "21% - Tipo general" }
                  ]}
                  className="w-full"
                  focusColor="#C9D7A7"
                />
              </div>

              {/* Importe con IVA (calculado) */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                  Importe con IVA (€)
                </label>
                <div
                  className="w-full h-8 px-3 border rounded text-sm flex items-center"
                  style={{
                    backgroundColor: '#ffffff',
                    color: PALETA.textoOscuro
                  }}
                >
                  {formulario.importe_con_iva > 0
                    ? formulario.importe_con_iva.toFixed(2)
                    : '0.00'
                  }
                </div>
              </div>

              {/* Documento justificativo */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                  Documento justificativo *
                </label>
                {!formulario.documento_justificativo ? (
                  <div>
                    <input
                      id="file-input-justificativo"
                      type="file"
                      accept=".pdf"
                      onChange={(e) => setFormulario(prev => ({
                        ...prev,
                        documento_justificativo: e.target.files?.[0] || null
                      }))}
                      className="hidden"
                    />
                    <label
                      htmlFor="file-input-justificativo"
                      className="inline-block px-3 py-2 rounded text-sm font-medium cursor-pointer transition-all"
                      style={{ backgroundColor: '#C9D7A7', color: '#4b4b4b' }}
                      onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(0.95)'}
                      onMouseLeave={(e) => e.currentTarget.style.filter = 'brightness(1)'}
                    >
                      Seleccionar documento
                    </label>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded border border-gray-300">
                    <div className="flex-1">
                      <p className="text-sm text-gray-700">{formulario.documento_justificativo.name}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {(formulario.documento_justificativo.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormulario(prev => ({ ...prev, documento_justificativo: null }))}
                      className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors text-xs"
                      title="Quitar documento"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => router.push(`/incidencias/${incidenciaId}/chat-proveedor`)}
              className="px-4 py-2 text-sm rounded transition-colors hover:brightness-95"
              style={{ backgroundColor: PALETA.verdeClaro, color: PALETA.textoOscuro }}
              disabled={enviando}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={
                enviando ||
                !formulario.solucion_aplicada.trim() ||
                !formulario.fecha_realizacion.trim() ||
                (!!formulario.importe_sin_iva && !formulario.porcentaje_iva) ||
                (!!formulario.importe_sin_iva && !!formulario.porcentaje_iva && !formulario.documento_justificativo)
              }
              className="px-6 py-2 text-sm rounded hover:brightness-95 transition-colors disabled:opacity-50"
              style={{ backgroundColor: PALETA.verdeClaro, color: PALETA.textoOscuro }}
            >
              {enviando ? (modoEdicion ? 'Guardando sus cambios...' : 'Cerrando su incidencia...') : (modoEdicion ? 'Guardar cambios' : 'Cerrar incidencia')}
            </button>
          </div>
        </form>
      </div>

      {/* Overlay de carga */}
      {enviando && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 shadow-2xl flex flex-col items-center gap-4">
            <div className="w-16 h-16 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${PALETA.verdeClaro} ${PALETA.verdeClaro} transparent ${PALETA.verdeClaro}` }}></div>
            <p className="text-lg font-medium" style={{ color: PALETA.textoOscuro }}>
              {modoEdicion ? 'Guardando sus cambios...' : 'Guardando su resolución...'}
            </p>
            <p className="text-sm text-gray-500">Por favor, no cierre esta ventana</p>
          </div>
        </div>
      )}
    </div>
  );
}
