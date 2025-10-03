# 🛠️ IMPLEMENTACIÓN: Resolución Manual por Control

## 📋 Resumen

Añadir funcionalidad para que Control pueda resolver incidencias manualmente, ya sea sin proveedor del sistema (usando proveedor externo) o marcando como resuelta una incidencia que tiene proveedor asignado.

---

## 🎯 Casos de Uso

### Caso 1: Sin Proveedor del Sistema
- Incidencia resuelta por proveedor externo (no registrado)
- Trabajo realizado internamente
- No requiere gestión de proveedor

### Caso 2: Con Proveedor Asignado
- Control resuelve manualmente por razones excepcionales
- Proveedor no puede marcar como resuelta
- Trabajo completado pero requiere intervención de Control

---

## 📐 Diseño de la Solución

### 1. Interfaz de Usuario

#### **Chat Cliente (sin proveedor)**

**Ubicación**: Sección "ACCIONES DE CONTROL" en [chat-control-cliente/page.tsx](app/(app)/incidencias/[id]/chat-control-cliente/page.tsx)

**Condiciones para mostrar botón**:
```typescript
{tipoUsuario === 'Control' &&
 !tieneProveedorAsignado &&
 (incidencia.estado_cliente === 'Abierta' || incidencia.estado_cliente === 'En espera') && (
  <button
    onClick={() => setMostrarModalResolucionManual(true)}
    className="px-3 py-2 text-sm text-white rounded hover:opacity-90"
    style={{ backgroundColor: PALETA.verdeClaro }}
  >
    Resolver Manualmente
  </button>
)}
```

#### **Chat Proveedor (con proveedor)**

**Ubicación**: Selector de estados en [chat-proveedor/page.tsx](app/(app)/incidencias/[id]/chat-proveedor/page.tsx)

**Condiciones**:
- Solo visible para Control
- Solo en estados activos (no "Cerrada", "Anulada")

```typescript
// En el selector de estado proveedor, añadir opción
{tipoUsuario === 'Control' && estado !== 'Cerrada' && estado !== 'Anulada' && (
  <option value="__RESOLUCION_MANUAL__">
    🔧 Resolver Manualmente (Control)
  </option>
)}
```

---

### 2. Componentes Nuevos

#### **ModalResolucionManual.tsx**

```typescript
"use client";

import { useState } from "react";
import { PALETA } from "@/lib/theme";

type FormularioResolucionManual = {
  descripcion: string;           // Obligatorio
  proveedor_externo?: string;    // Opcional (solo sin proveedor)
  importe?: number;              // Opcional
  documentos?: File[];           // Opcional
  observaciones?: string;        // Opcional (solo con proveedor)
};

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formulario: FormularioResolucionManual) => Promise<void>;
  tieneProveedor: boolean;       // Determina qué campos mostrar
  enviando: boolean;
}

export default function ModalResolucionManual({
  isOpen,
  onClose,
  onSubmit,
  tieneProveedor,
  enviando
}: ModalProps) {
  const [formulario, setFormulario] = useState<FormularioResolucionManual>({
    descripcion: '',
    proveedor_externo: '',
    importe: undefined,
    documentos: [],
    observaciones: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formulario.descripcion.trim()) {
      alert('La descripción es obligatoria');
      return;
    }
    await onSubmit(formulario);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFormulario(prev => ({
        ...prev,
        documentos: Array.from(e.target.files || [])
      }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        className="rounded-lg p-6 max-w-2xl w-full mx-4 shadow"
        style={{ backgroundColor: PALETA.card }}
      >
        <h3 className="text-xl font-semibold mb-4" style={{ color: PALETA.textoOscuro }}>
          {tieneProveedor
            ? 'Resolver Incidencia Manualmente (Control)'
            : 'Resolver Incidencia Manualmente'}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Descripción (obligatorio) */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
              {tieneProveedor ? 'Motivo de resolución manual *' : 'Descripción de la resolución *'}
            </label>
            <textarea
              value={formulario.descripcion}
              onChange={(e) => setFormulario(prev => ({ ...prev, descripcion: e.target.value }))}
              placeholder="Describe cómo se resolvió la incidencia..."
              className="w-full h-24 p-3 border rounded resize-none focus:outline-none"
              onFocus={(e) => e.target.style.boxShadow = `0 0 0 2px ${PALETA.verdeClaro}80`}
              onBlur={(e) => e.target.style.boxShadow = ''}
              required
            />
          </div>

          {/* Campos solo para resolución SIN proveedor */}
          {!tieneProveedor && (
            <>
              {/* Proveedor externo */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                  Proveedor externo (opcional)
                </label>
                <input
                  type="text"
                  value={formulario.proveedor_externo}
                  onChange={(e) => setFormulario(prev => ({ ...prev, proveedor_externo: e.target.value }))}
                  placeholder="Ej: Fontanería García SL"
                  className="w-full p-2 border rounded focus:outline-none"
                  onFocus={(e) => e.target.style.boxShadow = `0 0 0 2px ${PALETA.verdeClaro}80`}
                  onBlur={(e) => e.target.style.boxShadow = ''}
                />
              </div>

              {/* Importe */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                  Importe (€, opcional)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formulario.importe || ''}
                  onChange={(e) => setFormulario(prev => ({
                    ...prev,
                    importe: e.target.value ? parseFloat(e.target.value) : undefined
                  }))}
                  placeholder="0.00"
                  className="w-full p-2 border rounded focus:outline-none"
                  onFocus={(e) => e.target.style.boxShadow = `0 0 0 2px ${PALETA.verdeClaro}80`}
                  onBlur={(e) => e.target.style.boxShadow = ''}
                />
              </div>
            </>
          )}

          {/* Observaciones (solo con proveedor) */}
          {tieneProveedor && (
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
                Observaciones adicionales (opcional)
              </label>
              <textarea
                value={formulario.observaciones}
                onChange={(e) => setFormulario(prev => ({ ...prev, observaciones: e.target.value }))}
                placeholder="Información adicional sobre la resolución..."
                className="w-full h-20 p-3 border rounded resize-none focus:outline-none"
                onFocus={(e) => e.target.style.boxShadow = `0 0 0 2px ${PALETA.verdeClaro}80`}
                onBlur={(e) => e.target.style.boxShadow = ''}
              />
            </div>
          )}

          {/* Adjuntar documentos */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: PALETA.textoOscuro }}>
              Adjuntar documentos (facturas, fotos, etc.)
            </label>
            <input
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={handleFileChange}
              className="w-full p-2 border rounded"
            />
            {formulario.documentos && formulario.documentos.length > 0 && (
              <div className="mt-2 text-sm text-gray-600">
                {formulario.documentos.length} archivo(s) seleccionado(s)
              </div>
            )}
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded border hover:bg-gray-50"
              style={{ color: PALETA.textoOscuro, borderColor: '#d1d5db' }}
              disabled={enviando}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando}
              className="px-6 py-2 text-sm text-white rounded hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: PALETA.verdeClaro }}
            >
              {enviando ? 'Resolviendo...' : 'Resolver Incidencia'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

---

### 3. Lógica de Backend

#### **Función: resolverManualmenteSinProveedor()**

**Ubicación**: [chat-control-cliente/page.tsx](app/(app)/incidencias/[id]/chat-control-cliente/page.tsx)

```typescript
const resolverManualmenteSinProveedor = async (formulario: FormularioResolucionManual) => {
  if (!autorId || !incidencia) return;

  try {
    setEnviando(true);

    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData.user?.email;

    // 1. Subir documentos adjuntos (si hay)
    const documentosUrls: string[] = [];
    if (formulario.documentos && formulario.documentos.length > 0) {
      for (const doc of formulario.documentos) {
        const nombreArchivo = `${Date.now()}_${doc.name}`;
        const ruta = `incidencias/${incidencia.num_solicitud}/resolucion_manual/${nombreArchivo}`;

        const { data, error } = await supabase.storage
          .from('incidencias')
          .upload(ruta, doc);

        if (!error && data) {
          documentosUrls.push(ruta);
        }
      }
    }

    // 2. Obtener estado anterior
    const estadoAnterior = incidencia.estado_cliente;

    // 3. Actualizar estado de incidencia
    const { error: updateError } = await supabase
      .from("incidencias")
      .update({ estado_cliente: "Resuelta" })
      .eq("id", incidenciaId);

    if (updateError) throw updateError;

    // 4. Registrar cambio de estado
    await registrarCambioEstado({
      incidenciaId,
      tipoEstado: 'cliente',
      estadoAnterior,
      estadoNuevo: 'Resuelta',
      autorId,
      motivo: 'Resolución manual por Control',
      metadatos: {
        accion: 'resolucion_manual',
        proveedor_externo: formulario.proveedor_externo || 'No especificado',
        importe: formulario.importe || 0,
        num_documentos: documentosUrls.length
      }
    });

    // 5. Crear comentario sistema con detalles
    const cuerpoComentario = `Incidencia resuelta manualmente por Control.

**Descripción:** ${formulario.descripcion}

**Proveedor:** ${formulario.proveedor_externo || 'No especificado'}

**Importe:** ${formulario.importe ? `${formulario.importe}€` : 'No especificado'}

${documentosUrls.length > 0 ? `**Documentos adjuntos:** ${documentosUrls.length}` : ''}`;

    await supabase
      .from("comentarios")
      .insert({
        incidencia_id: incidenciaId,
        ambito: 'cliente',
        autor_id: autorId,
        autor_email: userEmail,
        autor_rol: 'Control',
        cuerpo: cuerpoComentario,
        es_sistema: true
      });

    // 6. Si hay documentos, crear adjuntos
    if (documentosUrls.length > 0) {
      const { data: comentario } = await supabase
        .from("comentarios")
        .select("id")
        .eq("incidencia_id", incidenciaId)
        .order("creado_en", { ascending: false })
        .limit(1)
        .single();

      if (comentario) {
        const adjuntos = documentosUrls.map((url, index) => ({
          incidencia_id: incidenciaId,
          comentario_id: comentario.id,
          storage_key: url,
          nombre_archivo: formulario.documentos![index].name,
          tipo: 'documento'
        }));

        await supabase
          .from("adjuntos")
          .insert(adjuntos);
      }
    }

    setMostrarModalResolucionManual(false);
    cargarDatos(); // Recargar

  } catch (error) {
    console.error("Error en resolución manual:", error);
    alert('Error al resolver la incidencia');
  } finally {
    setEnviando(false);
  }
};
```

#### **Función: resolverManualmenteConProveedor()**

**Ubicación**: [chat-proveedor/page.tsx](app/(app)/incidencias/[id]/chat-proveedor/page.tsx)

```typescript
const resolverManualmenteConProveedor = async (formulario: FormularioResolucionManual) => {
  if (!autorId || !incidencia) return;

  try {
    setEnviando(true);

    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData.user?.email;

    // 1. Obtener estados anteriores
    const estadoClienteAnterior = incidencia.estado_cliente;
    const estadoProveedorAnterior = estadoProveedor;

    // 2. Actualizar estado cliente
    await supabase
      .from("incidencias")
      .update({ estado_cliente: "Resuelta" })
      .eq("id", incidenciaId);

    // 3. Actualizar estado proveedor
    await supabase
      .from("proveedor_casos")
      .update({ estado_proveedor: "Resuelta" })
      .eq("incidencia_id", incidenciaId)
      .eq("activo", true);

    // 4. Registrar cambios de estado (cliente)
    await registrarCambioEstado({
      incidenciaId,
      tipoEstado: 'cliente',
      estadoAnterior: estadoClienteAnterior,
      estadoNuevo: 'Resuelta',
      autorId,
      motivo: 'Resolución manual por Control',
      metadatos: {
        accion: 'resolucion_manual_control'
      }
    });

    // 5. Registrar cambio de estado (proveedor)
    await registrarCambioEstado({
      incidenciaId,
      tipoEstado: 'proveedor',
      estadoAnterior: estadoProveedorAnterior,
      estadoNuevo: 'Resuelta',
      autorId,
      motivo: 'Resolución manual por Control',
      metadatos: {
        accion: 'resolucion_manual_control'
      }
    });

    // 6. Comentario en chat proveedor
    await supabase
      .from("comentarios")
      .insert({
        incidencia_id: incidenciaId,
        ambito: 'proveedor',
        autor_id: autorId,
        autor_email: userEmail,
        autor_rol: 'Control',
        cuerpo: `Control ha resuelto esta incidencia manualmente.

**Motivo:** ${formulario.descripcion}

${formulario.observaciones ? `**Observaciones:** ${formulario.observaciones}` : ''}`,
        es_sistema: true
      });

    // 7. Comentario en chat cliente
    await supabase
      .from("comentarios")
      .insert({
        incidencia_id: incidenciaId,
        ambito: 'cliente',
        autor_id: autorId,
        autor_email: userEmail,
        autor_rol: 'Control',
        cuerpo: `Incidencia resuelta por Control.

**Motivo:** ${formulario.descripcion}`,
        es_sistema: true
      });

    setMostrarModalResolucionManual(false);
    cargarDatos(); // Recargar

  } catch (error) {
    console.error("Error en resolución manual:", error);
    alert('Error al resolver la incidencia');
  } finally {
    setEnviando(false);
  }
};
```

---

### 4. Estados y Variables

#### **Chat Control-Cliente**

```typescript
// Añadir states
const [mostrarModalResolucionManual, setMostrarModalResolucionManual] = useState(false);

// En el return, añadir modal
<ModalResolucionManual
  isOpen={mostrarModalResolucionManual}
  onClose={() => setMostrarModalResolucionManual(false)}
  onSubmit={resolverManualmenteSinProveedor}
  tieneProveedor={false}
  enviando={enviando}
/>
```

#### **Chat Proveedor**

```typescript
// Añadir states
const [mostrarModalResolucionManual, setMostrarModalResolucionManual] = useState(false);

// Modificar handleEstadoChange
const handleEstadoChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
  const nuevoEstado = e.target.value;

  if (nuevoEstado === '__RESOLUCION_MANUAL__') {
    setMostrarModalResolucionManual(true);
    return;
  }

  // ... resto del código
};

// En el return, añadir modal
<ModalResolucionManual
  isOpen={mostrarModalResolucionManual}
  onClose={() => setMostrarModalResolucionManual(false)}
  onSubmit={resolverManualmenteConProveedor}
  tieneProveedor={true}
  enviando={enviando}
/>
```

---

### 5. Estructura de Archivos

```
/app/(app)/incidencias/[id]/
├── chat-control-cliente/
│   └── page.tsx              # Añadir botón + modal + función
├── chat-proveedor/
│   └── page.tsx              # Añadir opción en selector + modal + función
│
/components/
└── ModalResolucionManual.tsx # NUEVO componente modal

/lib/
└── historialEstados.ts       # Ya existe (usar registrarCambioEstado)
```

---

## 📊 Estructura de Datos

### Metadatos en historial_estados

**Sin Proveedor**:
```json
{
  "accion": "resolucion_manual",
  "proveedor_externo": "Fontanería García SL",
  "importe": 350.50,
  "num_documentos": 2
}
```

**Con Proveedor**:
```json
{
  "accion": "resolucion_manual_control"
}
```

### Comentario Sistema (Sin Proveedor)

```markdown
Incidencia resuelta manualmente por Control.

**Descripción:** Se reparó la fuga con proveedor externo

**Proveedor:** Fontanería García SL

**Importe:** 350.50€

**Documentos adjuntos:** 2
```

### Comentario Sistema (Con Proveedor - Chat Proveedor)

```markdown
Control ha resuelto esta incidencia manualmente.

**Motivo:** El proveedor completó el trabajo pero no pudo marcarlo como resuelto

**Observaciones:** Verificado en sitio el 15/01/2025
```

### Comentario Sistema (Con Proveedor - Chat Cliente)

```markdown
Incidencia resuelta por Control.

**Motivo:** El proveedor completó el trabajo pero no pudo marcarlo como resuelto
```

---

## ✅ Checklist de Implementación

### Fase 1: Componente Modal
- [ ] Crear `components/ModalResolucionManual.tsx`
- [ ] Implementar formulario con validaciones
- [ ] Añadir manejo de archivos múltiples
- [ ] Estilos con PALETA consistente

### Fase 2: Chat Control-Cliente (Sin Proveedor)
- [ ] Añadir botón "Resolver Manualmente" en Acciones de Control
- [ ] Condiciones: Sin proveedor + estados Abierta/En espera
- [ ] Implementar `resolverManualmenteSinProveedor()`
- [ ] Integrar modal
- [ ] Subida de documentos a storage
- [ ] Creación de comentario sistema
- [ ] Registro en historial_estados

### Fase 3: Chat Proveedor (Con Proveedor)
- [ ] Añadir opción en selector de estados (solo Control)
- [ ] Implementar `resolverManualmenteConProveedor()`
- [ ] Integrar modal
- [ ] Actualización dual de estados (cliente + proveedor)
- [ ] Doble comentario (chat proveedor + chat cliente)
- [ ] Registro doble en historial_estados

### Fase 4: Pruebas
- [ ] Test T-207: Resolución manual sin proveedor
- [ ] Test T-208: Resolución manual con proveedor
- [ ] Test T-209: Validación campos obligatorios
- [ ] Verificar permisos (solo Control)
- [ ] Verificar storage de documentos
- [ ] Verificar historial completo

### Fase 5: Documentación
- [ ] Actualizar CLAUDE.md con nueva funcionalidad
- [ ] Screenshots para manual de usuario
- [ ] Añadir a ROADMAP_PRODUCCION.md

---

## 🔍 Consideraciones Técnicas

### Permisos RLS Supabase
- Verificar que Control puede UPDATE en `incidencias.estado_cliente`
- Verificar que Control puede UPDATE en `proveedor_casos.estado_proveedor`
- Verificar INSERT en `comentarios` con `es_sistema=true`
- Verificar INSERT en `historial_estados`

### Storage
- Crear carpeta `incidencias/{num_solicitud}/resolucion_manual/`
- Verificar permisos de escritura para Control
- URLs firmadas para documentos adjuntos

### Performance
- Operaciones en paralelo cuando sea posible
- Transacciones para mantener consistencia
- Manejo de errores con rollback si falla algún paso

### UX
- Loading states claros durante proceso
- Confirmación visual después de resolver
- Scroll automático al comentario nuevo
- Refresh de datos después de resolver

---

## 🚀 Orden de Implementación Sugerido

1. **Día 1**: Crear `ModalResolucionManual.tsx` completo
2. **Día 2**: Implementar resolución sin proveedor (chat-control-cliente)
3. **Día 3**: Implementar resolución con proveedor (chat-proveedor)
4. **Día 4**: Pruebas completas + fixes
5. **Día 5**: Documentación + revisión final

---

## 📝 Notas Importantes

- **Solo Control** puede resolver manualmente
- **Sin proveedor**: No crea `proveedor_casos`
- **Con proveedor**: Mantiene `activo=true` (no anula)
- **Historial completo**: Siempre registrar en `historial_estados`
- **Comentarios sistema**: Usar `es_sistema=true` para distinguir
- **Documentos opcionales**: Pero recomendados (facturas, evidencias)

---

## 🐛 Testing

### Casos de Prueba Clave

```typescript
// Test 1: Sin proveedor - campos mínimos
{
  descripcion: "Resuelto por técnico interno",
  proveedor_externo: null,
  importe: null,
  documentos: []
}

// Test 2: Sin proveedor - campos completos
{
  descripcion: "Reparación de fuga",
  proveedor_externo: "Fontanería García",
  importe: 350.50,
  documentos: [factura.pdf, foto.jpg]
}

// Test 3: Con proveedor - mínimo
{
  descripcion: "Proveedor completó pero no marcó",
  observaciones: null,
  documentos: []
}

// Test 4: Con proveedor - completo
{
  descripcion: "Trabajo verificado en sitio",
  observaciones: "Cliente confirma resolución",
  documentos: [acta.pdf]
}
```

### Verificaciones Post-Resolución

```sql
-- Verificar estado cliente
SELECT estado_cliente FROM incidencias WHERE id = 'xxx';
-- Debe ser 'Resuelta'

-- Verificar estado proveedor (si tiene)
SELECT estado_proveedor, activo FROM proveedor_casos
WHERE incidencia_id = 'xxx' AND activo = true;
-- Debe ser 'Resuelta', activo = true

-- Verificar historial
SELECT * FROM historial_estados
WHERE incidencia_id = 'xxx'
ORDER BY cambiado_en DESC LIMIT 2;
-- Debe tener registro(s) reciente(s)

-- Verificar comentarios
SELECT cuerpo, es_sistema, ambito FROM comentarios
WHERE incidencia_id = 'xxx'
ORDER BY creado_en DESC LIMIT 2;
-- Debe tener comentario(s) sistema
```

---

## 📞 Soporte

Si hay dudas durante implementación:
1. Revisar casos de prueba T-207, T-208, T-209
2. Consultar RN-10 en INFORME_PRUEBAS_PRODUCCION.md
3. Ver CU-07 para flujo completo
4. Verificar implementación de anulación (similar)
