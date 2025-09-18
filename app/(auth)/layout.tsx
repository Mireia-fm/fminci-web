export default function AuthLayout({ children }: { children: React.ReactNode }) {
  // envuelve en un div y coloca aquí el estilo del login centrado
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#5D6D52]">
      {children}
    </div>
  );
}