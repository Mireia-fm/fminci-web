"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Image from "next/image";

const PALETA = {
  fondo: "#5D6D52",
  headerTable: "#D9B6A9",
  card: "#F9FAF8",
  filtros: "#E8B5A8",
  texto: "#EDF0E9",
  textoOscuro: "#4b4b4b",
  verdeClaro: "#A9B88C",
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); 
    setOk(null); 
    setLoading(true);
    
    try {
      const { error } = await supabase.auth.signInWithPassword({ 
        email: email.trim(), 
        password 
      });
      
      if (error) {
        setErr(error.message);
      } else {
        router.replace("/");
      }
    } catch (error) {
      console.error('Login error:', error);
      setErr('Error de conexión. Por favor, verifica tu conexión a internet.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setErr(null); 
    setOk(null);
    
    if (!email) { 
      setErr("Escribe tu email arriba y vuelve a pulsar."); 
      return; 
    }
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/update-password`,
      });
      
      if (error) {
        setErr(error.message);
      } else {
        setOk("Te hemos enviado un email para restablecer tu contraseña.");
      }
    } catch (error) {
      console.error('Reset password error:', error);
      setErr('Error de conexión. Por favor, verifica tu conexión a internet.');
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: PALETA.fondo }}>
      <div className="flex w-full max-w-4xl relative">
        {/* Banda lateral con logo y marca */}
        <aside 
          className="hidden md:flex flex-col justify-center items-center"
          style={{ backgroundColor: PALETA.fondo, width: '120px' }}
        >
          {/* Nombre de la aplicación en vertical - más cerca del logo */}
          <div className="flex items-center justify-center" style={{ transform: 'translateX(15px) translateY(-10px)' }}>
            <h1 style={{ 
              color: "#E8B5A8",
              fontSize: '70px',
              fontFamily: 'Montserrat, Poppins, sans-serif',
              fontWeight: '700',
              letterSpacing: '2px',
              lineHeight: '1',
              transform: 'rotate(270deg)',
              transformOrigin: 'center',
              whiteSpace: 'nowrap'
            }}>
              FMinci
            </h1>
          </div>
        </aside>

        {/* Logo pegado al cuadro blanco por fuera, esquina inferior izquierda */}
        <div className="absolute bottom-0" style={{ left: '20px', zIndex: 10 }}>
          <div className="relative">
            <Image
              src="/images/fminci-logo.png"
              alt="FMinci Logo"
              width={100}
              height={100}
              className="shadow-lg"
              style={{ objectFit: 'cover', transform: 'rotate(-90deg)' }}
              priority={true}
            />
            {/* Fallback si no hay imagen - se mostrará si la imagen no carga */}
            <noscript>
              <div className="w-25 h-25 bg-white/30 flex items-center justify-center shadow-lg">
                <span className="text-3xl font-bold" style={{ color: "#E8B5A8" }}>FM</span>
              </div>
            </noscript>
          </div>
        </div>

        {/* Tarjeta de login - estilo Wix */}
        <section className="flex-1 bg-white p-12 shadow-xl relative">
          <div className="max-w-md mx-auto">
            <h1 className="text-3xl font-bold text-center mb-2" style={{ 
              color: PALETA.fondo,
              fontFamily: 'Montserrat, Poppins, sans-serif'
            }}>
              Inicio de sesión
            </h1>
            <p className="text-center mb-8" style={{ 
              color: PALETA.fondo,
              fontFamily: 'Montserrat, Poppins, sans-serif'
            }}>
              Software de gestión de incidencias
            </p>

            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label className="block text-base font-medium mb-2" style={{ 
                  color: PALETA.fondo,
                  fontFamily: 'Montserrat, Poppins, sans-serif'
                }}>
                  Usuario *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border-b-2 focus:outline-none focus:border-2 text-base"
                  style={{ 
                    borderBottomColor: email ? PALETA.fondo : '#d1d5db',
                    fontFamily: 'Montserrat, Poppins, sans-serif',
                    color: '#A9B88C',
                    borderRadius: '0'
                  }}
                  placeholder="tu@correo.com"
                  required
                />
              </div>

              <div>
                <label className="block text-base font-medium mb-2" style={{ 
                  color: PALETA.fondo,
                  fontFamily: 'Montserrat, Poppins, sans-serif'
                }}>
                  Contraseña *
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border-b-2 focus:outline-none focus:border-2"
                  style={{ 
                    borderBottomColor: password ? PALETA.fondo : '#d1d5db',
                    fontFamily: 'Montserrat, Poppins, sans-serif',
                    color: '#A9B88C',
                    borderRadius: '0',
                    fontSize: '20px'
                  }}
                  placeholder="••••••••"
                  required
                />
              </div>

              {err && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded border-l-4 border-red-400">
                  {err}
                </div>
              )}
              {ok && (
                <div className="text-sm text-green-700 bg-green-50 p-3 rounded border-l-4 border-green-400">
                  {ok}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-md text-white font-medium transition-all duration-200 hover:opacity-90 disabled:opacity-50"
                style={{ 
                  backgroundColor: PALETA.fondo,
                  fontFamily: 'Montserrat, Poppins, sans-serif'
                }}
              >
                {loading ? "Accediendo..." : "Acceder"}
              </button>

              <button 
                type="button" 
                onClick={handleReset}
                className="block mx-auto text-sm underline mt-4 hover:opacity-80"
                style={{ 
                  color: PALETA.fondo,
                  fontFamily: 'Montserrat, Poppins, sans-serif'
                }}
              >
                ¿Olvidaste la contraseña?
              </button>
            </form>
          </div>
        </section>
      </div>

      {/* Footer */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
        <p className="text-sm" style={{ 
          color: PALETA.texto,
          fontFamily: 'Montserrat, Poppins, sans-serif'
        }}>
          Software de gestión de incidencias para los centros de mayores de Fundación La Caixa
        </p>
      </div>
    </main>
  );
}