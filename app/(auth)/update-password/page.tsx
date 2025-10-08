"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Image from "next/image";
import { PALETA } from "@/lib/theme";

export default function UpdatePassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [validToken, setValidToken] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Verificar si hay un token de recuperación en la URL
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const type = hashParams.get('type');
    const errorDescription = hashParams.get('error_description');

    if (errorDescription) {
      setErr('El enlace ha expirado o ya fue utilizado. Si recibió varios emails, use el más reciente.');
    } else if (accessToken && type === 'recovery') {
      setValidToken(true);
    } else {
      setErr('Enlace inválido o expirado. Por favor, solicita un nuevo enlace de recuperación.');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setOk(null);

    // Validaciones
    if (password.length < 6) {
      setErr("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setErr("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setErr(error.message);
      } else {
        setOk("¡Contraseña actualizada exitosamente! Redirigiendo al inicio de sesión...");

        // Cerrar sesión y redirigir al login después de 2 segundos
        setTimeout(async () => {
          await supabase.auth.signOut();
          router.replace("/login");
        }, 2000);
      }
    } catch (error) {
      console.error('Update password error:', error);
      setErr('Error de conexión. Por favor, verifica tu conexión a internet.');
    } finally {
      setLoading(false);
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
          </div>
        </div>

        {/* Tarjeta de actualización de contraseña */}
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
              Nueva Contraseña
            </h1>
            <p className="text-sm md:text-base text-center mb-6 md:mb-8" style={{
              color: PALETA.bg,
              fontFamily: 'Montserrat, Poppins, sans-serif'
            }}>
              Crea tu nueva contraseña segura
            </p>

            {!validToken ? (
              <div className="text-center">
                <div className="text-sm text-red-600 bg-red-50 p-4 rounded border-l-4 border-red-400 mb-4">
                  {err}
                </div>
                <button
                  onClick={() => router.push('/login')}
                  className="text-sm underline hover:opacity-80"
                  style={{
                    color: PALETA.bg,
                    fontFamily: 'Montserrat, Poppins, sans-serif'
                  }}
                >
                  Volver al inicio de sesión
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-base font-medium mb-2" style={{
                    color: PALETA.bg,
                    fontFamily: 'Montserrat, Poppins, sans-serif'
                  }}>
                    Nueva Contraseña *
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
                    minLength={6}
                  />
                  <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
                    Mínimo 6 caracteres
                  </p>
                </div>

                <div>
                  <label className="block text-base font-medium mb-2" style={{
                    color: PALETA.bg,
                    fontFamily: 'Montserrat, Poppins, sans-serif'
                  }}>
                    Confirmar Contraseña *
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 border-b-2 focus:outline-none focus:border-2"
                    style={{
                      borderBottomColor: confirmPassword ? PALETA.bg : '#d1d5db',
                      fontFamily: 'Montserrat, Poppins, sans-serif',
                      color: '#A9B88C',
                      borderRadius: '0',
                      fontSize: '20px'
                    }}
                    placeholder="••••••••"
                    required
                    minLength={6}
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
                  disabled={loading || !!ok}
                  className="w-full py-3 rounded-md text-white font-medium transition-all duration-200 hover:opacity-90 disabled:opacity-50"
                  style={{
                    backgroundColor: PALETA.bg,
                    fontFamily: 'Montserrat, Poppins, sans-serif'
                  }}
                >
                  {loading ? "Actualizando..." : ok ? "¡Listo!" : "Actualizar Contraseña"}
                </button>

                <button
                  type="button"
                  onClick={() => router.push('/login')}
                  className="block mx-auto text-sm underline mt-4 hover:opacity-80"
                  style={{
                    color: PALETA.bg,
                    fontFamily: 'Montserrat, Poppins, sans-serif'
                  }}
                >
                  Volver al inicio de sesión
                </button>
              </form>
            )}
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