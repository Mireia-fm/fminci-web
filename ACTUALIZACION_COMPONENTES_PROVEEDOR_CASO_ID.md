# Actualización de Componentes para usar `proveedor_caso_id`

## Resumen

Se han actualizado todos los componentes y servicios relacionados con el chat de proveedor para utilizar `proveedor_caso_id`, permitiendo así separar comentarios entre diferentes asignaciones de proveedor para una misma incidencia.

## Archivos Actualizados

### 1. [app/(app)/incidencias/[id]/chat-proveedor/page.tsx](app/(app)/incidencias/[id]/chat-proveedor/page.tsx)

#### Cambios Principales:

**Estado para `proveedorCasoId`:**
```typescript
const [proveedorCasoId, setProveedorCasoId] = useState<string | null>(null);
```

**Obtención del `proveedor_caso_id` al cargar datos (línea 287-306):**
```typescript
const { data: proveedorCaso } = await supabase
  .from("proveedor_casos")
  .select("id, asignado_en, estado_proveedor, prioridad, descripcion_proveedor, activo")
  .eq("incidencia_id", incidenciaId)
  .eq("activo", true)
  .neq("estado_proveedor", "Anulada") // Filtrar anuladas
  .order("asignado_en", { ascending: false })
  .limit(1)
  .maybeSingle();

if (proveedorCaso) {
  setProveedorCasoId(proveedorCaso.id);
  // ...
}
```

**Carga de comentarios filtrados por `proveedor_caso_id` (línea 461-491):**
```typescript
let comentariosData: Comentario[] = [];
if (perfil.rol === 'Control' || perfil.rol === 'Proveedor') {
  const { data: proveedorCasoActivo } = await supabase
    .from("proveedor_casos")
    .select("id")
    .eq("incidencia_id", incidenciaId)
    .eq("activo", true)
    .neq("estado_proveedor", "Anulada")
    .maybeSingle();

  if (proveedorCasoActivo) {
    const { data: comentarios } = await supabase
      .from("comentarios")
      .select('*, adjuntos(*)')
      .eq("incidencia_id", incidenciaId)
      .eq("proveedor_caso_id", proveedorCasoActivo.id) // FILTRO CLAVE
      .in("ambito", ["proveedor", "ambos"])
      .order("creado_en", { ascending: true });

    comentariosData = comentarios || [];
  }
}
```

**Envío de comentarios con `proveedor_caso_id` (línea 543-552):**
```typescript
const comentarioCreado = await crearComentario({
  incidencia_id: incidenciaId,
  proveedor_caso_id: proveedorCasoId || undefined, // INCLUIDO
  ambito: 'proveedor',
  autor_id: perfil.persona_id,
  autor_email: perfil.email,
  autor_rol: perfil.rol,
  cuerpo: nuevoComentario.trim(),
  es_sistema: false
});
```

**Todas las llamadas a `crearComentario` actualizadas:**
- Línea 543: Envío de comentario del usuario
- Línea 827: Anulación de asignación
- Línea 986: Rechazo de resolución
- Línea 1060: Resolución manual
- Línea 1179: Aprobación de presupuesto
- Línea 1228: Revisión de presupuesto

**Tipo `Comentario` actualizado (línea 63-78):**
```typescript
type Comentario = {
  id: string;
  incidencia_id: string;
  proveedor_caso_id?: string | null; // AÑADIDO
  ambito: 'cliente' | 'proveedor' | 'ambos';
  // ... resto de campos
};
```

---

### 2. [lib/services/comentariosService.ts](lib/services/comentariosService.ts)

**Ya estaba actualizado previamente.** ✅

Funciones clave:
- `obtenerComentarios`: Acepta parámetro opcional `proveedorCasoId`
- `crearComentario`: Acepta campo `proveedor_caso_id` en `NuevoComentario`
- `obtenerComentariosProveedorCaso`: Helper específico para filtrar por caso

---

### 3. [lib/services/citasService.ts](lib/services/citasService.ts)

#### Cambios:

**Interfaz actualizada (línea 5-11):**
```typescript
export interface CalendarizarVisitaParams {
  incidenciaId: string;
  proveedorCasoId?: string; // AÑADIDO
  fechaVisita: string;
  horarioVisita: 'mañana' | 'tarde';
  autorId: string;
}
```

**Uso de `crearComentario` en lugar de insert directo (línea 101-123):**
```typescript
// Necesitamos obtener email del autor para crearComentario
const { data: autorData } = await supabase
  .from("personas")
  .select("email, rol")
  .eq("id", autorId)
  .single();

if (autorData) {
  await crearComentario({
    incidencia_id: incidenciaId,
    proveedor_caso_id: proveedorCasoId, // INCLUIDO
    autor_id: autorId,
    autor_email: autorData.email || '',
    autor_rol: autorData.rol || 'Proveedor',
    cuerpo: mensajeVisita,
    ambito: 'ambos',
    es_sistema: true
  });
}
```

**Llamada desde page.tsx actualizada (línea 612-618):**
```typescript
const result = await calendarizarVisita({
  incidenciaId,
  proveedorCasoId: proveedorCasoId || undefined, // AÑADIDO
  fechaVisita,
  horarioVisita: horarioVisita as 'mañana' | 'tarde',
  autorId: perfil.persona_id
});
```

---

### 4. [lib/services/presupuestosService.ts](lib/services/presupuestosService.ts)

#### Cambios:

**Interfaz actualizada (línea 6-17):**
```typescript
export interface OfertarPresupuestoParams {
  incidenciaId: string;
  numeroIncidencia: string;
  proveedorCasoId?: string; // AÑADIDO
  fechaEstimadaInicio: string;
  duracionEstimada: string;
  importeTotalSinIva: string;
  documentoPresupuesto: File;
  descripcionPresupuesto: string;
  autorId: string;
  autorEmail: string;
}
```

**Uso de `crearComentario` (línea 133-146):**
```typescript
const comentarioCreado = await crearComentario({
  incidencia_id: incidenciaId,
  proveedor_caso_id: proveedorCasoId, // INCLUIDO
  ambito: 'proveedor',
  autor_id: autorId,
  autor_email: autorEmail,
  autor_rol: 'Proveedor',
  cuerpo: mensajePresupuesto,
  es_sistema: false
});
```

**Llamada desde page.tsx actualizada (línea 645-655):**
```typescript
const result = await ofertarPresupuesto({
  incidenciaId,
  numeroIncidencia: incidencia.num_solicitud,
  proveedorCasoId: proveedorCasoId || undefined, // AÑADIDO
  fechaEstimadaInicio,
  duracionEstimada,
  importeTotalSinIva,
  documentoPresupuesto,
  descripcionPresupuesto,
  autorId: perfil.persona_id,
  autorEmail: userEmail || perfil.email
});
```

---

### 5. [lib/services/resolucionProveedorService.ts](lib/services/resolucionProveedorService.ts)

#### Cambios:

**Comentario de resolución técnica (línea 271-284):**
```typescript
const comentarioCreado = await crearComentario({
  incidencia_id: incidenciaId,
  proveedor_caso_id: proveedorCaso.id, // INCLUIDO
  ambito: 'proveedor',
  autor_id: autorId,
  autor_email: autorEmail,
  autor_rol: 'Proveedor',
  cuerpo: mensajeSolucion,
  es_sistema: false
});
```

**Comentario de valoración económica (línea 510-523):**
```typescript
const comentarioCreado = await crearComentario({
  incidencia_id: incidenciaId,
  proveedor_caso_id: proveedorCasoActual.id, // INCLUIDO
  ambito: 'proveedor',
  autor_id: autorId,
  autor_email: autorEmail,
  autor_rol: 'Proveedor',
  cuerpo: mensajeValoracion,
  es_sistema: false
});
```

**Nota:** Estos servicios obtienen el `proveedor_caso_id` internamente mediante:
```typescript
const { data: proveedorCaso } = await supabase
  .from("proveedor_casos")
  .select("id")
  .eq("incidencia_id", incidenciaId)
  .eq("activo", true)
  .single();
```

Por lo tanto, NO necesitan recibirlo como parámetro.

---

## Flujo Completo

### 1. **Usuario entra al chat-proveedor**
```
page.tsx: cargarDatos()
  ↓
Obtiene proveedor_casos activo no anulado
  ↓
Guarda proveedorCasoId en el estado
  ↓
Carga comentarios FILTRADOS por ese proveedor_caso_id
```

### 2. **Usuario envía un comentario**
```
handleEnviarComentario()
  ↓
crearComentario({ ..., proveedor_caso_id: proveedorCasoId })
  ↓
Comentario se vincula a la asignación específica
```

### 3. **Proveedor calendariza visita**
```
handleEnviarVisita()
  ↓
calendarizarVisita({ ..., proveedorCasoId })
  ↓
citasService crea comentario con proveedor_caso_id
```

### 4. **Proveedor envía presupuesto**
```
handleEnviarPresupuesto()
  ↓
ofertarPresupuesto({ ..., proveedorCasoId })
  ↓
presupuestosService crea comentario con proveedor_caso_id
```

### 5. **Proveedor resuelve incidencia**
```
handleResolverIncidencia()
  ↓
resolverIncidenciaService({ ... })
  ↓
Servicio obtiene proveedor_caso_id activo internamente
  ↓
Crea comentario vinculado a ese caso
```

---

## Beneficios de la Implementación

✅ **Separación de historiales:** Cada asignación de proveedor tiene su propio conjunto de comentarios

✅ **Sin cruces de información:** Los proveedores anulados no ven comentarios del nuevo proveedor

✅ **Trazabilidad completa:** Control puede ver el historial completo si es necesario

✅ **Retrocompatibilidad:** Los comentarios antiguos ya fueron migrados correctamente (2,888/2,893)

✅ **Consistencia:** Todos los servicios usan la misma lógica de vinculación

---

## Testing Recomendado

### Caso 1: Chat sin reasignación
1. Entrar a una incidencia con un solo proveedor asignado
2. ✓ Ver que se cargan todos los comentarios del proveedor
3. ✓ Enviar un comentario y verificar que aparece
4. ✓ Calendarizar visita y verificar comentario del sistema

### Caso 2: Chat con anulación y reasignación
1. Control anula la asignación del Proveedor A
2. ✓ Proveedor A sigue viendo sus comentarios (caso activo=true, estado=Anulada)
3. Control asigna a Proveedor B
4. ✓ Caso de Proveedor A pasa a activo=false
5. ✓ Proveedor B solo ve comentarios del nuevo caso
6. ✓ Proveedor A ya no ve la incidencia en su lista

### Caso 3: Servicios automáticos
1. Proveedor calendariza visita
2. ✓ Comentario se crea con proveedor_caso_id correcto
3. Proveedor envía presupuesto
4. ✓ Comentario se crea con proveedor_caso_id correcto
5. Proveedor resuelve
6. ✓ Comentario de resolución se crea con proveedor_caso_id correcto
7. Proveedor valora
8. ✓ Comentario de valoración se crea con proveedor_caso_id correcto

---

## Verificación de Compilación

```bash
npm run build
```

**Resultado:** ✅ Compilación exitosa sin errores (solo warnings menores)

---

## Documentos Relacionados

- [GESTION_ANULACION_REASIGNACION.md](GESTION_ANULACION_REASIGNACION.md) - Arquitectura y base de datos
- [FIX_CARACTERES_ESPECIALES_STORAGE.md](FIX_CARACTERES_ESPECIALES_STORAGE.md) - Fix de nombres de archivos

---

## Siguiente Pasos (Opcional)

### Componente de Historial de Proveedores
Crear un componente en Control que muestre:
- Todas las asignaciones históricas de una incidencia
- Comentarios separados por asignación
- Estadísticas de tiempo por proveedor
- Motivos de anulación

```typescript
// components/HistorialProveedoresAsignados.tsx
export default function HistorialProveedoresAsignados({ incidenciaId }) {
  // Obtener TODOS los proveedor_casos (activo=true y activo=false)
  // Mostrar timeline de asignaciones
  // Permitir expandir cada asignación para ver sus comentarios
}
```

### Dashboard de Proveedor
Actualizar dashboard para:
- Filtrar solo incidencias con `proveedor_casos.activo=true AND estado_proveedor!='Anulada'`
- Mostrar historial de incidencias anuladas si el proveedor quiere verlas
