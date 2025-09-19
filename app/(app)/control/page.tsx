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
    } catch (error) {
      console.error("Error verificando acceso:", error);
      router.replace("/login");
    } finally {
      setLoading(false);
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 mb-6">
            <button
              onClick={() => router.push("/incidencias")}
              className="p-4 rounded-lg text-left hover:opacity-90 transition-opacity"
              style={{ backgroundColor: PALETA.headerTable, color: PALETA.textoOscuro }}
            >
              <h3 className="font-medium mb-2">Gestionar Incidencias</h3>
              <p className="text-sm opacity-80">Vista principal con herramientas avanzadas</p>
            </button>

            <button
              onClick={() => router.push("/control/asignacion-masiva")}
              className="p-4 rounded-lg text-left hover:opacity-90 transition-opacity"
              style={{ backgroundColor: PALETA.filtros, color: PALETA.textoOscuro }}
            >
              <h3 className="font-medium mb-2">Asignación Masiva</h3>
              <p className="text-sm opacity-80">Bulk actions</p>
            </button>
          </div>
        </div>

        {/* Gestión de Entidades */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4" style={{ color: PALETA.texto }}>
            GESTIÓN DE ENTIDADES:
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <button
              onClick={() => router.push("/control/proveedores")}
              className="p-4 rounded-lg text-left hover:opacity-90 transition-opacity"
              style={{ backgroundColor: "#66bb6a", color: "white" }}
            >
              <h3 className="font-medium mb-2">🏢 Proveedores</h3>
              <p className="text-sm opacity-90">Gestión y evaluación</p>
            </button>

            <button
              onClick={() => router.push("/control/centros")}
              className="p-4 rounded-lg text-left hover:opacity-90 transition-opacity"
              style={{ backgroundColor: "#42a5f5", color: "white" }}
            >
              <h3 className="font-medium mb-2">🏫 Centros</h3>
              <p className="text-sm opacity-90">Instituciones y personal</p>
            </button>

            <button
              onClick={() => router.push("/control/usuarios")}
              className="p-4 rounded-lg text-left hover:opacity-90 transition-opacity"
              style={{ backgroundColor: "#8d6e63", color: "white" }}
            >
              <h3 className="font-medium mb-2">👤 Usuarios</h3>
              <p className="text-sm opacity-90">Gestión de cuentas</p>
            </button>
          </div>
        </div>


      </div>
    </div>
  );
}