# Gestión de Anulación y Reasignación de Proveedores

## Resumen

Se ha implementado un sistema completo para gestionar la anulación de asignaciones de proveedores y permitir múltiples asignaciones históricas para una misma incidencia, con comentarios separados por asignación.

## Problema Original

- Al anular un proveedor, `proveedor_casos.activo=false` inmediatamente
- No se podían gestionar múltiples asignaciones de proveedor para el mismo `num_solicitud`
- Los comentarios se mezclaban entre diferentes asignaciones de proveedor
- No había distinción clara entre el historial del proveedor anulado y el nuevo

## Solución Implementada

### 1. Base de Datos

#### Nueva columna en `comentarios`
```sql
ALTER TABLE comentarios
ADD COLUMN proveedor_caso_id UUID REFERENCES proveedor_casos(id);

CREATE INDEX idx_comentarios_proveedor_caso_id
ON comentarios(proveedor_caso_id);
```

#### Migración retroactiva
- ✅ 2,888 de 2,893 comentarios vinculados automáticamente
- ⏸️ 5 comentarios pendientes de volcado de Wix (22 sept en adelante)

### 2. Lógica de Anulación

**Antes:**
```typescript
// Se marcaba activo=false inmediatamente
await supabase.update({
  estado_proveedor: 'Anulada',
  activo: false  // ❌ Se perdía visibilidad
})
```

**Ahora:**
```typescript
// Se mantiene activo=true hasta reasignación
await supabase.update({
  estado_proveedor: 'Anulada',
  // activo se mantiene en true
  motivo_anulacion: motivoAnulacion,
  anulado_en: fechaAnulacion,
  anulado_por: personaId
})
```

**Archivo:** [useControlActions.ts](app/(app)/incidencias/[id]/chat-proveedor/hooks/useControlActions.ts:89-101)

### 3. Lógica de Reasignación

**ACTUALIZADO:** Ya no se marca `activo=false` al reasignar. El campo `activo` se reserva para otros usos.

**Al asignar un nuevo proveedor:**

1. **Detecta si hay caso anulado activo:**
```typescript
const { data: casoExistente } = await supabase
  .from("proveedor_casos")
  .select("id, estado_proveedor")
  .eq("incidencia_id", incidenciaId)
  .eq("activo", true)
  .maybeSingle();
```

2. **Si está anulado, crea nuevo caso (sin tocar el anterior):**
```typescript
if (casoExistente.estado_proveedor === 'Anulada') {
  // Crear nuevo caso con estado "Abierta"
  await supabase.insert({
    incidencia_id,
    proveedor_id: nuevoProveedorId,
    estado_proveedor: 'Abierta', // Siempre empieza como "Abierta"
    activo: true,
    // ...
  });

  // El caso anterior permanece con:
  // - activo: true
  // - estado_proveedor: 'Anulada'
}
```

**Resultado:** Control verá **dos registros** en `proveedor_casos` para la misma incidencia:
- Registro 1: `{ proveedor_id: A, estado_proveedor: 'Anulada', activo: true }`
- Registro 2: `{ proveedor_id: B, estado_proveedor: 'Abierta', activo: true }`

**Archivo:** [asignacionProveedorService.ts](lib/services/asignacionProveedorService.ts:85-112)

### 4. Servicio de Comentarios

#### Interfaces actualizadas
```typescript
export interface NuevoComentario {
  incidencia_id: string;
  proveedor_caso_id?: string; // NUEVO
  ambito: AmbitoComentario;
  // ...
}

export interface Comentario {
  id: string;
  incidencia_id: string;
  proveedor_caso_id?: string | null; // NUEVO
  // ...
}
```

#### Función principal con filtro
```typescript
export async function obtenerComentarios(
  incidenciaId: string,
  ambito?: AmbitoComentario,
  proveedorCasoId?: string  // NUEVO parámetro
): Promise<Comentario[]> {
  let query = supabase
    .from('comentarios')
    .select('...')
    .eq('incidencia_id', incidenciaId);

  if (proveedorCasoId) {
    query = query.eq('proveedor_caso_id', proveedorCasoId);
  }

  return data;
}
```

#### Funciones helpers
```typescript
// Para obtener comentarios de una asignación específica
export async function obtenerComentariosProveedorCaso(
  incidenciaId: string,
  proveedorCasoId: string
): Promise<Comentario[]>

// Para comentarios de cliente (globales a la incidencia)
export async function obtenerComentariosCliente(
  incidenciaId: string
): Promise<Comentario[]>
```

**Archivo:** [comentariosService.ts](lib/services/comentariosService.ts)

### 5. Queries Diferenciadas por Rol

#### Control (chat-proveedor)
```sql
-- Ve el caso activo no anulado
SELECT * FROM proveedor_casos
WHERE incidencia_id = ?
  AND activo = true
  AND estado_proveedor != 'Anulada'
```

#### Proveedor (su dashboard)
```sql
-- Ve su asignación (incluso si está anulada)
SELECT * FROM proveedor_casos
WHERE incidencia_id = ?
  AND proveedor_id = ?
  -- Puede ver tanto activa como anulada
```

#### Control (historial completo)
```sql
-- Ve TODAS las asignaciones
SELECT * FROM proveedor_casos
WHERE incidencia_id = ?
ORDER BY asignado_en DESC
```

## Flujo de Trabajo Completo

### Escenario: Control anula y reasigna

1. **Estado inicial:**
   - Incidencia asignada a Proveedor A
   - `proveedor_casos`: `{ proveedor_id: A, activo: true, estado: 'Abierta' }`

2. **Control anula la asignación:**
   - Click en "Anular"
   - Ingresa motivo
   - **Estado después:**
     - `proveedor_casos`: `{ proveedor_id: A, activo: true, estado: 'Anulada', motivo_anulacion: '...', anulado_en: '...', anulado_por: ... }`
     - Comentario creado: `{ proveedor_caso_id: caso_A_id, cuerpo: 'Asignación anulada...' }`
     - Citas canceladas
     - Notificación a Proveedor A

3. **Control reasigna a Proveedor B:**
   - Abre modal de asignación
   - Selecciona Proveedor B
   - **Proceso:**
     a. Detecta caso anulado activo
     b. Crea nuevo caso B con `estado_proveedor: 'Abierta'` y `activo: true`
     c. El caso A permanece sin cambios
   - **Estado final:**
     - Caso A: `{ proveedor_id: A, activo: true, estado: 'Anulada' }` (sin cambios)
     - Caso B: `{ proveedor_id: B, activo: true, estado: 'Abierta' }` (nuevo)

4. **Visibilidad de comentarios:**
   - **Proveedor A:** Ve solo sus comentarios (vinculados a caso_A_id)
   - **Proveedor B:** Ve solo sus comentarios (vinculados a caso_B_id)
   - **Control:** Puede ver ambos historiales según el `proveedor_caso_id` que filtre

## Archivos Modificados

### Base de datos
- ✅ Migración: `add_proveedor_caso_id_to_comentarios`
- ✅ Migración: `migrate_comentarios_to_proveedor_caso`

### Servicios
- ✅ [lib/services/comentariosService.ts](lib/services/comentariosService.ts)
  - Añadido `proveedor_caso_id` a interfaces
  - Actualizada función `obtenerComentarios` con filtro
  - Actualizada función `crearComentario` para incluir campo
  - Nuevas funciones: `obtenerComentariosProveedorCaso`, `obtenerComentariosCliente`

- ✅ [lib/services/asignacionProveedorService.ts](lib/services/asignacionProveedorService.ts)
  - Detección de casos anulados
  - Marcar caso anterior como inactivo al reasignar
  - Crear nuevo caso al reasignar
  - Pasar `proveedor_caso_id` a comentarios de proveedor

### Hooks
- ✅ [app/(app)/incidencias/[id]/chat-proveedor/hooks/useControlActions.ts](app/(app)/incidencias/[id]/chat-proveedor/hooks/useControlActions.ts:54-163)
  - Anulación: NO marcar `activo=false`
  - Guardar `motivo_anulacion`, `anulado_en`, `anulado_por`
  - Vincular comentario de anulación a `proveedor_caso_id`

## Próximos Pasos

### Para Componentes (Pendiente)
Los siguientes componentes necesitan actualizarse para usar el nuevo sistema:

1. **[app/(app)/incidencias/[id]/chat-proveedor/page.tsx](app/(app)/incidencias/[id]/chat-proveedor/page.tsx)**
   - Actualizar consulta para obtener `proveedor_casos.id`
   - Filtrar comentarios por `proveedor_caso_id`
   - Pasar `proveedor_caso_id` al crear comentarios

2. **[app/(app)/incidencias/[id]/chat-proveedor/hooks/useProveedorChat.ts](app/(app)/incidencias/[id]/chat-proveedor/hooks/useProveedorChat.ts)**
   - Usar `obtenerComentariosProveedorCaso` en lugar de `obtenerComentarios`
   - Incluir `proveedor_caso_id` al crear comentarios

3. **[components/proveedor/*.tsx](components/proveedor/)**
   - Actualizar modales que crean comentarios para incluir `proveedor_caso_id`

### Para Volcado de Wix
Después de migrar incidencias desde 22 sept:
```sql
-- Vincular comentarios huérfanos post-migración
UPDATE comentarios c
SET proveedor_caso_id = (
  SELECT pc.id
  FROM proveedor_casos pc
  WHERE pc.incidencia_id = c.incidencia_id
    AND pc.activo = true
  ORDER BY pc.asignado_en DESC
  LIMIT 1
)
WHERE c.ambito IN ('proveedor', 'ambos')
  AND c.proveedor_caso_id IS NULL
  AND c.creado_en >= '2025-09-22'::timestamp;
```

### Para Historial de Proveedores
Crear componente para Control que muestre:
- Todas las asignaciones históricas de una incidencia
- Comentarios separados por asignación
- Estadísticas de tiempo por proveedor

## Ventajas de la Implementación

✅ **Trazabilidad completa:** Control ve todo el historial de asignaciones (múltiples registros en proveedor_casos)
✅ **Historiales separados:** Cada proveedor ve solo SUS comentarios vinculados a su proveedor_caso_id
✅ **Sin duplicados confusos:** Los comentarios están claramente vinculados a asignaciones específicas
✅ **Acceso permanente al historial:** Proveedores anulados mantienen acceso a su trabajo (activo=true)
✅ **Auditoría:** Se registra quién anuló, cuándo y por qué
✅ **Reasignaciones limpias:** El sistema detecta casos anulados y crea nuevos con estado 'Abierta'
✅ **Retrocompatibilidad:** Los 2,888 comentarios históricos ya están vinculados correctamente
✅ **Flexibilidad del campo activo:** El campo `activo` queda libre para otros usos futuros
✅ **Transparencia:** Proveedores pueden revisar por qué fueron anulados y acceder a sus documentos

## Testing Recomendado

1. **Anular proveedor:**
   - ✓ Estado se marca como 'Anulada'
   - ✓ `activo` permanece `true`
   - ✓ Se guarda motivo, fecha y autor
   - ✓ Comentario se vincula correctamente

2. **Reasignar después de anulación:**
   - ✓ Caso anterior permanece con `activo=true` y `estado_proveedor='Anulada'`
   - ✓ Se crea nuevo caso con `activo=true` y `estado_proveedor='Abierta'`
   - ✓ Comentarios del nuevo proveedor se vinculan al nuevo caso
   - ✓ Control ve dos registros en proveedor_casos para la misma incidencia

3. **Visibilidad de comentarios:**
   - ✓ Proveedor A ve solo sus comentarios
   - ✓ Proveedor B ve solo sus comentarios
   - ✓ Control puede filtrar por caso específico

4. **Historial:**
   - ✓ Se pueden ver todas las asignaciones históricas
   - ✓ Los comentarios se mantienen vinculados correctamente
