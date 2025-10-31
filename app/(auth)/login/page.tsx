"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Image from "next/image";
import { PALETA } from "@/lib/theme";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const router = useRouter();

  const addDebugLog = (message: string) => {
    setDebugLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
    console.log('[LOGIN]', message);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setOk(null);
    setDebugLogs([]);
    setLoading(true);

    try {
      addDebugLog(`Iniciando login para: ${email.trim()}`);

      // Verificar que localStorage está disponible
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('test', 'test');
          localStorage.removeItem('test');
          addDebugLog('✓ localStorage disponible');
        } catch (e) {
          addDebugLog('✗ ERROR: localStorage NO disponible');
          setErr('Tu navegador tiene el almacenamiento local deshabilitado. Por favor, habilita las cookies y el almacenamiento local en la configuración de tu navegador.');
          setLoading(false);
          return;
        }
      }

      addDebugLog('Conectando con servidor...');
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (error) {
        addDebugLog(`✗ ERROR de autenticación: ${error.message}`);
        setErr(error.message);
      } else {
        addDebugLog(`✓ Autenticación exitosa`);
        addDebugLog(`Sesión ${data.session ? 'creada correctamente' : 'NO creada'}`);

        // Verificar que la sesión se guardó
        addDebugLog('Verificando persistencia de sesión...');
        const { data: sessionData } = await supabase.auth.getSession();

        if (!sessionData.session) {
          addDebugLog('✗ ERROR: La sesión no se guardó en el navegador');
          setErr('Error al guardar la sesión. Tu navegador está bloqueando el almacenamiento. Por favor, permite cookies y almacenamiento local.');
          return;
        }

        addDebugLog('✓ Sesión guardada correctamente');
        addDebugLog('Redirigiendo a la aplicación...');
        router.replace("/");
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
      addDebugLog(`✗ EXCEPCIÓN: ${errorMsg}`);
      setErr('Error de conexión. Verifica tu conexión a internet y que tu navegador permite cookies.');
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
        redirectTo: 'https://www.fminci.com/update-password',
      });

      if (error) {
        setErr(error.message);
      } else {
        setOk("Revise su email para restablecer la contraseña.");
      }
    } catch (error) {
      console.error('Reset password error:', error);
      setErr('Error de conexión. Por favor, verifica tu conexión a internet.');
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 md:p-0" style={{ backgroundColor: PALETA.bg }}>
      <div className="flex w-full max-w-4xl relative">
        {/* Banda lateral con logo y marca - solo desktop */}
        <aside
          className="hidden md:flex flex-col justify-center items-center"
          style={{ backgroundColor: PALETA.bg, width: '120px' }}
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

        {/* Logo pegado al cuadro blanco por fuera, esquina inferior izquierda - solo desktop */}
        <div className="hidden md:block absolute bottom-0" style={{ left: '20px', zIndex: 10 }}>
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
        <section className="flex-1 bg-white p-6 md:p-12 shadow-xl relative rounded-lg md:rounded-none">
          {/* Logo centrado para móvil */}
          <div className="md:hidden flex justify-center mb-6">
            <Image
              src="/images/fminci-logo.png"
              alt="FMinci Logo"
              width={80}
              height={80}
              className="shadow-lg rounded-lg"
              style={{ objectFit: 'cover' }}
              priority={true}
            />
          </div>

          <div className="max-w-md mx-auto">
            <h1 className="text-2xl md:text-3xl font-bold text-center mb-2" style={{
              color: PALETA.bg,
              fontFamily: 'Montserrat, Poppins, sans-serif'
            }}>
              Inicio de sesión
            </h1>
            <p className="text-sm md:text-base text-center mb-6 md:mb-8" style={{
              color: PALETA.bg,
              fontFamily: 'Montserrat, Poppins, sans-serif'
            }}>
              Software de gestión de incidencias
            </p>

            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label className="block text-base font-medium mb-2" style={{ 
                  color: PALETA.bg,
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
                    borderBottomColor: email ? PALETA.bg : '#d1d5db',
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
                  color: PALETA.bg,
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
                    borderBottomColor: password ? PALETA.bg : '#d1d5db',
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
                <div className="text-sm p-3 rounded border-l-4" style={{
                  color: PALETA.bg,
                  backgroundColor: '#E8F5E9',
                  borderLeftColor: PALETA.bg
                }}>
                  {ok}
                </div>
              )}

              {/* Debug logs visibles en pantalla */}
              {debugLogs.length > 0 && (
                <div className="text-xs bg-gray-100 p-3 rounded border border-gray-300 max-h-40 overflow-y-auto">
                  <div className="font-semibold mb-2 text-gray-700">Información de diagnóstico:</div>
                  {debugLogs.map((log, index) => (
                    <div key={index} className="text-gray-600 font-mono mb-1">
                      {log}
                    </div>
                  ))}
                  <div className="mt-2 text-gray-500 italic text-xs">
                    Por favor, haz una captura de pantalla de esta información si el problema persiste.
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-md text-white font-medium transition-all duration-200 hover:opacity-90 disabled:opacity-50"
                style={{ 
                  backgroundColor: PALETA.bg,
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
                  color: PALETA.bg,
                  fontFamily: 'Montserrat, Poppins, sans-serif'
                }}
              >
                Restablecimiento de contraseña
              </button>
            </form>
          </div>
        </section>
      </div>

      {/* Footer - posicionado absolutamente en desktop, normalmente en móvil */}
      <div className="fixed md:absolute bottom-4 left-1/2 transform -translate-x-1/2 w-full px-4 md:px-0">
        <p className="text-xs md:text-sm text-center" style={{
          color: PALETA.texto,
          fontFamily: 'Montserrat, Poppins, sans-serif'
        }}>
          Software de gestión de incidencias para los centros de mayores de Fundación La Caixa
        </p>
      </div>
    </main>
  );
}