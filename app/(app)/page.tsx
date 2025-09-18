"use client";
import { usePerfil } from "@/hooks/usePerfil";
import DashboardCliente from "@/components/DashboardCliente";
import DashboardProveedor from "@/components/DashboardProveedor";

export default function Page() {
  const { perfil, loading } = usePerfil();

  if (loading) return <div className="p-8 text-white/80">Cargando…</div>;
  if (!perfil)  return <div className="p-8 text-white/80">Sin perfil</div>;

  return perfil.es_proveedor ? <DashboardProveedor /> : <DashboardCliente />;
}