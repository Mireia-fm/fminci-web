# Guía de Uso de la Nueva Arquitectura

Esta guía muestra cómo usar los servicios, hooks y componentes creados durante la refactorización.

## Tabla de Contenidos
1. [Servicios (Sprint 1)](#servicios-sprint-1)
2. [Hooks (Sprint 2)](#hooks-sprint-2)
3. [Componentes (Sprint 3)](#componentes-sprint-3)
4. [Ejemplo Completo: Chat Simplificado](#ejemplo-completo-chat-simplificado)

---

## Servicios (Sprint 1)

### storageService

**Obtener URL firmada de un archivo:**
```typescript
import { obtenerUrlFirmada } from '@/lib/services/storageService';

// Obtener una sola URL
const { url, error } = await obtenerUrlFirmada('incidencias/12345/imagen.jpg');
if (url) {
  console.log('URL firmada:', url);
}

// Obtener múltiples URLs
import { obtenerUrlsMultiples } from '@/lib/services/storageService';

const storageKeys = ['incidencias/12345/img1.jpg', 'incidencias/12345/img2.jpg'];
const urlMap = await obtenerUrlsMultiples(storageKeys);

// urlMap es un Map<string, string | null>
storageKeys.forEach(key => {
  const url = urlMap.get(key);
  console.log(`${key} -> ${url}`);
});
```

**Subir archivos:**
```typescript
import { subirArchivo, subirMultiples } from '@/lib/services/storageService';

// Subir un solo archivo
const file = new File(['contenido'], 'documento.pdf');
const { ruta, error } = await subirArchivo(file, 'incidencias/12345/docs/documento.pdf');
if (ruta) {
  console.log('Archivo subido a:', ruta);
}

// Subir múltiples archivos
const files = [file1, file2, file3];
const rutasExitosas = await subirMultiples(files, 'incidencias/12345/adjuntos');
console.log(`${rutasExitosas.length} archivos subidos`);
```

### comentariosService

**Obtener comentarios:**
```typescript
import { obtenerComentarios } from '@/lib/services/comentariosService';

// Obtener todos los comentarios de una incidencia
const comentarios = await obtenerComentarios('incidencia-id-123');

// Filtrar por ámbito
const comentariosCliente = await obtenerComentarios('incidencia-id-123', 'cliente');
const comentariosProveedor = await obtenerComentarios('incidencia-id-123', 'proveedor');
```

**Crear comentario:**
```typescript
import { crearComentario, type NuevoComentario } from '@/lib/services/comentariosService';

const nuevoComentario: NuevoComentario = {
  incidencia_id: 'incidencia-id-123',
  ambito: 'cliente',
  autor_id: 'user-id-456',
  autor_email: 'usuario@example.com',
  autor_rol: 'Control',
  cuerpo: 'Este es un mensaje de prueba',
  es_sistema: false
};

const comentarioCreado = await crearComentario(nuevoComentario);
if (comentarioCreado) {
  console.log('Comentario creado con ID:', comentarioCreado.id);
}
```

### proveedorCasosService

**Gestionar proveedores:**
```typescript
import {
  obtenerProveedorActivo,
  asignarProveedor,
  actualizarEstadoProveedor
} from '@/lib/services/proveedorCasosService';

// Obtener proveedor activo
const proveedorActivo = await obtenerProveedorActivo('incidencia-id-123');
if (proveedorActivo) {
  console.log('Proveedor:', proveedorActivo.proveedores?.nombre);
  console.log('Estado:', proveedorActivo.estado_proveedor);
}

// Asignar proveedor
const nuevaAsignacion = await asignarProveedor({
  incidencia_id: 'incidencia-id-123',
  proveedor_id: 'proveedor-id-789',
  prioridad: 'Normal',
  asignado_por: 'user-id-456'
});

// Actualizar estado
await actualizarEstadoProveedor('incidencia-id-123', 'En proceso');
```

---

## Hooks (Sprint 2)

### useSignedUrls

**Cargar URLs automáticamente:**
```typescript
import { useSignedUrls } from '@/shared/hooks/useSignedUrls';

function MisAdjuntos({ adjuntos }) {
  const { urls, loading, error } = useSignedUrls(adjuntos);

  if (loading) return <div>Cargando imágenes...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {adjuntos.map(adjunto => (
        <img key={adjunto.id} src={urls[adjunto.id]} alt={adjunto.nombre_archivo} />
      ))}
    </div>
  );
}
```

### useChatFileUpload

**Manejar archivos en chat:**
```typescript
import { useChatFileUpload } from '@/shared/hooks/useFileUpload';

function MiChat({ numSolicitud }) {
  const {
    imagenSeleccionada,
    documentoSeleccionado,
    seleccionarImagen,
    seleccionarDocumento,
    limpiar,
    uploadFiles,
    uploading,
    tieneArchivos
  } = useChatFileUpload(numSolicitud);

  const handleEnviar = async () => {
    // Subir archivos primero
    const { imagenUrl, documentoUrl } = await uploadFiles();

    // Crear comentario con URLs
    await crearComentario({
      // ...otros campos
      imagen_url: imagenUrl,
      documento_url: documentoUrl
    });

    limpiar();
  };

  return (
    <div>
      <input type="file" onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) seleccionarImagen(file);
      }} />

      {tieneArchivos && (
        <button onClick={handleEnviar} disabled={uploading}>
          {uploading ? 'Subiendo...' : 'Enviar'}
        </button>
      )}
    </div>
  );
}
```

### useChat

**Gestión completa de chat:**
```typescript
import { useChat } from '@/shared/hooks/useChat';

function MiChatPage({ incidenciaId }) {
  const {
    usuario,
    comentarios,
    nuevoComentario,
    setNuevoComentario,
    enviarComentario,
    enviarComentarioSistema,
    enviando,
    loading
  } = useChat({
    incidenciaId,
    ambito: 'cliente',
    onComentarioEnviado: () => console.log('Mensaje enviado!')
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    await enviarComentario(nuevoComentario);
  };

  if (loading) return <div>Cargando chat...</div>;

  return (
    <div>
      <h2>Usuario: {usuario?.nombre}</h2>

      {comentarios.map(msg => (
        <div key={msg.id}>{msg.cuerpo}</div>
      ))}

      <form onSubmit={handleSubmit}>
        <textarea
          value={nuevoComentario}
          onChange={(e) => setNuevoComentario(e.target.value)}
        />
        <button type="submit" disabled={enviando}>
          Enviar
        </button>
      </form>
    </div>
  );
}
```

---

## Componentes (Sprint 3)

### DatosTecnicosIncidencia

```typescript
import DatosTecnicosIncidencia from '@/shared/components/DatosTecnicosIncidencia';
import { useSignedUrls } from '@/shared/hooks/useSignedUrls';

function VistaIncidencia({ incidencia }) {
  const { urls } = useSignedUrls(incidencia.adjuntos_principales);

  return (
    <DatosTecnicosIncidencia
      incidencia={incidencia}
      imageUrls={urls}
      adjuntosPrincipales={incidencia.adjuntos_principales}
    />
  );
}
```

### ChatMessage

```typescript
import ChatMessage from '@/shared/components/ChatMessage';

function ListaMensajes({ mensajes, attachmentUrls }) {
  return (
    <div>
      {mensajes.map(mensaje => (
        <ChatMessage
          key={mensaje.id}
          mensaje={mensaje}
          attachmentUrls={attachmentUrls}
          onImageClick={(url) => window.open(url, '_blank')}
        />
      ))}
    </div>
  );
}
```

### ChatInput

```typescript
import ChatInput from '@/shared/components/ChatInput';

function FormularioChat() {
  const [mensaje, setMensaje] = useState('');
  const [imagen, setImagen] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    // Lógica de envío
    setEnviando(false);
  };

  return (
    <ChatInput
      value={mensaje}
      onChange={setMensaje}
      onSubmit={handleSubmit}
      onImageSelect={setImagen}
      selectedImage={imagen}
      loading={enviando}
      placeholder="Escribe tu mensaje..."
    />
  );
}
```

### ChatContainer

**Componente completo de chat:**
```typescript
import ChatContainer from '@/shared/components/ChatContainer';
import { useChat } from '@/shared/hooks/useChat';
import { useComentarioUrls } from '@/shared/hooks/useSignedUrls';
import { useChatFileUpload } from '@/shared/hooks/useFileUpload';

function PaginaChat({ incidenciaId, numSolicitud }) {
  // Hook principal de chat
  const {
    comentarios,
    nuevoComentario,
    setNuevoComentario,
    enviarComentario,
    enviando,
    loading
  } = useChat({ incidenciaId, ambito: 'cliente' });

  // URLs de adjuntos
  const { urls: attachmentUrls } = useComentarioUrls(comentarios);

  // Manejo de archivos
  const {
    imagenSeleccionada,
    documentoSeleccionado,
    seleccionarImagen,
    seleccionarDocumento,
    uploadFiles,
    limpiar
  } = useChatFileUpload(numSolicitud);

  const handleEnviar = async (e: React.FormEvent) => {
    e.preventDefault();

    // Subir archivos si existen
    const { imagenUrl, documentoUrl } = await uploadFiles();

    // Enviar comentario con URLs
    await enviarComentario(nuevoComentario, imagenUrl, documentoUrl);

    // Limpiar archivos
    limpiar();
  };

  return (
    <ChatContainer
      title="Chat con Cliente"
      mensajes={comentarios}
      nuevoMensaje={nuevoComentario}
      onMensajeChange={setNuevoComentario}
      onEnviar={handleEnviar}
      attachmentUrls={attachmentUrls}
      onImageSelect={seleccionarImagen}
      onDocumentSelect={seleccionarDocumento}
      selectedImage={imagenSeleccionada}
      selectedDocument={documentoSeleccionado}
      loading={loading}
      enviando={enviando}
    />
  );
}
```

---

## Ejemplo Completo: Chat Simplificado

Este es un ejemplo completo de cómo sería una página de chat usando todos los servicios, hooks y componentes:

```typescript
"use client";

import { useParams, useRouter } from "next/navigation";
import DatosTecnicosIncidencia from "@/shared/components/DatosTecnicosIncidencia";
import ChatContainer from "@/shared/components/ChatContainer";
import { useChat } from "@/shared/hooks/useChat";
import { useSignedUrls, useComentarioUrls } from "@/shared/hooks/useSignedUrls";
import { useChatFileUpload } from "@/shared/hooks/useFileUpload";
import { PALETA } from "@/lib/theme";

export default function ChatSimplificado() {
  const params = useParams();
  const router = useRouter();
  const incidenciaId = params.id as string;

  // Cargar datos de incidencia (simplificado)
  const [incidencia, setIncidencia] = useState(null);

  useEffect(() => {
    // Cargar incidencia desde Supabase
    // ...
  }, [incidenciaId]);

  // Hook principal de chat
  const {
    usuario,
    comentarios,
    nuevoComentario,
    setNuevoComentario,
    enviarComentario,
    enviando,
    loading: loadingChat
  } = useChat({
    incidenciaId,
    ambito: 'cliente'
  });

  // URLs firmadas para imágenes principales
  const { urls: imageUrls } = useSignedUrls(incidencia?.adjuntos_principales);

  // URLs firmadas para adjuntos de comentarios
  const { urls: commentUrls } = useComentarioUrls(comentarios);

  // Manejo de archivos
  const {
    imagenSeleccionada,
    documentoSeleccionado,
    seleccionarImagen,
    seleccionarDocumento,
    uploadFiles,
    limpiar
  } = useChatFileUpload(incidencia?.num_solicitud || '');

  const handleEnviarMensaje = async (e: React.FormEvent) => {
    e.preventDefault();

    // Subir archivos
    const { imagenUrl, documentoUrl } = await uploadFiles();

    // Enviar comentario
    await enviarComentario(nuevoComentario, imagenUrl, documentoUrl);

    // Limpiar
    limpiar();
  };

  if (!incidencia || loadingChat) {
    return <div>Cargando...</div>;
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: PALETA.bg }}>
      {/* Header */}
      <div className="flex justify-between items-center p-6">
        <button
          onClick={() => router.push("/incidencias")}
          className="text-white text-sm hover:underline"
        >
          ← Volver a incidencias
        </button>
      </div>

      {/* Contenido */}
      <div className="px-6 pb-6">
        {/* Datos Técnicos */}
        <DatosTecnicosIncidencia
          incidencia={incidencia}
          imageUrls={imageUrls}
          adjuntosPrincipales={incidencia.adjuntos_principales}
        />

        {/* Chat */}
        <ChatContainer
          title="CHAT CON CLIENTE"
          mensajes={comentarios}
          nuevoMensaje={nuevoComentario}
          onMensajeChange={setNuevoComentario}
          onEnviar={handleEnviarMensaje}
          attachmentUrls={commentUrls}
          onImageSelect={seleccionarImagen}
          onDocumentSelect={seleccionarDocumento}
          selectedImage={imagenSeleccionada}
          selectedDocument={documentoSeleccionado}
          enviando={enviando}
        />
      </div>
    </div>
  );
}
```

**Comparación con el código original:**
- **Antes**: ~1810 líneas
- **Después**: ~120 líneas
- **Reducción**: ~93%

---

## Beneficios de la Nueva Arquitectura

### 1. Mantenibilidad
- Cambios en la UI solo requieren modificar componentes
- Cambios en lógica de negocio solo requieren modificar servicios
- Un bug en URL signing se arregla en un solo lugar

### 2. Testabilidad
```typescript
// Testear servicio de comentarios
test('crearComentario crea un comentario correctamente', async () => {
  const resultado = await crearComentario({...});
  expect(resultado).toBeDefined();
  expect(resultado.id).toBeTruthy();
});

// Testear hook (con @testing-library/react-hooks)
test('useChat carga comentarios correctamente', async () => {
  const { result, waitForNextUpdate } = renderHook(() =>
    useChat({ incidenciaId: '123', ambito: 'cliente' })
  );

  await waitForNextUpdate();
  expect(result.current.comentarios).toHaveLength(3);
});

// Testear componente (con @testing-library/react)
test('ChatMessage muestra el mensaje correctamente', () => {
  const { getByText } = render(
    <ChatMessage mensaje={mockMensaje} />
  );

  expect(getByText('Hola mundo')).toBeInTheDocument();
});
```

### 3. Reutilización
- Los mismos componentes pueden usarse en chat-control-cliente y chat-proveedor
- Los hooks pueden usarse en cualquier componente que necesite chat
- Los servicios pueden usarse desde cualquier parte de la aplicación

### 4. TypeScript
- Todos los servicios, hooks y componentes tienen types completos
- Auto-completado en el IDE
- Detección de errores en tiempo de desarrollo

---

## Próximos Pasos Recomendados

1. **Integrar gradualmente** en archivos existentes:
   - Empezar con `chat-control-cliente`
   - Reemplazar una función a la vez
   - Testear después de cada cambio
   - Commit frecuente

2. **Extender la arquitectura**:
   - Crear `presupuestosService` para gestión de presupuestos
   - Crear `visitasService` para gestión de citas
   - Crear componentes para formularios repetidos

3. **Optimizaciones futuras**:
   - Implementar caching en servicios
   - Añadir React Query para gestión de estado de servidor
   - Migrar a Server Components de Next.js 15 donde tenga sentido

4. **Testing**:
   - Escribir tests unitarios para servicios
   - Escribir tests para hooks con @testing-library/react-hooks
   - Escribir tests para componentes con @testing-library/react
