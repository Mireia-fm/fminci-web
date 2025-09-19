"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { registrarCambiosEstado } from "@/lib/historialEstados";

// Paleta similar a la imagen de Wix
const PALETA = {
  fondo: "#5D6D52",
  headerTable: "#D9B6A9",
  card: "#F9FAF8",
  filtros: "#E8B5A8",
  texto: "#EDF0E9",
  textoOscuro: "#4b4b4b",
};

type Incidencia = {
  id: string;
  num_solicitud: string;
  fecha: string;
  estado_cliente: string;
  centro?: string;
  descripcion: string;
  catalogacion?: string;
  prioridad?: string;
  institucion_id?: string;
  instituciones?: {
    nombre: string;
  }[] | null;
  proveedor_casos?: {
    estado_proveedor: string;
    prioridad?: string;
    activo?: boolean;
  }[] | null;
};

type Proveedor = {
  id: string;
  nombre: string;
  tipo: string;
};

export default function IncidenciasListado() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [incidencias, setIncidencias] = useState<Incidencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroCentro, setFiltroCentro] = useState("");
  const [filtroNumero, setFiltroNumero] = useState("");
  const [filtroEstadoProveedor, setFiltroEstadoProveedor] = useState("");
  const [filtroFecha, setFiltroFecha] = useState("");
  const [filtroCatalogacion, setFiltroCatalogacion] = useState("");
  const [filtroPrioridadCliente, setFiltroPrioridadCliente] = useState("");
  const [filtroPrioridadProveedor, setFiltroPrioridadProveedor] = useState("");
  const [tipoUsuario, setTipoUsuario] = useState<string | null>(null);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [incidenciaSeleccionada, setIncidenciaSeleccionada] = useState<string | null>(null);
  const [tieneProveedorAsignado, setTieneProveedorAsignado] = useState(false);
  const [paginaActual, setPaginaActual] = useState(1);
  const incidenciasPorPagina = 20;
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [mostrarModalProveedor, setMostrarModalProveedor] = useState(false);
  const [formularioProveedor, setFormularioProveedor] = useState({
    proveedor_id: '',
    descripcion_proveedor: '',
    prioridad: 'No crítico' as 'Crítico' | 'No crítico',
    estado_proveedor: 'Abierta'
  });
  const [accionEnCurso, setAccionEnCurso] = useState<string | null>(null);
  const [centrosUnicos, setCentrosUnicos] = useState<string[]>([]);
  const [catalogacionesUnicas, setCatalogacionesUnicas] = useState<string[]>([]);

  // Manejar parámetros URL al cargar
  useEffect(() => {
    const filtroEstadoParam = searchParams.get('filtroEstado');
    if (filtroEstadoParam) {
      setFiltroEstado(filtroEstadoParam);
    }
    
    const filtroEstadoProveedorParam = searchParams.get('estado_proveedor');
    if (filtroEstadoProveedorParam) {
      setFiltroEstadoProveedor(filtroEstadoProveedorParam);
    }
  }, [searchParams]);

  // Cargar incidencias del usuario actual
  useEffect(() => {
    cargarIncidencias();
    cargarProveedores();
  }, []);

  const cargarIncidencias = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData.user?.email;

      if (!userEmail) {
        setLoading(false);
        return;
      }

      // Obtener tipo de usuario de la tabla personas
      const { data: persona, error: personaError } = await supabase
        .from("personas")
        .select("rol, id")
        .eq("email", userEmail)
        .maybeSingle();

      if (!personaError && persona) {
        setTipoUsuario(persona.rol);
      }

      let data, error;

      if (persona?.rol === "Proveedor") {
        // Para proveedores: obtener institución y mostrar TODAS las incidencias asignadas a esa institución
        const { data: personaInst } = await supabase
          .from("personas_instituciones")
          .select("institucion_id")
          .eq("persona_id", persona.id)
          .maybeSingle();

        if (!personaInst) {
          setLoading(false);
          return;
        }

        // Consulta para proveedores: mostrar todas las incidencias asignadas a la institución del proveedor
        const result = await supabase
          .from("incidencias")
          .select(`
            id,
            num_solicitud,
            fecha,
            estado_cliente,
            centro,
            descripcion,
            institucion_id,
            instituciones(nombre),
            proveedor_casos!inner(
              estado_proveedor,
              activo
            )
          `)
          .eq("proveedor_casos.proveedor_id", personaInst.institucion_id)
          .eq("proveedor_casos.activo", true)
          .order("fecha_creacion", { ascending: false });
        
        data = result.data;
        error = result.error;
      } else if (persona?.rol === "Control") {
        // Para Control: mostrar TODAS las incidencias del sistema
        const result = await supabase
          .from("incidencias")
          .select(`
            id,
            num_solicitud,
            fecha,
            estado_cliente,
            centro,
            descripcion,
            catalogacion,
            prioridad,
            institucion_id,
            email,
            instituciones(nombre),
            proveedor_casos(estado_proveedor, prioridad, activo)
          `)
          .order("fecha_creacion", { ascending: false });

        data = result.data;
        error = result.error;
      } else {
        // Para otros usuarios: mostrar todas las incidencias de su centro
        const { data: personaInstituciones } = await supabase
          .from("personas")
          .select(`
            id,
            personas_instituciones!inner(
              institucion_id,
              instituciones!inner(id, nombre, tipo)
            )
          `)
          .eq("email", userEmail);

        if (personaInstituciones && personaInstituciones.length > 0) {
          const institucionId = personaInstituciones[0].personas_instituciones?.[0]?.institucion_id;

          if (institucionId) {
            const result = await supabase
              .from("incidencias")
              .select(`
                id,
                num_solicitud,
                fecha,
                estado_cliente,
                centro,
                descripcion,
                catalogacion,
                prioridad,
                institucion_id,
                email,
                instituciones(nombre),
                proveedor_casos(estado_proveedor, prioridad, activo)
              `)
              .eq("institucion_id", institucionId)
              .order("fecha_creacion", { ascending: false });

            data = result.data;
            error = result.error;
          } else {
            data = [];
            error = null;
          }
        } else {
          data = [];
          error = null;
        }
      }

      if (error) {
        console.error("Error cargando incidencias:", error);
      } else {
        const incidenciasData = data || [];

        // Deduplicar incidencias por ID y agrupar casos de proveedor
        const incidenciasUnicas = incidenciasData.reduce((acc, current) => {
          const existing = acc.find(item => item.id === current.id);
          if (existing) {
            // Si ya existe, combinar los casos de proveedor
            if (current.proveedor_casos && current.proveedor_casos.length > 0) {
              existing.proveedor_casos = existing.proveedor_casos || [];
              current.proveedor_casos.forEach(caso => {
                if (!existing.proveedor_casos.some(existingCaso =>
                  existingCaso.estado_proveedor === caso.estado_proveedor &&
                  existingCaso.activo === caso.activo
                )) {
                  existing.proveedor_casos.push(caso);
                }
              });
            }
          } else {
            acc.push(current);
          }
          return acc;
        }, [] as Incidencia[]);

        setIncidencias(incidenciasUnicas);

        // Debug para proveedores
        if (persona?.rol === "Proveedor") {
          console.log("Incidencias cargadas para proveedor:", incidenciasUnicas.length);
          console.log("Muestra de incidencias:", incidenciasUnicas.slice(0, 2));
        }

        // Calcular centros únicos para mostrar/ocultar filtro de centro
        const centros = [...new Set(
          incidenciasUnicas
            .map(inc => inc.instituciones?.[0]?.nombre || inc.centro)
            .filter(Boolean)
        )].sort((a, b) => a.localeCompare(b));
        setCentrosUnicos(centros);

        // Calcular catalogaciones únicas
        const catalogaciones = [...new Set(
          incidenciasUnicas
            .map(inc => inc.catalogacion)
            .filter(Boolean)
        )];
        setCatalogacionesUnicas(catalogaciones);
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const cargarProveedores = async () => {
    try {
      const { data, error } = await supabase
        .from("instituciones")
        .select("id, nombre, tipo")
        .eq("tipo", "Proveedor")
        .eq("activo", true)
        .order("nombre");

      if (!error && data) {
        setProveedores(data);
      }
    } catch (error) {
      console.error("Error cargando proveedores:", error);
    }
  };

  const abrirModalProveedor = (incidenciaId: string) => {
    setIncidenciaSeleccionada(incidenciaId);

    // Obtener la descripción de la incidencia para pre-llenar el campo
    const incidencia = incidencias.find(inc => inc.id === incidenciaId);
    const descripcionIncidencia = incidencia?.descripcion || '';

    setFormularioProveedor({
      proveedor_id: '',
      descripcion_proveedor: descripcionIncidencia,
      prioridad: '',
      estado_proveedor: 'Abierta'
    });
    setMostrarModalProveedor(true);
  };

  const cerrarModalProveedor = () => {
    setMostrarModalProveedor(false);
    setIncidenciaSeleccionada(null);
    setFormularioProveedor({
      proveedor_id: '',
      descripcion_proveedor: '',
      prioridad: '',
      estado_proveedor: 'Abierta'
    });
  };

  const asignarProveedorCompleto = async () => {
    if (!incidenciaSeleccionada || !formularioProveedor.proveedor_id) {
      return;
    }

    try {
      setAccionEnCurso(incidenciaSeleccionada);

      // Obtener datos del usuario actual para asignado_por
      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData.user?.email;

      let asignadoPorId = null;
      if (userEmail) {
        const { data: persona } = await supabase
          .from("personas")
          .select("id")
          .eq("email", userEmail)
          .maybeSingle();
        asignadoPorId = persona?.id;
      }

      // Verificar si ya existe un caso activo para esta incidencia
      const { data: casoExistente } = await supabase
        .from("proveedor_casos")
        .select("id")
        .eq("incidencia_id", incidenciaSeleccionada)
        .eq("activo", true)
        .maybeSingle();

      if (casoExistente) {
        // Actualizar el caso existente
        const { error } = await supabase
          .from("proveedor_casos")
          .update({
            proveedor_id: formularioProveedor.proveedor_id,
            descripcion_proveedor: formularioProveedor.descripcion_proveedor,
            prioridad: formularioProveedor.prioridad,
            estado_proveedor: formularioProveedor.estado_proveedor,
            asignado_por: asignadoPorId,
            asignado_en: new Date().toISOString(),
            actualizado_en: new Date().toISOString()
          })
          .eq("id", casoExistente.id);

        if (error) {
          console.error("Error actualizando caso de proveedor:", error);
          throw error;
        }
      } else {
        // Crear nuevo caso en proveedor_casos
        const { error } = await supabase
          .from("proveedor_casos")
          .insert({
            incidencia_id: incidenciaSeleccionada,
            proveedor_id: formularioProveedor.proveedor_id,
            descripcion_proveedor: formularioProveedor.descripcion_proveedor,
            prioridad: formularioProveedor.prioridad,
            estado_proveedor: formularioProveedor.estado_proveedor,
            asignado_por: asignadoPorId,
            asignado_en: new Date().toISOString(),
            activo: true
          });

        if (error) {
          console.error("Error creando caso de proveedor:", error);
          throw error;
        }
      }

      // Obtener estado anterior del cliente y cambiar a "En tramitación"
      const { data: incidenciaAnterior } = await supabase
        .from("incidencias")
        .select("estado_cliente")
        .eq("id", incidenciaSeleccionada)
        .single();

      const estadoClienteAnterior = incidenciaAnterior?.estado_cliente || null;

      await supabase
        .from("incidencias")
        .update({ estado_cliente: 'En tramitación' })
        .eq("id", incidenciaSeleccionada);

      // Registrar cambios de estado en el historial
      const cambiosEstado = [
        {
          incidenciaId: incidenciaSeleccionada,
          tipoEstado: 'cliente' as const,
          estadoAnterior: estadoClienteAnterior,
          estadoNuevo: 'En tramitación',
          autorId: asignadoPorId,
          motivo: 'Asignación a proveedor',
          metadatos: {
            proveedor_id: formularioProveedor.proveedor_id,
            proveedor_nombre: proveedores.find(p => p.id === formularioProveedor.proveedor_id)?.nombre,
            prioridad: formularioProveedor.prioridad,
            accion: 'asignar_proveedor'
          }
        },
        {
          incidenciaId: incidenciaSeleccionada,
          tipoEstado: 'proveedor' as const,
          estadoAnterior: null,
          estadoNuevo: formularioProveedor.estado_proveedor,
          autorId: asignadoPorId,
          motivo: 'Asignación inicial',
          metadatos: {
            proveedor_id: formularioProveedor.proveedor_id,
            proveedor_nombre: proveedores.find(p => p.id === formularioProveedor.proveedor_id)?.nombre,
            prioridad: formularioProveedor.prioridad,
            descripcion_proveedor: formularioProveedor.descripcion_proveedor,
            accion: 'asignar_proveedor'
          }
        }
      ];

      await registrarCambiosEstado(cambiosEstado);

      // Crear comentario del sistema en el chat del cliente
      const proveedor = proveedores.find(p => p.id === formularioProveedor.proveedor_id);

      if (proveedor) {
        await supabase
          .from("comentarios")
          .insert({
            incidencia_id: incidenciaSeleccionada,
            ambito: 'cliente',
            autor_id: asignadoPorId,
            autor_email: userEmail,
            autor_rol: 'Control',
            cuerpo: `La incidencia ha sido asignada al proveedor ${proveedor.nombre}.`,
            es_sistema: true
          });
      }

      cerrarModalProveedor();
      setMostrarModal(false);
      cargarIncidencias();
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setAccionEnCurso(null);
    }
  };

  // Filtrar incidencias
  const incidenciasFiltradas = incidencias.filter((inc) => {
    // Para proveedores: usar filtroEstadoProveedor O filtroEstado (cualquiera que tenga valor)
    // Para otros usuarios: usar solo filtroEstado para estado_cliente
    const estadoAFiltrar = tipoUsuario === "Proveedor" ? (filtroEstadoProveedor || filtroEstado) : filtroEstado;

    // Debug para proveedores cuando hay filtro activo
    if (tipoUsuario === "Proveedor" && estadoAFiltrar) {
      console.log("Filtrando con estado:", estadoAFiltrar);
      console.log("Incidencia:", inc.num_solicitud, "Casos proveedor:", inc.proveedor_casos);
    }

    const coincideEstado = !estadoAFiltrar ||
      (tipoUsuario === "Proveedor" ?
        (inc.proveedor_casos && inc.proveedor_casos.some(pc => pc.activo && pc.estado_proveedor === estadoAFiltrar)) :
        inc.estado_cliente?.trim() === estadoAFiltrar?.trim()
      );

    const coincideCentro = !filtroCentro ||
      (inc.centro && inc.centro.toLowerCase().includes(filtroCentro.toLowerCase())) ||
      (inc.instituciones?.[0]?.nombre && inc.instituciones[0].nombre.toLowerCase().includes(filtroCentro.toLowerCase()));
    const coincideNumero = !filtroNumero ||
      inc.num_solicitud.toLowerCase().includes(filtroNumero.toLowerCase());
    const coincideEstadoProveedor = !filtroEstadoProveedor ||
      (inc.proveedor_casos && inc.proveedor_casos.some(pc => pc.activo && pc.estado_proveedor === filtroEstadoProveedor));
    const coincideFecha = !filtroFecha ||
      inc.fecha === filtroFecha;
    const coincideCatalogacion = !filtroCatalogacion ||
      inc.catalogacion === filtroCatalogacion;
    const coincidePrioridadCliente = !filtroPrioridadCliente ||
      inc.prioridad === filtroPrioridadCliente;
    const coincidePrioridadProveedor = !filtroPrioridadProveedor ||
      (inc.proveedor_casos && inc.proveedor_casos.some(pc => pc.activo && pc.prioridad === filtroPrioridadProveedor));

    // Para proveedores: no verificar filtroEstadoProveedor por separado si ya se verificó en coincideEstado
    const verificarEstadoProveedorSeparado = tipoUsuario !== "Proveedor" && filtroEstadoProveedor;

    return coincideEstado && coincideCentro && coincideNumero &&
           (!verificarEstadoProveedorSeparado || coincideEstadoProveedor) &&
           coincideFecha && coincideCatalogacion && coincidePrioridadCliente && coincidePrioridadProveedor;
  });

  // Calcular paginación
  const totalPaginas = Math.ceil(incidenciasFiltradas.length / incidenciasPorPagina);
  const indiceInicio = (paginaActual - 1) * incidenciasPorPagina;
  const indiceFin = indiceInicio + incidenciasPorPagina;
  const incidenciasPaginadas = incidenciasFiltradas.slice(indiceInicio, indiceFin);

  const limpiarFiltros = () => {
    setFiltroEstado("");
    setFiltroCentro("");
    setFiltroNumero("");
    setFiltroEstadoProveedor("");
    setFiltroFecha("");
    setFiltroCatalogacion("");
    setFiltroPrioridadCliente("");
    setFiltroPrioridadProveedor("");
    setPaginaActual(1); // Resetear a la primera página

    // Limpiar también los parámetros de URL
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('filtroEstado');
      url.searchParams.delete('estado_proveedor');
      window.history.replaceState({}, '', url.toString());
    }
  };

  const irAPagina = (pagina: number) => {
    setPaginaActual(pagina);
  };

  const paginaAnterior = () => {
    if (paginaActual > 1) {
      setPaginaActual(paginaActual - 1);
    }
  };

  const paginaSiguiente = () => {
    if (paginaActual < totalPaginas) {
      setPaginaActual(paginaActual + 1);
    }
  };

  const manejarClickIncidencia = async (incidenciaId: string) => {
    if (tipoUsuario === "Control") {
      // Si es Control, verificar si tiene proveedor asignado y mostrar modal
      const incidencia = incidencias.find(inc => inc.id === incidenciaId);
      const tieneProveedor = incidencia?.proveedor_casos &&
                           incidencia.proveedor_casos.length > 0 &&
                           incidencia.proveedor_casos.some(pc => pc.estado_proveedor);

      setTieneProveedorAsignado(!!tieneProveedor);
      setIncidenciaSeleccionada(incidenciaId);
      setMostrarModal(true);
    } else {
      // Para otros tipos, redirigir directamente
      redirigirAChat(incidenciaId, tipoUsuario);
    }
  };

  const redirigirAChat = (incidenciaId: string, tipo: string | null) => {
    if (tipo === "Proveedor") {
      router.push(`/incidencias/${incidenciaId}/chat-proveedor`);
    } else {
      // Cliente, Gestor, o Control eligiendo control/cliente
      router.push(`/incidencias/${incidenciaId}/chat-control-cliente`);
    }
  };

  const elegirChatControl = (tipoChat: string) => {
    if (incidenciaSeleccionada) {
      if (tipoChat === "proveedor") {
        router.push(`/incidencias/${incidenciaSeleccionada}/chat-proveedor`);
      } else {
        router.push(`/incidencias/${incidenciaSeleccionada}/chat-control-cliente`);
      }
    }
    setMostrarModal(false);
    setIncidenciaSeleccionada(null);
  };

  const asignarAProveedor = () => {
    // Cerrar el modal de selección y abrir el modal de asignación de proveedor
    setMostrarModal(false);
    if (incidenciaSeleccionada) {
      abrirModalProveedor(incidenciaSeleccionada);
    }
  };

  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: PALETA.fondo }}>

      {/* Contenido principal */}
      <div className="px-6 pb-6">
        {/* Título */}
        {tipoUsuario !== "Control" && (
          <h1 className="text-lg tracking-[0.3em] mb-8" style={{ color: PALETA.texto }}>
            MIS INCIDENCIAS:
          </h1>
        )}

        {/* Filtros - encima de la tabla */}
        <div
          className="p-4 rounded-lg relative mb-6"
          style={{ backgroundColor: PALETA.headerTable }}
        >
          {/* Primera fila de filtros: número solicitud, fecha, estado cliente, estado proveedor */}
          <div className="flex gap-4 items-center mb-4 flex-wrap">
            <input
              type="text"
              placeholder="Número solicitud"
              value={filtroNumero}
              onChange={(e) => setFiltroNumero(e.target.value)}
              className="px-3 py-2 rounded border text-sm h-10 bg-white w-48"
            />

            <input
              type="date"
              value={filtroFecha}
              onChange={(e) => setFiltroFecha(e.target.value)}
              className="px-3 py-2 rounded border text-sm h-10 bg-white w-44"
            />

            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="px-3 py-2 rounded border text-sm h-10 bg-white appearance-none w-48"
              style={{ backgroundImage: "url('data:image/svg+xml;charset=US-ASCII,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"4\" height=\"5\"><path fill=\"%23666\" d=\"M2 0L0 2h4zm0 5L0 3h4z\"/></svg>')", backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center", backgroundSize: "12px" }}
            >
              {tipoUsuario === "Proveedor" ? (
                <>
                  <option value="">Estado</option>
                  <option value="Abierta">Abierta</option>
                  <option value="En resolución">En resolución</option>
                  <option value="Ofertada">Ofertada</option>
                  <option value="Oferta aprobada">Oferta aprobada</option>
                  <option value="Oferta a revisar">Oferta a revisar</option>
                  <option value="Resuelta">Resuelta</option>
                  <option value="Cerrada">Cerrada</option>
                  <option value="Anulada">Anulada</option>
                  <option value="Valorada">Valorada</option>
                  <option value="Pendiente valoración">Pendiente valoración</option>
                </>
              ) : tipoUsuario === "Control" ? (
                <>
                  <option value="">Estado Cliente</option>
                  <option value="Abierta">Abierta</option>
                  <option value="En espera">En espera</option>
                  <option value="En tramitación">En tramitación</option>
                  <option value="Resuelta">Resuelta</option>
                  <option value="Cerrada">Cerrada</option>
                  <option value="Anulada">Anulada</option>
                </>
              ) : (
                <>
                  <option value="">Estado Cliente</option>
                  <option value="Abierta">Abierta</option>
                  <option value="En espera">En espera</option>
                  <option value="En tramitación">En tramitación</option>
                  <option value="Resuelta">Resuelta</option>
                  <option value="Cerrada">Cerrada</option>
                  <option value="Anulada">Anulada</option>
                </>
              )}
            </select>

            {tipoUsuario === "Control" && (
              <select
                value={filtroEstadoProveedor}
                onChange={(e) => setFiltroEstadoProveedor(e.target.value)}
                className="px-3 py-2 rounded border text-sm h-10 bg-white appearance-none w-52"
                style={{ backgroundImage: "url('data:image/svg+xml;charset=US-ASCII,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"4\" height=\"5\"><path fill=\"%23666\" d=\"M2 0L0 2h4zm0 5L0 3h4z\"/></svg>')", backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center", backgroundSize: "12px" }}
              >
                <option value="">Estado Proveedor</option>
                <option value="Abierta">Abierta</option>
                <option value="En resolución">En resolución</option>
                <option value="Ofertada">Ofertada</option>
                <option value="Oferta aprobada">Oferta aprobada</option>
                <option value="Oferta a revisar">Oferta a revisar</option>
                <option value="Resuelta">Resuelta</option>
                <option value="Cerrada">Cerrada</option>
                <option value="Anulada">Anulada</option>
                <option value="Valorada">Valorada</option>
                <option value="Pendiente valoración">Pendiente valoración</option>
              </select>
            )}
          </div>

          {/* Segunda fila de filtros: centro, catalogación, prioridad cliente, prioridad proveedor */}
          <div className="flex gap-4 items-center flex-wrap">
            {/* Centro como desplegable - solo para Control y Proveedor */}
            {tipoUsuario !== "Cliente" && (
              <select
                value={filtroCentro}
                onChange={(e) => setFiltroCentro(e.target.value)}
                className="px-3 py-2 rounded border text-sm h-10 bg-white appearance-none w-48"
                style={{ backgroundImage: "url('data:image/svg+xml;charset=US-ASCII,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"4\" height=\"5\"><path fill=\"%23666\" d=\"M2 0L0 2h4zm0 5L0 3h4z\"/></svg>')", backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center", backgroundSize: "12px" }}
              >
                <option value="">Centro</option>
                {centrosUnicos.map(centro => (
                  <option key={centro} value={centro}>{centro}</option>
                ))}
              </select>
            )}

            {/* Catalogación como desplegable */}
            <select
              value={filtroCatalogacion}
              onChange={(e) => setFiltroCatalogacion(e.target.value)}
              className="px-3 py-2 rounded border text-sm h-10 bg-white appearance-none w-48"
              style={{ backgroundImage: "url('data:image/svg+xml;charset=US-ASCII,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"4\" height=\"5\"><path fill=\"%23666\" d=\"M2 0L0 2h4zm0 5L0 3h4z\"/></svg>')", backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center", backgroundSize: "12px" }}
            >
              <option value="">Catalogación</option>
              {catalogacionesUnicas.map(catalogacion => (
                <option key={catalogacion} value={catalogacion}>{catalogacion}</option>
              ))}
            </select>

            {/* Filtro de prioridad cliente */}
            <select
              value={filtroPrioridadCliente}
              onChange={(e) => setFiltroPrioridadCliente(e.target.value)}
              className="px-3 py-2 rounded border text-sm h-10 bg-white appearance-none w-48"
              style={{ backgroundImage: "url('data:image/svg+xml;charset=US-ASCII,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"4\" height=\"5\"><path fill=\"%23666\" d=\"M2 0L0 2h4zm0 5L0 3h4z\"/></svg>')", backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center", backgroundSize: "12px" }}
            >
              <option value="">Prioridad Cliente</option>
              <option value="Urgente">Urgente</option>
              <option value="Crítico">Crítico</option>
              <option value="Normal">Normal</option>
            </select>

            {/* Filtro de prioridad proveedor */}
            {tipoUsuario === "Control" && (
              <select
                value={filtroPrioridadProveedor}
                onChange={(e) => setFiltroPrioridadProveedor(e.target.value)}
                className="px-3 py-2 rounded border text-sm h-10 bg-white appearance-none w-52"
                style={{ backgroundImage: "url('data:image/svg+xml;charset=US-ASCII,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"4\" height=\"5\"><path fill=\"%23666\" d=\"M2 0L0 2h4zm0 5L0 3h4z\"/></svg>')", backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center", backgroundSize: "12px" }}
              >
                <option value="">Prioridad Proveedor</option>
                <option value="Crítico">Crítico</option>
                <option value="No crítico">No crítico</option>
              </select>
            )}
          </div>

          {/* Botón limpiar filtros - separado y a la derecha */}
          <button
            onClick={limpiarFiltros}
            className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/10 transition-colors"
            style={{
              color: PALETA.textoOscuro
            }}
            title="Limpiar filtros"
          >
            ✕
          </button>
        </div>

        {/* Tabla de incidencias */}
        <div className="mb-6" style={{ backgroundColor: PALETA.card, borderRadius: "8px" }}>
          {/* Header de la tabla */}
          <div
            className="grid gap-4 p-4 rounded-t-lg"
            style={{
              backgroundColor: PALETA.headerTable,
              gridTemplateColumns: tipoUsuario === "Control" ? "0.9fr 0.8fr 1fr 1fr 1.2fr 2fr" : "0.9fr 0.8fr 1fr 1.2fr 2fr"
            }}
          >
            <div className="font-medium text-sm">Número solicitud</div>
            <div className="font-medium text-sm">Fecha</div>
            <div className="font-medium text-sm">Estado Cliente</div>
            {tipoUsuario === "Control" && (
              <div className="font-medium text-sm">Estado Proveedor</div>
            )}
            <div className="font-medium text-sm">
              {tipoUsuario === "Cliente" ? "Catalogación" : "Centro"}
            </div>
            <div className="font-medium text-sm">Descripción</div>
          </div>

          {/* Contenido de la tabla */}
          <div className="min-h-[300px]">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <span className="text-gray-500">Cargando incidencias...</span>
              </div>
            ) : incidenciasFiltradas.length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <span className="text-gray-500">
                  {incidencias.length === 0 ? "No tienes incidencias registradas" : "No se encontraron incidencias con los filtros aplicados"}
                </span>
              </div>
            ) : (
              incidenciasPaginadas.map((incidencia) => (
                <div
                  key={incidencia.id}
                  onClick={() => manejarClickIncidencia(incidencia.id)}
                  className="grid gap-4 p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                  style={{ gridTemplateColumns: tipoUsuario === "Control" ? "0.9fr 0.8fr 1fr 1fr 1.2fr 2fr" : "0.9fr 0.8fr 1fr 1.2fr 2fr" }}
                >
                  <div className="text-sm">{incidencia.num_solicitud}</div>
                  <div className="text-sm">{incidencia.fecha}</div>
                  <div className="text-sm">
                    {tipoUsuario === "Proveedor" ?
                      (incidencia.proveedor_casos?.find(pc => pc.activo)?.estado_proveedor || incidencia.estado_cliente) :
                      incidencia.estado_cliente
                    }
                  </div>
                  {tipoUsuario === "Control" && (
                    <div className="text-sm">
                      {incidencia.proveedor_casos?.find(pc => pc.activo)?.estado_proveedor || "-"}
                    </div>
                  )}
                  <div className="text-sm">
                    {tipoUsuario === "Cliente"
                      ? (incidencia.catalogacion || "-")
                      : (incidencia.instituciones?.[0]?.nombre || incidencia.centro || "-")
                    }
                  </div>
                  <div className="text-sm truncate" title={incidencia.descripcion}>
                    {incidencia.descripcion}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Paginación */}
        {incidenciasFiltradas.length > incidenciasPorPagina && (
          <div className="flex items-center justify-between mb-6 px-4 py-3 rounded-lg" style={{ backgroundColor: PALETA.card }}>
            <div className="text-sm text-gray-600">
              Mostrando {indiceInicio + 1}-{Math.min(indiceFin, incidenciasFiltradas.length)} de {incidenciasFiltradas.length} incidencias
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={paginaAnterior}
                disabled={paginaActual === 1}
                className="px-3 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ 
                  backgroundColor: paginaActual === 1 ? '#d1d5db' : PALETA.fondo,
                  color: paginaActual === 1 ? '#6b7280' : 'white'
                }}
              >
                ← Anterior
              </button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                  .filter(pagina => {
                    // Mostrar siempre primera, última, actual y 2 alrededor de la actual
                    return pagina === 1 || 
                           pagina === totalPaginas || 
                           Math.abs(pagina - paginaActual) <= 2;
                  })
                  .map((pagina, index, array) => {
                    // Agregar "..." si hay saltos
                    const prevPagina = array[index - 1];
                    const showEllipsis = prevPagina && pagina - prevPagina > 1;
                    
                    return (
                      <div key={pagina} className="flex items-center">
                        {showEllipsis && (
                          <span className="px-2 text-gray-400 text-sm">...</span>
                        )}
                        <button
                          onClick={() => irAPagina(pagina)}
                          className="px-3 py-2 rounded text-sm font-medium transition-colors"
                          style={{
                            backgroundColor: pagina === paginaActual ? PALETA.fondo : 'transparent',
                            color: pagina === paginaActual ? 'white' : PALETA.textoOscuro,
                            border: pagina === paginaActual ? 'none' : '1px solid #d1d5db'
                          }}
                        >
                          {pagina}
                        </button>
                      </div>
                    );
                  })
                }
              </div>
              
              <button
                onClick={paginaSiguiente}
                disabled={paginaActual === totalPaginas}
                className="px-3 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ 
                  backgroundColor: paginaActual === totalPaginas ? '#d1d5db' : PALETA.fondo,
                  color: paginaActual === totalPaginas ? '#6b7280' : 'white'
                }}
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}


        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-sm" style={{ color: PALETA.texto }}>
            Software de gestión de incidencias para los centros de Gent Gran de Fundació La Caixa
          </p>
        </div>
      </div>

      {/* Modal para usuarios Control */}
      {mostrarModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div 
            className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
            style={{ backgroundColor: PALETA.card }}
          >
            <h3 className="text-xl font-semibold mb-4" style={{ color: PALETA.textoOscuro }}>
              Selecciona el tipo de chat
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              ¿Qué chat deseas abrir para esta incidencia?
            </p>
            
            <div className="flex flex-col gap-3">
              <button
                onClick={() => elegirChatControl("control-cliente")}
                className="w-full py-3 px-4 rounded text-white text-sm font-medium hover:opacity-90 transition-opacity"
                style={{ backgroundColor: PALETA.fondo }}
              >
                Chat Cliente
              </button>
              {tieneProveedorAsignado ? (
                <button
                  onClick={() => elegirChatControl("proveedor")}
                  className="w-full py-3 px-4 rounded text-white text-sm font-medium hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: PALETA.filtros }}
                >
                  Chat Proveedor
                </button>
              ) : (
                <button
                  onClick={asignarAProveedor}
                  className="w-full py-3 px-4 rounded text-white text-sm font-medium hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: "#10b981" }}
                >
                  Asignar a Proveedor
                </button>
              )}
            </div>
            
            <div className="flex justify-end mt-4">
              <button
                onClick={() => {
                  setMostrarModal(false);
                  setIncidenciaSeleccionada(null);
                }}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para asignar proveedor */}
      {mostrarModalProveedor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div
            className="rounded-lg p-8 max-w-lg w-full mx-4 shadow"
            style={{ backgroundColor: PALETA.card }}
          >
            <h3 className="text-xl font-semibold mb-6" style={{ color: PALETA.textoOscuro }}>
              Asignar Incidencia a Proveedor
            </h3>

            <form onSubmit={(e) => { e.preventDefault(); asignarProveedorCompleto(); }}>
              <div className="space-y-6">
                {/* Selección de Proveedor */}
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                    Proveedor *
                  </label>
                  <select
                    value={formularioProveedor.proveedor_id}
                    onChange={(e) => setFormularioProveedor(prev => ({
                      ...prev,
                      proveedor_id: e.target.value
                    }))}
                    className="w-full h-9 rounded border px-3 text-sm outline-none focus:ring-2 focus:ring-[#C9D7A7] appearance-none pr-6"
                    required
                  >
                    <option value="">Seleccionar proveedor...</option>
                    {proveedores.map(proveedor => (
                      <option key={proveedor.id} value={proveedor.id}>
                        {proveedor.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Descripción para el Proveedor */}
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                    Descripción para el Proveedor
                  </label>
                  <textarea
                    value={formularioProveedor.descripcion_proveedor}
                    onChange={(e) => setFormularioProveedor(prev => ({
                      ...prev,
                      descripcion_proveedor: e.target.value
                    }))}
                    placeholder="Instrucciones específicas o detalles adicionales para el proveedor..."
                    className="min-h-[80px] w-full rounded border p-3 text-sm outline-none focus:ring-2 focus:ring-[#C9D7A7]"
                  />
                </div>

                {/* Prioridad */}
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                    Prioridad
                  </label>
                  <select
                    value={formularioProveedor.prioridad}
                    onChange={(e) => setFormularioProveedor(prev => ({
                      ...prev,
                      prioridad: e.target.value as 'Crítico' | 'No crítico'
                    }))}
                    className="w-full h-9 rounded border px-3 text-sm outline-none focus:ring-2 focus:ring-[#C9D7A7] appearance-none pr-6"
                    required
                  >
                    <option value="">Seleccionar prioridad...</option>
                    <option value="No crítico">No crítico</option>
                    <option value="Crítico">Crítico</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-8">
                <button
                  type="button"
                  onClick={cerrarModalProveedor}
                  className="px-4 py-2 text-sm rounded border hover:bg-gray-50 transition-colors"
                  style={{ color: PALETA.textoOscuro, borderColor: '#d1d5db' }}
                  disabled={accionEnCurso === incidenciaSeleccionada}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!formularioProveedor.proveedor_id || !formularioProveedor.prioridad || accionEnCurso === incidenciaSeleccionada}
                  className="px-6 py-2 text-sm text-white rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                  style={{
                    backgroundColor: PALETA.fondo,
                    opacity: (!formularioProveedor.proveedor_id || !formularioProveedor.prioridad || accionEnCurso === incidenciaSeleccionada) ? 0.5 : 1
                  }}
                >
                  {accionEnCurso === incidenciaSeleccionada ? 'Asignando...' : 'Asignar Proveedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}