"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient"; // si no tienes alias @, usa: import { supabase } from "../lib/supabaseClient";

export default function UserButton() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user?.email ?? null);
    });
  }, []);

  return (
    <div className="flex items-center gap-3">
      {email && <span className="text-sm text-white/90">{email}</span>}
      <button
        onClick={async () => {
          await supabase.auth.signOut();
          router.replace("/login");
        }}
        className="px-4 py-2 text-sm bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white"
      >
        Salir
      </button>
    </div>
  );
}