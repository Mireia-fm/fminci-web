"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePerfil } from "@/hooks/usePerfil";

export default function Sidebar() {
  const pathname = usePathname();
  const { perfil } = usePerfil();

  // Items según rol
  const items = perfil?.es_proveedor
    ? [
        { href: "/", label: "Dashboard" },
        { href: "/incidencias", label: "Mis Incidencias" },
        { href: "/proveedor", label: "Panel de Proveedor" },
      ]
    : perfil?.rol === "Control"
    ? [
        { href: "/", label: "Dashboard" },
        { href: "/incidencias", label: "Incidencias" },
        { href: "/control", label: "Panel de Control" },
      ]
    : [
        { href: "/", label: "Dashboard" },
        { href: "/incidencias", label: "Incidencias" },
      ];

  return (
    <aside
      className="hidden md:flex w-60 min-h-[calc(100vh-56px)] flex-col p-5 gap-1"
      style={{ backgroundColor: "var(--fm-bg)", color: "var(--fm-text)" }}
    >
      <nav className="flex flex-col">
        {items.map(it => {
          const active = pathname === it.href || (it.href !== "/" && pathname.startsWith(it.href));
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`rounded px-3 py-2 transition ${active ? "bg-white/10" : "hover:bg-white/10"}`}
            >
              {it.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}