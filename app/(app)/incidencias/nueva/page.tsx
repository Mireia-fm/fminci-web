"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { PALETA } from "@/lib/theme";
import { useAuth } from "@/contexts/AuthContext";
import SearchableSelect from "@/components/SearchableSelect";

// Tipos
type Opcion = { value: string; label: string };
type CentroRow = { id: string; nombre: string; tipo?: string };
type CatalogacionRow = { id: string; nombre: string };

export default function NuevaIncidenciaPage() {
  const router = useRouter();
  const { perfil, loading: loadingAuth } = useAuth();

  // Campos del formulario
  const [fecha, setFecha] = useState<string>("");
  const [hora, setHora] = useState<string>("");
  const [nombre, setNombre] = useState<string>("");
  const [nombreAsignado, setNombreAsignado] = useState<boolean>(false);
  const [centroAsignado, setCentroAsignado] = useState<boolean>(false);
  const [email, setEmail] = useState<string>("");

  const [centro, setCentro] = useState<string>("");            // UUID de instituciones.id
  const [catalogacion, setCatalogacion] = useState<string>(""); // Texto (o id si prefieres)
  const [prioridad, setPrioridad] = useState<string>("");
  const [descripcion, setDescripcion] = useState<string>("");

  const [imagen, setImagen] = useState<File | null>(null);

  const [opcionesCentros, setOpcionesCentros] = useState<Opcion[]>([]);
  const [opcionesCatalogacion, setOpcionesCatalogacion] = useState<Opcion[]>([]);
  const opcionesPrioridad: Opcion[] = [
    { value: "", label: "Seleccione la prioridad" },
    { value: "Urgente", label: "Urgente" },
    { value: "Crítico", label: "Crítico" },
    { value: "Normal", label: "Normal" },
  ];

  const [enviando, setEnviando] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [incidenciaCreada, setIncidenciaCreada] = useState<{id: string; num_solicitud: string} | null>(null);


  // Fecha & hora (solo visual) → readonly
  useEffect(() => {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    // Formato ISO para la base de datos (YYYY-MM-DD)
    setFecha(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
    setHora(`${pad(now.getHours())}:${pad(now.getMinutes())}`);
  }, []);

  // Email y nombre desde el perfil
  useEffect(() => {
    if (!loadingAuth && perfil) {
      setEmail(perfil.email);

      (async () => {
        // Obtener nombre de la persona
        const { data: persona } = await supabase
          .from("personas")
          .select("nombre")
          .eq("id", perfil.persona_id)
          .maybeSingle();

        if (persona?.nombre && persona.nombre.trim() !== "") {
          setNombre(persona.nombre);
          setNombreAsignado(true);
        }

        // Usar instituciones desde perfil (ya cargadas en AuthContext)
        const centrosAsignados = perfil.instituciones?.filter(inst => inst.tipo === "Centro") || [];

        // Lógica para el campo centro
        if (perfil.acceso_todos_centros) {
          // Si acceso_todos_centros es TRUE, mostrar lista para seleccionar
          setCentroAsignado(false);
        } else if (centrosAsignados.length === 1) {
          // Si tiene exactamente 1 centro, preseleccionarlo y hacerlo readonly
          const centroUnico = centrosAsignados[0];
          setCentro(centroUnico.institucion_id);
          setCentroAsignado(true);
        } else {
          // Si tiene 0 o múltiples centros, mostrar lista para seleccionar
          setCentroAsignado(false);
        }
      })();
    }
  }, [loadingAuth, perfil]);

  // Cargar opciones Centros + Catalogaciones
  useEffect(() => {
    if (!loadingAuth && !perfil) {
      setErrorMsg("No se pudo obtener el perfil del usuario.");
      setLoading(false);
      return;
    }

    if (!perfil) return;

    (async () => {
      let centrosPermitidos: CentroRow[] = [];

      if (perfil.acceso_todos_centros) {
        // Si tiene acceso a todos los centros, mostrar todos
        const { data: cData, error: cErr } = await supabase
          .from("instituciones")
          .select("id, nombre, tipo")
          .eq("tipo", "Centro")
          .order("nombre");

        if (!cErr && cData) {
          centrosPermitidos = (cData ?? []) as CentroRow[];
        } else if (cErr) {
          console.error("Error Centros:", cErr);
          setErrorMsg("No se pudieron cargar los centros.");
          return;
        }
      } else {
        // Usar instituciones ya cargadas desde AuthContext
        centrosPermitidos = (perfil.instituciones || [])
          .filter(inst => inst.tipo === "Centro")
          .map(inst => ({
            id: inst.institucion_id,
            nombre: inst.nombre,
            tipo: inst.tipo
          }))
          .sort((a, b) => a.nombre.localeCompare(b.nombre));
      }

      // Configurar opciones de centros
      setOpcionesCentros([
        { value: "", label: "Seleccione un centro" },
        ...centrosPermitidos.map((c) => ({ value: c.id, label: c.nombre })),
      ]);

      // Catalogaciones
      const { data: catData, error: catErr } = await supabase
        .from("catalogaciones")
        .select("id, nombre")
        .order("nombre");

      if (!catErr && catData) {
        const filas: CatalogacionRow[] = (catData ?? []) as CatalogacionRow[];
        setOpcionesCatalogacion([
          { value: "", label: "Seleccione una catalogación" },
          // Guardamos texto en incidencias.catalogacion:
          ...filas.map((x) => ({ value: x.nombre, label: x.nombre })),
        ]);
      } else if (catErr) {
        console.error("Error Catalogaciones:", catErr);
        setErrorMsg("No se pudieron cargar las catalogaciones.");
      }

      // Indicar que la carga ha terminado
      setLoading(false);
    })();
  }, [loadingAuth, perfil]);


  // Validación: Imagen es OPCIONAL
  const faltanObligatorios = useMemo(() => {
    return !(
      (nombreAsignado ? true : Boolean(nombre)) &&
      centro &&
      catalogacion &&
      prioridad &&
      descripcion
    );
  }, [nombre, nombreAsignado, centro, catalogacion, prioridad, descripcion]);

  // Subida de imagen principal después de crear la incidencia
  async function subirImagenPrincipal(file: File, numSolicitud: string): Promise<string | null> {
    if (!file) return null;
    // Nueva estructura: incidencias/{num_solicitud}/{filename}
    const safeName = file.name.replace(/\s+/g, "_");
    const path = `incidencias/${numSolicitud}/${Date.now()}_${safeName}`;

    const { data, error } = await supabase.storage
      .from("incidencias")
      .upload(path, file, { upsert: false });

    if (error) throw error;

    // Devolver el path para la base de datos
    return data.path;
  }

  // Envío real: INSERT en incidencias
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (faltanObligatorios || enviando) return;

    try {
      setEnviando(true);

      // Debugging: verificar estado de autenticación
      const { data: userData } = await supabase.auth.getUser();
      console.log("Usuario autenticado:", userData.user?.email);
      console.log("Token presente:", !!userData.user);

      // 1) INSERT sin imagen primero (num_solicitud se genera automáticamente)
      const { data, error } = await supabase
        .from("incidencias")
        .insert({
          institucion_id: centro,               // UUID seleccionado
          catalogacion: catalogacion,          // texto
          prioridad: prioridad,         // enum prioridad_incidencia
          descripcion: descripcion,
          nombre_solicitante: nombre || null,
          fecha: fecha,
          hora: hora,
          email: email || null,
          imagen_url: null,                    // null inicialmente
          estado_cliente: "Abierta",           // enum estado_cliente
          // Si tu tabla aún usa 'centro' texto en lugar de FK, añade también:
          centro: opcionesCentros.find(o => o.value===centro)?.label ?? null,
        })
        .select("id, num_solicitud")           // recuperamos id y número generado automáticamente
        .single();

      if (error) {
        console.error("Error INSERT incidencia:", error);
        setErrorMsg(error.message ?? "Error al crear la incidencia.");
        setEnviando(false);
        return;
      }

      // 2) Subir imagen si existe y actualizar el registro
      let imagenUrl = null;
      if (imagen) {
        try {
          imagenUrl = await subirImagenPrincipal(imagen, data.num_solicitud);

          // Actualizar el registro con la URL de la imagen
          const { error: updateError } = await supabase
            .from("incidencias")
            .update({ imagen_url: imagenUrl })
            .eq("id", data.id);

          if (updateError) {
            console.error("Error actualizando imagen_url:", updateError);
            // No fallar la creación por esto, solo logear el error
          }

          // Crear registro en tabla adjuntos
          const { error: adjuntoError } = await supabase
            .from("adjuntos")
            .insert({
              incidencia_id: data.id,
              tipo: "imagen_principal",
              categoria: "imagen_principal",
              storage_key: imagenUrl,
              nombre_archivo: imagen.name,
              visible_proveedor: true
            });

          if (adjuntoError) {
            console.error("Error creando registro en adjuntos:", adjuntoError);
            // No fallar la creación por esto, solo logear el error
          }
        } catch (imagenError) {
          console.error("Error subiendo imagen:", imagenError);
          // No fallar la creación por esto
        }
      }

      // 3) Mostrar el número de solicitud generado
      setIncidenciaCreada({
        id: data.id,
        num_solicitud: data.num_solicitud
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(err);
      setErrorMsg(msg || "Error al crear la incidencia.");
    } finally {
      setEnviando(false);
    }
  };

  // Estilos
  const inputBase =
    "w-full h-9 rounded border px-3 text-sm outline-none focus:ring-2 focus:ring-[#C9D7A7] placeholder:text-gray-500";
  const textAreaBase =
    "min-h-[120px] w-full rounded border p-3 text-sm outline-none focus:ring-2 focus:ring-[#C9D7A7] placeholder:text-gray-500";

  // Si la incidencia fue creada exitosamente, mostrar pantalla de éxito
  if (incidenciaCreada) {
    return (
      <div className="min-h-screen w-full py-12" style={{ backgroundColor: PALETA.bg }}>
        <div
          className="mx-auto w-full max-w-2xl rounded-lg p-8 shadow text-center"
          style={{ backgroundColor: PALETA.card }}
        >
          <div className="mb-6">
            <div
              className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4"
              style={{ backgroundColor: "#C9D7A7" }}
            >
              <svg className="w-8 h-8" fill="none" stroke="#5D6D52" viewBox="0 0 24 24" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-3xl font-semibold mb-2" style={{ color: PALETA.headerTable }}>
              ¡Incidencia creada exitosamente!
            </h1>
            <p className="text-gray-600 mb-6">
              Tu incidencia ha sido registrada correctamente en el sistema.
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <h2 className="text-lg font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
              Número de solicitud asignado:
            </h2>
            <div className="text-2xl font-bold" style={{ color: PALETA.headerTable }}>
              #{incidenciaCreada.num_solicitud}
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Guarda este número para futuras consultas sobre tu incidencia.
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => router.push(`/incidencias/${incidenciaCreada.id}/chat-control-cliente`)}
              className="w-full rounded px-6 py-3 text-white font-medium"
              style={{ backgroundColor: PALETA.filtros }}
            >
              Ir al chat
            </button>
            <button
              onClick={() => router.push("/incidencias")}
              className="w-full rounded px-6 py-3 border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
            >
              Ver todas las incidencias
            </button>
            <button
              onClick={() => {
                setIncidenciaCreada(null);
                setDescripcion("");
                setCatalogacion("");
                setPrioridad("");
                setCentro("");
                setImagen(null);
                setErrorMsg("");
              }}
              className="w-full text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Crear otra incidencia
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full py-4" style={{ backgroundColor: PALETA.bg }}>
      {/* Botón volver atrás - arriba a la izquierda */}
      <div className="px-8 mb-4">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="flex items-center gap-1 text-sm text-white hover:underline transition-all"
        >
          <span className="text-lg">←</span>
          Volver
        </button>
      </div>

      <div
        className="mx-auto w-full max-w-3xl rounded-lg p-6 shadow"
        style={{ backgroundColor: PALETA.card }}
      >
        <h1 className="mb-6 text-center text-3xl font-semibold" style={{ color: PALETA.headerTable }}>
          Nueva incidencia
        </h1>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-600">Cargando...</div>
          </div>
        ) : (
          <>
            {errorMsg && (
          <div className="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          {/* Nombre / Email */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-gray-600">
                Nombre {nombreAsignado ? "" : <span className="text-red-500">*</span>}
              </label>
              <input
                className={inputBase}
                placeholder="Escriba su nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                readOnly={nombreAsignado}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-600">Email</label>
              <input className={inputBase} value={email} readOnly />
            </div>
          </div>

          {/* Centro */}
          <div>
            <label className="mb-1 block text-sm text-gray-600">
              Centro {centroAsignado ? "" : <span className="text-red-500">*</span>}
            </label>
            {centroAsignado ? (
              <input
                className={inputBase}
                value={opcionesCentros.find(o => o.value === centro)?.label || "Centro asignado"}
                readOnly
              />
            ) : (
              <SearchableSelect
                value={centro}
                onChange={setCentro}
                placeholder="Seleccione un centro"
                options={opcionesCentros.filter(o => o.value !== "")}
                className="w-full"
                focusColor="#C9D7A7"
              />
            )}
          </div>

          {/* Catalogación / Prioridad */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-gray-600">
                Catalogación <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                value={catalogacion}
                onChange={setCatalogacion}
                placeholder="Seleccione catalogación"
                options={opcionesCatalogacion.filter(o => o.value !== "")}
                className="w-full"
                focusColor="#C9D7A7"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-600">
                Prioridad <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                value={prioridad}
                onChange={setPrioridad}
                placeholder="Seleccione la prioridad"
                options={opcionesPrioridad.filter(o => o.value !== "")}
                className="w-full"
                focusColor="#C9D7A7"
              />
            </div>
          </div>

          {/* Imagen (OPCIONAL) + preview */}
          <div>
            <label className="mb-1 block text-sm text-gray-600">Imagen (opcional)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImagen(e.target.files?.[0] ?? null)}
              className="block w-full text-sm file:mr-4 file:rounded file:border-0 file:bg-[#C9D7A7] file:px-3 file:py-2 file:text-sm file:font-medium hover:file:brightness-95"
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="mb-1 block text-sm text-gray-600">
              Descripción <span className="text-red-500">*</span>
            </label>
            <textarea
              className={textAreaBase}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Describa brevemente la incidencia"
            />
          </div>

          {/* Botón enviar */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={faltanObligatorios || enviando}
              className="mx-auto block w-full max-w-sm rounded px-6 py-2 text-white disabled:opacity-60 transition-colors"
              style={{ backgroundColor: PALETA.filtros }}
            >
              {enviando ? "Enviando…" : "Enviar"}
            </button>
            <p className="mt-2 text-center text-xs" style={{ color: PALETA.textoOscuro }}>
              * Los campos marcados son obligatorios
            </p>
          </div>
        </form>
          </>
        )}
      </div>
    </div>
  );
}