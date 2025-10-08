"use client";
import UserButton from "./UserButton";
import Link from "next/link";
import Image from "next/image";

interface TopbarProps {
  onToggleSidebar?: () => void;
}

export default function Topbar({ onToggleSidebar }: TopbarProps) {
  return (
    <header className="h-14 w-full flex items-center justify-between px-4 md:px-6"
      style={{ backgroundColor: "var(--fm-bg)", color: "var(--fm-text)" }}>

      <div className="flex items-center gap-3">
        {/* Botón hamburguesa - visible en todas las resoluciones */}
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-md hover:bg-white/10 transition-colors"
            title="Mostrar/Ocultar menú"
            aria-label="Toggle menu"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-white"
            >
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
        )}

        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/images/fminci-logo.png"
            alt="FMinci Logo"
            width={32}
            height={32}
            className="rounded"
          />
          <span className="font-semibold tracking-wide text-white">FMinci</span>
        </Link>
      </div>

      <UserButton />
    </header>
  );
}