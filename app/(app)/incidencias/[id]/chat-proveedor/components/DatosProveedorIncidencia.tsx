import { PALETA } from '@/lib/theme';

/**
 * Tipos
 */
type Adjunto = {
  id: string;
  tipo: string;
  nombre_archivo?: string | null;
  storage_key?: string | null;
};

type Incidencia = {
  id: string;
  num_solicitud: string;
  descripcion: string;
  estado_cliente: string;
  estado_proveedor?: string;
  prioridad_proveedor?: string;
  descripcion_proveedor?: string;
  centro?: string;
  fecha?: string;
  hora?: string;
  catalogacion?: string;
  instituciones?: {
    nombre: string;
    direccion?: string;
  }[] | null;
  adjuntos_principales?: Adjunto[];
};

interface Props {
  incidencia: Incidencia;
  imageUrls: Record<string, string>;
  direccionCentro: string | null;
  fechaAsignacionProveedor: string | null;
  userRole: string;
}

/**
 * Componente para mostrar los datos técnicos de la incidencia
 * en el contexto del chat proveedor
 */
export default function DatosProveedorIncidencia({
  incidencia,
  imageUrls,
  direccionCentro,
  fechaAsignacionProveedor,
  userRole
}: Props) {
  // Determinar si hay imágenes para mostrar
  const hasImages = incidencia.adjuntos_principales &&
    incidencia.adjuntos_principales.length > 0 &&
    incidencia.adjuntos_principales.some(adjunto => imageUrls[adjunto.id]);

  return (
    <div className="px-6 mb-6">
      <div className="rounded-lg shadow-lg" style={{ backgroundColor: PALETA.card }}>
        <div
          className="px-6 py-4 mb-6 border-b rounded-t-lg"
          style={{
            backgroundColor: PALETA.headerTable,
            color: PALETA.textoOscuro
          }}
        >
          <h2 className="text-lg font-semibold">DATOS TÉCNICOS DE LA INCIDENCIA</h2>
        </div>

        <div className={`grid grid-cols-1 ${hasImages ? 'lg:grid-cols-3' : ''} gap-6 px-6 pb-6`}>
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
                    <div className="flex items-center gap-2">
                      <span>{incidencia.instituciones?.[0]?.nombre || incidencia.centro || "-"}</span>
                      {direccionCentro && (
                        <button
                          onClick={() => {
                            window.open(direccionCentro || '', '_blank');
                          }}
                          className="px-2 py-1 text-xs rounded text-white hover:opacity-90 transition-opacity"
                          style={{ backgroundColor: PALETA.bg }}
                          title="Ir a la dirección"
                        >
                          📍 Ir a la dirección
                        </button>
                      )}
                    </div>
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
                      {incidencia.estado_proveedor || "Sin asignar"}
                    </span>
                  </td>
                </tr>

                <tr>
                  <td className="py-2 font-semibold" style={{ color: PALETA.textoOscuro }}>
                    Fecha de Creación:
                  </td>
                  <td className="py-2" style={{ color: PALETA.textoOscuro }}>
                    {incidencia.fecha && incidencia.hora
                      ? new Date(`${incidencia.fecha}T${incidencia.hora}`).toLocaleString('es-ES', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : '-'}
                  </td>
                </tr>

                <tr style={{ backgroundColor: `${PALETA.headerTable}20` }}>
                  <td className="py-2 font-semibold" style={{ color: PALETA.textoOscuro }}>
                    Fecha de Asignación:
                  </td>
                  <td className="py-2" style={{ color: PALETA.textoOscuro }}>
                    {fechaAsignacionProveedor ? new Date(fechaAsignacionProveedor).toLocaleString('es-ES', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : '-'}
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
                    {incidencia.prioridad_proveedor ? (
                      <span
                        className="px-2 py-1 rounded text-xs font-medium text-white"
                        style={{
                          backgroundColor: incidencia.prioridad_proveedor === 'Crítico' ? '#ef4444' : '#10b981'
                        }}
                      >
                        {incidencia.prioridad_proveedor}
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
                    {incidencia.descripcion_proveedor || incidencia.descripcion}
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
                  {incidencia.adjuntos_principales?.map((adjunto) => {
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
    </div>
  );
}
