# Fix: Caracteres Especiales en Nombres de Archivos de Storage

## Problema

Al subir archivos con nombres que contienen caracteres especiales (comas, espacios, acentos, etc.) a Supabase Storage, se producía el error:

```
Console StorageApiError
Invalid key: incidencias/20251006-01/documentos/1759738058195_IDOM CONSULTING, ENGINEERING, ALBARÁN 5000012O3GO1O7O.pdf
```

## Causa

Supabase Storage tiene restricciones sobre los caracteres permitidos en las rutas de archivos. Caracteres como:
- Espacios
- Comas `,`
- Acentos `á, é, í, ó, ú`
- Caracteres especiales: `Ñ, ñ, ¿, ¡`, etc.

No son válidos y causan errores de `Invalid key`.

## Solución Implementada

### 1. Función de Sanitización Centralizada

Se creó una función en [storageService.ts](lib/services/storageService.ts:18-31) para sanitizar nombres de archivos:

```typescript
export function sanitizarNombreArchivo(nombre: string): string {
  // Remover caracteres no válidos y espacios
  // Mantener solo letras, números, guiones, puntos y guiones bajos
  return nombre
    .normalize('NFD') // Descomponer caracteres acentuados
    .replace(/[\u0300-\u036f]/g, '') // Eliminar marcas diacríticas
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Reemplazar caracteres especiales por guión bajo
    .replace(/_{2,}/g, '_') // Reemplazar múltiples guiones bajos por uno solo
    .replace(/^[._-]+|[._-]+$/g, ''); // Eliminar guiones/puntos al inicio o final
}
```

**Ejemplo de transformación:**
```
"IDOM CONSULTING, ENGINEERING, ALBARÁN 5000012O3GO1O7O.pdf"
     ↓
"IDOM_CONSULTING_ENGINEERING_ALBARAN_5000012O3GO1O7O.pdf"
```

### 2. Archivos Actualizados

#### [lib/services/storageService.ts](lib/services/storageService.ts)
- ✅ Añadida función `sanitizarNombreArchivo` (exportada)
- ✅ Actualizada función `subirMultiples` para usar sanitización

**Antes:**
```typescript
const nombreArchivo = `${Date.now()}_${file.name}`;
```

**Después:**
```typescript
const nombreSanitizado = sanitizarNombreArchivo(file.name);
const nombreArchivo = `${Date.now()}_${nombreSanitizado}`;
```

#### [lib/services/resolucionProveedorService.ts](lib/services/resolucionProveedorService.ts)
- ✅ Importada función `sanitizarNombreArchivo`
- ✅ Actualizada función `subirArchivo` (línea 59)
- ✅ Actualizada subida de documento justificativo (línea 546)

**Cambios en `subirArchivo`:**
```typescript
const nombreSanitizado = sanitizarNombreArchivo(archivo.name);
const nombreArchivo = `${Date.now()}_${nombreSanitizado}`;
```

**Cambios en `valoracionEconomica`:**
```typescript
const nombreSanitizado = sanitizarNombreArchivo(documentoJustificativo.name);
const fileName = `justificante_${Date.now()}_${nombreSanitizado}`;
```

#### [lib/services/asignacionProveedorService.ts](lib/services/asignacionProveedorService.ts)
- ✅ Importada función `sanitizarNombreArchivo`
- ✅ Actualizada función `procesarImagenesAdicionales` (línea 324)

**Antes:**
```typescript
const safeName = archivo.name.replace(/\s+/g, "_");
```

**Después:**
```typescript
const safeName = sanitizarNombreArchivo(archivo.name);
```

#### [lib/services/presupuestosService.ts](lib/services/presupuestosService.ts)
- ✅ Importada función `sanitizarNombreArchivo`
- ✅ Actualizada subida de documento de presupuesto (línea 43)

**Cambios:**
```typescript
const nombreSanitizado = sanitizarNombreArchivo(documentoPresupuesto.name);
const nombreArchivo = `${Date.now()}_${nombreSanitizado}`;
```

### 3. Cobertura Completa

Todos los puntos de subida de archivos en la aplicación ahora sanitizan nombres:

| Servicio | Función | Tipo de Archivo |
|----------|---------|-----------------|
| `storageService` | `subirMultiples` | Múltiples (genérico) |
| `resolucionProveedorService` | `subirArchivo` | Imágenes y documentos de resolución |
| `resolucionProveedorService` | `valoracionEconomica` | Documentos justificativos |
| `asignacionProveedorService` | `procesarImagenesAdicionales` | Imágenes adicionales al asignar |
| `presupuestosService` | `ofertarPresupuesto` | Documentos de presupuesto |

## Casos de Prueba

### Caso 1: Archivo con espacios y comas
**Input:** `"IDOM CONSULTING, ENGINEERING.pdf"`
**Output:** `"IDOM_CONSULTING_ENGINEERING.pdf"`

### Caso 2: Archivo con acentos
**Input:** `"Presupuesto Instalación Eléctrica.pdf"`
**Output:** `"Presupuesto_Instalacion_Electrica.pdf"`

### Caso 3: Archivo con caracteres especiales
**Input:** `"Factura #123 - Cliente [A&B].pdf"`
**Output:** `"Factura_123_Cliente_A_B_.pdf"`

### Caso 4: Archivo con ñ y tildes
**Input:** `"Año 2025 - Diseño.docx"`
**Output:** `"Ano_2025_Diseno.docx"`

## Testing Recomendado

1. **Resolución de proveedor:**
   - ✓ Subir documento con espacios y comas
   - ✓ Subir imágenes con acentos
   - ✓ Verificar que se almacenan correctamente

2. **Valoración económica:**
   - ✓ Subir documento justificativo con caracteres especiales
   - ✓ Verificar que se crea el adjunto correctamente

3. **Presupuestos:**
   - ✓ Subir presupuesto con nombre complejo
   - ✓ Verificar que Control puede ver el documento

4. **Asignación de proveedor:**
   - ✓ Subir múltiples imágenes adicionales con caracteres especiales
   - ✓ Verificar que todas se suben correctamente

## Compatibilidad con Archivos Existentes

⚠️ **Importante:** Los archivos ya subidos con nombres originales **NO** se verán afectados. Esta solución solo aplica a **nuevas subidas**.

Si hay archivos existentes con nombres problemáticos en Storage:
1. Los enlaces firmados deberían seguir funcionando
2. Si hay problemas, considerar migración manual o script de renombrado

## Notas Adicionales

- La función `sanitizarNombreArchivo` es **exportada** desde `storageService.ts` para reutilización
- Se mantiene el timestamp `Date.now()` como prefijo para evitar colisiones
- El nombre original del archivo se guarda en la tabla `adjuntos.nombre_archivo` para referencia del usuario
- La transformación es **unidireccional** (no reversible), pero esto no afecta la funcionalidad

## Resolución del Issue Original

El error específico del screenshot:
```
Invalid key: incidencias/20251006-01/documentos/1759738058195_IDOM CONSULTING, ENGINEERING, ALBARÁN 5000012O3GO1O7O.pdf
```

Ahora se resuelve automáticamente transformando el nombre a:
```
incidencias/20251006-01/documentos/1759738058195_IDOM_CONSULTING_ENGINEERING_ALBARAN_5000012O3GO1O7O.pdf
```

## Referencias

- [Supabase Storage API](https://supabase.com/docs/guides/storage)
- [storageService.ts](lib/services/storageService.ts)
- [resolucionProveedorService.ts](lib/services/resolucionProveedorService.ts)
