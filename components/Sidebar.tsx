"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePerfil } from "@/hooks/usePerfil";
import { useEffect } from "react";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { perfil } = usePerfil();

  // Cerrar sidebar en móvil cuando cambia la ruta
  useEffect(() => {
    if (onClose) {
      onClose();
    }
  }, [pathname]);

  // Items según rol
  const items = perfil?.es_proveedor
    ? [
        { href: "/", label: "Dashboard" },
        { href: "/incidencias", label: "Mis Incidencias" },
        { href: "/calendario", label: "Calendario" },
      ]
    : perfil?.rol === "Control"
    ? [
        { href: "/", label: "Dashboard" },
        { href: "/incidencias", label: "Incidencias" },
        { href: "/control/presupuestos", label: "Presupuestos" },
      ]
    : [
        { href: "/", label: "Dashboard" },
        { href: "/incidencias", label: "Incidencias" },
        { href: "/calendario", label: "Calendario" },
      ];

  return (
    <>
      {/* Overlay para móvil */}
      {isOpen && onClose && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:static
          inset-y-0 left-0
          w-60
          flex-col p-5 gap-1
          z-50
          transition-transform duration-300
          md:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          md:flex
          ${isOpen ? 'flex' : 'hidden md:flex'}
        `}
        style={{
          backgroundColor: "var(--fm-bg)",
          color: "var(--fm-text)",
          top: '56px', // Altura del topbar
          height: 'calc(100vh - 56px)'
        }}
      >
        <nav className="flex flex-col">
          {items.map(it => {
            const active = pathname === it.href ||
              (it.href !== "/" && it.href !== "/control" && pathname.startsWith(it.href)) ||
              (it.href === "/control" && pathname === "/control");
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
    </>
  );
}
