"use client";
import Topbar from "@/components/Topbar";
import Sidebar from "@/components/Sidebar";
import { AuthProvider } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

// Force dynamic rendering for all app routes
export const dynamic = 'force-dynamic';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true); // Abierto por defecto

  // Guardia de sesión en cliente
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }
      setReady(true);
    })();
  }, [router]);

  const toggleSidebar = () => {
    setSidebarVisible(!sidebarVisible);
  };

  const closeSidebar = () => {
    setSidebarVisible(false);
  };

  if (!ready) return null; // evita parpadeo sin sesión

  return (
    <ErrorBoundary>
      <AuthProvider>
        <div className="min-h-screen" style={{ backgroundColor: "var(--fm-bg)" }}>
          <Topbar onToggleSidebar={toggleSidebar} />
          <div className="flex relative">
            <Sidebar isOpen={sidebarVisible} onClose={closeSidebar} />
            <main className="flex-1 bg-transparent p-4 md:p-8 w-full md:w-auto">
              {children}
            </main>
          </div>
        </div>
      </AuthProvider>
    </ErrorBoundary>
  );
}