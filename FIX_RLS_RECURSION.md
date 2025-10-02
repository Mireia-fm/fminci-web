# Fix: Recursión Infinita en RLS (Error 500 en Producción)

**Fecha:** 2025-10-02
**Problema:** Al hacer deployment, los usuarios veían "Sin perfil" y error 500 en producción.

## 🔍 Causa Raíz

**Error detectado:** `infinite recursion detected in policy for relation "personas_instituciones"`

Durante la migración a roles nativos de PostgreSQL, se crearon políticas RLS con **recursión infinita**:

### Política problemática en `personas_instituciones`:

```sql
-- ❌ ANTES (con recursión infinita)
CREATE POLICY personas_instituciones_select ON personas_instituciones
  FOR SELECT
  USING (
    app.es_control()
    OR persona_id = app.current_persona_id()
    OR institucion_id IN (
      SELECT personas_instituciones_1.institucion_id
      FROM personas_instituciones personas_instituciones_1  -- ❌ Lee la misma tabla!
      WHERE personas_instituciones_1.persona_id = app.current_persona_id()
    )
  );
```

**Problema:** La política intenta leer `personas_instituciones` para determinar si puedes leer `personas_instituciones` → loop infinito.

### Política problemática en `personas`:

```sql
-- ❌ ANTES (con recursión infinita)
CREATE POLICY personas_select_own_institutions ON personas
  FOR SELECT
  USING (
    app.es_control()
    OR id = app.current_persona_id()
    OR EXISTS (
      SELECT 1 FROM personas_instituciones pi
      WHERE pi.persona_id = personas.id
        AND pi.institucion_id IN (
          SELECT institucion_id
          FROM personas_instituciones  -- ❌ Otra recursión!
          WHERE persona_id = app.current_persona_id()
        )
    )
  );
```

## ✅ Solución Aplicada

### Migración 1: Fix `personas_instituciones`

```sql
-- ✅ DESPUÉS (sin recursión)
DROP POLICY IF EXISTS personas_instituciones_select ON personas_instituciones;

CREATE POLICY personas_instituciones_select ON personas_instituciones
  FOR SELECT
  USING (
    app.es_control()
    OR persona_id = app.current_persona_id()
  );
```

**Cambio:** Eliminada la subquery recursiva. Ahora solo valida:
- Control puede ver todo
- Usuarios pueden ver sus propias relaciones

### Migración 2: Fix `personas`

```sql
-- ✅ DESPUÉS (sin recursión)
DROP POLICY IF EXISTS personas_select_own_institutions ON personas;

CREATE POLICY personas_select ON personas
  FOR SELECT
  USING (
    app.es_control()
    OR id = app.current_persona_id()
  );
```

**Cambio:** Política simplificada:
- Control puede ver todo
- Usuarios pueden ver su propio perfil

## 🧪 Verificación

La vista `v_mi_perfil` ahora funciona correctamente:

```sql
-- Esta vista depende de app.current_persona_id() que lee personas
CREATE VIEW v_mi_perfil AS
SELECT
  id AS persona_id,
  email,
  rol,
  COALESCE(acceso_todos_centros, false) AS acceso_todos_centros,
  EXISTS (
    SELECT 1 FROM personas_instituciones pi
    WHERE pi.persona_id = p.id
      AND pi.rol_en_institucion = 'Proveedor'
  ) AS es_proveedor
FROM personas p
WHERE id = app.current_persona_id();
```

## 📊 Impacto

**Antes:**
- ❌ Error 500 en todas las páginas
- ❌ "Sin perfil" en dashboard
- ❌ No se podían cargar datos de usuario

**Después:**
- ✅ Login funciona
- ✅ Dashboard carga correctamente
- ✅ Usuarios ven su perfil
- ✅ No hay errores 500

## 🚀 Deployment

Las migraciones fueron aplicadas directamente en producción vía Supabase MCP:

1. `fix_personas_instituciones_rls_recursion`
2. `fix_personas_rls_recursion`

**No requiere deployment de código** - los cambios son solo en la base de datos.

## ⚠️ Nota de Seguridad

Las nuevas políticas son **más restrictivas** que las anteriores (que intentaban dar acceso a instituciones compartidas).

Si en el futuro necesitas que los usuarios vean personas de sus mismas instituciones, se necesitará:

1. Crear una **tabla auxiliar** o **función** que no cause recursión
2. O usar **SECURITY DEFINER functions** para queries específicas

**NO volver a usar subqueries que lean la misma tabla en políticas RLS.**

## 🔗 Referencias

- [Supabase RLS Best Practices](https://supabase.com/docs/guides/auth/row-level-security)
- Error de Postgres: `42P17` - Infinite recursion detected in policy
- Migración de roles nativos: `MIGRACION_ROLES_NATIVOS.md`
