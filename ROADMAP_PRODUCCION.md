# 🚀 Roadmap para Producción - FMINCI Web

**Fecha de creación:** 2025-10-02
**Versión actual:** Pre-producción
**Estado:** Listo para Fase 3 y optimizaciones finales

---

## 📋 Índice

1. [Estado Actual del Proyecto](#estado-actual-del-proyecto)
2. [Mejoras Completadas](#mejoras-completadas)
3. [Fase 3: Centralización de Servicios](#fase-3-centralización-de-servicios)
4. [Fase 4: Refactorización de Chat Proveedor](#fase-4-refactorización-de-chat-proveedor)
5. [Mejoras Críticas para Producción](#mejoras-críticas-para-producción)
6. [Mejoras Recomendadas](#mejoras-recomendadas)
7. [Optimizaciones de Performance](#optimizaciones-de-performance)
8. [Checklist Pre-Producción](#checklist-pre-producción)

---

## 📊 Estado Actual del Proyecto

### ✅ Completado (Fases 1 y 2)

#### Fase 1: Centralización de Queries y Theming
**Objetivo:** Eliminar duplicación de código y centralizar lógica común

**Archivos creados:**
- ✅ `contexts/AuthContext.tsx` - Manejo centralizado de autenticación
- ✅ `lib/incidenciasService.ts` - Queries de incidencias centralizadas
- ✅ `lib/theme.ts` - Colores y constantes centralizadas

**Refactorizaciones:**
- ✅ `components/DashboardProveedor.tsx` - 383 → 273 líneas (-28%)
- ✅ `components/DashboardCliente.tsx` - 437 → 280 líneas (-36%)
- ✅ **Fix N+1 query** en DashboardCliente para gestores

**Impacto:**
- 🔥 ~150 líneas de código eliminadas
- 🔥 PALETA unificada en 13 archivos
- 🔥 Queries optimizadas (reducción de N queries a 1)

#### Fase 2: Aplicación de useAuth()
**Objetivo:** Usar AuthContext en todos los componentes

**Archivos refactorizados:**
- ✅ `app/(app)/incidencias/page.tsx` - Eliminadas ~60 líneas
- ✅ `app/(app)/incidencias/nueva/page.tsx` - Simplificado
- ✅ `app/(app)/control/page.tsx` - 143 → 102 líneas (-29%)
- ✅ `app/(app)/calendario/page.tsx` - Queries eliminadas

**Impacto:**
- 🔥 ~200 líneas adicionales eliminadas
- 🔥 Auth completamente centralizado
- 🔥 Cero verificaciones manuales de rol en componentes

#### Migración de Seguridad: Roles Nativos PostgreSQL
**Objetivo:** Implementar seguridad real a nivel de base de datos

**Logros:**
- ✅ 7 migraciones aplicadas exitosamente
- ✅ 26 políticas RLS nuevas creadas
- ✅ 100% de tablas con RLS habilitado
- ✅ 0 errores de seguridad (antes: 5 ERROR)
- ✅ Trigger automático de sincronización
- ✅ Funciones SECURITY DEFINER protegidas

**Documentación:**
- 📄 [MIGRACION_ROLES_NATIVOS.md](MIGRACION_ROLES_NATIVOS.md) - Informe completo

### 📈 Métricas de Mejora

| Métrica | Antes | Después | Mejora |
|---------|-------|---------|--------|
| Líneas de código duplicado | ~350 | 0 | ✅ -100% |
| Archivos con PALETA local | 13 | 0 | ✅ -100% |
| Tablas sin RLS | 10 | 0 | ✅ -100% |
| Errores de seguridad | 5 | 0 | ✅ -100% |
| N+1 queries | 1 | 0 | ✅ -100% |
| Build time | ~13s | ~12s | ✅ -8% |

---

## 🎯 Fase 3: Centralización de Servicios

**Estado:** 🔴 PENDIENTE
**Prioridad:** 🔥 ALTA (requerido antes de producción)
**Tiempo estimado:** 4-6 horas

### Objetivo

Eliminar queries duplicadas de comentarios y presupuestos, actualmente esparcidas en múltiples archivos.

### 3.1 Crear `lib/comentariosService.ts`

**Archivos afectados:**
- `app/(app)/incidencias/[id]/chat-control-cliente/page.tsx` (1,200 líneas)
- `app/(app)/incidencias/[id]/chat-proveedor/page.tsx` (3,843 líneas)

**Funciones a crear:**

```typescript
// lib/comentariosService.ts

import { supabase } from "./supabaseClient";
import { Perfil } from "@/contexts/AuthContext";

export type Comentario = {
  id: string;
  incidencia_id: string;
  ambito: "cliente" | "proveedor" | "ambos";
  proveedor_id?: string;
  autor_id?: string;
  autor_email?: string;
  autor_rol?: string;
  es_sistema: boolean;
  cuerpo?: string;
  imagen_url?: string;
  documento_url?: string;
  creado_en: string;
};

/**
 * Obtener todos los comentarios de una incidencia
 * Filtra automáticamente por ámbito según el rol del usuario
 */
export async function obtenerComentarios(
  incidenciaId: string,
  perfil: Perfil,
  proveedorId?: string
): Promise<Comentario[]> {
  // Implementar lógica según rol:
  // - Control: ve todos los comentarios
  // - Proveedor: ve solo ámbito "proveedor" y "ambos" de su proveedor
  // - Cliente/Gestor: ve solo ámbito "cliente" y "ambos"
}

/**
 * Crear un nuevo comentario
 */
export async function crearComentario(
  data: {
    incidencia_id: string;
    ambito: "cliente" | "proveedor" | "ambos";
    proveedor_id?: string;
    cuerpo?: string;
    imagen_url?: string;
    documento_url?: string;
  },
  perfil: Perfil
): Promise<{ data: Comentario | null; error: any }> {
  // Agregar autor_id, autor_email, autor_rol automáticamente
  // Validar permisos según rol
}

/**
 * Actualizar un comentario existente
 * Solo Control puede actualizar
 */
export async function actualizarComentario(
  comentarioId: string,
  updates: Partial<Comentario>,
  perfil: Perfil
): Promise<{ data: Comentario | null; error: any }> {
  if (perfil.rol !== "Control") {
    return { data: null, error: { message: "No autorizado" } };
  }
  // Implementar actualización
}

/**
 * Eliminar un comentario
 * Solo Control puede eliminar
 */
export async function eliminarComentario(
  comentarioId: string,
  perfil: Perfil
): Promise<{ error: any }> {
  if (perfil.rol !== "Control") {
    return { error: { message: "No autorizado" } };
  }
  // Implementar eliminación
}

/**
 * Subir imagen para comentario
 */
export async function subirImagenComentario(
  file: File,
  incidenciaId: string
): Promise<{ url: string | null; error: any }> {
  // Implementar upload a Supabase Storage
  // Bucket: comentarios-imagenes
  // Path: {incidenciaId}/{timestamp}-{filename}
}

/**
 * Subir documento para comentario
 */
export async function subirDocumentoComentario(
  file: File,
  incidenciaId: string
): Promise<{ url: string | null; error: any }> {
  // Implementar upload a Supabase Storage
  // Bucket: comentarios-documentos
  // Path: {incidenciaId}/{timestamp}-{filename}
}

/**
 * Obtener URL firmada de imagen
 */
export async function obtenerUrlFirmadaImagen(
  path: string
): Promise<string | null> {
  // Implementar obtención de signed URL
  // Duración: 3600 segundos (1 hora)
}

/**
 * Obtener URL firmada de documento
 */
export async function obtenerUrlFirmadaDocumento(
  path: string
): Promise<string | null> {
  // Implementar obtención de signed URL
  // Duración: 3600 segundos (1 hora)
}
```

**Pasos de implementación:**

1. ✅ Crear archivo `lib/comentariosService.ts`
2. ✅ Implementar función `obtenerComentarios()`
3. ✅ Implementar función `crearComentario()`
4. ✅ Implementar funciones de upload (imagen/documento)
5. ✅ Implementar funciones de URLs firmadas
6. ✅ Refactorizar `chat-control-cliente/page.tsx` para usar el servicio
7. ✅ Refactorizar `chat-proveedor/page.tsx` para usar el servicio
8. ✅ Probar creación, lectura, y visualización de comentarios
9. ✅ Verificar permisos por rol

**Reducción esperada:**
- `chat-control-cliente/page.tsx`: 1,200 → ~900 líneas (-25%)
- `chat-proveedor/page.tsx`: 3,843 → ~3,200 líneas (-17%)
- **Total:** ~640 líneas eliminadas

---

### 3.2 Crear `lib/presupuestosService.ts`

**Archivos afectados:**
- `app/(app)/incidencias/[id]/chat-proveedor/page.tsx` (3,843 líneas)
- `app/(app)/control/presupuestos/page.tsx` (300 líneas)

**Funciones a crear:**

```typescript
// lib/presupuestosService.ts

import { supabase } from "./supabaseClient";
import { Perfil } from "@/contexts/AuthContext";

export type Presupuesto = {
  id: string;
  incidencia_id: string;
  proveedor_id: string;
  numero_incidencia: string;
  fecha_estimada_inicio: string;
  duracion_estimada: string;
  importe_total_sin_iva: number;
  presupuesto_detallado_url?: string;
  descripcion_breve: string;
  estado: "pendiente_revision" | "aprobado" | "rechazado";
  creado_por?: string;
  revisado_por?: string;
  revisado_en?: string;
  comentarios_revision?: string;
  creado_en: string;
};

/**
 * Obtener presupuestos de una incidencia
 */
export async function obtenerPresupuestos(
  incidenciaId: string,
  perfil: Perfil
): Promise<Presupuesto[]> {
  // Control: ve todos
  // Proveedor: solo los de su proveedor
  // Cliente/Gestor: todos los de la incidencia (RLS filtra)
}

/**
 * Obtener un presupuesto específico
 */
export async function obtenerPresupuesto(
  presupuestoId: string,
  perfil: Perfil
): Promise<Presupuesto | null> {
  // Validar permisos según rol
}

/**
 * Crear un nuevo presupuesto
 */
export async function crearPresupuesto(
  data: {
    incidencia_id: string;
    proveedor_id: string;
    numero_incidencia: string;
    fecha_estimada_inicio: string;
    duracion_estimada: string;
    importe_total_sin_iva: number;
    descripcion_breve: string;
    presupuesto_detallado_file?: File;
  },
  perfil: Perfil
): Promise<{ data: Presupuesto | null; error: any }> {
  // 1. Validar que el usuario es proveedor del proveedor_id
  // 2. Subir archivo PDF si existe
  // 3. Crear presupuesto en BD
  // 4. Agregar creado_por automáticamente
}

/**
 * Actualizar estado del presupuesto (aprobar/rechazar)
 * Solo Control puede hacerlo
 */
export async function actualizarEstadoPresupuesto(
  presupuestoId: string,
  estado: "aprobado" | "rechazado",
  comentarios_revision?: string,
  perfil: Perfil
): Promise<{ data: Presupuesto | null; error: any }> {
  if (perfil.rol !== "Control") {
    return { data: null, error: { message: "No autorizado" } };
  }
  // Actualizar estado, revisado_por, revisado_en, comentarios_revision
}

/**
 * Subir documento de presupuesto detallado (PDF)
 */
export async function subirDocumentoPresupuesto(
  file: File,
  incidenciaId: string,
  proveedorId: string
): Promise<{ url: string | null; error: any }> {
  // Bucket: presupuestos
  // Path: {incidenciaId}/{proveedorId}/{timestamp}-{filename}
  // Validar que sea PDF
}

/**
 * Obtener URL firmada del documento de presupuesto
 */
export async function obtenerUrlPresupuesto(
  path: string
): Promise<string | null> {
  // Duración: 7200 segundos (2 horas)
}

/**
 * Obtener todos los presupuestos pendientes de revisión
 * Solo para Control
 */
export async function obtenerPresupuestosPendientes(
  perfil: Perfil
): Promise<Presupuesto[]> {
  if (perfil.rol !== "Control") {
    return [];
  }
  // Query con .eq("estado", "pendiente_revision")
}

/**
 * Obtener estadísticas de presupuestos
 * Solo para Control
 */
export async function obtenerEstadisticasPresupuestos(
  perfil: Perfil
): Promise<{
  total: number;
  pendientes: number;
  aprobados: number;
  rechazados: number;
  importe_total_aprobado: number;
}> {
  if (perfil.rol !== "Control") {
    return { total: 0, pendientes: 0, aprobados: 0, rechazados: 0, importe_total_aprobado: 0 };
  }
  // Implementar agregaciones
}
```

**Pasos de implementación:**

1. ✅ Crear archivo `lib/presupuestosService.ts`
2. ✅ Implementar función `obtenerPresupuestos()`
3. ✅ Implementar función `crearPresupuesto()` con upload
4. ✅ Implementar función `actualizarEstadoPresupuesto()`
5. ✅ Implementar función `obtenerPresupuestosPendientes()`
6. ✅ Refactorizar `chat-proveedor/page.tsx` para usar el servicio
7. ✅ Refactorizar `control/presupuestos/page.tsx` para usar el servicio
8. ✅ Probar creación, aprobación/rechazo
9. ✅ Verificar permisos por rol

**Reducción esperada:**
- `chat-proveedor/page.tsx`: 3,200 → ~2,800 líneas (-12%)
- `control/presupuestos/page.tsx`: 300 → ~200 líneas (-33%)
- **Total:** ~500 líneas eliminadas

---

### 3.3 Testing de la Fase 3

**Tests requeridos:**

```bash
# Build debe pasar
npm run build

# Tests funcionales manuales:
1. Login como Control → Ver todos los comentarios
2. Login como Proveedor → Solo ver comentarios de proveedor
3. Login como Cliente → Solo ver comentarios de cliente
4. Crear comentario con imagen
5. Crear comentario con documento
6. Crear presupuesto como Proveedor
7. Aprobar presupuesto como Control
8. Rechazar presupuesto como Control
```

**Checklist:**
- [ ] Build exitoso sin errores
- [ ] Comentarios se crean correctamente
- [ ] Imágenes se suben y visualizan
- [ ] Documentos se suben y descargan
- [ ] Presupuestos se crean correctamente
- [ ] Solo Control puede aprobar/rechazar
- [ ] RLS previene acceso no autorizado

---

## 🔧 Fase 4: Refactorización de Chat Proveedor

**Estado:** 🔴 PENDIENTE
**Prioridad:** 🟡 MEDIA (mejora de mantenibilidad)
**Tiempo estimado:** 6-8 horas

### Objetivo

Dividir `chat-proveedor/page.tsx` (actualmente 3,843 líneas) en componentes modulares más pequeños y mantenibles.

### Análisis del Archivo Actual

**Estructura detectada:**
```typescript
// chat-proveedor/page.tsx (3,843 líneas)
├── Estados (54 useState) - Líneas 1-150
├── useEffects (8) - Líneas 150-350
├── Funciones helper (20+) - Líneas 350-1500
│   ├── cargarDatos()
│   ├── cargarComentarios()
│   ├── enviarComentario()
│   ├── subirImagen()
│   ├── manejarPresupuesto()
│   ├── actualizarEstado()
│   └── ...
└── JSX (2,300 líneas) - Líneas 1500-3843
    ├── Header con información de incidencia
    ├── Timeline de comentarios
    ├── Sección de presupuestos
    ├── Formulario de comentarios
    ├── Sección de cambio de estado
    ├── Sección de fecha de visita
    └── Diálogos modales
```

### 4.1 Estructura Propuesta

Dividir en 8 componentes especializados:

```
app/(app)/incidencias/[id]/chat-proveedor/
├── page.tsx (500 líneas) - Orchestrator principal
├── components/
│   ├── ChatProveedorHeader.tsx (150 líneas)
│   │   ├── Información de incidencia
│   │   ├── Estado actual
│   │   └── Acciones rápidas
│   │
│   ├── TimelineComentarios.tsx (400 líneas)
│   │   ├── Lista de comentarios
│   │   ├── Scroll automático
│   │   └── Filtros por ámbito
│   │
│   ├── FormularioComentario.tsx (300 líneas)
│   │   ├── Input de texto
│   │   ├── Upload de imagen
│   │   ├── Upload de documento
│   │   └── Selector de ámbito
│   │
│   ├── SeccionPresupuestos.tsx (500 líneas)
│   │   ├── Lista de presupuestos
│   │   ├── Formulario de nuevo presupuesto
│   │   └── Estado de presupuestos
│   │
│   ├── SeccionEstado.tsx (300 líneas)
│   │   ├── Selector de estado
│   │   ├── Motivo/comentario
│   │   └── Confirmación
│   │
│   ├── SeccionFechaVisita.tsx (250 líneas)
│   │   ├── Calendario
│   │   ├── Selector de horario
│   │   └── Confirmación
│   │
│   ├── DialogoImagen.tsx (150 líneas)
│   │   └── Modal para visualizar imágenes
│   │
│   └── DialogoDocumento.tsx (150 líneas)
│       └── Modal para visualizar documentos
│
└── hooks/
    ├── useChatProveedor.ts (400 líneas)
    │   ├── Estado compartido
    │   ├── Lógica de comentarios
    │   └── Lógica de presupuestos
    │
    └── useIncidenciaData.ts (200 líneas)
        ├── Carga de datos iniciales
        └── Actualización de datos
```

### 4.2 Pasos de Implementación

#### Paso 1: Crear Hook Principal (2 horas)

```typescript
// hooks/useChatProveedor.ts

export function useChatProveedor(incidenciaId: string) {
  const { perfil, proveedorId } = useAuth();
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const [loading, setLoading] = useState(true);

  const cargarDatos = async () => {
    // Centralizar toda la lógica de carga
  };

  const agregarComentario = async (data: NuevoComentario) => {
    // Usar comentariosService
  };

  const crearPresupuesto = async (data: NuevoPresupuesto) => {
    // Usar presupuestosService
  };

  return {
    comentarios,
    presupuestos,
    loading,
    agregarComentario,
    crearPresupuesto,
    cargarDatos,
  };
}
```

#### Paso 2: Extraer Componentes (4 horas)

**Prioridad de extracción:**

1. ✅ `ChatProveedorHeader.tsx` - Más simple, bajo acoplamiento
2. ✅ `DialogoImagen.tsx` y `DialogoDocumento.tsx` - Independientes
3. ✅ `FormularioComentario.tsx` - Usa el hook
4. ✅ `TimelineComentarios.tsx` - Usa el hook
5. ✅ `SeccionPresupuestos.tsx` - Usa presupuestosService
6. ✅ `SeccionEstado.tsx` - Lógica específica
7. ✅ `SeccionFechaVisita.tsx` - Lógica específica

#### Paso 3: Refactorizar page.tsx (2 horas)

```typescript
// page.tsx (objetivo: ~500 líneas)

export default function ChatProveedorPage({ params }: Props) {
  const incidenciaId = params.id;
  const chatData = useChatProveedor(incidenciaId);
  const incidenciaData = useIncidenciaData(incidenciaId);

  if (chatData.loading) return <LoadingSpinner />;

  return (
    <div className="chat-proveedor">
      <ChatProveedorHeader incidencia={incidenciaData.incidencia} />

      <TimelineComentarios
        comentarios={chatData.comentarios}
        onNuevoComentario={chatData.agregarComentario}
      />

      <FormularioComentario
        onEnviar={chatData.agregarComentario}
      />

      <SeccionPresupuestos
        presupuestos={chatData.presupuestos}
        onCrear={chatData.crearPresupuesto}
      />

      <SeccionEstado
        incidenciaId={incidenciaId}
        estadoActual={incidenciaData.estado}
        onCambiarEstado={incidenciaData.actualizarEstado}
      />

      <SeccionFechaVisita
        incidenciaId={incidenciaId}
        fechaActual={incidenciaData.fechaVisita}
      />
    </div>
  );
}
```

### 4.3 Testing de la Fase 4

**Tests requeridos:**

```bash
# Build debe pasar
npm run build

# Tests funcionales:
1. Cargar chat-proveedor → Ver todos los comentarios
2. Enviar nuevo comentario → Aparece en timeline
3. Subir imagen → Se visualiza correctamente
4. Crear presupuesto → Aparece en lista
5. Cambiar estado → Se actualiza en BD
6. Calendarizar visita → Se guarda correctamente
```

**Checklist:**
- [ ] Build exitoso sin errores
- [ ] Todos los componentes funcionan aisladamente
- [ ] Hook useChatProveedor funciona correctamente
- [ ] No hay regresiones en funcionalidad
- [ ] Tamaño de archivo reducido significativamente

---

## 🚨 Mejoras Críticas para Producción

**Prioridad:** 🔥 CRÍTICA (debe completarse antes de producción)

### 1. Variables de Entorno y Configuración

**Estado:** 🔴 PENDIENTE

**Problemas actuales:**
- `.env.local` contiene credenciales reales
- No hay `.env.example` documentado
- Falta validación de variables de entorno

**Tareas:**

```bash
# 1. Crear .env.example
cat > .env.example << 'EOF'
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
EOF

# 2. Actualizar .gitignore
echo ".env.local" >> .gitignore
echo ".env.production" >> .gitignore
```

```typescript
// lib/env.ts - Validación de variables de entorno
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
] as const;

export function validateEnv() {
  const missing = requiredEnvVars.filter(
    (key) => !process.env[key]
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }
}

// Llamar en app/layout.tsx
validateEnv();
```

**Checklist:**
- [ ] Crear `.env.example` con documentación
- [ ] Crear `lib/env.ts` con validación
- [ ] Verificar que `.env.local` no está en git
- [ ] Documentar variables en README.md

---

### 2. Manejo de Errores Global

**Estado:** 🟡 PARCIAL (hay algunos try-catch pero no hay manejo global)

**Problemas actuales:**
- No hay boundary de errores en React
- Errores de Supabase no se manejan consistentemente
- No hay logging de errores en producción

**Tareas:**

```typescript
// components/ErrorBoundary.tsx
'use client';

import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // Enviar a servicio de logging (ej: Sentry, LogRocket)
    console.error('Error capturado por boundary:', error, errorInfo);

    // En producción, enviar a tu backend o servicio de logs
    if (process.env.NODE_ENV === 'production') {
      // fetch('/api/log-error', { ... })
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="error-container">
          <h2>Algo salió mal</h2>
          <p>Por favor, recarga la página o contacta a soporte.</p>
          <button onClick={() => window.location.reload()}>
            Recargar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

```typescript
// app/layout.tsx - Agregar ErrorBoundary
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <ErrorBoundary>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
```

```typescript
// lib/errorHandler.ts - Helper para errores de Supabase
export function handleSupabaseError(error: any, context?: string) {
  console.error(`Error en ${context || 'operación'}:`, error);

  // Mensajes amigables para el usuario
  const userMessage = error.message || 'Ocurrió un error inesperado';

  // En producción, enviar a logging service
  if (process.env.NODE_ENV === 'production') {
    // logToService(error, context);
  }

  return userMessage;
}

// Uso en servicios:
export async function obtenerIncidencias() {
  try {
    const { data, error } = await supabase.from('incidencias').select();
    if (error) throw error;
    return data;
  } catch (error) {
    throw new Error(handleSupabaseError(error, 'obtenerIncidencias'));
  }
}
```

**Checklist:**
- [ ] Crear `ErrorBoundary` component
- [ ] Agregar ErrorBoundary en layout principal
- [ ] Crear `lib/errorHandler.ts`
- [ ] Actualizar todos los servicios para usar errorHandler
- [ ] Configurar logging service (opcional: Sentry)

---

### 3. Loading States y UX

**Estado:** 🟡 PARCIAL (algunos componentes tienen loading, otros no)

**Problemas actuales:**
- No hay loading state consistente
- No hay skeleton loaders
- Transiciones abruptas

**Tareas:**

```typescript
// components/LoadingSpinner.tsx
export function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className="flex items-center justify-center">
      <div className={`${sizeClasses[size]} border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin`} />
    </div>
  );
}

// components/SkeletonCard.tsx
export function SkeletonCard() {
  return (
    <div className="animate-pulse bg-gray-200 rounded-lg p-4">
      <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
      <div className="h-4 bg-gray-300 rounded w-1/2"></div>
    </div>
  );
}
```

**Patrón recomendado:**

```typescript
// Antes:
export default function Dashboard() {
  const [data, setData] = useState([]);

  useEffect(() => {
    cargarDatos();
  }, []);

  return <div>{data.map(...)}</div>; // ❌ Flash de contenido vacío
}

// Después:
export default function Dashboard() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarDatos().finally(() => setLoading(false));
  }, []);

  if (loading) return <SkeletonCard />; // ✅ Skeleton mientras carga

  return <div>{data.map(...)}</div>;
}
```

**Checklist:**
- [ ] Crear componentes de loading (Spinner, Skeleton)
- [ ] Agregar loading states a todos los useEffect
- [ ] Usar Suspense donde sea apropiado (Next.js 15)
- [ ] Agregar transiciones suaves (Framer Motion opcional)

---

### 4. Validación de Formularios

**Estado:** 🟡 PARCIAL (hay validaciones básicas)

**Problemas actuales:**
- Validaciones inconsistentes
- Mensajes de error no estandarizados
- No hay validación de tipos de archivo

**Tareas:**

```bash
# Instalar biblioteca de validación
npm install zod react-hook-form @hookform/resolvers
```

```typescript
// lib/schemas/incidenciaSchema.ts
import { z } from 'zod';

export const nuevaIncidenciaSchema = z.object({
  fecha: z.string().min(1, 'Fecha es requerida'),
  hora: z.string().min(1, 'Hora es requerida'),
  nombre_solicitante: z.string().min(2, 'Nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  centro: z.string().uuid('Centro es requerido'),
  prioridad: z.enum(['Urgente', 'Critico', 'Normal']),
  catalogacion: z.string().min(1, 'Catalogación es requerida'),
  descripcion: z.string().min(10, 'Descripción debe tener al menos 10 caracteres'),
  imagen: z.instanceof(File).optional().refine(
    (file) => !file || file.size <= 5 * 1024 * 1024,
    'La imagen debe ser menor a 5MB'
  ).refine(
    (file) => !file || ['image/jpeg', 'image/png', 'image/webp'].includes(file.type),
    'Solo se permiten imágenes JPG, PNG o WebP'
  ),
});

export type NuevaIncidenciaInput = z.infer<typeof nuevaIncidenciaSchema>;
```

```typescript
// Uso en formulario con react-hook-form
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

export default function NuevaIncidenciaForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NuevaIncidenciaInput>({
    resolver: zodResolver(nuevaIncidenciaSchema),
  });

  const onSubmit = async (data: NuevaIncidenciaInput) => {
    // Data está validada automáticamente
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('nombre_solicitante')} />
      {errors.nombre_solicitante && (
        <span className="error">{errors.nombre_solicitante.message}</span>
      )}
    </form>
  );
}
```

**Schemas a crear:**
- [ ] `incidenciaSchema.ts` - Nueva incidencia
- [ ] `comentarioSchema.ts` - Nuevo comentario
- [ ] `presupuestoSchema.ts` - Nuevo presupuesto
- [ ] `loginSchema.ts` - Login form

---

### 5. Seguridad: Storage Buckets y Políticas

**Estado:** 🟡 PARCIAL (buckets existen pero políticas pueden mejorarse)

**Tareas:**

```sql
-- Verificar políticas de Storage en Supabase Dashboard

-- Bucket: incidencias-imagenes
-- Política de SELECT: Todos los autenticados
CREATE POLICY "Authenticated users can view images"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'incidencias-imagenes');

-- Política de INSERT: Solo usuarios autenticados
CREATE POLICY "Authenticated users can upload images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'incidencias-imagenes' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM incidencias
  )
);

-- Política de DELETE: Solo Control
CREATE POLICY "Only Control can delete images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'incidencias-imagenes' AND
  app.es_control()
);
```

**Checklist:**
- [ ] Revisar políticas de Storage buckets
- [ ] Agregar límites de tamaño de archivo (5MB imágenes, 10MB documentos)
- [ ] Validar tipos MIME en backend
- [ ] Implementar cleanup de archivos huérfanos

---

### 6. Optimización de Imágenes

**Estado:** 🔴 PENDIENTE

**Problemas actuales:**
- Uso de `<img>` en lugar de `<Image />`
- Sin optimización automática de imágenes
- Sin lazy loading

**Tareas:**

```typescript
// Reemplazar todos los <img> por <Image />
import Image from 'next/image';

// Antes:
<img src={url} alt="..." />

// Después:
<Image
  src={url}
  alt="..."
  width={800}
  height={600}
  placeholder="blur"
  blurDataURL="data:image/..." // Opcional: blur placeholder
  loading="lazy"
/>
```

**Configurar en next.config.js:**

```javascript
// next.config.js
module.exports = {
  images: {
    domains: [
      'your-project.supabase.co', // Supabase Storage
    ],
    formats: ['image/avif', 'image/webp'],
  },
};
```

**Checklist:**
- [ ] Reemplazar `<img>` por `<Image />` en todos los archivos
- [ ] Configurar dominios permitidos en next.config.js
- [ ] Agregar dimensiones a todas las imágenes
- [ ] Probar que imágenes se cargan correctamente

---

### 7. Logs y Monitoring de Producción

**Estado:** 🔴 PENDIENTE

**Recomendaciones:**

```typescript
// lib/logger.ts
type LogLevel = 'info' | 'warn' | 'error';

export function log(level: LogLevel, message: string, data?: any) {
  const timestamp = new Date().toISOString();

  // En desarrollo: console
  if (process.env.NODE_ENV === 'development') {
    console[level](`[${timestamp}] ${message}`, data);
  }

  // En producción: enviar a servicio
  if (process.env.NODE_ENV === 'production') {
    // Ejemplo con Sentry:
    // Sentry.captureMessage(message, { level, extra: data });

    // O tu propio endpoint:
    // fetch('/api/logs', {
    //   method: 'POST',
    //   body: JSON.stringify({ level, message, data, timestamp }),
    // });
  }
}

// Uso:
log('info', 'Usuario inició sesión', { userId: '123' });
log('error', 'Error cargando incidencias', { error: err.message });
```

**Servicios recomendados:**
- **Sentry** - Error tracking y performance monitoring
- **Vercel Analytics** - Si deployeas en Vercel
- **LogRocket** - Session replay y debugging
- **Datadog** - APM y logs enterprise

**Checklist:**
- [ ] Crear `lib/logger.ts`
- [ ] Reemplazar `console.log` por logger en producción
- [ ] Configurar servicio de logs (opcional pero recomendado)
- [ ] Agregar alertas para errores críticos

---

## 💡 Mejoras Recomendadas

**Prioridad:** 🟢 BAJA (nice to have, no bloqueantes)

### 1. Testing Automatizado

**Estado:** 🔴 NO EXISTE

**Configuración básica:**

```bash
# Instalar dependencias de testing
npm install -D @testing-library/react @testing-library/jest-dom jest jest-environment-jsdom
npm install -D @testing-library/user-event
```

```javascript
// jest.config.js
const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testEnvironment: 'jest-environment-jsdom',
};

module.exports = createJestConfig(customJestConfig);
```

```javascript
// jest.setup.js
import '@testing-library/jest-dom';
```

**Tests prioritarios:**
- [ ] `lib/incidenciasService.test.ts` - Tests de queries
- [ ] `contexts/AuthContext.test.tsx` - Tests de auth
- [ ] `components/DashboardCliente.test.tsx` - Tests de UI crítica

---

### 2. Documentación de API Interna

**Estado:** 🟡 PARCIAL (hay comentarios pero no documentación formal)

```typescript
// Ejemplo de JSDoc
/**
 * Obtiene todas las incidencias según el perfil del usuario
 *
 * @param perfil - Perfil del usuario autenticado
 * @returns Array de incidencias con datos completos
 * @throws {Error} Si no se puede conectar a la base de datos
 *
 * @example
 * ```typescript
 * const { perfil } = useAuth();
 * const incidencias = await obtenerIncidenciasPorPerfil(perfil);
 * ```
 */
export async function obtenerIncidenciasPorPerfil(
  perfil: Perfil
): Promise<Incidencia[]> {
  // ...
}
```

**Checklist:**
- [ ] Agregar JSDoc a todas las funciones públicas
- [ ] Documentar types/interfaces en `types/`
- [ ] Crear `CONTRIBUTING.md` con guías de código
- [ ] Generar docs automáticamente con TypeDoc (opcional)

---

### 3. Performance: React Query / SWR

**Estado:** 🔴 NO EXISTE (actualmente todo es fetch manual)

**Problema actual:**
- No hay caché de datos
- Refetch innecesarios
- No hay revalidación automática

**Solución con SWR:**

```bash
npm install swr
```

```typescript
// lib/hooks/useIncidencias.ts
import useSWR from 'swr';
import { obtenerIncidenciasPorPerfil } from '@/lib/incidenciasService';

export function useIncidencias() {
  const { perfil } = useAuth();

  const { data, error, isLoading, mutate } = useSWR(
    perfil ? ['incidencias', perfil.persona_id] : null,
    () => obtenerIncidenciasPorPerfil(perfil!),
    {
      revalidateOnFocus: true,
      dedupingInterval: 5000, // No refetch si pasó <5s
    }
  );

  return {
    incidencias: data ?? [],
    loading: isLoading,
    error,
    refetch: mutate,
  };
}

// Uso en componente:
const { incidencias, loading, refetch } = useIncidencias();
```

**Beneficios:**
- ⚡ Caché automático
- ⚡ Revalidación en focus
- ⚡ Deduplicación de requests
- ⚡ Optimistic updates

**Checklist:**
- [ ] Instalar SWR o React Query
- [ ] Crear hooks para cada recurso (incidencias, comentarios, presupuestos)
- [ ] Migrar componentes para usar hooks
- [ ] Configurar estrategias de caché

---

### 4. Internacionalización (i18n)

**Estado:** 🔴 NO EXISTE (todo hardcoded en español)

**Solo si necesitas multi-idioma:**

```bash
npm install next-intl
```

```typescript
// messages/es.json
{
  "dashboard": {
    "title": "Panel de Control",
    "incidencias": "Incidencias"
  }
}

// Uso:
import { useTranslations } from 'next-intl';

const t = useTranslations('dashboard');
<h1>{t('title')}</h1>
```

**Checklist:**
- [ ] Decidir si es necesario multi-idioma
- [ ] Si sí: Instalar next-intl
- [ ] Extraer todos los strings a archivos JSON
- [ ] Configurar idiomas soportados

---

### 5. PWA (Progressive Web App)

**Estado:** 🔴 NO EXISTE

**Para que la app sea instalable en móviles:**

```bash
npm install next-pwa
```

```javascript
// next.config.js
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
});

module.exports = withPWA({
  // ... resto de config
});
```

```json
// public/manifest.json
{
  "name": "FMINCI Web",
  "short_name": "FMINCI",
  "description": "Sistema de gestión de incidencias",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#5D6D52",
  "theme_color": "#5D6D52",
  "icons": [
    {
      "src": "/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

**Checklist:**
- [ ] Instalar next-pwa
- [ ] Crear manifest.json
- [ ] Generar iconos (192x192, 512x512)
- [ ] Probar instalación en móvil

---

## ⚡ Optimizaciones de Performance

**Estado:** 🟡 ACEPTABLE (pero puede mejorar)

### 1. Bundle Size Optimization

```bash
# Analizar bundle actual
npm install -D @next/bundle-analyzer

# next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

module.exports = withBundleAnalyzer({
  // ... config
});

# Ejecutar análisis
ANALYZE=true npm run build
```

**Acciones:**
- [ ] Revisar dependencias grandes
- [ ] Implementar dynamic imports para rutas pesadas
- [ ] Evaluar si todas las deps son necesarias

---

### 2. Database Query Optimization

**Queries a revisar:**

```typescript
// ❌ MAL: Select *
const { data } = await supabase
  .from('incidencias')
  .select('*');

// ✅ BIEN: Select solo lo necesario
const { data } = await supabase
  .from('incidencias')
  .select('id, num_solicitud, estado_cliente, fecha_creacion');

// ✅ MEJOR: Con índices
// Crear en Supabase:
CREATE INDEX idx_incidencias_institucion_estado
ON incidencias(institucion_id, estado_cliente);
```

**Checklist:**
- [ ] Revisar todos los `.select('*')` y especificar columnas
- [ ] Crear índices en columnas frecuentemente filtradas
- [ ] Usar `.range()` para paginación en lugar de cargar todo

---

### 3. Implementar Paginación

**Archivos prioritarios:**
- `app/(app)/incidencias/page.tsx` - Puede tener 1000+ incidencias
- `app/(app)/control/presupuestos/page.tsx` - Puede crecer mucho

```typescript
// Ejemplo de paginación
const ITEMS_PER_PAGE = 20;

export async function obtenerIncidenciasPaginadas(
  perfil: Perfil,
  page: number = 1
): Promise<{ data: Incidencia[]; count: number }> {
  const start = (page - 1) * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE - 1;

  const { data, error, count } = await supabase
    .from('incidencias')
    .select('*', { count: 'exact' })
    .range(start, end)
    .order('fecha_creacion', { ascending: false });

  if (error) throw error;

  return { data: data || [], count: count || 0 };
}
```

**Checklist:**
- [ ] Implementar paginación en incidencias
- [ ] Implementar paginación en presupuestos
- [ ] Agregar controles de navegación (prev/next)
- [ ] Mostrar número de página actual

---

### 4. Caché de Imágenes y Assets

**Configurar en next.config.js:**

```javascript
module.exports = {
  // ... otras configs

  // Configurar headers para caché
  async headers() {
    return [
      {
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};
```

---

## ✅ Checklist Pre-Producción

### Seguridad y Configuración
- [ ] Variables de entorno configuradas correctamente
- [ ] `.env.local` no está en git
- [ ] RLS habilitado en todas las tablas
- [ ] Políticas de Storage revisadas
- [ ] Service Role Key nunca expuesta en cliente

### Código y Estructura
- [ ] Fase 3 completada (comentariosService, presupuestosService)
- [ ] Fase 4 completada (chat-proveedor refactorizado)
- [ ] ErrorBoundary implementado
- [ ] Loading states en todos los componentes
- [ ] Validación de formularios con Zod

### Performance
- [ ] Build sin errores: `npm run build`
- [ ] Bundle size analizado y optimizado
- [ ] Imágenes optimizadas con `<Image />`
- [ ] Queries optimizadas (sin N+1)
- [ ] Paginación implementada en listas grandes

### Testing
- [ ] Tests manuales completados para cada rol
- [ ] Flujo completo de incidencia probado
- [ ] Flujo de presupuestos probado
- [ ] Flujo de comentarios probado
- [ ] Responsive design verificado (móvil/tablet/desktop)

### Monitoreo
- [ ] Error logging configurado
- [ ] Servicio de monitoring elegido (opcional)
- [ ] Alertas configuradas para errores críticos

### Documentación
- [ ] README.md actualizado
- [ ] `.env.example` creado
- [ ] CLAUDE.md actualizado
- [ ] MIGRACION_ROLES_NATIVOS.md completo
- [ ] ROADMAP_PRODUCCION.md (este archivo)

### Deployment
- [ ] Dominio configurado
- [ ] SSL/HTTPS habilitado
- [ ] Supabase en plan de producción (si aplica)
- [ ] Variables de entorno en plataforma de deploy
- [ ] Backup de base de datos configurado

---

## 🎯 Resumen de Prioridades

### Antes de Producción (Bloqueantes)

1. **Fase 3** - Centralizar comentarios y presupuestos (4-6h)
2. **Variables de entorno** - Crear .env.example y validación (1h)
3. **ErrorBoundary** - Manejo de errores global (2h)
4. **Loading states** - UX durante carga (2h)
5. **Validación formularios** - Zod en formularios críticos (3h)
6. **Optimización imágenes** - Reemplazar `<img>` por `<Image />` (2h)

**Total:** ~14-16 horas de trabajo

### Después de Producción (Mejoras continuas)

1. **Fase 4** - Refactorizar chat-proveedor (6-8h)
2. **Testing** - Tests automatizados (variable)
3. **Performance** - SWR/React Query (4h)
4. **PWA** - Si se requiere app móvil (3h)
5. **i18n** - Si se requiere multi-idioma (8h)

---

## 📞 Soporte y Contacto

**Archivos de referencia:**
- 📄 `CLAUDE.md` - Información del proyecto para Claude
- 📄 `MIGRACION_ROLES_NATIVOS.md` - Detalles de seguridad
- 📄 `ROADMAP_PRODUCCION.md` - Este archivo

**Comandos útiles:**
```bash
# Desarrollo
npm run dev

# Build de producción
npm run build

# Verificar tipos
npm run type-check

# Linting
npm run lint

# Análisis de bundle
ANALYZE=true npm run build
```

---

**Última actualización:** 2025-10-02
**Próxima revisión:** Después de completar Fase 3

🚀 **¡Éxito con el lanzamiento a producción!**
