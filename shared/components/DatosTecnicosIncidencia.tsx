import { PALETA } from '@/lib/theme';

export interface Incidencia {
  num_solicitud: string;
  descripcion: string;
  estado_cliente: string;
  centro?: string;
  fecha?: string;
  hora?: string;
  catalogacion?: string | null;
  prioridad?: string | null;
  instituciones?: {
    nombre: string;
  }[] | null;
}

export interface AdjuntoPrincipal {
  id: string;
  nombre_archivo?: string | null;
  storage_key?: string | null;
  visible_proveedor?: boolean | null;
}

interface DatosTecnicosIncidenciaProps {
  incidencia: Incidencia;
  imageUrls?: Record<string, string>;
  adjuntosPrincipales?: AdjuntoPrincipal[];
}

export default function DatosTecnicosIncidencia({
  incidencia,
  imageUrls = {},
  adjuntosPrincipales = []
}: DatosTecnicosIncidenciaProps) {
  const hasImages = adjuntosPrincipales.length > 0 &&
    adjuntosPrincipales.some(adjunto => imageUrls[adjunto.id]);

  return (
    <div
      className="rounded-lg mb-12 shadow-lg"
      style={{ backgroundColor: PALETA.card }}
    >
      <div
        className="px-6 py-4 border-b rounded-t-lg"
        style={{
          backgroundColor: PALETA.headerTable,
          color: PALETA.textoOscuro
        }}
      >
        <h2 className="text-lg font-semibold">DATOS TÉCNICOS DE LA INCIDENCIA</h2>
      </div>

      <div className={`grid grid-cols-1 ${hasImages ? 'lg:grid-cols-3' : ''} gap-6 p-6`}>
        {/* Tabla de datos técnicos */}
        <div className={hasImages ? "lg:col-span-2" : ""}>
          <table className="w-full text-sm">
            <tbody className="divide-y" style={{ borderColor: PALETA.headerTable }}>
              <tr>
                <td className="py-2 font-semibold w-1/3" style={{ color: PALETA.textoOscuro }}>
                  ID Solicitud:
                </td>
                <td className="py-2 font-mono" style={{ color: PALETA.textoOscuro }}>
                  {incidencia.num_solicitud}
                </td>
              </tr>

              <tr style={{ backgroundColor: `${PALETA.headerTable}20` }}>
                <td className="py-2 font-semibold" style={{ color: PALETA.textoOscuro }}>
                  Centro:
                </td>
                <td className="py-2" style={{ color: PALETA.textoOscuro }}>
                  {incidencia.instituciones?.[0]?.nombre || incidencia.centro || "-"}
                </td>
              </tr>

              <tr>
                <td className="py-2 font-semibold" style={{ color: PALETA.textoOscuro }}>
                  Fecha/Hora:
                </td>
                <td className="py-2 font-mono" style={{ color: PALETA.textoOscuro }}>
                  {incidencia.fecha && incidencia.hora
                    ? new Date(incidencia.fecha + 'T' + incidencia.hora).toLocaleString('es-ES', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : "-"
                  }
                </td>
              </tr>

              <tr style={{ backgroundColor: `${PALETA.headerTable}20` }}>
                <td className="py-2 font-semibold" style={{ color: PALETA.textoOscuro }}>
                  Estado:
                </td>
                <td className="py-2">
                  <span
                    className="px-2 py-1 rounded text-xs font-medium text-white"
                    style={{ backgroundColor: '#3b82f6' }}
                  >
                    {incidencia.estado_cliente}
                  </span>
                </td>
              </tr>

              <tr>
                <td className="py-2 font-semibold" style={{ color: PALETA.textoOscuro }}>
                  Catalogación:
                </td>
                <td className="py-2" style={{ color: PALETA.textoOscuro }}>
                  {incidencia.catalogacion || "Sin catalogar"}
                </td>
              </tr>

              <tr style={{ backgroundColor: `${PALETA.headerTable}20` }}>
                <td className="py-2 font-semibold" style={{ color: PALETA.textoOscuro }}>
                  Prioridad:
                </td>
                <td className="py-2">
                  {incidencia.prioridad ? (
                    <span
                      className="px-2 py-1 rounded text-xs font-medium text-white"
                      style={{
                        backgroundColor: incidencia.prioridad === 'Crítico' ? '#ef4444' : '#10b981'
                      }}
                    >
                      {incidencia.prioridad}
                    </span>
                  ) : (
                    <span style={{ color: PALETA.textoOscuro }}>No asignada</span>
                  )}
                </td>
              </tr>

              <tr>
                <td className="py-2 font-semibold align-top" style={{ color: PALETA.textoOscuro }}>
                  Descripción:
                </td>
                <td className="py-2 leading-relaxed" style={{ color: PALETA.textoOscuro }}>
                  {incidencia.descripcion}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Sección de imágenes - solo mostrar si hay imágenes */}
        {hasImages && (
          <div className="lg:col-span-1">
            <div className="rounded-lg p-4">
              <p className="py-2 font-semibold text-sm" style={{ color: PALETA.textoOscuro }}>
                Imagen:
              </p>

              <div className="space-y-3">
                {adjuntosPrincipales.map((adjunto) => {
                  const imageUrl = imageUrls[adjunto.id];
                  if (!imageUrl) return null;
                  return (
                    <div key={adjunto.id} className="text-center">
                      <div
                        className="cursor-pointer border-2 rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
                        style={{ borderColor: PALETA.bg }}
                        onClick={() => window.open(imageUrl, '_blank')}
                      >
                        <img
                          src={imageUrl}
                          alt={adjunto.nombre_archivo || "Imagen de la incidencia"}
                          className="w-full h-48 object-cover hover:scale-105 transition-transform duration-200"
                          onError={(e) => {
                            console.error('Error cargando imagen:', adjunto.storage_key);
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
