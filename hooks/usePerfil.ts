"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export type Perfil = {
  persona_id: string;
  email: string;
  rol: "Control" | "Cliente" | "Gestor" | "Proveedor";
  acceso_todos_centros: boolean;
  es_proveedor: boolean;
};

export function usePerfil() {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("v_mi_perfil").select("*").single();
      if (!error && data) setPerfil(data as Perfil);
      setLoading(false);
    })();
  }, []);

  return { perfil, loading };
}