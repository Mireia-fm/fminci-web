# Fix: Vinculación de auth_user_id en tabla personas

**Fecha:** 2025-10-03
**Problema:** Vista proveedor mostraba 0 resultados para usuario Control

## 🔍 Causa Raíz

Los usuarios en la tabla `personas` tenían `auth_user_id = NULL`, lo que causaba:

1. La función `app.get_user_rol()` no podía determinar el rol del usuario
2. `app.es_control()` retornaba `false` para usuarios Control
3. Las políticas RLS bloqueaban el acceso a `proveedor_casos`
4. Las queries retornaban 0 resultados

### Ejemplo del problema:

```sql
-- Usuario en auth.users
SELECT id, email FROM auth.users WHERE email = 'jmarinco@idom.com';
-- id: b74a4055-75e5-4a60-88c9-aaf59123daad

-- Usuario en personas (DESVINCULADO)
SELECT auth_user_id, email, rol FROM personas WHERE email = 'jmarinco@idom.com';
-- auth_user_id: NULL ❌
-- rol: Control
```

## 🛠️ Solución

### Query ejecutada:

```sql
-- Vincular automáticamente todos los usuarios por email
UPDATE personas p
SET auth_user_id = u.id
FROM auth.users u
WHERE LOWER(p.email) = LOWER(u.email)
  AND p.auth_user_id IS NULL;
```

### Resultado:
- ✅ 8 usuarios vinculados exitosamente
- 93 usuarios en `personas` sin cuenta en `auth.users` (aún sin crear)

## 📊 Estado Post-Fix

### Usuarios vinculados:
```sql
SELECT COUNT(*) FROM personas WHERE auth_user_id IS NOT NULL;
-- Resultado: 8
```

### Distribución:
- Control: 1 vinculado (jmarinco@idom.com)
- Otros roles: 7 vinculados

## 🔐 Funciones que Dependen de auth_user_id

### `app.get_user_rol()`
```sql
CREATE FUNCTION app.get_user_rol() RETURNS text AS $$
DECLARE
  user_rol text;
BEGIN
  -- 1. Buscar en metadata de auth.users
  SELECT (raw_app_meta_data->>'rol')::text
  INTO user_rol
  FROM auth.users
  WHERE id = auth.uid();

  -- 2. Fallback: buscar en personas usando auth_user_id
  IF user_rol IS NULL THEN
    SELECT p.rol::text
    INTO user_rol
    FROM public.personas p
    WHERE p.auth_user_id = auth.uid();  -- ❗ Requiere auth_user_id vinculado
  END IF;

  RETURN COALESCE(user_rol, 'Otro');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
```

### `app.es_control()`
```sql
CREATE FUNCTION app.es_control() RETURNS boolean AS $$
BEGIN
  RETURN app.get_user_rol() = 'Control';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
```

### `app.current_persona_id()`
```sql
CREATE FUNCTION app.current_persona_id() RETURNS uuid AS $$
  SELECT p.id
  FROM personas p
  WHERE p.auth_user_id = auth.uid();  -- ❗ Requiere auth_user_id vinculado
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

## 🚨 Prevención Futura

### 1. Hook de registro automático

Cuando se crea un nuevo usuario en `auth.users`, vincular automáticamente:

```sql
-- Trigger en auth.users (requiere permisos de superusuario)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Vincular usuario existente en personas
  UPDATE public.personas
  SET auth_user_id = NEW.id
  WHERE LOWER(email) = LOWER(NEW.email)
    AND auth_user_id IS NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger (si tienes permisos)
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### 2. Validación manual periódica

```sql
-- Verificar usuarios desvinculados con cuenta de auth
SELECT
  p.email,
  p.rol,
  u.id as auth_id_disponible
FROM personas p
JOIN auth.users u ON LOWER(p.email) = LOWER(u.email)
WHERE p.auth_user_id IS NULL;
```

### 3. Script de sincronización

```sql
-- Ejecutar periódicamente para mantener sincronizados
UPDATE personas p
SET auth_user_id = u.id
FROM auth.users u
WHERE LOWER(p.email) = LOWER(u.email)
  AND p.auth_user_id IS NULL
  AND p.auth_user_id != u.id;
```

## ✅ Verificación

Después del fix, el usuario Control puede:

1. ✅ Ejecutar `SELECT * FROM v_mi_perfil` sin errores
2. ✅ Ver dashboard con datos de cliente
3. ✅ Ver dashboard con datos de proveedor (769 casos activos)
4. ✅ Acceder a todas las tablas según políticas RLS

### Test manual:

```sql
-- Simular usuario autenticado
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "b74a4055-75e5-4a60-88c9-aaf59123daad", "email": "jmarinco@idom.com"}';

-- Verificar app.es_control()
SELECT app.es_control();  -- Debería retornar: true ✅

-- Verificar acceso a proveedor_casos
SELECT COUNT(*) FROM proveedor_casos WHERE activo = true;
-- Debería retornar: 769 ✅
```

## 🔗 Referencias

- Migración de roles nativos: `MIGRACION_ROLES_NATIVOS.md`
- Fix recursión RLS: `FIX_RLS_RECURSION.md`
- Documentación Supabase Auth: https://supabase.com/docs/guides/auth
