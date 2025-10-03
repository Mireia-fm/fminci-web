# Provider Cancellation Workflow - Implementation Summary

## Problem
When Control cancelled a provider assignment using the "Anular proveedor" button, several issues occurred:
- `estado_proveedor` remained "Abierta" instead of changing to "Anulada"
- The "Anular proveedor" button stayed visible after cancellation
- No proper tracking of cancellation history
- Notifications weren't being sent to providers

**Root Cause:** The `anularIncidencia()` function was trying to write to non-existent database fields:
- `proveedor_casos.fecha_anulacion` ❌
- `incidencias.motivo_anulacion_proveedor` ❌
- `incidencias.fecha_anulacion_proveedor` ❌
- `notificaciones` table ❌ (should be `proveedor_notificaciones`)

## Solution

### 1. Database Migration
**File:** Migration `add_cancellation_fields_to_proveedor_casos`

Added new fields to `proveedor_casos` table:
```sql
ALTER TABLE proveedor_casos
ADD COLUMN motivo_anulacion TEXT,
ADD COLUMN anulado_en TIMESTAMPTZ,
ADD COLUMN anulado_por UUID REFERENCES personas(id);

-- Added indexes for performance
CREATE INDEX idx_proveedor_casos_activo ON proveedor_casos(activo);
CREATE INDEX idx_proveedor_casos_incidencia_activo ON proveedor_casos(incidencia_id, activo);
```

**Note:** The `proveedor_notificaciones` table already existed with the correct structure.

### 2. Code Fixes

#### Fixed `anularIncidencia()` Function
**File:** `app/(app)/incidencias/[id]/chat-proveedor/page.tsx` (line 1507)

**Before:**
```typescript
await supabase
  .from("proveedor_casos")
  .update({
    estado_proveedor: "Anulada",
    activo: false,
    fecha_anulacion: new Date().toISOString() // ❌ Field doesn't exist
  })
  .eq("incidencia_id", incidenciaId)
  .eq("activo", true);

// Tried to update non-existent fields in incidencias table
await supabase
  .from("incidencias")
  .update({
    motivo_anulacion_proveedor: motivoAnulacion, // ❌
    fecha_anulacion_proveedor: new Date().toISOString() // ❌
  });

// Wrong table name
await supabase.from("notificaciones").insert({...}); // ❌
```

**After:**
```typescript
const { error: updateError } = await supabase
  .from("proveedor_casos")
  .update({
    estado_proveedor: "Anulada",
    activo: false,
    motivo_anulacion: motivoAnulacion, // ✅ Correct field
    anulado_en: new Date().toISOString(), // ✅ Correct field
    anulado_por: autorId // ✅ Track who cancelled
  })
  .eq("incidencia_id", incidenciaId)
  .eq("activo", true);

if (updateError) {
  console.error("Error updating proveedor_casos:", updateError);
  throw updateError; // ✅ Better error handling
}

// Correct table and column names
await supabase
  .from("proveedor_notificaciones")
  .insert({
    proveedor_id: proveedorInfo.proveedor_id,
    incidencia_id: incidenciaId,
    tipo_notificacion: 'anulacion', // ✅
    notificacion_vista: false, // ✅
    fecha_creacion: new Date().toISOString() // ✅
  });
```

#### Fixed Cancellation History Query
**File:** `app/(app)/incidencias/[id]/chat-proveedor/page.tsx` (line 517)

**Before:**
```typescript
const { data: proveedoresHistoricos } = await supabase
  .from("proveedor_casos")
  .select(`
    proveedor_id,
    asignado_en,
    fecha_anulacion, // ❌ Doesn't exist
    estado_proveedor,
    activo,
    incidencias!inner(
      motivo_anulacion_proveedor // ❌ Doesn't exist
    )
  `)
```

**After:**
```typescript
const { data: proveedoresHistoricos } = await supabase
  .from("proveedor_casos")
  .select(`
    proveedor_id,
    asignado_en,
    anulado_en, // ✅ Correct field name
    motivo_anulacion, // ✅ Get directly from proveedor_casos
    estado_proveedor,
    activo
  `)
```

### 3. UI Improvements

#### Added "Reasignar Proveedor" Button
**File:** `app/(app)/incidencias/[id]/chat-proveedor/page.tsx` (line 2234)

```typescript
{/* Botón Reasignar - disponible cuando está anulada */}
{estado === "Anulada" && (
  <button
    type="button"
    onClick={() => router.push(`/control/incidencias?asignar=${incidenciaId}`)}
    className="px-4 py-2 text-white rounded hover:opacity-90 transition-opacity"
    style={{ backgroundColor: PALETA.verdeClaro }}
  >
    Reasignar Proveedor
  </button>
)}
```

The "Anular Proveedor" button is automatically hidden when `estado === "Anulada"`.

### 4. Features Already Working

✅ **Cancellation History Display** (line 2113-2204)
- Shows all provider assignments (active and cancelled)
- Displays provider name, assignment date, cancellation date
- Shows cancellation reason in red highlighted box
- Marks active vs cancelled with visual badges

✅ **Notification System** (`components/DashboardProveedor.tsx`)
- `proveedor_notificaciones` table already exists
- Notifications already displayed in provider dashboard
- Marks notifications as viewed

✅ **Filter Cancelled Incidents** (`lib/incidenciasService.ts` line 179)
- `obtenerIncidenciasProveedor()` already filters by `activo: true`
- Cancelled incidents automatically hidden from provider view
- Dashboard counts only include active assignments

## Testing Checklist

To verify everything works:

1. **As Control user:**
   - [ ] Go to an incident with active provider assignment
   - [ ] Click "Anular Proveedor" button
   - [ ] Enter cancellation reason
   - [ ] Verify `estado_proveedor` changes to "Anulada"
   - [ ] Verify "Reasignar Proveedor" button appears
   - [ ] Check provider history section shows cancellation with reason

2. **As Provider user:**
   - [ ] Check dashboard - cancelled incident should disappear from counts
   - [ ] Check incident list - cancelled incident should not appear
   - [ ] Check notifications - should see cancellation notification

3. **Database verification:**
   ```sql
   SELECT
     pc.estado_proveedor,
     pc.activo,
     pc.motivo_anulacion,
     pc.anulado_en,
     i.num_solicitud
   FROM proveedor_casos pc
   JOIN incidencias i ON i.id = pc.incidencia_id
   WHERE pc.activo = false
   ORDER BY pc.anulado_en DESC;
   ```

## Files Modified

1. **Database:**
   - Migration: `add_cancellation_fields_to_proveedor_casos`

2. **Code:**
   - `app/(app)/incidencias/[id]/chat-proveedor/page.tsx`
     - Fixed `anularIncidencia()` function
     - Updated provider history query
     - Added "Reasignar Proveedor" button

## Migration Applied

The database migration has been successfully applied to production. New fields are now available:
- `proveedor_casos.motivo_anulacion`
- `proveedor_casos.anulado_en`
- `proveedor_casos.anulado_por`

## Deployment

Changes have been pushed to `main` branch and will be deployed automatically by Vercel.

**Commit:** `7d8d01e - Implement provider cancellation workflow and notification system`
