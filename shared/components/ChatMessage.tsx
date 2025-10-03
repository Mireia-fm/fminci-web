import { PALETA } from '@/lib/theme';

export interface ChatMessageData {
  id: string;
  autor_email?: string | null;
  autor_rol?: string | null;
  cuerpo?: string | null;
  creado_en: string;
  es_sistema?: boolean | null;
  imagen_url?: string | null;
  documento_url?: string | null;
  adjuntos?: {
    id: string;
    tipo: string;
    nombre_archivo?: string | null;
    storage_key?: string | null;
  }[];
  personas?: {
    nombre: string | null;
    email: string;
  };
}

interface ChatMessageProps {
  mensaje: ChatMessageData;
  attachmentUrls?: Record<string, string>;
  onImageClick?: (url: string) => void;
  onDocumentClick?: (url: string, filename: string) => void;
}

export default function ChatMessage({
  mensaje,
  attachmentUrls = {},
  onImageClick,
  onDocumentClick
}: ChatMessageProps) {
  const getColorEmisor = (emisor: string) => {
    switch (emisor.toLowerCase()) {
      case 'cliente':
        return "#E8D36A";
      case 'control':
        return "#A9B88C";
      case 'gestor':
        return "#8F9B83";
      case 'proveedor':
        return "#D4A574";
      default:
        return PALETA.headerTable;
    }
  };

  const formatearFechaHora = (fecha: string) => {
    const date = new Date(fecha);
    return date.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const nombreEmisor = mensaje.personas?.nombre || mensaje.autor_email || 'Sistema';
  const rolEmisor = mensaje.autor_rol || 'Sistema';

  return (
    <div className="mb-4">
      {/* Header del mensaje */}
      <div className="flex items-center gap-2 mb-1">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
          style={{ backgroundColor: getColorEmisor(rolEmisor) }}
        >
          {nombreEmisor.substring(0, 2).toUpperCase()}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm" style={{ color: PALETA.textoOscuro }}>
              {nombreEmisor}
            </span>
            {mensaje.es_sistema && (
              <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#fbbf24', color: '#78350f' }}>
                Sistema
              </span>
            )}
          </div>
          <div className="text-xs" style={{ color: PALETA.textoOscuro + 'AA' }}>
            {formatearFechaHora(mensaje.creado_en)}
          </div>
        </div>
      </div>

      {/* Cuerpo del mensaje */}
      <div
        className="ml-10 p-3 rounded-lg shadow-sm"
        style={{
          backgroundColor: mensaje.es_sistema ? '#fffbeb' : PALETA.card,
          borderLeft: `3px solid ${getColorEmisor(rolEmisor)}`
        }}
      >
        {mensaje.cuerpo && (
          <div
            className="whitespace-pre-wrap text-sm leading-relaxed mb-2"
            style={{ color: PALETA.textoOscuro }}
          >
            {mensaje.cuerpo}
          </div>
        )}

        {/* Imagen del comentario (campo imagen_url) */}
        {mensaje.imagen_url && attachmentUrls[`imagen_${mensaje.id}`] && (
          <div className="mt-2">
            <div
              className="cursor-pointer border rounded-lg overflow-hidden hover:shadow-lg transition-shadow inline-block"
              style={{ borderColor: PALETA.bg }}
              onClick={() => onImageClick?.(attachmentUrls[`imagen_${mensaje.id}`])}
            >
              <img
                src={attachmentUrls[`imagen_${mensaje.id}`]}
                alt="Imagen adjunta"
                className="max-w-xs max-h-48 object-cover hover:scale-105 transition-transform duration-200"
                onError={(e) => {
                  console.error('Error cargando imagen del comentario');
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          </div>
        )}

        {/* Documento del comentario (campo documento_url) */}
        {mensaje.documento_url && attachmentUrls[`documento_${mensaje.id}`] && (
          <div className="mt-2">
            <a
              href={attachmentUrls[`documento_${mensaje.id}`]}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded hover:opacity-90 transition-opacity"
              style={{ backgroundColor: PALETA.verdeClaro, color: 'white' }}
              onClick={(e) => {
                if (onDocumentClick) {
                  e.preventDefault();
                  onDocumentClick(attachmentUrls[`documento_${mensaje.id}`], 'Documento adjunto');
                }
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Ver documento
            </a>
          </div>
        )}

        {/* Adjuntos modernos (tabla adjuntos) */}
        {mensaje.adjuntos && mensaje.adjuntos.length > 0 && (
          <div className="mt-2 space-y-2">
            {mensaje.adjuntos.map((adjunto) => {
              const url = attachmentUrls[adjunto.id];
              if (!url) return null;

              if (adjunto.tipo === 'imagen') {
                return (
                  <div
                    key={adjunto.id}
                    className="cursor-pointer border rounded-lg overflow-hidden hover:shadow-lg transition-shadow inline-block"
                    style={{ borderColor: PALETA.bg }}
                    onClick={() => onImageClick?.(url)}
                  >
                    <img
                      src={url}
                      alt={adjunto.nombre_archivo || 'Imagen adjunta'}
                      className="max-w-xs max-h-48 object-cover hover:scale-105 transition-transform duration-200"
                      onError={(e) => {
                        console.error('Error cargando adjunto:', adjunto.storage_key);
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                );
              } else {
                return (
                  <a
                    key={adjunto.id}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: PALETA.verdeClaro, color: 'white' }}
                    onClick={(e) => {
                      if (onDocumentClick) {
                        e.preventDefault();
                        onDocumentClick(url, adjunto.nombre_archivo || 'Documento');
                      }
                    }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    {adjunto.nombre_archivo || 'Ver documento'}
                  </a>
                );
              }
            })}
          </div>
        )}
      </div>
    </div>
  );
}
