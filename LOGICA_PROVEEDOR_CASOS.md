# Lógica de Múltiples Proveedores por Incidencia

## Resumen

Una incidencia puede tener **múltiples registros en `proveedor_casos`** (historial de todas las asignaciones), pero solo **uno debe estar trabajando activamente** en cada momento.

## Campos Clave en `proveedor_casos`

- **`activo`**: Flag booleano que indica si el registro debe ser visible en el historial
- **`estado_proveedor`**: Estado actual del proveedor ('Abierta', 'En curso', 'Ofertada', 'Valorada', 'Cerrada', 'Anulada')

## Reglas de Negocio

### 1. Proveedor "Activo" (Trabajando Actualmente)

Un proveedor se considera "activo" (trabajando) cuando:
```sql
activo = true AND estado_proveedor != 'Anulada'
```

Esto está implementado en `obtenerProveedorActivo()` en `proveedorCasosService.ts`:
```typescript
.eq('activo', true)
.neq('estado_proveedor', 'Anulada')
```

### 2. Múltiples Registros con `activo=true`

Es **NORMAL y CORRECTO** tener varios `proveedor_casos` con `activo=true` para la misma incidencia:

**Ejemplo de historial:**
```
incidencia_id | proveedor_id | activo | estado_proveedor | asignado_en
------------- | ------------ | ------ | ---------------- | -----------
INC-001       | PROV-A       | true   | Anulada          | 2025-01-01
INC-001       | PROV-B       | true   | Abierta          | 2025-01-05
```

- **PROV-A**: `activo=true` pero `estado_proveedor='Anulada'` → **No está trabajando**, solo es historial visible
- **PROV-B**: `activo=true` y `estado_proveedor='Abierta'` → **Está trabajando activamente**

### 3. Cuando se Anula un Proveedor

Al anular una asignación de proveedor:

```typescript
// ✅ CORRECTO - Mantener activo=true
await supabase
  .from("proveedor_casos")
  .update({
    estado_proveedor: "Anulada",
    desasignado_en: new Date().toISOString(),
    desasignado_por: perfil.persona_id,
    motivo_desasignacion: motivo
  })
  .eq("incidencia_id", incidenciaId)
  .eq("activo", true)
  .neq("estado_proveedor", "Anulada");
```

**NO se cambia `activo=false`** porque:
- Queremos preservar el historial visible
- El campo `estado_proveedor='Anulada'` ya indica que no está trabajando

### 4. Cuando se Reasigna tras Anulación

Al reasignar después de anular:

```typescript
// 1. El proveedor anulado se mantiene como está:
//    activo=true, estado_proveedor='Anulada'

// 2. Se crea un NUEVO registro para el nuevo proveedor:
await supabase
  .from("proveedor_casos")
  .insert({
    incidencia_id: incidenciaId,
    proveedor_id: nuevoProveedorId,
    estado_proveedor: 'Abierta',
    activo: true  // ← Nuevo registro también es activo
  });
```

**Resultado:** Ahora hay 2 registros con `activo=true`, pero solo uno sin `estado_proveedor='Anulada'`

## Funciones Clave

### `obtenerProveedorActivo(incidenciaId)`
Devuelve el proveedor que **está trabajando actualmente**:
- Filtra: `activo=true AND estado_proveedor != 'Anulada'`
- Devuelve: 1 solo registro (el que está trabajando) o `null`

### `tieneProveedorActivo(incidenciaId)`
Verifica si hay un proveedor trabajando:
- Usa `obtenerProveedorActivo()`
- Devuelve: `true` si hay un proveedor trabajando, `false` si no

### `obtenerHistorialProveedores(incidenciaId)`
Devuelve **todos los proveedores** asignados (historial completo):
- Filtra: `activo=true` (incluye anulados)
- Devuelve: Array con todos los proveedores (anulados y activos)

## Flujo Completo: Primera Asignación → Anulación → Reasignación

### Paso 1: Primera Asignación
```sql
INSERT INTO proveedor_casos (incidencia_id, proveedor_id, activo, estado_proveedor)
VALUES ('INC-001', 'PROV-A', true, 'Abierta');
```

**Estado:**
| incidencia_id | proveedor_id | activo | estado_proveedor |
|---------------|--------------|--------|------------------|
| INC-001       | PROV-A       | true   | Abierta          |

**Proveedor activo:** PROV-A ✅

---

### Paso 2: Control Anula la Asignación
```sql
UPDATE proveedor_casos
SET estado_proveedor = 'Anulada',
    desasignado_en = NOW(),
    motivo_desasignacion = 'No disponible'
WHERE incidencia_id = 'INC-001'
  AND activo = true
  AND estado_proveedor != 'Anulada';
```

**Estado:**
| incidencia_id | proveedor_id | activo | estado_proveedor |
|---------------|--------------|--------|------------------|
| INC-001       | PROV-A       | true   | Anulada          |

**Proveedor activo:** Ninguno ❌
**Botón visible:** "Reasignar Proveedor" ✅

---

### Paso 3: Control Reasigna a Nuevo Proveedor
```sql
INSERT INTO proveedor_casos (incidencia_id, proveedor_id, activo, estado_proveedor)
VALUES ('INC-001', 'PROV-B', true, 'Abierta');
```

**Estado:**
| incidencia_id | proveedor_id | activo | estado_proveedor |
|---------------|--------------|--------|------------------|
| INC-001       | PROV-A       | true   | Anulada          |
| INC-001       | PROV-B       | true   | Abierta          |

**Proveedor activo:** PROV-B ✅
**Historial visible:** PROV-A (anulado), PROV-B (activo) ✅

## Ventajas de Este Enfoque

1. **Historial Completo**: Todos los proveedores (anulados o no) son visibles
2. **Auditoría**: Se mantiene el registro de quién, cuándo y por qué se anularon
3. **Simplicidad**: No hay que cambiar múltiples flags, solo el estado
4. **Consistencia**: El campo `activo` siempre significa "visible en historial"

## Código de Referencia

- **Servicio:** `lib/services/proveedorCasosService.ts`
- **Asignación:** `lib/services/asignacionProveedorService.ts`
- **UI Control-Cliente:** `app/(app)/incidencias/[id]/chat-control-cliente/page.tsx`
- **UI Chat-Proveedor:** `app/(app)/incidencias/[id]/chat-proveedor/page.tsx`
