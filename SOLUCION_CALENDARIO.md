# Solución: Calendario no funciona en producción

## 🔍 Problema Identificado

El calendario funciona en local pero no en producción para proveedores. Las consultas devuelven arrays vacíos debido a que las **políticas RLS (Row Level Security)** están bloqueando el acceso.

## ✅ Soluciones Aplicadas

### 1. Migración de datos (COMPLETADA)
Ya aplicamos la migración `sync_auth_user_id_and_roles` que:
- ✅ Vinculó 79 usuarios de `personas` con `auth.users`
- ✅ Sincronizó 93 roles en `raw_app_meta_data`

### 2. Función de depuración (CREADA)
Creamos la función `debug_current_user()` para diagnosticar problemas de autenticación en producción.

## 🔧 Siguiente Paso: Forzar Logout/Login

**El problema más probable es que el token JWT del usuario está desactualizado.**

### Opción A: Logout/Login Manual (RECOMENDADO)

Pide al usuario que:
1. Cierre sesión en producción
2. Vuelva a iniciar sesión
3. Intente acceder al calendario

Esto forzará la regeneración del JWT con el rol actualizado en metadata.

### Opción B: Depurar desde DevTools

Si el problema persiste, ejecuta en la consola del navegador (F12):

```javascript
// 1. Obtener el cliente de Supabase
const supabase = (await import('/lib/supabaseClient.js')).supabase;

// 2. Verificar la sesión actual
const { data: session } = await supabase.auth.getSession();
console.log('📊 Sesión:', session);

// 3. Llamar a la función de depuración
const { data, error } = await supabase.rpc('debug_current_user');
console.log('🔍 Debug RLS:', { data, error });

// 4. Verificar si las citas se pueden obtener
const { data: citas, error: citasError } = await supabase
  .from('citas_proveedores')
  .select('*')
  .eq('proveedor_id', 'e306eec0-c024-49fd-b204-5753ccb31cbb')
  .eq('estado', 'programada')
  .limit(5);
console.log('📅 Citas:', { citas, citasError });
```

### Opción C: Forzar Refresh del Token

Si el logout/login no funciona, agrega este código temporalmente en `app/(app)/calendario/page.tsx`:

```typescript
useEffect(() => {
  if (!loadingAuth && perfil) {
    // Forzar refresh del token antes de cargar citas
    supabase.auth.refreshSession().then(() => {
      cargarCitas();
    });
  }
}, [loadingAuth, perfil]);
```

## 📊 Verificación del Estado Actual

### Usuario: mireia.miraquetedigo@gmail.com
- ✅ Email confirmado
- ✅ `auth_user_id` vinculado
- ✅ Rol en metadata: "Proveedor"
- ✅ Institución: Mastercold
- ✅ `rol_en_institucion`: "Proveedor"
- ✅ Tiene **89+ citas programadas** (incluyendo 9 para hoy 24/10/2025)

### Políticas RLS de `citas_proveedores`

**SELECT** (lectura):
```sql
app.es_control() OR
EXISTS (
  SELECT 1 FROM personas_instituciones pi
  WHERE pi.persona_id = app.current_persona_id()
  AND pi.institucion_id = citas_proveedores.proveedor_id
  AND pi.rol_en_institucion = 'Proveedor'
)
```

Esta política **requiere**:
1. `app.current_persona_id()` → Obtiene persona_id desde el email del JWT
2. `pi.rol_en_institucion = 'Proveedor'` → Ya está correcto ✅

## 🎯 Resultado Esperado

Después del logout/login, el calendario debería mostrar:
- **Sección "Citas para hoy"**: 9 citas del 24/10/2025
- **Calendario de octubre**: Todas las citas del mes
- **Citas futuras**: Noviembre y adelante

## ⚠️ Si el problema persiste

Si después del logout/login el problema continúa, ejecuta la función de depuración en DevTools y compárteme el resultado:

```javascript
const { data } = await supabase.rpc('debug_current_user');
console.log(JSON.stringify(data, null, 2));
```

Esto nos dirá exactamente qué está fallando en el contexto de autenticación.
