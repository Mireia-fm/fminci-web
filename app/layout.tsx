// app/layout.tsx
import "./globals.css";

export const metadata = {
  title: "FMinci",
  description: "Software de gestión de incidencias",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&family=Poppins:wght@400;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      {/* clases globales del body aquí */}
      <body className="min-h-screen">{children}</body>
    </html>
  );
}