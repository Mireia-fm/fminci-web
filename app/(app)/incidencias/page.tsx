"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { registrarCambiosEstado } from "@/lib/historialEstados";
import SearchableSelect from "@/components/SearchableSelect";
import NotificacionesProveedor from "@/components/NotificacionesProveedor";
import { PALETA } from "@/lib/theme";
import { useAuth } from "@/contexts/AuthContext";
import { obtenerIncidenciasPorPerfil } from "@/lib/incidenciasService";

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
    proveedor_id?: string;
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
  const { perfil, loading: loadingAuth, proveedorId } = useAuth();
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
  const [filtroProveedor, setFiltroProveedor] = useState("");
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
  const [mostrarFiltroCentro, setMostrarFiltroCentro] = useState(false);
  const [centrosAsignados, setCentrosAsignados] = useState<{id: string, nombre: string}[]>([]);

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

    const filtroCentroParam = searchParams.get('centro');
    if (filtroCentroParam) {
      setFiltroCentro(filtroCentroParam);
    }
  }, [searchParams]);

  // Cargar incidencias del usuario actual
  useEffect(() => {
    if (!loadingAuth && perfil) {
      // Solo cargar si no hay filtro de número específico
      if (!filtroNumero || filtroNumero.length < 4) {
        cargarIncidencias();
      }
      cargarProveedores();
    }
  }, [loadingAuth, perfil]);

  // Búsqueda específica cuando se busca un número exacto
  useEffect(() => {
    if (filtroNumero && filtroNumero.length >= 4) {
      console.log("Búsqueda específica para:", filtroNumero);
      buscarIncidenciaEspecifica(filtroNumero);
    } else {
      cargarIncidencias();
    }
  }, [filtroNumero]);

  const buscarIncidenciaEspecifica = async (numeroSolicitud: string) => {
    if (!perfil) return;

    try {
      setLoading(true);

      if (perfil.rol === "Control") {
        // Búsqueda específica para Control
        const { data, error } = await supabase
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
          .eq("num_solicitud", numeroSolicitud);

        if (!error && data) {
          setIncidencias(data);
          console.log("✅ Búsqueda específica EXITOSA:", data.length, "incidencias");
          console.log("✅ Datos:", data[0]?.num_solicitud, data[0]?.descripcion?.substring(0, 50));
        } else {
          console.error("❌ Error en búsqueda específica:", error);
          setIncidencias([]);
        }
      }
    } catch (error) {
      console.error("Error en búsqueda específica:", error);
      setIncidencias([]);
    } finally {
      setLoading(false);
    }
  };

  const cargarIncidencias = async () => {
    if (!perfil) return;

    try {
      // Usar el servicio centralizado
      const data = await obtenerIncidenciasPorPerfil(perfil);

      setIncidencias(data);

      // Configurar filtros según perfil
      if (perfil.rol === 'Cliente' && perfil.instituciones && perfil.instituciones.length > 1) {
        setMostrarFiltroCentro(true);
        setCentrosAsignados(perfil.instituciones.map(inst => ({
          id: inst.institucion_id,
          nombre: inst.nombre
        })));
      }

      // Calcular centros únicos
      const centros = [...new Set(
        data
          .map(inc => inc.instituciones?.[0]?.nombre || inc.centro)
          .filter((c): c is string => Boolean(c))
      )].sort((a, b) => a.localeCompare(b));
      setCentrosUnicos(centros);

      // Calcular catalogaciones únicas
      const catalogaciones = [...new Set(
        data
          .map(inc => inc.catalogacion)
          .filter((c): c is string => Boolean(c))
      )];
      setCatalogacionesUnicas(catalogaciones);
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
      prioridad: 'No crítico' as 'Crítico' | 'No crítico',
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
      prioridad: 'No crítico' as 'Crítico' | 'No crítico',
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
            proveedor_nombre: proveedores.find(p => p.id === formularioProveedor.proveedor_id)?.nombre || '',
            prioridad: formularioProveedor.prioridad,
            accion: 'asignar_proveedor',
            descripcion_proveedor: formularioProveedor.descripcion_proveedor || ''
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
            proveedor_nombre: proveedores.find(p => p.id === formularioProveedor.proveedor_id)?.nombre || '',
            prioridad: formularioProveedor.prioridad,
            descripcion_proveedor: formularioProveedor.descripcion_proveedor || '',
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
    const estadoAFiltrar = perfil?.rol === "Proveedor" ? (filtroEstadoProveedor || filtroEstado) : filtroEstado;

    // Debug para proveedores cuando hay filtro activo
    if (perfil?.rol === "Proveedor" && estadoAFiltrar) {
      console.log("Filtrando con estado:", estadoAFiltrar);
      console.log("Incidencia:", inc.num_solicitud, "Casos proveedor:", inc.proveedor_casos);
    }

    const coincideEstado = !estadoAFiltrar ||
      (perfil?.rol === "Proveedor" ?
        (inc.proveedor_casos && inc.proveedor_casos.some(pc => pc.activo && pc.estado_proveedor === estadoAFiltrar)) :
        inc.estado_cliente?.trim() === estadoAFiltrar?.trim()
      );

    const coincideCentro = !filtroCentro ||
      (inc.centro && inc.centro.toLowerCase() === filtroCentro.toLowerCase()) ||
      (inc.instituciones?.[0]?.nombre && inc.instituciones[0].nombre.toLowerCase() === filtroCentro.toLowerCase());
    const coincideNumero = !filtroNumero ||
      inc.num_solicitud.toLowerCase().includes(filtroNumero.toLowerCase());
    const coincideEstadoProveedor = !filtroEstadoProveedor ||
      (inc.proveedor_casos && inc.proveedor_casos.some(pc => pc.activo && pc.estado_proveedor === filtroEstadoProveedor));
    const coincideFecha = !filtroFecha ||
      inc.fecha === filtroFecha;
    const coincideCatalogacion = !filtroCatalogacion ||
      inc.catalogacion === filtroCatalogacion;
    const coincidePrioridadCliente = !filtroPrioridadCliente ||
      (perfil?.rol === "Cliente" || perfil?.rol === "Gestor" ?
        inc.prioridad === filtroPrioridadCliente :
        (inc.proveedor_casos && inc.proveedor_casos.some(pc => pc.activo && pc.prioridad === filtroPrioridadCliente)));
    const coincidePrioridadProveedor = !filtroPrioridadProveedor ||
      (inc.proveedor_casos && inc.proveedor_casos.some(pc => pc.activo && pc.prioridad === filtroPrioridadProveedor));
    const coincideProveedor = !filtroProveedor ||
      (inc.proveedor_casos && inc.proveedor_casos.some(pc => pc.activo && pc.proveedor_id === filtroProveedor));

    // Para proveedores: no verificar filtroEstadoProveedor por separado si ya se verificó en coincideEstado
    const verificarEstadoProveedorSeparado = perfil?.rol !== "Proveedor" && filtroEstadoProveedor;

    return coincideEstado && coincideCentro && coincideNumero &&
           (!verificarEstadoProveedorSeparado || coincideEstadoProveedor) &&
           coincideFecha && coincideCatalogacion && coincidePrioridadCliente && coincidePrioridadProveedor && coincideProveedor;
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
    setFiltroProveedor("");
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
    if (perfil?.rol === "Control") {
      // Si es Control, verificar si tiene proveedor asignado y mostrar modal
      const incidencia = incidencias.find(inc => inc.id === incidenciaId);
      const tieneProveedor = incidencia?.proveedor_casos &&
                           incidencia.proveedor_casos.length > 0 &&
                           incidencia.proveedor_casos.some(pc => pc.estado_proveedor && pc.activo);

      setTieneProveedorAsignado(!!tieneProveedor);
      setIncidenciaSeleccionada(incidenciaId);
      setMostrarModal(true);
    } else {
      // Para otros tipos, redirigir directamente
      redirigirAChat(incidenciaId, perfil?.rol || null);
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

  // Mostrar loading si el tipo de usuario no está confirmado o si está cargando
  if (loadingAuth || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: PALETA.bg }}>
        <div className="text-white">Cargando incidencias...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: PALETA.bg }}>

      {/* Contenido principal */}
      <div className="px-6 pb-6">
        {/* Título */}
        {perfil?.rol !== "Control" && (
          <h1 className="text-lg tracking-[0.3em] mb-8" style={{ color: PALETA.texto }}>
            MIS INCIDENCIAS:
          </h1>
        )}

        {/* Filtros - encima de la tabla */}
        <div className="mb-12 relative">
          <div
            className="p-4"
            style={{
              backgroundColor: PALETA.headerTable,
              borderRadius: "4px 4px 0 4px"
            }}
          >
            {/* Primera fila de filtros: número solicitud, fecha, estado cliente, estado proveedor */}
            <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: `repeat(${perfil?.rol === "Control" ? 4 : 3}, minmax(0, 1fr))` }}>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: PALETA.textoOscuro }}>
                Número solicitud
              </label>
              <input
                type="text"
                placeholder="Buscar"
                value={filtroNumero}
                onChange={(e) => setFiltroNumero(e.target.value)}
                className="px-3 py-1.5 rounded border text-sm h-8 bg-white w-full"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: PALETA.textoOscuro }}>
                Fecha
              </label>
              <input
                type="date"
                value={filtroFecha}
                onChange={(e) => setFiltroFecha(e.target.value)}
                className="px-3 py-1.5 rounded border text-sm h-8 bg-white w-full"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: PALETA.textoOscuro }}>
                {perfil?.rol === "Control" ? "Estado Cliente" : "Estado"}
              </label>
              <SearchableSelect
                value={filtroEstado}
                onChange={setFiltroEstado}
                placeholder="Seleccionar"
                className="w-full"
                options={
                  perfil?.rol === "Proveedor" ? [
                    { value: "Abierta", label: "Abierta" },
                    { value: "En resolución", label: "En resolución" },
                    { value: "Ofertada", label: "Ofertada" },
                    { value: "Oferta aprobada", label: "Oferta aprobada" },
                    { value: "Oferta a revisar", label: "Oferta a revisar" },
                    { value: "Resuelta", label: "Resuelta" },
                    { value: "Cerrada", label: "Cerrada" },
                    { value: "Anulada", label: "Anulada" },
                    { value: "Valorada", label: "Valorada" },
                    { value: "Pendiente valoración", label: "Pendiente valoración" }
                  ] : [
                    { value: "Abierta", label: "Abierta" },
                    { value: "En espera", label: "En espera" },
                    { value: "En tramitación", label: "En tramitación" },
                    { value: "Resuelta", label: "Resuelta" },
                    { value: "Cerrada", label: "Cerrada" },
                    { value: "Anulada", label: "Anulada" }
                  ]
                }
              />
            </div>

            {perfil?.rol === "Control" && (
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: PALETA.textoOscuro }}>
                  Estado Proveedor
                </label>
                <SearchableSelect
                  value={filtroEstadoProveedor}
                  onChange={setFiltroEstadoProveedor}
                  placeholder="Seleccionar"
                  className="w-full"
                  options={[
                    { value: "Abierta", label: "Abierta" },
                    { value: "En resolución", label: "En resolución" },
                    { value: "Ofertada", label: "Ofertada" },
                    { value: "Oferta aprobada", label: "Oferta aprobada" },
                    { value: "Oferta a revisar", label: "Oferta a revisar" },
                    { value: "Resuelta", label: "Resuelta" },
                    { value: "Cerrada", label: "Cerrada" },
                    { value: "Anulada", label: "Anulada" },
                    { value: "Valorada", label: "Valorada" },
                    { value: "Pendiente valoración", label: "Pendiente valoración" }
                  ]}
                />
              </div>
            )}
          </div>

            {/* Segunda fila de filtros: centro, catalogación, prioridad cliente, proveedor */}
            <div className="grid gap-4 mb-4" style={{
              gridTemplateColumns: perfil?.rol === "Control"
                ? "repeat(4, minmax(0, 1fr))"
                : "repeat(3, minmax(0, 1fr))"
            }}>
            {/* Centro como desplegable - para Control, Proveedor y Cliente con múltiples centros */}
            {(perfil?.rol !== "Cliente" || mostrarFiltroCentro) ? (
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: PALETA.textoOscuro }}>
                  Centro
                </label>
                <SearchableSelect
                  value={filtroCentro}
                  onChange={setFiltroCentro}
                  placeholder="Seleccionar"
                  className="w-full"
                  options={
                    /* Para Cliente con múltiples centros, usar centrosAsignados. Para otros, usar centrosUnicos */
                    mostrarFiltroCentro
                      ? centrosAsignados.map(centro => ({
                          value: centro.id,
                          label: centro.nombre
                        }))
                      : centrosUnicos.map(centro => ({
                          value: centro,
                          label: centro
                        }))
                  }
                />
              </div>
            ) : (
              /* Div vacío para mantener la estructura de 3 columnas */
              <div></div>
            )}

            {/* Catalogación como desplegable */}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: PALETA.textoOscuro }}>
                Catalogación
              </label>
              <SearchableSelect
                value={filtroCatalogacion}
                onChange={setFiltroCatalogacion}
                placeholder="Seleccionar"
                className="w-full"
                options={catalogacionesUnicas.map(catalogacion => ({
                  value: catalogacion,
                  label: catalogacion
                }))}
              />
            </div>

            {/* Filtro de prioridad cliente */}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: PALETA.textoOscuro }}>
                Prioridad
              </label>
              <SearchableSelect
                value={filtroPrioridadCliente}
                onChange={setFiltroPrioridadCliente}
                placeholder="Seleccionar"
                className="w-full"
                options={
                  perfil?.rol === "Cliente" || perfil?.rol === "Gestor" ? [
                    { value: "Urgente", label: "Urgente" },
                    { value: "Crítico", label: "Crítico" },
                    { value: "Normal", label: "Normal" }
                  ] : [
                    { value: "Crítico", label: "Crítico" },
                    { value: "No crítico", label: "No crítico" }
                  ]
                }
              />
            </div>

            {/* Filtro de prioridad proveedor */}
            {perfil?.rol === "Control" && (
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: PALETA.textoOscuro }}>
                  Prioridad Proveedor
                </label>
                <SearchableSelect
                  value={filtroPrioridadProveedor}
                  onChange={setFiltroPrioridadProveedor}
                  placeholder="Seleccionar"
                  className="w-full"
                  options={[
                    { value: "Crítico", label: "Crítico" },
                    { value: "No crítico", label: "No crítico" }
                  ]}
                />
              </div>
            )}
            </div>

            {/* Tercera fila de filtros: proveedor */}
            {perfil?.rol === "Control" && (
              <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
                <div></div>
                <div></div>
                <div></div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: PALETA.textoOscuro }}>
                    Proveedor
                  </label>
                  <SearchableSelect
                    value={filtroProveedor}
                    onChange={setFiltroProveedor}
                    placeholder="Seleccionar"
                    className="w-full"
                    options={proveedores.map(proveedor => ({
                      value: proveedor.id,
                      label: proveedor.nombre
                    }))}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Botón limpiar filtros - extensión separada */}
          <div className="absolute bottom-0 right-0 translate-y-full">
            <button
              onClick={limpiarFiltros}
              className="px-3 py-1 text-xs font-medium hover:opacity-80 transition-opacity flex items-center gap-1"
              style={{
                backgroundColor: PALETA.headerTable,
                color: PALETA.textoOscuro,
                borderRadius: "0 0 4px 4px"
              }}
              title="Limpiar filtros"
            >
              <span className="text-xs">✕</span>
              Limpiar filtros
            </button>
          </div>
        </div>

        {/* Tabla de incidencias */}
        <div className="mb-6" style={{ backgroundColor: PALETA.card, borderRadius: "8px" }}>
          {/* Header de la tabla */}
          <div
            className="grid gap-4 p-4 rounded-t-lg"
            style={{
              backgroundColor: PALETA.headerTable,
              gridTemplateColumns: perfil?.rol === "Control" ? "0.9fr 0.8fr 1fr 1fr 1.2fr 2fr" : "0.9fr 0.8fr 1fr 1.2fr 2fr"
            }}
          >
            <div className="font-medium text-sm">Número solicitud</div>
            <div className="font-medium text-sm">Fecha</div>
            <div className="font-medium text-sm">
              {perfil?.rol === "Control" ? "Estado Cliente" : "Estado"}
            </div>
            {perfil?.rol === "Control" && (
              <div className="font-medium text-sm">Estado Proveedor</div>
            )}
            <div className="font-medium text-sm">
              {perfil?.rol === "Cliente" ? "Catalogación" : "Centro"}
            </div>
            <div className="font-medium text-sm">Descripción</div>
          </div>

          {/* Contenido de la tabla */}
          <div className="min-h-[300px]">
            {incidenciasFiltradas.length === 0 ? (
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
                  style={{ gridTemplateColumns: perfil?.rol === "Control" ? "0.9fr 0.8fr 1fr 1fr 1.2fr 2fr" : "0.9fr 0.8fr 1fr 1.2fr 2fr" }}
                >
                  <div className="text-sm">{incidencia.num_solicitud}</div>
                  <div className="text-sm">{incidencia.fecha}</div>
                  <div className="text-sm">
                    {perfil?.rol === "Proveedor" ?
                      (incidencia.proveedor_casos?.find(pc => pc.activo)?.estado_proveedor || incidencia.estado_cliente) :
                      incidencia.estado_cliente
                    }
                  </div>
                  {perfil?.rol === "Control" && (
                    <div className="text-sm">
                      {incidencia.proveedor_casos?.find(pc => pc.activo)?.estado_proveedor || "-"}
                    </div>
                  )}
                  <div className="text-sm">
                    {perfil?.rol === "Cliente"
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
                  backgroundColor: paginaActual === 1 ? '#d1d5db' : PALETA.bg,
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
                            backgroundColor: pagina === paginaActual ? PALETA.bg : 'transparent',
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
                  backgroundColor: paginaActual === totalPaginas ? '#d1d5db' : PALETA.bg,
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
                style={{ backgroundColor: PALETA.bg }}
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
                  <SearchableSelect
                    value={formularioProveedor.proveedor_id}
                    onChange={(value) => setFormularioProveedor(prev => ({
                      ...prev,
                      proveedor_id: value
                    }))}
                    placeholder="Seleccionar proveedor..."
                    className="w-full"
                    options={proveedores.map(proveedor => ({
                      value: proveedor.id,
                      label: proveedor.nombre
                    }))}
                  />
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
                  <SearchableSelect
                    value={formularioProveedor.prioridad}
                    onChange={(value) => setFormularioProveedor(prev => ({
                      ...prev,
                      prioridad: value as 'Crítico' | 'No crítico'
                    }))}
                    placeholder="Seleccionar prioridad..."
                    className="w-full"
                    options={[
                      { value: "No crítico", label: "No crítico" },
                      { value: "Crítico", label: "Crítico" }
                    ]}
                  />
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
                    backgroundColor: PALETA.bg,
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

      {/* Notificaciones para proveedores */}
      {perfil?.rol === 'Proveedor' && proveedorId && (
        <NotificacionesProveedor proveedorId={proveedorId} />
      )}
    </div>
  );
}