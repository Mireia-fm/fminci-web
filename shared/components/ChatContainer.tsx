import { useRef, useEffect } from 'react';
import { PALETA } from '@/lib/theme';
import ChatMessage, { type ChatMessageData } from './ChatMessage';
import ChatInput from './ChatInput';

interface ChatContainerProps {
  title: string;
  mensajes: ChatMessageData[];
  nuevoMensaje: string;
  onMensajeChange: (value: string) => void;
  onEnviar: (e: React.FormEvent) => void;
  attachmentUrls?: Record<string, string>;
  onImageSelect?: (file: File | null) => void;
  onDocumentSelect?: (file: File | null) => void;
  selectedImage?: File | null;
  selectedDocument?: File | null;
  loading?: boolean;
  enviando?: boolean;
  showImageButton?: boolean;
  showDocumentButton?: boolean;
  autoScroll?: boolean;
  headerActions?: React.ReactNode;
}

export default function ChatContainer({
  title,
  mensajes,
  nuevoMensaje,
  onMensajeChange,
  onEnviar,
  attachmentUrls = {},
  onImageSelect,
  onDocumentSelect,
  selectedImage,
  selectedDocument,
  loading = false,
  enviando = false,
  showImageButton = true,
  showDocumentButton = true,
  autoScroll = true,
  headerActions
}: ChatContainerProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [mensajes]);

  const handleImageClick = (url: string) => {
    window.open(url, '_blank');
  };

  const handleDocumentClick = (url: string, filename: string) => {
    window.open(url, '_blank');
  };

  return (
    <div
      className="rounded-lg shadow-lg overflow-hidden"
      style={{ backgroundColor: PALETA.card }}
    >
      {/* Header */}
      <div
        className="px-6 py-4 border-b"
        style={{
          backgroundColor: PALETA.headerTable,
          color: PALETA.textoOscuro
        }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          {headerActions && (
            <div className="flex items-center gap-2">
              {headerActions}
            </div>
          )}
        </div>
      </div>

      {/* Mensajes */}
      <div
        className="p-6 overflow-y-auto"
        style={{
          maxHeight: '500px',
          minHeight: '300px',
          backgroundColor: PALETA.bg + '10'
        }}
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <svg className="animate-spin h-8 w-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p style={{ color: PALETA.textoOscuro }}>Cargando mensajes...</p>
            </div>
          </div>
        ) : mensajes.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-center" style={{ color: PALETA.textoOscuro }}>
              No hay mensajes todavía. ¡Sé el primero en escribir!
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {mensajes.map((mensaje) => (
              <ChatMessage
                key={mensaje.id}
                mensaje={mensaje}
                attachmentUrls={attachmentUrls}
                onImageClick={handleImageClick}
                onDocumentClick={handleDocumentClick}
              />
            ))}
            <div ref={messagesEndRef} id="messages-end" />
          </div>
        )}
      </div>

      {/* Input */}
      <div
        className="p-4 border-t"
        style={{ borderColor: PALETA.headerTable }}
      >
        <ChatInput
          value={nuevoMensaje}
          onChange={onMensajeChange}
          onSubmit={onEnviar}
          onImageSelect={onImageSelect}
          onDocumentSelect={onDocumentSelect}
          selectedImage={selectedImage}
          selectedDocument={selectedDocument}
          disabled={loading}
          loading={enviando}
          showImageButton={showImageButton}
          showDocumentButton={showDocumentButton}
        />
      </div>
    </div>
  );
}
