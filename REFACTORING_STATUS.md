# Estado de Refactorización - Sprint 1

## Resumen
Este documento registra el progreso de la refactorización del sistema de gestión de incidencias, enfocado en extraer lógica duplicada a servicios centralizados.

## Sprint 1: Servicios Base ✅ COMPLETADO

### Archivos Creados

#### 1. `lib/services/storageService.ts` ✅
**Propósito**: Centralizar operaciones de Supabase Storage (URLs firmadas y subida de archivos)

**Funciones Exportadas**:
- `obtenerUrlFirmada(storageKey, bucket?, expiresIn?)` - Obtiene URL firmada con fallback search
- `obtenerUrlsMultiples(storageKeys[], bucket?, expiresIn?)` - Batch de URLs firmadas
- `subirArchivo(file, ruta, bucket?)` - Sube un archivo
- `subirMultiples(files[], rutaBase, bucket?)` - Sube múltiples archivos
- `eliminarArchivo(storageKey, bucket?)` - Elimina un archivo
- `eliminarMultiples(storageKeys[], bucket?)` - Elimina múltiples archivos

**Impacto**: Elimina ~150 líneas de código duplicado en URL signing (10+ duplicaciones identificadas)

#### 2. `lib/services/comentariosService.ts` ✅
**Propósito**: Centralizar operaciones CRUD de comentarios

**Funciones Exportadas**:
- `obtenerComentarios(incidenciaId, ambito?)` - Obtiene comentarios con adjuntos y personas
- `crearComentario(comentario)` - Crea un comentario
- `crearComentariosMultiples(comentarios[])` - Crea múltiples comentarios
- `actualizarComentario(comentarioId, cuerpo)` - Actualiza un comentario
- `eliminarComentario(comentarioId)` - Elimina un comentario
- `crearAdjuntos(comentarioId, incidenciaId, archivos[])` - Crea adjuntos
- `obtenerAdjuntosComentario(comentarioId)` - Obtiene adjuntos de un comentario
- `obtenerAdjuntosIncidencia(incidenciaId)` - Obtiene todos los adjuntos de una incidencia
- `eliminarAdjunto(adjuntoId)` - Elimina un adjunto

**Tipos Exportados**:
- `AmbitoComentario` = 'cliente' | 'proveedor' | 'ambos'
- `NuevoComentario` - Interface para crear comentarios
- `Comentario` - Interface completa de comentario
- `Adjunto` - Interface de adjunto

**Impacto**: Elimina ~80 líneas de código duplicado en gestión de comentarios (8+ duplicaciones)

#### 3. `lib/services/proveedorCasosService.ts` ✅
**Propósito**: Centralizar operaciones de asignación y gestión de proveedores

**Funciones Exportadas**:
- `obtenerProveedorActivo(incidenciaId)` - Obtiene proveedor activo
- `obtenerHistorialProveedores(incidenciaId)` - Obtiene historial completo
- `asignarProveedor(nuevoProveedorCaso)` - Asigna proveedor a incidencia
- `reasignarProveedor(incidenciaId, nuevoProveedorId, prioridad, motivo, usuarioId)` - Reasigna proveedor
- `actualizarProveedorActivo(incidenciaId, actualizacion)` - Actualiza proveedor activo
- `desactivarProveedoresActivos(incidenciaId, motivo?, usuarioId?)` - Desactiva proveedores
- `obtenerIncidenciasProveedor(proveedorId, soloActivas?)` - Obtiene incidencias de un proveedor
- `actualizarEstadoProveedor(incidenciaId, nuevoEstado)` - Actualiza estado proveedor
- `actualizarPrioridadProveedor(incidenciaId, nuevaPrioridad)` - Actualiza prioridad
- `tieneProveedorActivo(incidenciaId)` - Verifica si tiene proveedor activo

**Tipos Exportados**:
- `ProveedorCaso` - Interface completa de proveedor_caso
- `NuevoProveedorCaso` - Interface para crear asignación
- `ActualizarProveedorCaso` - Interface para actualizar

**Impacto**: Elimina ~100 líneas de código duplicado en gestión de proveedores (6+ duplicaciones)

## Archivos Pendientes de Integración

### Archivos que Deben Usar los Nuevos Servicios:

1. **`app/(app)/incidencias/[id]/chat-control-cliente/page.tsx`** (1810 líneas)
   - Reemplazar: `getSignedImageUrl()` → `obtenerUrlFirmada()`
   - Reemplazar: `subirArchivo()` → `subirArchivoStorage()` del storageService
   - Reemplazar: queries directas de comentarios → `obtenerComentarios()`, `crearComentario()`
   - Reemplazar: queries de proveedor_casos → `obtenerProveedorActivo()`, `tieneProveedorActivo()`

2. **`app/(app)/incidencias/[id]/chat-proveedor/page.tsx`** (3850 líneas)
   - Mismo patrón que chat-control-cliente
   - Adicional: uso extensivo de estado proveedor → `actualizarEstadoProveedor()`

3. **`components/ModalAsignarProveedor.tsx`** (~400 líneas)
   - Reemplazar: lógica de asignación → `asignarProveedor()`, `reasignarProveedor()`

4. **`app/(app)/control/presupuestos/page.tsx`** (~800 líneas)
   - Reemplazar: queries de comentarios y adjuntos → servicios centralizados

5. **`app/(app)/calendario/page.tsx`** (~600 líneas)
   - Reemplazar: queries de proveedor_casos → `obtenerIncidenciasProveedor()`

## Próximos Pasos

### Fase 1A: Integración Gradual (Recomendada)
En lugar de hacer cambios masivos de una vez, integrar servicios gradualmente:

1. **Paso 1**: Integrar `storageService` en un archivo (chat-control-cliente)
   - Reemplazar solo `getSignedImageUrl()` y `subirArchivo()`
   - Testear que URLs firmadas funcionan correctamente
   - Commit cambios

2. **Paso 2**: Integrar `comentariosService` en el mismo archivo
   - Reemplazar queries de comentarios
   - Mantener la misma funcionalidad
   - Commit cambios

3. **Paso 3**: Integrar `proveedorCasosService`
   - Reemplazar queries de proveedor_casos
   - Commit cambios

4. **Paso 4**: Repetir proceso en chat-proveedor

5. **Paso 5**: Actualizar componentes restantes

### Fase 1B: Testing
Después de cada integración parcial:
- Verificar que sign-in funciona
- Verificar que chat carga correctamente
- Verificar que adjuntos se muestran
- Verificar que comentarios se envían
- Verificar que estados se actualizan

## Beneficios Logrados (Una Vez Integrado)

### Reducción de Código
- **Antes**: ~330 líneas de código duplicado
- **Después**: ~330 líneas en servicios reutilizables
- **Reducción neta en archivos principales**: ~250-280 líneas

### Mantenibilidad
- ✅ Single Source of Truth para cada operación
- ✅ Tipado fuerte con TypeScript
- ✅ Manejo consistente de errores
- ✅ Logging centralizado

### Facilidad de Testing
- ✅ Servicios pueden ser testeados independientemente
- ✅ Mocks más fáciles de crear
- ✅ Menos dependencias en componentes

## Notas Técnicas

### Compatibilidad
- Los servicios mantienen compatibilidad con código existente
- Manejo de errores graceful (no lanzan excepciones, retornan null/[])
- Fallbacks para casos edge (URLs mal formadas, archivos no encontrados)

### Performance
- `obtenerUrlsMultiples()` usa Promise.all para paralelización
- Caching no implementado (puede añadirse después si es necesario)

### Seguridad
- URLs firmadas con expiración de 4 horas (configurable)
- RLS policies de Supabase se mantienen intactas
- No hay cambios en autenticación/autorización

## Estado del Branch

**Branch actual**: `refactor/sprint-1-services`

**Commits pendientes**:
- ✅ Commit inicial: feat: Add centralized services for storage, comments, and provider cases
- ⏳ Siguiente: feat: Integrate services in chat-control-cliente
- ⏳ Siguiente: feat: Integrate services in chat-proveedor
- ⏳ Siguiente: feat: Integrate services in remaining components

**Merge a main**: Solo después de Sprint 4 completo y testing exhaustivo
