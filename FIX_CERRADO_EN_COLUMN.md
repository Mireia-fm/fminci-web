# Fix: Error "column cerrado_en does not exist"

## Problema
Al resolver incidencias o calendarizar visitas como proveedor, aparecía el error:
```
Error actualizando estado del proveedor: column "cerrado_en" does not exist
```

## Causa
La función de trigger `proveedor_casos_only_one_active()` intentaba actualizar la columna `cerrado_en` que fue eliminada previamente y reemplazada por `mes_cierre`.

## Solución
Se aplicó la migración `fix_proveedor_casos_only_one_active_remove_cerrado_en` que corrige la función:

**Antes:**
```sql
UPDATE proveedor_casos
SET activo = false, cerrado_en = COALESCE(cerrado_en, NOW())
WHERE incidencia_id = NEW.incidencia_id
  AND activo = true
  AND id <> NEW.id;
```

**Después:**
```sql
UPDATE proveedor_casos
SET activo = false
WHERE incidencia_id = NEW.incidencia_id
  AND activo = true
  AND id <> NEW.id;
```

La columna `mes_cierre` se actualiza solo cuando el estado cambia a "Cerrada", no en esta función.

## Fecha
2025-10-12

## Archivos relacionados
- Migración aplicada directamente en Supabase
- Función: `proveedor_casos_only_one_active()`
- Trigger: `trg_pc_one_active` en tabla `proveedor_casos`
