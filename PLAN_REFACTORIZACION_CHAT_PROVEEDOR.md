# 📋 PLAN DE REFACTORIZACIÓN - CHAT PROVEEDOR

## 📊 Situación Actual

### Archivo Principal
- **Archivo**: `app/(app)/incidencias/[id]/chat-proveedor/page.tsx`
- **Líneas**: **2975 líneas** 🚨
- **Complejidad**: CRÍTICA

### Comparación con Chat Control-Cliente
| Aspecto | Chat Control-Cliente | Chat Proveedor |
|---------|---------------------|----------------|
| **Líneas totales** | 936 (después refactor) | 2975 (sin refactor) |
| **Estados useState** | ~15 | **~50** 🚨 |
| **Funciones** | ~10 | **~25** 🚨 |
| **Modales** | 4 | **8** |
| **Complejidad lógica** | Media | **Muy Alta** |

### Problemas Identificados

#### 1. **Exceso de Estados** (~50 estados)
```typescript
// Estados de incidencia y UI básica (8)
const [incidencia, setIncidencia] = useState<Incidencia | null>(null);
const [comentarios, setComentarios] = useState<Comentario[]>([]);
const [nuevoComentario, setNuevoComentario] = useState("");
const [loading, setLoading] = useState(true);
const [enviando, setEnviando] = useState(false);
const [direccionCentro, setDireccionCentro] = useState<string | null>(null);
const [proveedorAsignado, setProveedorAsignado] = useState(false);
const [nombreProveedor, setNombreProveedor] = useState<string | null>(null);

// Estados de archivos (6)
const [imagenSeleccionada, setImagenSeleccionada] = useState<File | null>(null);
const [documentoSeleccionado, setDocumentoSeleccionado] = useState<File | null>(null);
const [imagenResolucion, setImagenResolucion] = useState<File | null>(null);
const [documentoResolucion, setDocumentoResolucion] = useState<File | null>(null);
const [documentoJustificativo, setDocumentoJustificativo] = useState<File | null>(null);
const [documentoPresupuesto, setDocumentoPresupuesto] = useState<File | null>(null);

// Estados de URLs firmadas (3)
const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
const [commentAttachmentUrls, setCommentAttachmentUrls] = useState<Record<string, string>>({});
const [documentoPresupuestoUrl, setDocumentoPresupuestoUrl] = useState<string | null>(null);

// Estados de visitas (3)
const [mostrarModalVisita, setMostrarModalVisita] = useState(false);
const [fechaVisita, setFechaVisita] = useState('');
const [horarioVisita, setHorarioVisita] = useState('');
const [visitaCalendarizada, setVisitaCalendarizada] = useState<{fecha: string; horario: string;} | null>(null);

// Estados de presupuestos (8)
const [mostrarModalPresupuesto, setMostrarModalPresupuesto] = useState(false);
const [mostrarModalGestionPresupuesto, setMostrarModalGestionPresupuesto] = useState(false);
const [presupuesto, setPresupuesto] = useState('');
const [descripcionPresupuesto, setDescripcionPresupuesto] = useState('');
const [fechaEstimadaInicio, setFechaEstimadaInicio] = useState('');
const [duracionEstimada, setDuracionEstimada] = useState('');
const [importeTotalSinIva, setImporteTotalSinIva] = useState('');
const [presupuestoActual, setPresupuestoActual] = useState<PresupuestoType | null>(null);
const [tieneOfertaAprobada, setTieneOfertaAprobada] = useState(false);
const [tuvoOfertaAprobada, setTuvoOfertaAprobada] = useState(false);
const [cargandoPresupuesto, setCargandoPresupuesto] = useState(false);

// Estados de valoración económica (3)
const [importeSinIva, setImporteSinIva] = useState('');
const [importeConIva, setImporteConIva] = useState('');
const [porcentajeIva, setPorcentajeIva] = useState('');

// Estados de resolución (2)
const [mostrarModalResolver, setMostrarModalResolver] = useState(false);
const [solucionAplicada, setSolucionAplicada] = useState('');

// Estados de Control (7)
const [mostrarModalAnular, setMostrarModalAnular] = useState(false);
const [mostrarModalCerrar, setMostrarModalCerrar] = useState(false);
const [mostrarModalValorarIncidencia, setMostrarModalValorarIncidencia] = useState(false);
const [mostrarModalResolucionManual, setMostrarModalResolucionManual] = useState(false);
const [mostrarModalMotivoRevision, setMostrarModalMotivoRevision] = useState(false);
const [motivoAnulacion, setMotivoAnulacion] = useState('');
const [motivoCierre, setMotivoCierre] = useState('');
const [motivoRevision, setMotivoRevision] = useState('');

// Estados de historial (3)
const [fechaAsignacionProveedor, setFechaAsignacionProveedor] = useState<string | null>(null);
const [historialProveedores, setHistorialProveedores] = useState<ProveedorHistorico[]>([]);
const [historialProveedor, setHistorialProveedor] = useState<CambioEstado[]>([]);
```

**TOTAL: ~50 estados** 🚨

#### 2. **Funciones Complejas Dentro del Componente**

Funciones que todavía están en el archivo principal:
- `cargarDatos()` - **~230 líneas** - Carga masiva de información
- `enviarComentario()` - **~100 líneas** - Manejo de comentarios
- `anularIncidencia()` - **~120 líneas** - Lógica de anulación
- `cerrarIncidencia()` - **~80 líneas** - Cierre de incidencia
- `mandarARevisar()` - **~90 líneas** - Revisión de presupuesto
- `aprobarPresupuesto()` - **~100 líneas** - Aprobación
- `abrirModalGestionPresupuesto()` - **~40 líneas** - Carga de presupuesto
- `getSignedDocumentUrl()` - **~30 líneas** - URLs firmadas (duplicado)
- `getSignedImageUrl()` - **~30 líneas** - URLs firmadas (duplicado)
- `cargarDireccionCentro()` - **~25 líneas** - Carga de dirección

**TOTAL: ~845 líneas solo en funciones de lógica** 🚨

#### 3. **JSX Masivo**
- Datos técnicos: **~300 líneas**
- Acciones Control: **~150 líneas**
- Acciones Proveedor: **~400 líneas**
- Chat: **~500 líneas**
- Modales: **~400 líneas**
- Historiales: **~200 líneas**

**TOTAL: ~1950 líneas de JSX** 🚨

---

## 🎯 Objetivos de la Refactorización

### Metas Principales
1. ✅ **Reducir archivo principal de 2975 → ~300 líneas** (90% reducción)
2. ✅ **Extraer ~40 estados a hooks personalizados**
3. ✅ **Convertir funciones complejas en servicios**
4. ✅ **Componentizar UI en piezas reutilizables**
5. ✅ **Reutilizar hooks y componentes ya creados**
6. ✅ **Mantener la lógica de negocio funcionando sin cambios**

---

## 📐 Arquitectura Propuesta

```
app/(app)/incidencias/[id]/chat-proveedor/
├── page.tsx                           # 🎯 ~300 líneas (solo orquestación)
├── hooks/
│   ├── useProveedorChat.ts           # ⚡ Estado principal + carga datos
│   ├── usePresupuestoGestion.ts      # ⚡ Toda lógica de presupuestos
│   ├── useVisitaGestion.ts           # ⚡ Calendarización de visitas
│   ├── useValoracionEconomica.ts     # ⚡ Valoraciones e importes
│   ├── useControlActions.ts          # ⚡ Acciones de Control en chat proveedor
│   └── useProveedorActions.ts        # ⚡ Acciones específicas del proveedor
├── components/
│   ├── DatosProveedorIncidencia.tsx  # 📦 Datos técnicos + proveedor
│   ├── AccionesControl.tsx           # 📦 Acciones para rol Control
│   ├── AccionesProveedor.tsx         # 📦 Acciones para rol Proveedor
│   ├── HistorialProveedores.tsx      # 📦 Tabla de proveedores históricos
│   └── ModalGestionPresupuesto.tsx   # 📦 Modal complejo de presupuesto
└── types/
    └── proveedor.ts                  # 📋 Tipos específicos del proveedor

# Reutilizados de shared/
shared/
├── hooks/
│   ├── useSignedUrls.ts              # ✅ Ya existe - URLs firmadas
│   ├── useFileUpload.ts              # ✅ Ya existe - Subida archivos
│   └── useChat.ts                    # ✅ Ya existe - Chat genérico
├── components/
│   ├── ChatContainer.tsx             # ✅ Ya existe
│   ├── ChatMessage.tsx               # ✅ Ya existe
│   ├── ChatInput.tsx                 # ✅ Ya existe
│   ├── DatosTecnicosIncidencia.tsx   # ✅ Ya existe
│   └── HistorialEstados.tsx          # ✅ Ya existe

# Servicios ya creados
lib/services/
├── storageService.ts                 # ✅ Ya existe
├── comentariosService.ts             # ✅ Ya existe
├── citasService.ts                   # ✅ Ya existe
├── presupuestosService.ts            # ✅ Ya existe
├── resolucionProveedorService.ts     # ✅ Ya existe
└── proveedorCasosService.ts          # ✅ Ya existe

# Modales ya creados
components/proveedor/
├── ModalCalendarizar.tsx             # ✅ Ya existe
├── ModalOferta.tsx                   # ✅ Ya existe
├── ModalValoracion.tsx               # ✅ Ya existe
└── ModalResolver.tsx                 # ✅ Ya existe
```

---

## 🔍 Plan Detallado de Refactorización

### FASE 1: Crear Hooks Personalizados

#### 1.1 `useProveedorChat.ts` - Hook Principal
**Responsabilidad**: Gestión del estado principal del chat proveedor

```typescript
// hooks/useProveedorChat.ts
export function useProveedorChat(incidenciaId: string) {
  // Estados básicos
  const [incidencia, setIncidencia] = useState<Incidencia | null>(null);
  const [loading, setLoading] = useState(true);
  const [proveedorAsignado, setProveedorAsignado] = useState(false);
  const [nombreProveedor, setNombreProveedor] = useState<string | null>(null);
  const [direccionCentro, setDireccionCentro] = useState<string | null>(null);

  // Historial
  const [historialProveedores, setHistorialProveedores] = useState<ProveedorHistorico[]>([]);
  const [historialProveedor, setHistorialProveedor] = useState<CambioEstado[]>([]);
  const [fechaAsignacionProveedor, setFechaAsignacionProveedor] = useState<string | null>(null);

  const cargarDatos = async () => {
    // Toda la lógica de cargarDatos() actual
    // ~230 líneas movidas aquí
  };

  const cargarDireccionCentro = async (institucionId?: string, nombreCentro?: string) => {
    // Lógica de carga de dirección
  };

  useEffect(() => {
    cargarDatos();
  }, [incidenciaId]);

  return {
    incidencia,
    loading,
    proveedorAsignado,
    nombreProveedor,
    direccionCentro,
    historialProveedores,
    historialProveedor,
    fechaAsignacionProveedor,
    cargarDatos
  };
}
```

**Reducción**: ~300 líneas extraídas del page.tsx

---

#### 1.2 `usePresupuestoGestion.ts` - Gestión de Presupuestos
**Responsabilidad**: Todo lo relacionado con presupuestos

```typescript
// hooks/usePresupuestoGestion.ts
export function usePresupuestoGestion(incidenciaId: string) {
  // Estados de presupuesto
  const [mostrarModalPresupuesto, setMostrarModalPresupuesto] = useState(false);
  const [mostrarModalGestionPresupuesto, setMostrarModalGestionPresupuesto] = useState(false);
  const [presupuesto, setPresupuesto] = useState('');
  const [descripcionPresupuesto, setDescripcionPresupuesto] = useState('');
  const [fechaEstimadaInicio, setFechaEstimadaInicio] = useState('');
  const [duracionEstimada, setDuracionEstimada] = useState('');
  const [importeTotalSinIva, setImporteTotalSinIva] = useState('');
  const [documentoPresupuesto, setDocumentoPresupuesto] = useState<File | null>(null);
  const [presupuestoActual, setPresupuestoActual] = useState<PresupuestoType | null>(null);
  const [tieneOfertaAprobada, setTieneOfertaAprobada] = useState(false);
  const [tuvoOfertaAprobada, setTuvoOfertaAprobada] = useState(false);
  const [cargandoPresupuesto, setCargandoPresupuesto] = useState(false);
  const [documentoPresupuestoUrl, setDocumentoPresupuestoUrl] = useState<string | null>(null);
  const [mostrarModalMotivoRevision, setMostrarModalMotivoRevision] = useState(false);
  const [motivoRevision, setMotivoRevision] = useState('');

  const abrirModalGestionPresupuesto = async () => {
    // Lógica de carga de presupuesto
  };

  const cerrarModalPresupuesto = () => {
    setMostrarModalPresupuesto(false);
    // Limpiar estados
  };

  const aprobarPresupuesto = async () => {
    // Lógica de aprobación (usando servicio)
  };

  const mandarARevisar = async () => {
    // Lógica de revisión
  };

  return {
    // Estados
    mostrarModalPresupuesto,
    mostrarModalGestionPresupuesto,
    presupuestoActual,
    tieneOfertaAprobada,
    tuvoOfertaAprobada,
    cargandoPresupuesto,
    documentoPresupuestoUrl,
    // Formulario
    presupuesto,
    setPresupuesto,
    descripcionPresupuesto,
    setDescripcionPresupuesto,
    fechaEstimadaInicio,
    setFechaEstimadaInicio,
    duracionEstimada,
    setDuracionEstimada,
    importeTotalSinIva,
    setImporteTotalSinIva,
    documentoPresupuesto,
    setDocumentoPresupuesto,
    // Acciones
    abrirModalGestionPresupuesto,
    cerrarModalPresupuesto,
    aprobarPresupuesto,
    mandarARevisar,
    // Modal de revisión
    mostrarModalMotivoRevision,
    setMostrarModalMotivoRevision,
    motivoRevision,
    setMotivoRevision
  };
}
```

**Reducción**: ~400 líneas extraídas del page.tsx

---

#### 1.3 `useVisitaGestion.ts` - Gestión de Visitas
**Responsabilidad**: Calendarización y gestión de visitas

```typescript
// hooks/useVisitaGestion.ts
export function useVisitaGestion(incidenciaId: string, numSolicitud: string) {
  const [mostrarModalVisita, setMostrarModalVisita] = useState(false);
  const [fechaVisita, setFechaVisita] = useState('');
  const [horarioVisita, setHorarioVisita] = useState('');
  const [visitaCalendarizada, setVisitaCalendarizada] = useState<{
    fecha: string;
    horario: string;
  } | null>(null);
  const [enviando, setEnviando] = useState(false);

  const handleCalendarizarVisita = async () => {
    if (!fechaVisita || !horarioVisita) {
      alert('Por favor completa todos los campos');
      return;
    }

    try {
      setEnviando(true);

      // Usar servicio ya existente
      await calendarizarVisita({
        incidenciaId,
        numSolicitud,
        fechaVisita,
        horarioVisita,
        perfil // obtener de AuthContext
      });

      setVisitaCalendarizada({ fecha: fechaVisita, horario: horarioVisita });
      cerrarModal();
    } catch (error) {
      console.error('Error calendarizando visita:', error);
      alert('Error al calendarizar la visita');
    } finally {
      setEnviando(false);
    }
  };

  const cerrarModal = () => {
    setMostrarModalVisita(false);
    setFechaVisita('');
    setHorarioVisita('');
  };

  return {
    mostrarModalVisita,
    setMostrarModalVisita,
    fechaVisita,
    setFechaVisita,
    horarioVisita,
    setHorarioVisita,
    visitaCalendarizada,
    enviando,
    handleCalendarizarVisita,
    cerrarModal
  };
}
```

**Reducción**: ~150 líneas extraídas del page.tsx

---

#### 1.4 `useValoracionEconomica.ts` - Valoraciones
**Responsabilidad**: Gestión de valoraciones económicas

```typescript
// hooks/useValoracionEconomica.ts
export function useValoracionEconomica(
  incidenciaId: string,
  numSolicitud: string,
  presupuestoActual: PresupuestoType | null
) {
  const [mostrarModalValorarIncidencia, setMostrarModalValorarIncidencia] = useState(false);
  const [importeSinIva, setImporteSinIva] = useState('');
  const [importeConIva, setImporteConIva] = useState('');
  const [porcentajeIva, setPorcentajeIva] = useState('');
  const [documentoJustificativo, setDocumentoJustificativo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Efecto para detectar si el importe coincide con la oferta
  useEffect(() => {
    const importeActual = parseFloat(importeSinIva) || 0;
    const importeOferta = presupuestoActual?.importe_total_sin_iva
      ? parseFloat(String(presupuestoActual.importe_total_sin_iva))
      : 0;
    const importeCoincide = importeActual > 0 && importeActual === importeOferta;

    // Aquí puedes exponer este estado si lo necesitas
  }, [importeSinIva, presupuestoActual]);

  const handleValorarEconomicamente = async () => {
    try {
      setEnviando(true);

      // Usar servicio ya existente
      await valoracionEconomicaService({
        incidenciaId,
        numSolicitud,
        importeSinIva: parseFloat(importeSinIva),
        importeConIva: parseFloat(importeConIva),
        porcentajeIva: parseFloat(porcentajeIva),
        documentoJustificativo,
        perfil // obtener de AuthContext
      });

      cerrarModal();
    } catch (error) {
      console.error('Error en valoración económica:', error);
      alert('Error al realizar la valoración económica');
    } finally {
      setEnviando(false);
    }
  };

  const cerrarModal = () => {
    setMostrarModalValorarIncidencia(false);
    setImporteSinIva('');
    setImporteConIva('');
    setPorcentajeIva('');
    setDocumentoJustificativo(null);
  };

  return {
    mostrarModalValorarIncidencia,
    setMostrarModalValorarIncidencia,
    importeSinIva,
    setImporteSinIva,
    importeConIva,
    setImporteConIva,
    porcentajeIva,
    setPorcentajeIva,
    documentoJustificativo,
    setDocumentoJustificativo,
    enviando,
    handleValorarEconomicamente,
    cerrarModal
  };
}
```

**Reducción**: ~120 líneas extraídas del page.tsx

---

#### 1.5 `useControlActions.ts` - Acciones de Control
**Responsabilidad**: Acciones de Control en el chat proveedor

```typescript
// hooks/useControlActions.ts
export function useControlActions(incidenciaId: string, numSolicitud: string) {
  const [mostrarModalAnular, setMostrarModalAnular] = useState(false);
  const [mostrarModalCerrar, setMostrarModalCerrar] = useState(false);
  const [mostrarModalResolucionManual, setMostrarModalResolucionManual] = useState(false);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');
  const [motivoCierre, setMotivoCierre] = useState('');
  const [enviando, setEnviando] = useState(false);

  const handleAnularIncidencia = async () => {
    // Lógica de anulación
    // Usar servicio si existe, o crear uno
  };

  const handleCerrarIncidencia = async () => {
    // Lógica de cierre
  };

  const handleResolucionManual = async (formulario: FormularioResolucionManual) => {
    // Lógica de resolución manual
  };

  return {
    // Anular
    mostrarModalAnular,
    setMostrarModalAnular,
    motivoAnulacion,
    setMotivoAnulacion,
    handleAnularIncidencia,
    // Cerrar
    mostrarModalCerrar,
    setMostrarModalCerrar,
    motivoCierre,
    setMotivoCierre,
    handleCerrarIncidencia,
    // Resolución manual
    mostrarModalResolucionManual,
    setMostrarModalResolucionManual,
    handleResolucionManual,
    // Estado
    enviando
  };
}
```

**Reducción**: ~200 líneas extraídas del page.tsx

---

#### 1.6 `useProveedorActions.ts` - Acciones del Proveedor
**Responsabilidad**: Acciones específicas del rol Proveedor

```typescript
// hooks/useProveedorActions.ts
export function useProveedorActions(
  incidenciaId: string,
  numSolicitud: string
) {
  const [mostrarModalResolver, setMostrarModalResolver] = useState(false);
  const [solucionAplicada, setSolucionAplicada] = useState('');
  const [imagenResolucion, setImagenResolucion] = useState<File | null>(null);
  const [documentoResolucion, setDocumentoResolucion] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);

  const handleResolverIncidencia = async () => {
    try {
      setEnviando(true);

      // Usar servicio ya existente
      await resolverIncidenciaService({
        incidenciaId,
        numSolicitud,
        solucionAplicada,
        imagenResolucion,
        documentoResolucion,
        perfil // obtener de AuthContext
      });

      cerrarModal();
    } catch (error) {
      console.error('Error resolviendo incidencia:', error);
      alert('Error al resolver la incidencia');
    } finally {
      setEnviando(false);
    }
  };

  const cerrarModal = () => {
    setMostrarModalResolver(false);
    setSolucionAplicada('');
    setImagenResolucion(null);
    setDocumentoResolucion(null);
  };

  return {
    mostrarModalResolver,
    setMostrarModalResolver,
    solucionAplicada,
    setSolucionAplicada,
    imagenResolucion,
    setImagenResolucion,
    documentoResolucion,
    setDocumentoResolucion,
    enviando,
    handleResolverIncidencia,
    cerrarModal
  };
}
```

**Reducción**: ~150 líneas extraídas del page.tsx

---

### FASE 2: Crear Componentes UI

#### 2.1 `DatosProveedorIncidencia.tsx`
**Responsabilidad**: Mostrar datos técnicos con información del proveedor

```typescript
// components/DatosProveedorIncidencia.tsx
interface Props {
  incidencia: Incidencia;
  imageUrls: Record<string, string>;
  direccionCentro: string | null;
  nombreProveedor: string | null;
  fechaAsignacionProveedor: string | null;
  visitaCalendarizada: { fecha: string; horario: string } | null;
  userRole: string;
}

export default function DatosProveedorIncidencia({
  incidencia,
  imageUrls,
  direccionCentro,
  nombreProveedor,
  fechaAsignacionProveedor,
  visitaCalendarizada,
  userRole
}: Props) {
  return (
    <div className="rounded-lg shadow-lg mb-6" style={{ backgroundColor: PALETA.card }}>
      <div
        className="px-6 py-4 border-b rounded-t-lg"
        style={{
          backgroundColor: PALETA.headerTable,
          color: PALETA.textoOscuro
        }}
      >
        <h2 className="text-lg font-semibold text-center">
          DATOS TÉCNICOS DE LA INCIDENCIA
        </h2>
      </div>
      <div className="px-6 py-4">
        {/* Reutilizar DatosTecnicosIncidencia */}
        <DatosTecnicosIncidencia
          incidencia={incidencia}
          imageUrls={imageUrls}
          adjuntosPrincipales={incidencia.adjuntos_principales}
        />

        {/* Información adicional del proveedor */}
        {userRole === 'Proveedor' && (
          <>
            {direccionCentro && (
              <div className="mt-4">
                <p className="font-semibold text-sm">Dirección del centro:</p>
                <p className="text-sm">{direccionCentro}</p>
              </div>
            )}
            {visitaCalendarizada && (
              <div className="mt-4">
                <p className="font-semibold text-sm">Visita calendarizada:</p>
                <p className="text-sm">
                  {new Date(visitaCalendarizada.fecha).toLocaleDateString('es-ES')} - {visitaCalendarizada.horario}
                </p>
              </div>
            )}
          </>
        )}

        {/* Para Control, mostrar nombre del proveedor */}
        {userRole === 'Control' && nombreProveedor && (
          <div className="mt-4">
            <p className="font-semibold text-sm">Proveedor asignado:</p>
            <p className="text-sm">{nombreProveedor}</p>
            {fechaAsignacionProveedor && (
              <p className="text-xs text-gray-500">
                Asignado el {new Date(fechaAsignacionProveedor).toLocaleDateString('es-ES')}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Reducción**: ~350 líneas extraídas del page.tsx

---

#### 2.2 `AccionesControl.tsx`
**Responsabilidad**: Acciones disponibles para Control

```typescript
// components/AccionesControl.tsx
interface Props {
  incidencia: Incidencia;
  onAnular: () => void;
  onCerrar: () => void;
  onValorar: () => void;
  onResolverManual: () => void;
  onMandarARevisar: () => void;
  onAprobarPresupuesto: () => void;
  presupuestoActual: PresupuestoType | null;
}

export default function AccionesControl({ ... }: Props) {
  return (
    <div className="rounded-lg shadow-lg mb-6" style={{ backgroundColor: PALETA.card }}>
      <div
        className="px-6 py-4 border-b rounded-t-lg"
        style={{
          backgroundColor: PALETA.headerTable,
          color: PALETA.textoOscuro
        }}
      >
        <h2 className="text-lg font-semibold">ACCIONES DE CONTROL</h2>
      </div>
      <div className="px-6 py-4">
        <div className="flex justify-center gap-4 flex-wrap">
          {/* Botones condicionales según estado */}
          {incidencia.estado_cliente !== 'Anulada' && (
            <button onClick={onAnular} className="...">
              Anular incidencia
            </button>
          )}

          {/* Más botones... */}
        </div>
      </div>
    </div>
  );
}
```

**Reducción**: ~200 líneas extraídas del page.tsx

---

#### 2.3 `AccionesProveedor.tsx`
**Responsabilidad**: Acciones disponibles para Proveedor

```typescript
// components/AccionesProveedor.tsx
interface Props {
  incidencia: Incidencia;
  onCalendarizarVisita: () => void;
  onOfertarPresupuesto: () => void;
  onResolver: () => void;
  visitaCalendarizada: { fecha: string; horario: string } | null;
  tieneOfertaAprobada: boolean;
}

export default function AccionesProveedor({ ... }: Props) {
  return (
    <div className="rounded-lg shadow-lg mb-6" style={{ backgroundColor: PALETA.card }}>
      <div
        className="px-6 py-4 border-b rounded-t-lg"
        style={{
          backgroundColor: PALETA.headerTable,
          color: PALETA.textoOscuro
        }}
      >
        <h2 className="text-lg font-semibold">ACCIONES DISPONIBLES</h2>
      </div>
      <div className="px-6 py-4">
        <div className="flex justify-center gap-4 flex-wrap">
          {/* Botones condicionales según estado y flujo */}
          {!visitaCalendarizada && incidencia.estado_proveedor === 'Asignada' && (
            <button onClick={onCalendarizarVisita} className="...">
              Calendarizar visita
            </button>
          )}

          {/* Más botones... */}
        </div>
      </div>
    </div>
  );
}
```

**Reducción**: ~450 líneas extraídas del page.tsx

---

#### 2.4 `HistorialProveedores.tsx`
**Responsabilidad**: Tabla de proveedores históricos

```typescript
// components/HistorialProveedores.tsx
interface Props {
  historial: ProveedorHistorico[];
}

export default function HistorialProveedores({ historial }: Props) {
  if (historial.length === 0) return null;

  return (
    <div className="rounded-lg shadow-lg mb-6" style={{ backgroundColor: PALETA.card }}>
      <div
        className="px-6 py-4 border-b rounded-t-lg"
        style={{
          backgroundColor: PALETA.headerTable,
          color: PALETA.textoOscuro
        }}
      >
        <h2 className="text-lg font-semibold text-center">
          HISTORIAL DE PROVEEDORES
        </h2>
      </div>
      <div className="px-6 py-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: PALETA.headerTable }}>
                <th className="px-4 py-2 text-left">Proveedor</th>
                <th className="px-4 py-2 text-left">Asignado</th>
                <th className="px-4 py-2 text-left">Desasignado</th>
                <th className="px-4 py-2 text-left">Estado Final</th>
                <th className="px-4 py-2 text-left">Motivo</th>
                <th className="px-4 py-2 text-left">Estado</th>
              </tr>
            </thead>
            <tbody>
              {historial.map((prov, index) => (
                <tr key={index} className="border-b">
                  {/* Celdas de la tabla */}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

**Reducción**: ~180 líneas extraídas del page.tsx

---

#### 2.5 `ModalGestionPresupuesto.tsx`
**Responsabilidad**: Modal complejo de gestión de presupuesto

```typescript
// components/ModalGestionPresupuesto.tsx
interface Props {
  isOpen: boolean;
  onClose: () => void;
  presupuesto: PresupuestoType | null;
  documentoUrl: string | null;
  onAprobar: () => void;
  onMandarARevisar: () => void;
  userRole: string;
  loading: boolean;
}

export default function ModalGestionPresupuesto({ ... }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {loading ? (
          <div className="text-center py-8">Cargando presupuesto...</div>
        ) : presupuesto ? (
          <>
            <h2 className="text-xl font-semibold mb-4">Gestión de Presupuesto</h2>

            {/* Detalles del presupuesto */}
            <div className="space-y-4">
              {/* Información del presupuesto */}
            </div>

            {/* Documento adjunto */}
            {documentoUrl && (
              <div className="mt-4">
                <a href={documentoUrl} target="_blank" rel="noopener noreferrer">
                  Ver documento
                </a>
              </div>
            )}

            {/* Acciones */}
            {userRole === 'Control' && (
              <div className="mt-6 flex gap-4">
                <button onClick={onAprobar}>Aprobar</button>
                <button onClick={onMandarARevisar}>Mandar a revisar</button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8">No hay presupuesto disponible</div>
        )}
      </div>
    </div>
  );
}
```

**Reducción**: ~150 líneas extraídas del page.tsx

---

### FASE 3: Archivo Principal Refactorizado

#### `page.tsx` - Resultado Final (~300 líneas)

```typescript
"use client";

import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { PALETA } from "@/lib/theme";

// Hooks personalizados
import { useProveedorChat } from "./hooks/useProveedorChat";
import { usePresupuestoGestion } from "./hooks/usePresupuestoGestion";
import { useVisitaGestion } from "./hooks/useVisitaGestion";
import { useValoracionEconomica } from "./hooks/useValoracionEconomica";
import { useControlActions } from "./hooks/useControlActions";
import { useProveedorActions } from "./hooks/useProveedorActions";

// Hooks compartidos
import { useSignedUrls, useComentarioUrls } from "@/shared/hooks/useSignedUrls";
import { useChatFileUpload } from "@/shared/hooks/useFileUpload";

// Componentes personalizados
import DatosProveedorIncidencia from "./components/DatosProveedorIncidencia";
import AccionesControl from "./components/AccionesControl";
import AccionesProveedor from "./components/AccionesProveedor";
import HistorialProveedores from "./components/HistorialProveedores";
import ModalGestionPresupuesto from "./components/ModalGestionPresupuesto";

// Componentes compartidos
import ChatContainer from "@/shared/components/ChatContainer";
import HistorialEstados from "@/shared/components/HistorialEstados";
import ScrollToBottomButton from "@/components/ScrollToBottomButton";

// Modales de proveedor
import ModalCalendarizar from "@/components/proveedor/ModalCalendarizar";
import ModalOferta from "@/components/proveedor/ModalOferta";
import ModalValoracion from "@/components/proveedor/ModalValoracion";
import ModalResolver from "@/components/proveedor/ModalResolver";
import ModalResolucionManual from "@/components/ModalResolucionManual";

export default function ChatProveedor() {
  const params = useParams();
  const router = useRouter();
  const incidenciaId = params.id as string;

  // Auth
  const { perfil, loading: authLoading } = useAuth();

  // Hook principal
  const {
    incidencia,
    loading,
    proveedorAsignado,
    nombreProveedor,
    direccionCentro,
    historialProveedores,
    historialProveedor,
    fechaAsignacionProveedor,
    cargarDatos
  } = useProveedorChat(incidenciaId);

  // Presupuestos
  const presupuestoHook = usePresupuestoGestion(incidenciaId);

  // Visitas
  const visitaHook = useVisitaGestion(incidenciaId, incidencia?.num_solicitud || '');

  // Valoración económica
  const valoracionHook = useValoracionEconomica(
    incidenciaId,
    incidencia?.num_solicitud || '',
    presupuestoHook.presupuestoActual
  );

  // Acciones Control
  const controlActions = useControlActions(incidenciaId, incidencia?.num_solicitud || '');

  // Acciones Proveedor
  const proveedorActions = useProveedorActions(incidenciaId, incidencia?.num_solicitud || '');

  // URLs firmadas (hooks compartidos)
  const { urls: imageUrls } = useSignedUrls(incidencia?.adjuntos_principales || []);

  // Chat (usando componentes y hooks compartidos)
  const fileUpload = useChatFileUpload(incidencia?.num_solicitud || '');

  // Comentarios - necesitarías crear un hook useComentarios compartido
  // const { comentarios, enviarComentario, enviando } = useComentarios(incidenciaId, 'proveedor');

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: PALETA.bg }}>
        <div className="text-white">Cargando...</div>
      </div>
    );
  }

  if (!incidencia) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: PALETA.bg }}>
        <div className="text-white">Incidencia no encontrada</div>
      </div>
    );
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
        <DatosProveedorIncidencia
          incidencia={incidencia}
          imageUrls={imageUrls}
          direccionCentro={direccionCentro}
          nombreProveedor={nombreProveedor}
          fechaAsignacionProveedor={fechaAsignacionProveedor}
          visitaCalendarizada={visitaHook.visitaCalendarizada}
          userRole={perfil?.rol || ''}
        />

        {/* Acciones según rol */}
        {perfil?.rol === 'Control' && (
          <AccionesControl
            incidencia={incidencia}
            onAnular={() => controlActions.setMostrarModalAnular(true)}
            onCerrar={() => controlActions.setMostrarModalCerrar(true)}
            onValorar={() => valoracionHook.setMostrarModalValorarIncidencia(true)}
            onResolverManual={() => controlActions.setMostrarModalResolucionManual(true)}
            onMandarARevisar={presupuestoHook.mandarARevisar}
            onAprobarPresupuesto={presupuestoHook.aprobarPresupuesto}
            presupuestoActual={presupuestoHook.presupuestoActual}
          />
        )}

        {perfil?.rol === 'Proveedor' && (
          <AccionesProveedor
            incidencia={incidencia}
            onCalendarizarVisita={() => visitaHook.setMostrarModalVisita(true)}
            onOfertarPresupuesto={() => presupuestoHook.setMostrarModalPresupuesto(true)}
            onResolver={() => proveedorActions.setMostrarModalResolver(true)}
            visitaCalendarizada={visitaHook.visitaCalendarizada}
            tieneOfertaAprobada={presupuestoHook.tieneOfertaAprobada}
          />
        )}

        {/* Chat */}
        <div className="mb-8">
          <h2 className="text-white text-center text-lg font-semibold mb-4 tracking-wider">
            {perfil?.rol === 'Control' ? 'CHAT PROVEEDOR' : 'SEGUIMIENTO'}
          </h2>
        </div>

        {/* Reutilizar ChatContainer compartido */}
        {/* <ChatContainer ... /> */}

        {/* Historiales */}
        <HistorialEstados
          cambios={historialProveedor}
          titulo="HISTORIAL DE ESTADOS DEL PROVEEDOR"
        />

        <HistorialProveedores historial={historialProveedores} />
      </div>

      {/* Modales */}
      <ModalCalendarizar
        isOpen={visitaHook.mostrarModalVisita}
        onClose={visitaHook.cerrarModal}
        fechaVisita={visitaHook.fechaVisita}
        setFechaVisita={visitaHook.setFechaVisita}
        horarioVisita={visitaHook.horarioVisita}
        setHorarioVisita={visitaHook.setHorarioVisita}
        onSubmit={visitaHook.handleCalendarizarVisita}
        enviando={visitaHook.enviando}
      />

      <ModalOferta
        isOpen={presupuestoHook.mostrarModalPresupuesto}
        onClose={presupuestoHook.cerrarModalPresupuesto}
        // ... props
      />

      <ModalValoracion
        isOpen={valoracionHook.mostrarModalValorarIncidencia}
        onClose={valoracionHook.cerrarModal}
        // ... props
      />

      <ModalResolver
        isOpen={proveedorActions.mostrarModalResolver}
        onClose={proveedorActions.cerrarModal}
        // ... props
      />

      <ModalGestionPresupuesto
        isOpen={presupuestoHook.mostrarModalGestionPresupuesto}
        onClose={() => presupuestoHook.setMostrarModalGestionPresupuesto(false)}
        presupuesto={presupuestoHook.presupuestoActual}
        documentoUrl={presupuestoHook.documentoPresupuestoUrl}
        onAprobar={presupuestoHook.aprobarPresupuesto}
        onMandarARevisar={presupuestoHook.mandarARevisar}
        userRole={perfil?.rol || ''}
        loading={presupuestoHook.cargandoPresupuesto}
      />

      {/* Más modales... */}
    </div>
  );
}
```

---

## 📊 Comparativa: Antes vs Después

| Métrica | Antes | Después | Mejora |
|---------|-------|---------|--------|
| **Líneas archivo principal** | 2975 | ~300 | ↓ 90% |
| **Estados en componente** | ~50 | ~5 | ↓ 90% |
| **Funciones en componente** | ~25 | ~2 | ↓ 92% |
| **Lógica de negocio en UI** | ~845 líneas | 0 líneas | ↓ 100% |
| **Código reutilizable** | 0% | 70% | ↑ Infinito |
| **Facilidad de testing** | Imposible | Fácil | ↑ 100% |
| **Mantenibilidad** | Muy baja | Alta | ↑ 500% |

---

## ✅ Checklist de Implementación

### Hooks Personalizados
- [ ] `hooks/useProveedorChat.ts` (~300 líneas)
- [ ] `hooks/usePresupuestoGestion.ts` (~400 líneas)
- [ ] `hooks/useVisitaGestion.ts` (~150 líneas)
- [ ] `hooks/useValoracionEconomica.ts` (~120 líneas)
- [ ] `hooks/useControlActions.ts` (~200 líneas)
- [ ] `hooks/useProveedorActions.ts` (~150 líneas)

### Componentes UI
- [ ] `components/DatosProveedorIncidencia.tsx` (~150 líneas)
- [ ] `components/AccionesControl.tsx` (~200 líneas)
- [ ] `components/AccionesProveedor.tsx` (~250 líneas)
- [ ] `components/HistorialProveedores.tsx` (~120 líneas)
- [ ] `components/ModalGestionPresupuesto.tsx` (~150 líneas)

### Refactorización Principal
- [ ] Actualizar `page.tsx` para usar hooks (~300 líneas)
- [ ] Eliminar funciones duplicadas (getSignedImageUrl, etc.)
- [ ] Reutilizar ChatContainer compartido
- [ ] Verificar todos los modales funcionan
- [ ] Testing manual completo

### Servicios (Ya Creados ✅)
- [x] `lib/services/citasService.ts`
- [x] `lib/services/presupuestosService.ts`
- [x] `lib/services/resolucionProveedorService.ts`
- [x] `lib/services/storageService.ts`
- [x] `lib/services/comentariosService.ts`

### Hooks Compartidos (Ya Creados ✅)
- [x] `shared/hooks/useSignedUrls.ts`
- [x] `shared/hooks/useFileUpload.ts`

### Componentes Compartidos (Ya Creados ✅)
- [x] `shared/components/ChatContainer.tsx`
- [x] `shared/components/ChatMessage.tsx`
- [x] `shared/components/ChatInput.tsx`
- [x] `shared/components/DatosTecnicosIncidencia.tsx`
- [x] `shared/components/HistorialEstados.tsx`

---

## 🚀 Orden de Implementación Recomendado

### DÍA 1: Hooks de Estado (4-5 horas)
1. Crear `useProveedorChat.ts` - Hook principal
2. Crear `usePresupuestoGestion.ts` - Presupuestos
3. Testing básico de hooks

**Resultado esperado**: 700 líneas extraídas, ~40 estados centralizados

---

### DÍA 2: Hooks de Acciones (3-4 horas)
1. Crear `useVisitaGestion.ts`
2. Crear `useValoracionEconomica.ts`
3. Crear `useControlActions.ts`
4. Crear `useProveedorActions.ts`

**Resultado esperado**: 620 líneas más extraídas

---

### DÍA 3: Componentes UI (4-5 horas)
1. Crear `DatosProveedorIncidencia.tsx`
2. Crear `AccionesControl.tsx`
3. Crear `AccionesProveedor.tsx`
4. Crear `HistorialProveedores.tsx`

**Resultado esperado**: 870 líneas de JSX extraídas

---

### DÍA 4: Integración Final (3-4 horas)
1. Refactorizar `page.tsx` para usar todos los hooks
2. Integrar componentes compartidos (ChatContainer)
3. Eliminar código duplicado
4. Testing completo

**Resultado esperado**: Archivo principal de ~300 líneas

---

### DÍA 5: Testing y Ajustes (2-3 horas)
1. Testing de todas las funcionalidades
2. Corrección de bugs
3. Optimizaciones finales
4. Documentación

---

## 📈 Beneficios Esperados

### Inmediatos
- ✅ Archivo principal legible (300 vs 2975 líneas)
- ✅ Lógica separada de UI
- ✅ Estados organizados por responsabilidad
- ✅ Código reutilizable

### A Medio Plazo
- ✅ Fácil añadir nuevas funcionalidades
- ✅ Testing unitario posible
- ✅ Menos bugs por complejidad
- ✅ Onboarding de desarrolladores más rápido

### A Largo Plazo
- ✅ Mantenibilidad garantizada
- ✅ Escalabilidad del proyecto
- ✅ Menor costo de desarrollo
- ✅ Mayor calidad del código

---

## 🎯 Consideraciones Importantes

### 1. **No Romper Funcionalidad**
- Cada extracción debe mantener la lógica exacta
- Testing exhaustivo después de cada cambio
- Commits pequeños y frecuentes

### 2. **Reutilizar lo ya Creado**
- Máxima reutilización de hooks compartidos
- Usar servicios ya existentes
- No duplicar componentes

### 3. **Mantener Consistencia**
- Seguir patrones del chat-control-cliente
- Mismo estilo de código
- Misma estructura de carpetas

### 4. **Documentación**
- Comentar hooks complejos
- Documentar props de componentes
- Actualizar este plan con cambios

---

## 📝 Notas Finales

Este plan reduce el archivo de **2975 líneas a ~300 líneas** (90% reducción), siguiendo exactamente la misma estrategia que funcionó en chat-control-cliente.

La clave del éxito es:
1. **Ir paso a paso** - No intentar hacerlo todo de golpe
2. **Testing continuo** - Verificar que todo funciona después de cada cambio
3. **Reutilizar código** - Aprovechar lo ya creado
4. **Mantener la funcionalidad** - No cambiar lógica de negocio

**Tiempo estimado total**: 16-21 horas de trabajo

**¿Listo para empezar?** 🚀
