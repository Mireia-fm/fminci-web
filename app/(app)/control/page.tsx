"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const PALETA = {
  fondo: "#5D6D52",
  headerTable: "#D9B6A9",
  card: "#F9FAF8",
  filtros: "#E8B5A8",
  texto: "#EDF0E9",
  textoOscuro: "#4b4b4b",
};

export default function PanelControl() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tipoUsuario, setTipoUsuario] = useState<string | null>(null);
  const [estadisticas, setEstadisticas] = useState({
    totalIncidencias: 0,
    incidenciasAbiertas: 0,
    incidenciasCerradas: 0,
    usuariosActivos: 0
  });

  useEffect(() => {
    verificarAcceso();
  }, []);

  const verificarAcceso = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData.user?.email;

      if (!userEmail) {
        router.replace("/login");
        return;
      }

      // Obtener tipo de usuario de la tabla personas
      const { data: persona, error: personaError } = await supabase
        .from("personas")
        .select("rol")
        .eq("email", userEmail)
        .maybeSingle();

      if (personaError || !persona || persona.rol !== "Control") {
        // Si no es usuario Control, redirigir al dashboard
        router.replace("/");
        return;
      }

      setTipoUsuario(persona.rol);
      await cargarEstadisticas();
    } catch (error) {
      console.error("Error verificando acceso:", error);
      router.replace("/login");
    } finally {
      setLoading(false);
    }
  };

  const cargarEstadisticas = async () => {
    try {
      // Cargar estadísticas generales
      const { data: incidencias } = await supabase
        .from("incidencias")
        .select("estado_cliente");

      if (incidencias) {
        const total = incidencias.length;
        const abiertas = incidencias.filter(inc => 
          ["Abierta", "En espera", "En tramitación"].includes(inc.estado_cliente)
        ).length;
        const cerradas = incidencias.filter(inc => 
          ["Cerrada", "Resuelta", "Anulada"].includes(inc.estado_cliente)
        ).length;

        setEstadisticas(prev => ({
          ...prev,
          totalIncidencias: total,
          incidenciasAbiertas: abiertas,
          incidenciasCerradas: cerradas
        }));
      }

      // Cargar usuarios activos (aproximación)
      const { data: usuarios } = await supabase
        .from("personas")
        .select("email", { count: "exact" });

      if (usuarios) {
        setEstadisticas(prev => ({
          ...prev,
          usuariosActivos: usuarios.length
        }));
      }
    } catch (error) {
      console.error("Error cargando estadísticas:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center" style={{ backgroundColor: PALETA.fondo }}>
        <span className="text-white">Verificando acceso...</span>
      </div>
    );
  }

  if (tipoUsuario !== "Control") {
    return null;
  }

  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: PALETA.fondo }}>
      {/* Contenido principal */}
      <div className="px-6 py-6">
        {/* Título */}
        <h1 className="text-lg tracking-[0.3em] mb-8" style={{ color: PALETA.texto }}>
          PANEL DE CONTROL:
        </h1>


        {/* Gestión de Incidencias */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4" style={{ color: PALETA.texto }}>
            GESTIÓN DE INCIDENCIAS:
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <button
              onClick={() => router.push("/control/incidencias")}
              className="p-4 rounded-lg text-left hover:opacity-90 transition-opacity"
              style={{ backgroundColor: PALETA.headerTable, color: PALETA.textoOscuro }}
            >
              <h3 className="font-medium mb-2">Gestionar Todas</h3>
              <p className="text-sm opacity-80">Gestión completa de incidencias</p>
            </button>
            
            <button
              onClick={() => router.push("/control/incidencias?filtro=proveedor")}
              className="p-4 rounded-lg text-left hover:opacity-90 transition-opacity"
              style={{ backgroundColor: PALETA.filtros, color: PALETA.textoOscuro }}
            >
              <h3 className="font-medium mb-2">Proveedor</h3>
              <p className="text-sm opacity-80">Incidencias enviadas a proveedores</p>
            </button>
            
            <button
              onClick={() => router.push("/control/incidencias?filtro=cerrar")}
              className="p-4 rounded-lg text-left hover:opacity-90 transition-opacity"
              style={{ backgroundColor: PALETA.headerTable, color: PALETA.textoOscuro }}
            >
              <h3 className="font-medium mb-2">Cerrar</h3>
              <p className="text-sm opacity-80">Incidencias resueltas para cerrar</p>
            </button>
          </div>
        </div>

        {/* Acciones de administración */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4" style={{ color: PALETA.texto }}>
            ACCIONES DE ADMINISTRACIÓN:
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <button
              onClick={() => router.push("/incidencias")}
              className="p-4 rounded-lg text-left hover:opacity-90 transition-opacity"
              style={{ backgroundColor: PALETA.headerTable, color: PALETA.textoOscuro }}
            >
              <h3 className="font-medium mb-2">Ver Listado Básico</h3>
              <p className="text-sm opacity-80">Vista simple de incidencias</p>
            </button>
            
            <button
              className="p-4 rounded-lg text-left opacity-50 cursor-not-allowed"
              style={{ backgroundColor: PALETA.card, color: PALETA.textoOscuro }}
            >
              <h3 className="font-medium mb-2">Gestión de Usuarios</h3>
              <p className="text-sm opacity-60">Próximamente disponible</p>
            </button>
            
            <button
              className="p-4 rounded-lg text-left opacity-50 cursor-not-allowed"
              style={{ backgroundColor: PALETA.card, color: PALETA.textoOscuro }}
            >
              <h3 className="font-medium mb-2">Reportes</h3>
              <p className="text-sm opacity-60">Próximamente disponible</p>
            </button>
          </div>
        </div>

        {/* Información del sistema */}
        <div className="p-6 rounded-lg" style={{ backgroundColor: PALETA.card }}>
          <h2 className="text-lg font-semibold mb-4" style={{ color: PALETA.textoOscuro }}>
            Información del Sistema
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Usuario:</span> Control
            </div>
            <div>
              <span className="font-medium">Última actualización:</span> {new Date().toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}