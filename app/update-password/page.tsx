"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function UpdatePassword() {
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string|null>(null);
  const [ok, setOk]   = useState<string|null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setOk(null);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) setErr(error.message);
    else { setOk("Contraseña actualizada. Redirigiendo..."); setTimeout(()=>router.replace("/login"), 1200); }
  };

  return (
    <main className="min-h-screen grid place-items-center bg-gray-50 p-6">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow w-full max-w-md space-y-4">
        <h1 className="text-xl font-semibold">Nueva contraseña</h1>
        <input
          type="password"
          value={password}
          onChange={(e)=>setPassword(e.target.value)}
          className="w-full border rounded p-2"
          placeholder="••••••••"
          required
        />
        {err && <p className="text-red-600 text-sm">{err}</p>}
        {ok  && <p className="text-green-700 text-sm">{ok}</p>}
        <button className="w-full bg-black text-white py-2 rounded">Guardar</button>
      </form>
    </main>
  );
}