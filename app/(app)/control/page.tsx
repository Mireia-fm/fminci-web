"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { PALETA } from "@/lib/theme";

export default function PanelControl() {
  const router = useRouter();
  const { perfil, loading: loadingAuth } = useAuth();

  // Verificar acceso: solo usuarios Control
  if (!loadingAuth && (!perfil || perfil.rol !== "Control")) {
    router.replace("/");
    return null;
  }

  if (loadingAuth) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center" style={{ backgroundColor: PALETA.bg }}>
        <span className="text-white">Verificando acceso...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: PALETA.bg }}>
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