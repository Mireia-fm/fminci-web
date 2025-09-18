"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

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
  institucion_id?: string;
  instituciones?: { 
    nombre: string;
  }[] | null;
  proveedor_casos?: {
    estado_proveedor: string;
  }[] | null;
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
  const [tipoUsuario, setTipoUsuario] = useState<string | null>(null);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [incidenciaSeleccionada, setIncidenciaSeleccionada] = useState<string | null>(null);
  const [paginaActual, setPaginaActual] = useState(1);
  const incidenciasPorPagina = 20;

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
              estado_proveedor
            )
          `)
          .eq("proveedor_casos.proveedor_id", personaInst.institucion_id)
          .eq("proveedor_casos.activo", true)
          .order("fecha", { ascending: false });
        
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
            institucion_id,
            email,
            instituciones(nombre),
            proveedor_casos(estado_proveedor, activo)
          `)
          .order("fecha", { ascending: false })
          .limit(100);

        data = result.data;
        error = result.error;
      } else {
        // Para otros usuarios: usar la consulta original con email
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
            proveedor_casos(estado_proveedor)
          `)
          .eq("email", userEmail)
          .order("fecha", { ascending: false });

        data = result.data;
        error = result.error;
      }

      if (error) {
        console.error("Error cargando incidencias:", error);
      } else {
        setIncidencias(data || []);
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar incidencias
  const incidenciasFiltradas = incidencias.filter((inc) => {
    const coincideEstado = !filtroEstado ||
      (tipoUsuario === "Proveedor" ?
        (inc.proveedor_casos && inc.proveedor_casos.some(pc => pc.estado_proveedor === filtroEstado)) :
        inc.estado_cliente === filtroEstado
      );
    const coincideCentro = !filtroCentro ||
      (inc.centro && inc.centro.toLowerCase().includes(filtroCentro.toLowerCase())) ||
      (inc.instituciones?.[0]?.nombre && inc.instituciones[0].nombre.toLowerCase().includes(filtroCentro.toLowerCase()));
    const coincideNumero = !filtroNumero ||
      inc.num_solicitud.toLowerCase().includes(filtroNumero.toLowerCase());
    const coincideEstadoProveedor = !filtroEstadoProveedor ||
      (inc.proveedor_casos && inc.proveedor_casos.some(pc => pc.estado_proveedor === filtroEstadoProveedor));

    return coincideEstado && coincideCentro && coincideNumero && coincideEstadoProveedor;
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
    setPaginaActual(1); // Resetear a la primera página
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

  const manejarClickIncidencia = (incidenciaId: string) => {
    if (tipoUsuario === "Control") {
      // Si es Control, mostrar modal para elegir chat
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

  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: PALETA.fondo }}>

      {/* Contenido principal */}
      <div className="px-6 pb-6">
        {/* Título */}
        <h1 className="text-lg tracking-[0.3em] mb-8" style={{ color: PALETA.texto }}>
          MIS INCIDENCIAS:
        </h1>

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
            <div className="font-medium text-sm">Estado</div>
            {tipoUsuario === "Control" && (
              <div className="font-medium text-sm">Estado Proveedor</div>
            )}
            <div className="font-medium text-sm">Centro</div>
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
                      (incidencia.proveedor_casos?.[0]?.estado_proveedor || incidencia.estado_cliente) :
                      incidencia.estado_cliente
                    }
                  </div>
                  {tipoUsuario === "Control" && (
                    <div className="text-sm">
                      {incidencia.proveedor_casos?.[0]?.estado_proveedor || "-"}
                    </div>
                  )}
                  <div className="text-sm">
                    {incidencia.instituciones?.[0]?.nombre || incidencia.centro || "-"}
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

        {/* Filtros */}
        <div 
          className="flex gap-4 items-center p-4 rounded-lg relative"
          style={{ backgroundColor: PALETA.headerTable }}
        >
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="px-3 py-2 rounded border text-sm h-10 bg-white appearance-none w-40"
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
                <option value="">Estado</option>
                <option value="Abierta">Abierta</option>
                <option value="En espera">En espera</option>
                <option value="En tramitación">En tramitación</option>
                <option value="Resuelta">Resuelta</option>
                <option value="Cerrada">Cerrada</option>
                <option value="Anulada">Anulada</option>
              </>
            )}
          </select>

          <input
            type="text"
            placeholder="Centro"
            value={filtroCentro}
            onChange={(e) => setFiltroCentro(e.target.value)}
            className="px-3 py-2 rounded border text-sm h-10 bg-white w-40"
          />

          <input
            type="text"
            placeholder="Número solicitud"
            value={filtroNumero}
            onChange={(e) => setFiltroNumero(e.target.value)}
            className="px-3 py-2 rounded border text-sm h-10 bg-white w-40"
          />

          {tipoUsuario === "Control" && (
            <select
              value={filtroEstadoProveedor}
              onChange={(e) => setFiltroEstadoProveedor(e.target.value)}
              className="px-3 py-2 rounded border text-sm h-10 bg-white appearance-none w-40"
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

          <button
            onClick={limpiarFiltros}
            className="absolute right-4 w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/10 transition-colors"
            style={{ 
              color: PALETA.textoOscuro 
            }}
            title="Limpiar filtros"
          >
            ✕
          </button>
        </div>

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
                Chat Control/Cliente
              </button>
              <button
                onClick={() => elegirChatControl("proveedor")}
                className="w-full py-3 px-4 rounded text-white text-sm font-medium hover:opacity-90 transition-opacity"
                style={{ backgroundColor: PALETA.filtros }}
              >
                Chat Proveedor
              </button>
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
    </div>
  );
}