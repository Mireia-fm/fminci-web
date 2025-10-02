"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/lib/supabaseClient";

export type Perfil = {
  persona_id: string;
  email: string;
  rol: "Control" | "Cliente" | "Gestor" | "Proveedor";
  acceso_todos_centros: boolean;
  instituciones?: Array<{
    institucion_id: string;
    nombre: string;
  }>;
};

type AuthContextType = {
  perfil: Perfil | null;
  loading: boolean;
  proveedorId: string | null;
  recargarPerfil: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  perfil: null,
  loading: true,
  proveedorId: null,
  recargarPerfil: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [loading, setLoading] = useState(true);
  const [proveedorId, setProveedorId] = useState<string | null>(null);

  const cargarPerfil = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData.user?.email;

      if (!userEmail) {
        setPerfil(null);
        setLoading(false);
        return;
      }

      // Obtener datos del usuario de la tabla personas
      const { data: persona } = await supabase
        .from("personas")
        .select("id, rol, acceso_todos_centros")
        .eq("email", userEmail)
        .maybeSingle();

      if (!persona) {
        setPerfil(null);
        setLoading(false);
        return;
      }

      // Obtener instituciones asignadas
      const { data: personaInstituciones } = await supabase
        .from("personas_instituciones")
        .select(`
          institucion_id,
          instituciones!inner(
            id,
            nombre,
            tipo
          )
        `)
        .eq("persona_id", persona.id);

      const instituciones = personaInstituciones?.map(pi => ({
        institucion_id: pi.institucion_id,
        nombre: (pi.instituciones as { nombre?: string })?.nombre || "Sin nombre",
      })) || [];

      const perfilData: Perfil = {
        persona_id: persona.id,
        email: userEmail,
        rol: persona.rol,
        acceso_todos_centros: persona.acceso_todos_centros,
        instituciones,
      };

      setPerfil(perfilData);

      // Si es proveedor, obtener su ID de institución
      if (persona.rol === "Proveedor" && instituciones.length > 0) {
        setProveedorId(instituciones[0].institucion_id);
      }

      // Guardar en sessionStorage para acceso rápido
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('tipoUsuario', persona.rol);
      }
    } catch (error) {
      console.error("Error cargando perfil:", error);
      setPerfil(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarPerfil();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        perfil,
        loading,
        proveedorId,
        recargarPerfil: cargarPerfil
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
