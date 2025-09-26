"use client";
import Topbar from "@/components/Topbar";
import Sidebar from "@/components/Sidebar";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);

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

  if (!ready) return null; // evita parpadeo sin sesión

 return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--fm-bg)" }}>
      <Topbar onToggleSidebar={toggleSidebar} />
      <div className="flex">
        {sidebarVisible && <Sidebar />}
        <main className={`flex-1 bg-transparent p-4 md:p-8 transition-all duration-300 ${!sidebarVisible ? 'ml-0' : ''}`}>
          {children}
        </main>
      </div>
    </div>
  );

}