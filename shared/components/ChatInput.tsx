import { PALETA } from '@/lib/theme';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onImageSelect?: (file: File | null) => void;
  onDocumentSelect?: (file: File | null) => void;
  selectedImage?: File | null;
  selectedDocument?: File | null;
  disabled?: boolean;
  loading?: boolean;
  placeholder?: string;
  showImageButton?: boolean;
  showDocumentButton?: boolean;
}

export default function ChatInput({
  value,
  onChange,
  onSubmit,
  onImageSelect,
  onDocumentSelect,
  selectedImage,
  selectedDocument,
  disabled = false,
  loading = false,
  placeholder = "Escribe un mensaje...",
  showImageButton = true,
  showDocumentButton = true
}: ChatInputProps) {
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImageSelect) {
      onImageSelect(file);
    }
  };

  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onDocumentSelect) {
      onDocumentSelect(file);
    }
  };

  const removeImage = () => {
    if (onImageSelect) {
      onImageSelect(null);
    }
  };

  const removeDocument = () => {
    if (onDocumentSelect) {
      onDocumentSelect(null);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {/* Archivos seleccionados */}
      {(selectedImage || selectedDocument) && (
        <div className="flex gap-2 flex-wrap">
          {selectedImage && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded text-sm" style={{ backgroundColor: PALETA.card }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="truncate max-w-xs" style={{ color: PALETA.textoOscuro }}>
                {selectedImage.name}
              </span>
              <button
                type="button"
                onClick={removeImage}
                className="text-red-500 hover:text-red-700"
              >
                ×
              </button>
            </div>
          )}

          {selectedDocument && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded text-sm" style={{ backgroundColor: PALETA.card }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <span className="truncate max-w-xs" style={{ color: PALETA.textoOscuro }}>
                {selectedDocument.name}
              </span>
              <button
                type="button"
                onClick={removeDocument}
                className="text-red-500 hover:text-red-700"
              >
                ×
              </button>
            </div>
          )}
        </div>
      )}

      {/* Input principal */}
      <div className="flex gap-2 items-end">
        {/* Botones de adjuntos */}
        <div className="flex gap-2">
          {showImageButton && onImageSelect && (
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
                disabled={disabled}
              />
              <div
                className="p-2 rounded hover:opacity-80 transition-opacity"
                style={{ backgroundColor: PALETA.verdeClaro }}
                title="Adjuntar imagen"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </label>
          )}

          {showDocumentButton && onDocumentSelect && (
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
                onChange={handleDocumentChange}
                className="hidden"
                disabled={disabled}
              />
              <div
                className="p-2 rounded hover:opacity-80 transition-opacity"
                style={{ backgroundColor: PALETA.verdeClaro }}
                title="Adjuntar documento"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </div>
            </label>
          )}
        </div>

        {/* Textarea */}
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 p-3 rounded-lg resize-none border"
          style={{
            backgroundColor: PALETA.card,
            borderColor: PALETA.headerTable,
            color: PALETA.textoOscuro
          }}
          rows={2}
          disabled={disabled}
        />

        {/* Botón enviar */}
        <button
          type="submit"
          disabled={disabled || loading || (!value.trim() && !selectedImage && !selectedDocument)}
          className="px-4 py-2 rounded-lg text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: PALETA.verdeClaro }}
        >
          {loading ? (
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>
      </div>
    </form>
  );
}
