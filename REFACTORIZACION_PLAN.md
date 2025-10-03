# 🏗️ PLAN DE REFACTORIZACIÓN - MEJORA DE ARQUITECTURA

## 📊 Situación Actual

### Archivos Problemáticos
- `chat-control-cliente/page.tsx`: **1810 líneas** ⚠️
- `chat-proveedor/page.tsx`: **3850 líneas** 🚨
- **Total**: 5660 líneas en 2 archivos

### Problemas Identificados
1. ❌ **Monolitos**: Todo el código en un solo archivo
2. ❌ **Funciones gigantes**: Lógica mezclada (UI + Business Logic + Data)
3. ❌ **Duplicación**: Lógica repetida entre ambos chats
4. ❌ **Difícil mantenimiento**: Imposible encontrar código específico
5. ❌ **Testing complejo**: No se puede testear en unidades pequeñas
6. ❌ **Performance**: Re-renders innecesarios

---

## 🎯 Objetivos de la Refactorización

### Metas Principales
- ✅ Archivos principales < 300 líneas
- ✅ Componentes reutilizables < 150 líneas
- ✅ Separación clara: UI / Lógica / Datos
- ✅ Código DRY (Don't Repeat Yourself)
- ✅ Fácil de entender y mantener
- ✅ Preparado para testing

---

## 📐 Arquitectura Propuesta

```
app/(app)/incidencias/[id]/
├── chat-control-cliente/
│   ├── page.tsx                    # 🎯 ~200 líneas (solo layout + hooks)
│   ├── hooks/
│   │   ├── useIncidenciaChat.ts   # Estado + lógica incidencia
│   │   ├── useComentarios.ts      # CRUD comentarios
│   │   └── useImageUrls.ts        # Manejo URLs firmadas
│   ├── components/
│   │   ├── DatosTecnicos.tsx      # Tabla datos incidencia
│   │   ├── AccionesControl.tsx    # Botones acciones Control
│   │   └── ChatMessages.tsx       # Lista mensajes
│   └── actions/
│       ├── asignarProveedor.ts    # Función servidor
│       ├── anularIncidencia.ts
│       ├── ponerEnEspera.ts
│       └── resolverManual.ts
│
├── chat-proveedor/
│   ├── page.tsx                    # 🎯 ~250 líneas
│   ├── hooks/
│   │   ├── useProveedorChat.ts
│   │   ├── usePresupuesto.ts
│   │   └── useVisitas.ts
│   ├── components/
│   │   ├── DatosProveedor.tsx
│   │   ├── AccionesProveedor.tsx
│   │   ├── FormPresupuesto.tsx
│   │   └── EstadisticasProveedor.tsx
│   └── actions/
│       ├── crearPresupuesto.ts
│       ├── resolverIncidencia.ts
│       ├── calendarizarVisita.ts
│       └── valorarEconomicamente.ts
│
└── shared/                          # ♻️ Compartido entre ambos chats
    ├── components/
    │   ├── ChatContainer.tsx       # Contenedor chat común
    │   ├── ChatMessage.tsx         # Burbuja mensaje individual
    │   ├── ChatInput.tsx           # Input + adjuntos
    │   └── HistorialEstados.tsx    # Visualización historial
    ├── hooks/
    │   ├── useChat.ts              # Lógica común chat
    │   ├── useFileUpload.ts        # Upload archivos
    │   └── useScrollToBottom.ts    # Scroll automático
    └── utils/
        ├── formatters.ts           # Formato fechas, moneda
        └── validators.ts           # Validaciones

components/                          # 🌍 Globales (ya existen)
├── ModalAsignarProveedor.tsx
├── ModalResolucionManual.tsx
└── SearchableSelect.tsx

lib/
├── services/                        # 🆕 Capa de servicios
│   ├── incidenciasService.ts       # ✅ Ya existe (ampliar)
│   ├── comentariosService.ts       # CRUD comentarios
│   ├── proveedorCasosService.ts    # Gestión proveedor_casos
│   ├── presupuestosService.ts      # Gestión presupuestos
│   ├── storageService.ts           # URLs firmadas centralizadas
│   └── visitasService.ts           # Calendario citas
├── historialEstados.ts             # ✅ Ya existe
└── theme.ts                        # ✅ Ya existe
```

---

## 🔍 Análisis Detallado por Archivo

### chat-control-cliente/page.tsx (1810 líneas)

#### Desglose Actual
```
- Estados (useState): ~30 líneas
- Efectos (useEffect): ~50 líneas
- Funciones de carga: ~200 líneas
- Funciones de negocio: ~400 líneas
  * asignarProveedorCompleto: ~230 líneas
  * anularIncidencia: ~80 líneas
  * ponerEnEspera: ~60 líneas
  * resolverManualmenteSinProveedor: ~110 líneas
- Función URLs firmadas: ~150 líneas
- Función enviar comentario: ~100 líneas
- JSX/UI: ~800 líneas
  * Datos técnicos: ~200 líneas
  * Acciones Control: ~150 líneas
  * Chat: ~300 líneas
  * Modales: ~150 líneas
```

#### Después de Refactorización
```
page.tsx: ~200 líneas
├── useIncidenciaChat: ~100 líneas
├── useComentarios: ~80 líneas
├── useImageUrls: ~60 líneas
├── DatosTecnicos: ~100 líneas
├── AccionesControl: ~120 líneas
├── ChatMessages: ~150 líneas
├── asignarProveedor.ts: ~150 líneas
├── anularIncidencia.ts: ~60 líneas
├── ponerEnEspera.ts: ~50 líneas
└── resolverManual.ts: ~90 líneas
```

**Reducción**: 1810 → 200 líneas en archivo principal ✅

---

### chat-proveedor/page.tsx (3850 líneas)

#### Desglose Actual
```
- Estados: ~60 líneas
- Efectos: ~80 líneas
- Funciones de carga: ~300 líneas
- Funciones de negocio: ~1200 líneas
  * calendarizarVisita: ~140 líneas
  * ofertarPresupuesto: ~160 líneas
  * resolverIncidencia: ~190 líneas
  * valoracionEconomica: ~200 líneas
  * anularIncidencia: ~110 líneas
  * cerrarIncidencia: ~100 líneas
  * cargarPresupuesto: ~80 líneas
  * aprobarPresupuesto: ~80 líneas
  * mandarARevisar: ~80 líneas
  * resolverManualmenteConProveedor: ~100 líneas
- Función URLs: ~150 líneas
- JSX/UI: ~2000 líneas
  * Datos técnicos: ~300 líneas
  * Acciones proveedor: ~500 líneas
  * Chat: ~400 líneas
  * Modales: ~800 líneas
```

#### Después de Refactorización
```
page.tsx: ~250 líneas
├── useProveedorChat: ~150 líneas
├── usePresupuesto: ~100 líneas
├── useVisitas: ~80 líneas
├── DatosProveedor: ~150 líneas
├── AccionesProveedor: ~200 líneas
├── FormPresupuesto: ~150 líneas
├── EstadisticasProveedor: ~100 líneas
├── crearPresupuesto.ts: ~120 líneas
├── resolverIncidencia.ts: ~150 líneas
├── calendarizarVisita.ts: ~100 líneas
└── valorarEconomicamente.ts: ~150 líneas
```

**Reducción**: 3850 → 250 líneas en archivo principal ✅

---

## 🛠️ Estrategia de Refactorización

### Fase 1: Extraer Servicios (Semana 1)
**Prioridad**: ALTA 🔴

#### 1.1 Servicios de Datos
```typescript
// lib/services/comentariosService.ts
export const comentariosService = {
  obtenerPorIncidencia: async (incidenciaId: string) => {...},
  crear: async (comentario: NuevoComentario) => {...},
  obtenerConAdjuntos: async (incidenciaId: string, ambito: string) => {...}
};

// lib/services/storageService.ts
export const storageService = {
  obtenerUrlFirmada: async (storageKey: string, bucket: string) => {...},
  subirArchivo: async (file: File, ruta: string) => {...},
  subirMultiples: async (files: File[], rutaBase: string) => {...}
};

// lib/services/proveedorCasosService.ts
export const proveedorCasosService = {
  asignar: async (datos: AsignacionProveedor) => {...},
  anular: async (incidenciaId: string, motivo: string) => {...},
  reasignar: async (incidenciaId: string, nuevoProveedor: string) => {...},
  cambiarEstado: async (incidenciaId: string, estado: string) => {...}
};
```

**Beneficios**:
- ✅ Centralización de queries
- ✅ Reutilización entre componentes
- ✅ Fácil testing
- ✅ Cache de URLs firmadas

---

### Fase 2: Extraer Hooks Personalizados (Semana 2)
**Prioridad**: ALTA 🔴

#### 2.1 Hook Principal del Chat
```typescript
// shared/hooks/useChat.ts
export function useChat(incidenciaId: string, ambito: 'cliente' | 'proveedor') {
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);

  const cargarComentarios = async () => {
    const data = await comentariosService.obtenerConAdjuntos(incidenciaId, ambito);
    setComentarios(data);
  };

  const enviarComentario = async (cuerpo: string, adjuntos?: File[]) => {
    // Lógica de envío
  };

  return { comentarios, loading, enviando, cargarComentarios, enviarComentario };
}
```

#### 2.2 Hook de URLs Firmadas
```typescript
// shared/hooks/useSignedUrls.ts
export function useSignedUrls(adjuntos: Adjunto[]) {
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadUrls = async () => {
      const urlsMap: Record<string, string> = {};
      for (const adj of adjuntos) {
        const url = await storageService.obtenerUrlFirmada(adj.storage_key, 'incidencias');
        if (url) urlsMap[adj.id] = url;
      }
      setUrls(urlsMap);
    };
    loadUrls();
  }, [adjuntos]);

  return urls;
}
```

**Beneficios**:
- ✅ Lógica reutilizable
- ✅ Separación de responsabilidades
- ✅ Fácil testeo unitario

---

### Fase 3: Extraer Componentes UI (Semana 3)
**Prioridad**: MEDIA 🟡

#### 3.1 Componente Datos Técnicos
```typescript
// chat-control-cliente/components/DatosTecnicos.tsx
export function DatosTecnicos({ incidencia, imageUrls }: Props) {
  return (
    <div className="rounded-lg p-4">
      <h3>DATOS TÉCNICOS</h3>
      <table>
        {/* Tabla con datos */}
      </table>
      {incidencia.adjuntos_principales && (
        <ImagenesGrid adjuntos={incidencia.adjuntos_principales} urls={imageUrls} />
      )}
    </div>
  );
}
```

#### 3.2 Componente Acciones
```typescript
// chat-control-cliente/components/AccionesControl.tsx
export function AccionesControl({
  incidencia,
  tieneProveedor,
  onAsignar,
  onAnular,
  onEspera,
  onResolverManual
}: Props) {
  return (
    <div className="rounded-lg p-4">
      <h3>ACCIONES DE CONTROL</h3>
      <div className="flex gap-4">
        {!tieneProveedor && <button onClick={onAsignar}>Asignar Proveedor</button>}
        {/* Resto de botones */}
      </div>
    </div>
  );
}
```

#### 3.3 Componente Chat Reutilizable
```typescript
// shared/components/ChatContainer.tsx
export function ChatContainer({
  comentarios,
  onEnviar,
  userRole,
  enviando
}: Props) {
  return (
    <div className="bg-white rounded-lg">
      <div className="overflow-y-auto">
        {comentarios.map(c => (
          <ChatMessage key={c.id} comentario={c} userRole={userRole} />
        ))}
      </div>
      <ChatInput onSubmit={onEnviar} disabled={enviando} />
    </div>
  );
}
```

**Beneficios**:
- ✅ Componentes pequeños y focalizados
- ✅ Reutilización
- ✅ Fácil estilizado

---

### Fase 4: Server Actions (Next.js 15) (Semana 4)
**Prioridad**: BAJA 🟢

```typescript
// chat-control-cliente/actions/asignarProveedor.ts
'use server';

export async function asignarProveedorAction(
  incidenciaId: string,
  formulario: FormularioProveedor
) {
  // Lógica servidor
  // Más seguro, no expone lógica al cliente
}
```

**Beneficios**:
- ✅ Mejor seguridad
- ✅ Menor bundle JS
- ✅ Validación servidor

---

## 📋 Ejemplo de Refactorización Completa

### ANTES: chat-control-cliente/page.tsx (1810 líneas)

```typescript
"use client";

export default function ChatControlCliente() {
  // 30 estados
  const [incidencia, setIncidencia] = useState<Incidencia | null>(null);
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  // ... 28 estados más

  // 5 useEffects
  useEffect(() => { cargarDatos(); }, []);
  useEffect(() => { cargarImagenes(); }, [incidencia]);
  // ... 3 useEffects más

  // 10 funciones (cada una 50-200 líneas)
  const cargarDatos = async () => { /* 100 líneas */ };
  const asignarProveedorCompleto = async () => { /* 230 líneas */ };
  const anularIncidencia = async () => { /* 80 líneas */ };
  // ... 7 funciones más

  // JSX gigante (800 líneas)
  return (
    <div>
      {/* 200 líneas: Datos técnicos */}
      {/* 150 líneas: Acciones */}
      {/* 300 líneas: Chat */}
      {/* 150 líneas: Modales */}
    </div>
  );
}
```

---

### DESPUÉS: Arquitectura Modular

#### page.tsx (~200 líneas)
```typescript
"use client";

import { useIncidenciaChat } from './hooks/useIncidenciaChat';
import { useComentarios } from './hooks/useComentarios';
import { DatosTecnicos } from './components/DatosTecnicos';
import { AccionesControl } from './components/AccionesControl';
import { ChatContainer } from '../shared/components/ChatContainer';

export default function ChatControlCliente() {
  const { id } = useParams();

  // Hooks personalizados encapsulan lógica
  const {
    incidencia,
    loading,
    tieneProveedor,
    imageUrls,
    cargarDatos
  } = useIncidenciaChat(id as string);

  const {
    comentarios,
    enviarComentario,
    enviando
  } = useComentarios(id as string, 'cliente');

  const [modals, setModals] = useState({
    asignar: false,
    anular: false,
    espera: false,
    resolverManual: false
  });

  if (loading) return <Loading />;

  return (
    <div className="min-h-screen" style={{ backgroundColor: PALETA.bg }}>
      {/* Componentes pequeños y reutilizables */}
      <DatosTecnicos incidencia={incidencia} imageUrls={imageUrls} />

      <AccionesControl
        incidencia={incidencia}
        tieneProveedor={tieneProveedor}
        onAsignar={() => setModals({ ...modals, asignar: true })}
        onAnular={() => setModals({ ...modals, anular: true })}
        onEspera={() => setModals({ ...modals, espera: true })}
        onResolverManual={() => setModals({ ...modals, resolverManual: true })}
      />

      <ChatContainer
        comentarios={comentarios}
        onEnviar={enviarComentario}
        userRole="Control"
        enviando={enviando}
      />

      {/* Modales */}
      <ModalAsignarProveedor
        isOpen={modals.asignar}
        onClose={() => setModals({ ...modals, asignar: false })}
        onSubmit={handleAsignar}
      />
      {/* Resto de modales */}
    </div>
  );
}
```

#### hooks/useIncidenciaChat.ts (~100 líneas)
```typescript
import { incidenciasService } from '@/lib/services/incidenciasService';
import { storageService } from '@/lib/services/storageService';

export function useIncidenciaChat(incidenciaId: string) {
  const [incidencia, setIncidencia] = useState<Incidencia | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [tieneProveedor, setTieneProveedor] = useState(false);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const data = await incidenciasService.obtenerPorId(incidenciaId, 'completo');
      setIncidencia(data);

      // Verificar proveedor
      const tieneProveedor = await incidenciasService.tieneProveedorActivo(incidenciaId);
      setTieneProveedor(tieneProveedor);

      // Cargar URLs de imágenes
      if (data.adjuntos_principales) {
        const urls = await storageService.obtenerUrlsMultiples(
          data.adjuntos_principales.map(a => a.storage_key)
        );
        setImageUrls(urls);
      }
    } catch (error) {
      console.error('Error cargando incidencia:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [incidenciaId]);

  return {
    incidencia,
    loading,
    tieneProveedor,
    imageUrls,
    cargarDatos
  };
}
```

#### components/DatosTecnicos.tsx (~100 líneas)
```typescript
import { PALETA } from '@/lib/theme';

interface Props {
  incidencia: Incidencia;
  imageUrls: Record<string, string>;
}

export function DatosTecnicos({ incidencia, imageUrls }: Props) {
  const hasImages = incidencia.adjuntos_principales && incidencia.adjuntos_principales.length > 0;

  return (
    <div className="mb-6">
      <div className="rounded-lg p-4" style={{ backgroundColor: PALETA.card }}>
        <h3 className="text-center text-lg font-semibold mb-4">
          DATOS TÉCNICOS
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <table className="w-full text-xs">
              <tbody>
                <tr>
                  <td className="py-2 font-semibold">Número solicitud:</td>
                  <td className="py-2">{incidencia.num_solicitud}</td>
                </tr>
                <tr>
                  <td className="py-2 font-semibold">Centro:</td>
                  <td className="py-2">{incidencia.centro}</td>
                </tr>
                <tr>
                  <td className="py-2 font-semibold">Estado:</td>
                  <td className="py-2">
                    <EstadoBadge estado={incidencia.estado_cliente} />
                  </td>
                </tr>
                <tr>
                  <td className="py-2 font-semibold">Descripción:</td>
                  <td className="py-2">{incidencia.descripcion}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {hasImages && (
            <div>
              <p className="font-semibold text-sm mb-2">Imágenes:</p>
              <ImagenesGrid
                adjuntos={incidencia.adjuntos_principales}
                urls={imageUrls}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## 📊 Comparativa: Antes vs Después

| Métrica | Antes | Después | Mejora |
|---------|-------|---------|--------|
| **Líneas archivo principal** | 1810 / 3850 | 200 / 250 | ↓ 89% / 93% |
| **Componentes por archivo** | 1 monolito | 8-12 componentes | ↑ Modularidad |
| **Funciones > 50 líneas** | 10-15 | 0-2 | ↓ 85% |
| **Código duplicado** | ~30% | <5% | ↓ 83% |
| **Tiempo encontrar código** | 5-10 min | 30 seg | ↓ 90% |
| **Facilidad testing** | Muy difícil | Fácil | ↑ 100% |
| **Re-renders innecesarios** | Alto | Bajo | ↑ Performance |

---

## ✅ Checklist de Implementación

### Servicios
- [ ] `lib/services/comentariosService.ts`
- [ ] `lib/services/storageService.ts`
- [ ] `lib/services/proveedorCasosService.ts`
- [ ] `lib/services/presupuestosService.ts`
- [ ] `lib/services/visitasService.ts`

### Hooks Compartidos
- [ ] `shared/hooks/useChat.ts`
- [ ] `shared/hooks/useSignedUrls.ts`
- [ ] `shared/hooks/useFileUpload.ts`
- [ ] `shared/hooks/useScrollToBottom.ts`

### Componentes Compartidos
- [ ] `shared/components/ChatContainer.tsx`
- [ ] `shared/components/ChatMessage.tsx`
- [ ] `shared/components/ChatInput.tsx`
- [ ] `shared/components/ImagenesGrid.tsx`

### Chat Control-Cliente
- [ ] `hooks/useIncidenciaChat.ts`
- [ ] `hooks/useComentarios.ts`
- [ ] `components/DatosTecnicos.tsx`
- [ ] `components/AccionesControl.tsx`
- [ ] Refactorizar `page.tsx`

### Chat Proveedor
- [ ] `hooks/useProveedorChat.ts`
- [ ] `hooks/usePresupuesto.ts`
- [ ] `hooks/useVisitas.ts`
- [ ] `components/DatosProveedor.tsx`
- [ ] `components/AccionesProveedor.tsx`
- [ ] `components/FormPresupuesto.tsx`
- [ ] Refactorizar `page.tsx`

---

## 🚀 Orden de Implementación Recomendado

### Sprint 1 (Semana 1): Servicios Base
1. Crear `storageService.ts` (reduce duplicación inmediata)
2. Crear `comentariosService.ts`
3. Actualizar ambos chats para usar servicios

**Resultado**: Reducción ~20% líneas, centralización queries

---

### Sprint 2 (Semana 2): Hooks Compartidos
1. Extraer `useChat.ts`
2. Extraer `useSignedUrls.ts`
3. Integrar en ambos chats

**Resultado**: Reducción ~30% líneas, reutilización lógica

---

### Sprint 3 (Semana 3): Componentes UI
1. Extraer componentes chat compartidos
2. Extraer DatosTecnicos
3. Extraer AccionesControl/AccionesProveedor

**Resultado**: Reducción ~40% líneas, mejor organización

---

### Sprint 4 (Semana 4): Server Actions (Opcional)
1. Migrar funciones críticas a server actions
2. Optimizar seguridad
3. Testing completo

**Resultado**: Mejor seguridad, menor bundle

---

## 📚 Recursos y Referencias

### Patrones Aplicados
- **Custom Hooks**: Para lógica reutilizable
- **Composition**: Componentes pequeños combinables
- **Service Layer**: Separación datos/UI
- **Dependency Injection**: Pasar funciones como props

### Referencias Next.js 15
- [Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- [React 19 Hooks](https://react.dev/reference/react)
- [Performance Optimization](https://nextjs.org/docs/app/building-your-application/optimizing)

---

## 💡 Beneficios a Largo Plazo

### Para Desarrolladores
- ✅ Código más fácil de entender
- ✅ Onboarding más rápido de nuevos devs
- ✅ Menos bugs por complejidad
- ✅ Refactors futuros más simples

### Para el Proyecto
- ✅ Mantenibilidad a largo plazo
- ✅ Escalabilidad
- ✅ Testing automatizado posible
- ✅ Performance mejorado

### Para el Cliente
- ✅ Menos tiempo de desarrollo nuevas features
- ✅ Menos bugs en producción
- ✅ Aplicación más rápida
- ✅ Menor costo mantenimiento

---

## 🎯 Siguiente Paso

**¿Quieres que empiece con el Sprint 1 (Servicios Base)?**

Puedo empezar creando:
1. `lib/services/storageService.ts` - URLs firmadas centralizadas
2. `lib/services/comentariosService.ts` - CRUD comentarios
3. Actualizar ambos chats para usar estos servicios

Esto dará resultados inmediatos y reducirá ~500 líneas de código duplicado.
