# 📋 INFORME COMPLETO DE CASUÍSTICAS - SISTEMA FMINCI

## Guía para Pruebas en Producción

---

## 📊 ESTADOS DEL SISTEMA

### Estados Cliente (vista Cliente/Control)
1. **Abierta** - Incidencia creada, sin proveedor
2. **En espera** - Pausada por Control
3. **En tramitación** - Proveedor asignado
4. **Resuelta** - Proveedor marcó como resuelta
5. **Cerrada** - Cliente/Control cerró la incidencia
6. **Anulada** - Control anuló la incidencia

### Estados Proveedor (vista Proveedor)
1. **Abierta** - Caso asignado, sin acción
2. **En resolución** - Proveedor trabajando
3. **Ofertada** - Presupuesto enviado
4. **Oferta aprobada** - Control aprobó presupuesto
5. **Oferta a revisar** - Control rechazó presupuesto
6. **Resuelta** - Proveedor finalizó trabajo
7. **Cerrada** - Caso cerrado
8. **Anulada** - Proveedor anulado por Control
9. **Valorada** - Cliente valoró el trabajo
10. **Pendiente valoración** - Esperando valoración

---

## 🔄 FLUJOS PRINCIPALES

### FLUJO 1: Incidencia Simple (Sin Presupuesto)

```
┌─────────────────────────────────────────────────────────────┐
│ CLIENTE/GESTOR                                              │
└─────────────────────────────────────────────────────────────┘
1. Crear incidencia
   → Estado: "Abierta"
   → Adjuntar imagen (opcional)
   → Especificar centro

┌─────────────────────────────────────────────────────────────┐
│ CONTROL                                                      │
└─────────────────────────────────────────────────────────────┘
2. Revisar incidencia
3. Asignar proveedor
   → Estado Cliente: "Abierta" → "En tramitación"
   → Estado Proveedor: "Abierta"
   → Prioridad: "Crítico" o "No crítico"
   → Descripción personalizada
   → Excluir imágenes (opcional)

┌─────────────────────────────────────────────────────────────┐
│ PROVEEDOR                                                    │
└─────────────────────────────────────────────────────────────┘
4. Ver notificación de nueva incidencia
5. Cambiar estado a "En resolución"
6. Programar visita en calendario (opcional)
7. Comentar en el chat
8. Marcar como "Resuelta"
   → Estado Proveedor: "En resolución" → "Resuelta"

┌─────────────────────────────────────────────────────────────┐
│ CONTROL                                                      │
└─────────────────────────────────────────────────────────────┘
9. Verificar resolución
10. Cambiar a "Cerrada"
    → Estado Cliente: "En tramitación" → "Cerrada"
    → Estado Proveedor: "Resuelta" → "Cerrada"
```

---

### FLUJO 2: Incidencia con Presupuesto

```
┌─────────────────────────────────────────────────────────────┐
│ CLIENTE/GESTOR                                              │
└─────────────────────────────────────────────────────────────┘
1. Crear incidencia
   → Estado: "Abierta"

┌─────────────────────────────────────────────────────────────┐
│ CONTROL                                                      │
└─────────────────────────────────────────────────────────────┘
2. Asignar proveedor
   → Estado Cliente: "Abierta" → "En tramitación"
   → Estado Proveedor: "Abierta"

┌─────────────────────────────────────────────────────────────┐
│ PROVEEDOR                                                    │
└─────────────────────────────────────────────────────────────┘
3. Cambiar a "En resolución"
4. Crear presupuesto:
   - Descripción del trabajo
   - Fecha estimada inicio
   - Duración estimada
   - Importe sin IVA
   - Adjuntar PDF (opcional)
5. Enviar presupuesto
   → Estado Proveedor: "En resolución" → "Ofertada"

┌─────────────────────────────────────────────────────────────┐
│ CONTROL                                                      │
└─────────────────────────────────────────────────────────────┘
6A. OPCIÓN A - Aprobar presupuesto:
    → Estado Proveedor: "Ofertada" → "Oferta aprobada"
    → Notificación al proveedor
    → Comentario automático en chat proveedor

6B. OPCIÓN B - Rechazar presupuesto:
    → Indicar motivo de rechazo
    → Estado Proveedor: "Ofertada" → "Oferta a revisar"
    → Notificación al proveedor con motivo
    → Comentario automático en chat proveedor

┌─────────────────────────────────────────────────────────────┐
│ PROVEEDOR (si rechazado)                                    │
└─────────────────────────────────────────────────────────────┘
7. Ver motivo de rechazo
8. Crear nuevo presupuesto mejorado
   → Estado Proveedor: "Oferta a revisar" → "Ofertada"
   → Volver al paso 6

┌─────────────────────────────────────────────────────────────┐
│ PROVEEDOR (después de aprobación)                           │
└─────────────────────────────────────────────────────────────┘
9. Realizar trabajo
10. Marcar como "Resuelta"
    → Estado Proveedor: "Oferta aprobada" → "Resuelta"

┌─────────────────────────────────────────────────────────────┐
│ CONTROL                                                      │
└─────────────────────────────────────────────────────────────┘
11. Cerrar incidencia
    → Estado Cliente: "En tramitación" → "Cerrada"
    → Estado Proveedor: "Resuelta" → "Cerrada"
```

---

### FLUJO 3: Anulación de Incidencia por Control

```
┌─────────────────────────────────────────────────────────────┐
│ CONTROL                                                      │
└─────────────────────────────────────────────────────────────┘

CASO A: Anular incidencia SIN proveedor
1. En estado "Abierta"
2. Clic en "Anular incidencia"
3. Indicar motivo
   → Estado Cliente: "Abierta" → "Anulada"
   → Comentario en chat cliente con motivo

CASO B: Anular incidencia CON proveedor activo
1. En estado "En tramitación"
2. Clic en "Anular incidencia"
3. Indicar motivo
   → Estado Cliente: "En tramitación" → "Anulada"
   → Estado Proveedor: (cualquiera) → "Anulada"
   → Proveedor_casos.activo = false
   → Comentario en chat cliente con motivo
   → Comentario en chat proveedor con motivo
   → Notificación al proveedor

Resultado:
- Incidencia visible para todos pero marcada "Anulada"
- Proveedor pierde acceso (activo=false)
- Aparece botón "Reasignar Proveedor" en Control
```

---

### FLUJO 4: Reasignación de Proveedor

```
┌─────────────────────────────────────────────────────────────┐
│ CONTROL                                                      │
└─────────────────────────────────────────────────────────────┘

REQUISITO: Incidencia con proveedor anterior anulado
1. Ver incidencia anulada
2. Clic en "Reasignar Proveedor"
3. Seleccionar nuevo proveedor
4. Opciones adicionales:
   - Descripción personalizada
   - Prioridad
   - Excluir imágenes
   - NUEVO: Incluir documentos del chat anterior
5. Confirmar reasignación
   → Estado Cliente: "Anulada" → "En tramitación"
   → Crear nuevo proveedor_casos con activo=true
   → Estado Proveedor: "Abierta"
   → Copiar documentos seleccionados al chat nuevo
   → Comentario en chat cliente: "Proveedor reasignado"

┌─────────────────────────────────────────────────────────────┐
│ NUEVO PROVEEDOR                                              │
└─────────────────────────────────────────────────────────────┐
6. Notificación de nueva asignación
7. Ver documentos compartidos (si aplica)
8. Continuar flujo normal
```

---

### FLUJO 5: Poner en Espera

```
┌─────────────────────────────────────────────────────────────┐
│ CONTROL                                                      │
└─────────────────────────────────────────────────────────────┘

REQUISITOS:
- Estado actual: "Abierta" (sin proveedor)
- NO puede tener proveedor asignado

1. Incidencia en estado "Abierta"
2. Clic en "Poner en espera"
3. Indicar motivo
   → Estado Cliente: "Abierta" → "En espera"
   → Comentario en chat cliente con motivo
   → Registro en historial de estados

Para reactivar:
4. Asignar proveedor
   → Estado Cliente: "En espera" → "En tramitación"
```

---

### FLUJO 6: Resolución Manual por Control (Sin Proveedor del Sistema)

```
┌─────────────────────────────────────────────────────────────┐
│ ESCENARIO                                                    │
└─────────────────────────────────────────────────────────────┘
Control resuelve la incidencia directamente porque:
- Usó proveedor externo (no registrado en sistema)
- Solucionó internamente
- No requiere proveedor

┌─────────────────────────────────────────────────────────────┐
│ CONTROL - OPCIÓN A: Desde Chat Cliente (sin proveedor)     │
└─────────────────────────────────────────────────────────────┘
REQUISITO: Incidencia "Abierta" o "En espera" SIN proveedor asignado

1. Abrir incidencia en estado "Abierta" o "En espera"
2. En "Acciones de Control", clic "Resolver Manualmente"
3. Modal solicita:
   - Motivo/descripción de resolución *
   - Proveedor externo (texto libre, opcional)
   - Importe (opcional)
   - Adjuntar documentos (facturas, fotos, opcional)
4. Confirmar
   → Estado Cliente: (actual) → "Resuelta"
   → Comentario sistema en chat cliente con detalles
   → Registro en historial_estados con metadatos
   → NO se crea proveedor_casos

5. Control puede luego cerrar:
   → Estado Cliente: "Resuelta" → "Cerrada"

┌─────────────────────────────────────────────────────────────┐
│ CONTROL - OPCIÓN B: Desde Chat Proveedor (con proveedor)   │
└─────────────────────────────────────────────────────────────┘
REQUISITO: Incidencia CON proveedor asignado

1. Abrir incidencia en chat proveedor
2. Selector de estado con opción "Resolver Manualmente"
3. Modal solicita:
   - Motivo de resolución manual *
   - Observaciones adicionales
   - Adjuntar documentos
4. Confirmar
   → Estado Proveedor: (actual) → "Resuelta"
   → Estado Cliente: (actual) → "Resuelta"
   → Comentario en chat proveedor (visible solo Control/Proveedor)
   → Comentario en chat cliente (visible Cliente/Gestor/Control)
   → Registro en historial_estados (ambos tipos)

5. Seguir flujo normal de cierre

┌─────────────────────────────────────────────────────────────┐
│ DIFERENCIAS CLAVE                                            │
└─────────────────────────────────────────────────────────────┘
SIN PROVEEDOR:
- No se crea registro en proveedor_casos
- Solo un comentario sistema en chat cliente
- Ideal para casos resueltos por terceros

CON PROVEEDOR:
- Proveedor_casos se mantiene activo
- Doble comentario (cliente + proveedor)
- Marca que Control resolvió en lugar del proveedor
```

---

## 🎯 CASOS DE USO ESPECÍFICOS

### CU-01: Chat Cliente/Control
**Actor**: Control, Cliente, Gestor
**Flujo**:
1. Acceder a incidencia
2. Ver mensajes de:
   - Control (fondo verde claro)
   - Cliente (fondo amarillo)
   - Gestor (fondo verde oscuro)
   - Sistema (fondo amarillo claro)
3. Enviar mensaje con:
   - Texto
   - Imagen adjunta (opcional)
   - Documento adjunto (opcional)
4. Ver adjuntos históricos
5. Scroll automático a último mensaje

**Validaciones**:
- Solo usuarios autorizados ven este chat
- Mensajes ordenados cronológicamente
- Adjuntos con URLs firmadas (4 horas)

---

### CU-02: Chat Proveedor
**Actor**: Control, Proveedor
**Flujo**:
1. Control accede vía "Cambiar al Chat Proveedor"
2. Proveedor accede desde su dashboard
3. Ver mensajes de:
   - Proveedor (fondo propio)
   - Control (fondo verde claro)
   - Sistema (fondo amarillo claro)
4. Enviar mensaje con adjuntos
5. Cambiar estados de proveedor
6. Crear presupuesto (solo Proveedor)

**Validaciones**:
- Solo proveedor activo tiene acceso
- Si activo=false, mensaje de error
- Presupuestos solo en estados correctos

---

### CU-03: Calendario de Visitas
**Actor**: Proveedor
**Flujo**:
1. Acceder a /calendario
2. Ver visitas programadas en calendario mensual
3. Crear nueva visita:
   - Seleccionar incidencia asignada
   - Elegir fecha
   - Elegir horario (mañana/tarde)
4. Cancelar visita existente
5. Clic en visita → ir al chat

**Validaciones**:
- Solo incidencias con proveedor_casos.activo=true
- Estados permitidos: Abierta, En resolución, Ofertada, Oferta aprobada, Resuelta, Valorada
- Cliente ve visitas de sus incidencias

---

### CU-04: Dashboard Control - Alertas
**Actor**: Control
**Flujo**:
1. Acceder a /control/alertas
2. Ver alertas categorizadas:

**ALERTA CRÍTICA**: Incidencias sin atender >4h
- Criterios:
  - estado_cliente: "Abierta" o "En espera"
  - creado_en < hace 4 horas
  - Sin comentarios recientes (últimas 4h)
- Color: Rojo
- Prioridad: Alta

**ALERTA PROVEEDOR**: Sin respuesta >24h
- Criterios:
  - proveedor_casos.activo = true
  - estado_proveedor: "Abierta"
  - asignado_en < hace 24 horas
  - Sin comentarios del proveedor desde asignación
- Color: Púrpura
- Prioridad: Media

**ALERTA SLA**: Próximo a vencer (48h)
- Criterios:
  - estado_cliente: "Abierta", "En espera", "En tramitación"
  - creado_en < hace 40 horas (8h antes de vencer)
- Color: Naranja
- Prioridad: Alta

3. Filtrar por tipo de alerta
4. Clic en alerta → ir a chat de incidencia

---

### CU-05: Gestión de Presupuestos (Control)
**Actor**: Control
**Flujo**:
1. Acceder a /control/presupuestos
2. Ver lista de presupuestos pendientes
3. Filtros disponibles:
   - Estado: pendiente_revision, aprobado, rechazado
   - Proveedor
   - Número de solicitud
4. Ver detalle de presupuesto:
   - Información proveedor
   - Importe sin IVA
   - Fecha/duración estimada
   - Descripción trabajo
   - Documento adjunto (PDF)
5A. Aprobar:
    - Cambiar estado a "aprobado"
    - Actualizar proveedor_casos a "Oferta aprobada"
    - Notificar proveedor
5B. Rechazar:
    - Indicar motivo detallado
    - Cambiar estado a "rechazado"
    - Actualizar proveedor_casos a "Oferta a revisar"
    - Notificar proveedor con motivo

**Validaciones**:
- Solo Control puede aprobar/rechazar
- Motivo obligatorio al rechazar
- Historial de estados actualizado

---

### CU-06: Notificaciones Proveedor
**Actor**: Proveedor
**Flujo**:
1. Sistema detecta:
   - Nueva asignación → tipo: "nueva_asignacion"
   - Presupuesto rechazado → tipo: "revision"
2. Crear registro en proveedor_notificaciones:
   - proveedor_id
   - incidencia_id
   - tipo_notificacion
   - notificacion_vista: false
3. Proveedor ve badge rojo en dashboard
4. Proveedor accede a incidencia
5. Al entrar al chat:
   - notificacion_vista = true
   - Badge desaparece

**Tipos de notificación**:
- `nueva_asignacion`: Control asignó incidencia
- `revision`: Control rechazó presupuesto
- `aprobacion`: Control aprobó presupuesto (futuro)

---

### CU-07: Resolución Manual por Control
**Actor**: Control
**Flujo**:

**Escenario A - Sin Proveedor**:
1. Acceder a incidencia "Abierta" o "En espera" sin proveedor
2. En sección "Acciones de Control", clic "Resolver Manualmente"
3. Modal muestra formulario:
   - **Descripción de resolución** * (textarea)
   - **Proveedor externo** (texto libre, opcional)
   - **Importe** (número, opcional)
   - **Adjuntar documentos** (facturas, fotos, opcional)
4. Completar y confirmar
5. Sistema ejecuta:
   - Actualizar incidencias.estado_cliente → "Resuelta"
   - Subir documentos a storage (si hay)
   - Crear comentario sistema en chat cliente:
     ```
     "Incidencia resuelta manualmente por Control.

     Motivo: [descripción]
     Proveedor: [proveedor_externo o "No especificado"]
     Importe: [importe o "No especificado"]

     [Enlaces a documentos adjuntos]"
     ```
   - Registrar en historial_estados:
     - tipo_estado: "cliente"
     - estado_anterior → estado_nuevo: "Resuelta"
     - metadatos: { accion: "resolucion_manual", proveedor_externo, importe }
6. Redirigir al chat actualizado

**Escenario B - Con Proveedor**:
1. Acceder a incidencia con proveedor en chat proveedor
2. Selector de estado muestra opción "Resolver Manualmente (Control)"
3. Seleccionar → Modal muestra:
   - **Motivo de resolución** * (textarea)
   - **Observaciones** (textarea, opcional)
   - **Adjuntar documentos** (opcional)
4. Confirmar
5. Sistema ejecuta:
   - Actualizar incidencias.estado_cliente → "Resuelta"
   - Actualizar proveedor_casos.estado_proveedor → "Resuelta" (donde activo=true)
   - Crear comentario en chat proveedor (ámbito: "proveedor"):
     ```
     "Control ha resuelto esta incidencia manualmente.

     Motivo: [motivo]
     Observaciones: [observaciones o "-"]"
     ```
   - Crear comentario en chat cliente (ámbito: "cliente"):
     ```
     "Incidencia resuelta por Control.

     Motivo: [motivo]"
     ```
   - Registrar 2 cambios en historial_estados:
     - tipo_estado: "cliente" (estado → "Resuelta")
     - tipo_estado: "proveedor" (estado → "Resuelta")
     - metadatos: { accion: "resolucion_manual_control" }

**Validaciones**:
- Motivo obligatorio en ambos escenarios
- Solo Control puede usar esta función
- Documentos opcionales pero recomendados
- Historial completo de cambios

---

## ⚠️ RESTRICCIONES Y REGLAS DE NEGOCIO

### RN-01: Estados Cliente
- **Abierta** → Solo puede ir a: "En espera", "En tramitación" (con proveedor), "Resuelta" (resolución manual), "Anulada"
- **En espera** → Solo puede ir a: "En tramitación" (asignar proveedor), "Resuelta" (resolución manual), "Anulada"
- **En tramitación** → Solo puede ir a: "Resuelta" (proveedor o manual), "Cerrada" (control), "Anulada"
- **Resuelta** → Solo puede ir a: "Cerrada"
- **Cerrada** → Estado final (no cambia)
- **Anulada** → Solo puede ir a: "En tramitación" (reasignar)

### RN-02: Estados Proveedor
- **Abierta** → "En resolución", "Anulada"
- **En resolución** → "Ofertada" (con presupuesto), "Resuelta", "Anulada"
- **Ofertada** → "Oferta aprobada", "Oferta a revisar"
- **Oferta aprobada** → "Resuelta"
- **Oferta a revisar** → "Ofertada" (nuevo presupuesto)
- **Resuelta** → "Cerrada", "Pendiente valoración"
- **Cerrada** → Estado final
- **Anulada** → No cambia (proveedor pierde acceso)

### RN-03: Prioridades
- **Cliente**: Urgente, Crítico, Normal (no usado actualmente)
- **Proveedor**: Crítico, No crítico (asignado por Control)

### RN-04: Acceso a Incidencias
- **Control**: Ve todas las incidencias
- **Gestor con acceso_todos_centros=true**: Ve todas
- **Gestor/Cliente normal**: Solo de sus instituciones (via personas_instituciones)
- **Proveedor**: Solo donde proveedor_casos.activo=true

### RN-05: Proveedor Activo/Inactivo
- `proveedor_casos.activo = true`: Acceso total al chat y cambios de estado
- `proveedor_casos.activo = false`: Sin acceso (caso anulado)
- Un proveedor anulado NO puede ser reactivado, solo reasignado

### RN-06: Presupuestos
- Solo Proveedor puede crear presupuestos
- Solo en estados: "En resolución", "Oferta a revisar"
- Campos obligatorios: descripción, fecha_inicio, duración, importe
- PDF opcional pero recomendado
- Control puede aprobar/rechazar
- Motivo obligatorio al rechazar

### RN-07: Comentarios
- **Ámbito "cliente"**: Visible para Cliente, Gestor, Control
- **Ámbito "proveedor"**: Visible para Proveedor y Control
- **Ámbito "ambos"**: Visible para todos (no usado actualmente)
- `es_sistema=true`: Mensajes automáticos del sistema

### RN-08: Adjuntos e Imágenes
- Imagen principal: Mostrada en datos técnicos
- Imágenes/documentos de comentarios: En el chat
- Storage: bucket "incidencias" con estructura:
  - `incidencias/{num_solicitud}/imagenes/`
  - `incidencias/{num_solicitud}/comentarios/`
  - `incidencias/{num_solicitud}/presupuestos/`
- URLs firmadas con expiración de 4 horas

### RN-09: Calendario
- Solo Proveedor puede crear/cancelar visitas
- Cliente/Gestor solo visualizan
- Estados permitidos para visitas: ver CU-03
- Horarios: "mañana" o "tarde" (no horas específicas)

### RN-10: Resolución Manual por Control
- **Sin proveedor**: Disponible en estados "Abierta" o "En espera"
- **Con proveedor**: Disponible desde chat proveedor en cualquier estado activo
- Campos obligatorios: Motivo/descripción
- Campos opcionales: Proveedor externo, importe, documentos
- Genera comentario sistema automático
- Actualiza historial_estados con metadatos:
  - `accion: "resolucion_manual"`
  - `proveedor_externo: "..."` (si aplica)
  - `importe: 123.45` (si aplica)
- Sin proveedor: NO crea proveedor_casos
- Con proveedor: Mantiene proveedor_casos.activo=true

---

## 🧪 MATRIZ DE PRUEBAS

### Módulo: Creación de Incidencias

| ID | Caso de Prueba | Rol | Pasos | Resultado Esperado |
|----|---------------|-----|-------|-------------------|
| T-001 | Crear incidencia básica | Cliente | 1. Login<br>2. Nueva incidencia<br>3. Rellenar datos<br>4. Enviar | Incidencia creada con estado "Abierta" |
| T-002 | Crear con imagen | Cliente | 1. Nueva incidencia<br>2. Adjuntar imagen<br>3. Enviar | Incidencia con imagen visible en datos técnicos |
| T-003 | Validar campos obligatorios | Cliente | 1. Nueva incidencia<br>2. Enviar vacío | Error: campos obligatorios |
| T-004 | Cliente multicentro | Gestor | 1. Login (gestor multicentro)<br>2. Nueva incidencia<br>3. Ver selector de centro | Lista de centros disponibles |

### Módulo: Asignación de Proveedor

| ID | Caso de Prueba | Rol | Pasos | Resultado Esperado |
|----|---------------|-----|-------|-------------------|
| T-101 | Asignar proveedor básico | Control | 1. Abrir incidencia "Abierta"<br>2. Clic "Asignar Proveedor"<br>3. Seleccionar proveedor y prioridad<br>4. Enviar | Estado cliente → "En tramitación"<br>Estado proveedor → "Abierta"<br>Notificación al proveedor |
| T-102 | Excluir imágenes | Control | 1. Asignar proveedor<br>2. Marcar imagen para excluir<br>3. Enviar | Imagen marcada con visible_proveedor=false<br>Proveedor no ve imagen |
| T-103 | Reasignar con documentos | Control | 1. Abrir incidencia anulada<br>2. "Reasignar Proveedor"<br>3. Seleccionar documentos<br>4. Enviar | Documentos copiados al chat nuevo proveedor |
| T-104 | Validar proveedor inactivo | Control | 1. Intentar asignar proveedor desactivado | No aparece en lista |

### Módulo: Estados y Transiciones

| ID | Caso de Prueba | Rol | Pasos | Resultado Esperado |
|----|---------------|-----|-------|-------------------|
| T-201 | Poner en espera | Control | 1. Incidencia "Abierta" sin proveedor<br>2. "Poner en espera"<br>3. Indicar motivo | Estado → "En espera"<br>Comentario con motivo |
| T-202 | Anular sin proveedor | Control | 1. Incidencia "Abierta"<br>2. "Anular"<br>3. Indicar motivo | Estado → "Anulada"<br>Comentario en chat cliente |
| T-203 | Anular con proveedor | Control | 1. Incidencia "En tramitación"<br>2. "Anular"<br>3. Indicar motivo | Estado cliente → "Anulada"<br>Estado proveedor → "Anulada"<br>activo=false<br>Comentarios en ambos chats |
| T-204 | Proveedor a resolución | Proveedor | 1. Abrir incidencia "Abierta"<br>2. Cambiar estado<br>3. Seleccionar "En resolución" | Estado proveedor → "En resolución" |
| T-205 | Resolver sin presupuesto | Proveedor | 1. Incidencia "En resolución"<br>2. Cambiar a "Resuelta" | Estado proveedor → "Resuelta" |
| T-206 | Cerrar incidencia | Control | 1. Incidencia "Resuelta"<br>2. Cambiar a "Cerrada" | Estado cliente → "Cerrada"<br>Estado proveedor → "Cerrada" |
| T-207 | **Resolución manual sin proveedor** | Control | 1. Incidencia "Abierta" sin proveedor<br>2. "Resolver Manualmente"<br>3. Motivo + proveedor externo + importe<br>4. Adjuntar factura<br>5. Confirmar | Estado cliente → "Resuelta"<br>Comentario sistema con detalles<br>NO crea proveedor_casos<br>Historial con metadatos |
| T-208 | **Resolución manual con proveedor** | Control | 1. Incidencia "En tramitación"<br>2. Chat proveedor<br>3. "Resolver Manualmente"<br>4. Indicar motivo<br>5. Confirmar | Estado cliente → "Resuelta"<br>Estado proveedor → "Resuelta"<br>Doble comentario<br>Proveedor_casos activo=true |
| T-209 | **Validar campos obligatorios resolución** | Control | 1. "Resolver Manualmente"<br>2. Dejar motivo vacío<br>3. Confirmar | Error: motivo obligatorio |

### Módulo: Presupuestos

| ID | Caso de Prueba | Rol | Pasos | Resultado Esperado |
|----|---------------|-----|-------|-------------------|
| T-301 | Crear presupuesto | Proveedor | 1. Incidencia "En resolución"<br>2. "Crear Presupuesto"<br>3. Rellenar datos<br>4. Adjuntar PDF<br>5. Enviar | Estado → "Ofertada"<br>Presupuesto estado "pendiente_revision" |
| T-302 | Aprobar presupuesto | Control | 1. /control/presupuestos<br>2. Ver detalle<br>3. "Aprobar" | Estado presupuesto → "aprobado"<br>Estado proveedor → "Oferta aprobada"<br>Notificación proveedor |
| T-303 | Rechazar presupuesto | Control | 1. Ver presupuesto<br>2. "Mandar a revisar"<br>3. Indicar motivo<br>4. Enviar | Estado presupuesto → "rechazado"<br>Estado proveedor → "Oferta a revisar"<br>Notificación con motivo |
| T-304 | Reenviar presupuesto | Proveedor | 1. Ver notificación rechazo<br>2. Ver motivo<br>3. Crear nuevo presupuesto<br>4. Enviar | Estado proveedor → "Ofertada"<br>Nuevo presupuesto "pendiente_revision" |
| T-305 | Validar campos obligatorios | Proveedor | 1. Crear presupuesto<br>2. Dejar campos vacíos<br>3. Enviar | Error: campos obligatorios |

### Módulo: Chats y Comentarios

| ID | Caso de Prueba | Rol | Pasos | Resultado Esperado |
|----|---------------|-----|-------|-------------------|
| T-401 | Comentar en chat cliente | Cliente | 1. Abrir incidencia<br>2. Escribir mensaje<br>3. Enviar | Mensaje visible para Cliente/Gestor/Control<br>No visible para Proveedor |
| T-402 | Comentar con imagen | Control | 1. Chat cliente<br>2. Adjuntar imagen<br>3. Escribir mensaje<br>4. Enviar | Mensaje con imagen visible<br>URL firmada válida |
| T-403 | Comentar con documento | Proveedor | 1. Chat proveedor<br>2. Adjuntar PDF<br>3. Enviar | Documento descargable con URL firmada |
| T-404 | Ver solo chat autorizado | Cliente | 1. Intentar acceder chat proveedor | Error: sin permisos |
| T-405 | Comentarios del sistema | Sistema | 1. Asignar proveedor<br>2. Ver chat cliente | Comentario amarillo: "Proveedor asignado a..." |
| T-406 | Scroll a último mensaje | Cualquiera | 1. Chat con >10 mensajes<br>2. Clic botón scroll | Vista se mueve al último mensaje |

### Módulo: Calendario

| ID | Caso de Prueba | Rol | Pasos | Resultado Esperado |
|----|---------------|-----|-------|-------------------|
| T-501 | Crear visita | Proveedor | 1. /calendario<br>2. "Nueva Visita"<br>3. Seleccionar incidencia<br>4. Fecha y horario<br>5. Crear | Visita aparece en calendario<br>Estado "programada" |
| T-502 | Cancelar visita | Proveedor | 1. Clic en visita<br>2. "Cancelar"<br>3. Confirmar | Estado visita → "cancelada"<br>Desaparece de calendario |
| T-503 | Cliente ve visitas | Cliente | 1. /calendario<br>2. Ver mes actual | Solo visitas de sus incidencias<br>Sin botón "Nueva Visita" |
| T-504 | Navegar a chat desde visita | Proveedor | 1. Clic en visita en calendario | Redirige al chat correcto |
| T-505 | Validar estados permitidos | Proveedor | 1. "Nueva Visita"<br>2. Ver lista incidencias | Solo aparecen incidencias activas en estados permitidos |

### Módulo: Alertas

| ID | Caso de Prueba | Rol | Pasos | Resultado Esperado |
|----|---------------|-----|-------|-------------------|
| T-601 | Alerta crítica >4h | Control | 1. Crear incidencia<br>2. Esperar 4h sin comentar<br>3. /control/alertas | Alerta tipo "crítica" aparece |
| T-602 | Alerta proveedor >24h | Control | 1. Asignar proveedor<br>2. Esperar 24h sin respuesta<br>3. Ver alertas | Alerta tipo "proveedor" aparece |
| T-603 | Alerta SLA próximo | Control | 1. Incidencia >40h sin cerrar<br>2. Ver alertas | Alerta tipo "sla" aparece |
| T-604 | Filtrar alertas | Control | 1. /control/alertas<br>2. Filtro "Críticas" | Solo alertas críticas visibles |
| T-605 | Navegar desde alerta | Control | 1. Clic en alerta<br>2. Ver incidencia | Redirige al chat correcto |

### Módulo: Notificaciones

| ID | Caso de Prueba | Rol | Pasos | Resultado Esperado |
|----|---------------|-----|-------|-------------------|
| T-701 | Notificación nueva asignación | Proveedor | 1. Control asigna incidencia<br>2. Proveedor hace login | Badge rojo en dashboard<br>Número de notificaciones |
| T-702 | Marcar notificación vista | Proveedor | 1. Clic en incidencia notificada<br>2. Entrar al chat | Badge desaparece<br>notificacion_vista=true |
| T-703 | Notificación rechazo presupuesto | Proveedor | 1. Control rechaza presupuesto<br>2. Ver dashboard | Notificación tipo "revision"<br>Badge visible |
| T-704 | Múltiples notificaciones | Proveedor | 1. 3 asignaciones nuevas<br>2. Ver dashboard | Badge muestra "3"<br>Lista de incidencias |

### Módulo: Gestión de Proveedores/Centros

| ID | Caso de Prueba | Rol | Pasos | Resultado Esperado |
|----|---------------|-----|-------|-------------------|
| T-801 | Crear proveedor | Control | 1. /control/proveedores<br>2. "Nuevo Proveedor"<br>3. Rellenar datos<br>4. Crear | Proveedor creado activo=true |
| T-802 | Desactivar proveedor | Control | 1. Proveedor activo<br>2. "Desactivar" | activo=false<br>No aparece en listas |
| T-803 | Ver métricas proveedor | Control | 1. Lista proveedores<br>2. Ver tarjeta | Métricas: total casos, % éxito, días promedio, valoración |
| T-804 | Crear centro | Control | 1. /control/centros<br>2. "Nuevo Centro"<br>3. Rellenar<br>4. Crear | Centro creado con tipo correcto |
| T-805 | Ver estadísticas centro | Control | 1. Lista centros<br>2. Ver tarjeta | Estadísticas: total, abiertas, cerradas, días promedio |

### Módulo: Filtros y Búsquedas

| ID | Caso de Prueba | Rol | Pasos | Resultado Esperado |
|----|---------------|-----|-------|-------------------|
| T-901 | Filtrar por estado cliente | Control | 1. /incidencias<br>2. Filtro "Estado Cliente: Abierta" | Solo incidencias "Abierta" visibles |
| T-902 | Filtrar por proveedor | Control | 1. Filtro "Proveedor: X"<br>2. Aplicar | Solo incidencias de ese proveedor |
| T-903 | Buscar por número | Control | 1. Input búsqueda<br>2. Escribir "INC-123" | Solo INC-123 visible |
| T-904 | Filtros combinados | Control | 1. Estado + Proveedor + Búsqueda | Resultado intersección de filtros |
| T-905 | Limpiar filtros | Control | 1. Aplicar varios filtros<br>2. "Limpiar filtros" | Todos los filtros resetean |

### Módulo: Permisos y Accesos

| ID | Caso de Prueba | Rol | Pasos | Resultado Esperado |
|----|---------------|-----|-------|-------------------|
| T-1001 | Control ve todo | Control | 1. Login<br>2. /incidencias | Todas las incidencias visibles |
| T-1002 | Gestor normal | Gestor | 1. Login (sin acceso_todos_centros)<br>2. Ver incidencias | Solo de sus instituciones |
| T-1003 | Gestor total | Gestor | 1. Login (acceso_todos_centros=true)<br>2. Ver incidencias | Todas las incidencias |
| T-1004 | Proveedor solo activos | Proveedor | 1. Login<br>2. Ver incidencias | Solo donde activo=true |
| T-1005 | Cliente sin acceso proveedor | Cliente | 1. URL chat-proveedor<br>2. Intentar acceder | Redirige o error 403 |

### Módulo: Historial de Estados

| ID | Caso de Prueba | Rol | Pasos | Resultado Esperado |
|----|---------------|-----|-------|-------------------|
| T-1101 | Registrar cambio estado | Sistema | 1. Cambiar cualquier estado<br>2. Verificar BD | Registro en historial_estados con autor, motivo, metadatos |
| T-1102 | Ver historial completo | Control | 1. Incidencia con cambios<br>2. Ver historial (futuro) | Lista cronológica de cambios |
| T-1103 | Historial cliente vs proveedor | Sistema | 1. Cambiar estado cliente<br>2. Cambiar estado proveedor<br>3. Ver BD | Dos registros diferentes con tipo_estado correcto |

---

## 🚨 CASOS EXTREMOS Y ERRORES

### Error E-001: Proveedor Anulado Intenta Acceder
**Escenario**: Proveedor tiene activo=false
**Esperado**: Mensaje "Esta incidencia ha sido anulada. No puedes realizar cambios."
**Test**: T-1004 variante

### Error E-002: Doble Asignación
**Escenario**: Intentar asignar proveedor a incidencia que ya tiene uno activo
**Esperado**: Actualizar caso existente, no crear duplicado
**Test**: Verificar BD después de reasignar

### Error E-003: URL Firmada Expirada
**Escenario**: Intentar ver imagen después de 4 horas
**Esperado**: Regenerar URL firmada automáticamente
**Test**: Verificar función getSignedImageUrl()

### Error E-004: Presupuesto en Estado Incorrecto
**Escenario**: Proveedor intenta crear presupuesto en estado "Abierta"
**Esperado**: Botón "Crear Presupuesto" no visible
**Test**: T-301 variante negativa

### Error E-005: Transición de Estado Inválida
**Escenario**: Intentar cambiar "Cerrada" a "Abierta"
**Esperado**: Estados finales no permiten cambios
**Test**: Validar RN-01

### Error E-006: Usuario Sin Institución
**Escenario**: Persona sin registro en personas_instituciones
**Esperado**: Ver solo incidencias propias o error
**Test**: Crear usuario sin instituciones

### Error E-007: Imagen No Encontrada en Storage
**Escenario**: storage_key apunta a archivo inexistente
**Esperado**: Búsqueda fallback por nombre de archivo
**Test**: Verificar función getSignedImageUrl con path incorrecto

### Error E-008: Múltiples Presupuestos Pendientes
**Escenario**: Proveedor envía 2 presupuestos sin esperar aprobación
**Esperado**: Control ve ambos, puede aprobar el último
**Test**: Verificar lógica de presupuestos múltiples

---

## 📝 CHECKLIST DE PRUEBAS PRODUCCIÓN

### Pre-Producción
- [ ] Crear usuarios de prueba (1 de cada rol)
- [ ] Crear instituciones de prueba (centros y proveedores)
- [ ] Verificar configuración de storage (bucket "incidencias")
- [ ] Verificar RLS policies en Supabase
- [ ] Backup de base de datos

### Pruebas Básicas (Obligatorias)
- [ ] T-001: Crear incidencia
- [ ] T-101: Asignar proveedor
- [ ] T-301: Crear presupuesto
- [ ] T-302: Aprobar presupuesto
- [ ] T-401: Comentar en chat
- [ ] T-501: Crear visita calendario
- [ ] T-203: Anular con proveedor
- [ ] T-103: Reasignar proveedor
- [ ] **T-207: Resolución manual sin proveedor** (NUEVO)
- [ ] **T-208: Resolución manual con proveedor** (NUEVO)

### Pruebas de Estados (Críticas)
- [ ] T-201 a T-206: Todas las transiciones
- [ ] Validar RN-01 y RN-02 completas
- [ ] Verificar historial_estados se registra

### Pruebas de Permisos (Seguridad)
- [ ] T-1001 a T-1005: Todos los roles
- [ ] Verificar RLS en Supabase
- [ ] Intentar accesos no autorizados

### Pruebas de Notificaciones
- [ ] T-701 a T-704: Todas las notificaciones
- [ ] Verificar badges se actualizan
- [ ] Verificar emails (si implementado)

### Pruebas de Errores
- [ ] E-001 a E-008: Todos los casos extremos
- [ ] Validar mensajes de error claros
- [ ] Verificar rollback en errores

### Post-Producción
- [ ] Monitorizar logs primeras 24h
- [ ] Verificar alertas SLA funcionan
- [ ] Revisar performance de queries
- [ ] Feedback de usuarios

---

## 📊 MÉTRICAS A MONITORIZAR

1. **Tiempo de Respuesta**
   - Tiempo medio entre creación y asignación
   - Tiempo medio entre asignación y primera respuesta proveedor
   - Tiempo medio de resolución total

2. **Estados**
   - % incidencias en cada estado
   - Tasa de anulación
   - Tasa de reasignación

3. **Presupuestos**
   - % aprobación vs rechazo
   - Tiempo medio de aprobación
   - Número de revisiones promedio

4. **Alertas**
   - Número de alertas críticas por día
   - Tiempo medio de respuesta a alertas
   - % alertas SLA que vencen

5. **Calidad**
   - Errores en logs
   - Fallos de storage/URLs firmadas
   - Tiempos de carga (>3s)

---

## 🔧 DATOS DE PRUEBA SUGERIDOS

### Usuarios
```sql
-- Control
email: control.test@fminci.com
rol: Control

-- Gestor (multicentro)
email: gestor.test@fminci.com
rol: Gestor
acceso_todos_centros: true

-- Gestor (centro específico)
email: gestor.centro1@fminci.com
rol: Gestor
acceso_todos_centros: false
instituciones: [Centro 1]

-- Cliente
email: cliente.test@fminci.com
rol: Cliente
instituciones: [Centro 1]

-- Proveedor
email: proveedor.test@fminci.com
rol: Proveedor
instituciones: [Proveedor Test]
```

### Instituciones
```sql
-- Centro 1
nombre: "Centro Gent Gran Barcelona"
tipo: "Centro"
activo: true

-- Centro 2
nombre: "Centro Gent Gran Madrid"
tipo: "Centro"
activo: true

-- Proveedor Test
nombre: "Mantenimientos Test SL"
tipo: "Proveedor"
activo: true
especialidades: ["Fontanería", "Electricidad"]
```

### Incidencias de Prueba

**INC-001: Básica sin proveedor**
- Estado: Abierta
- Centro: Centro 1
- Descripción: "Fuga de agua en baño planta 2"

**INC-002: Con proveedor asignado**
- Estado Cliente: En tramitación
- Estado Proveedor: Abierta
- Proveedor: Proveedor Test
- Prioridad: Crítico

**INC-003: Con presupuesto pendiente**
- Estado Cliente: En tramitación
- Estado Proveedor: Ofertada
- Presupuesto: 350€, pendiente_revision

**INC-004: Anulada para reasignación**
- Estado Cliente: Anulada
- Estado Proveedor: Anulada
- proveedor_casos.activo: false

**INC-005: En espera**
- Estado Cliente: En espera
- Sin proveedor
- Motivo: "Esperando confirmación del centro"

---

## ✅ FIRMA DE VALIDACIÓN

**Probado por**: _______________
**Fecha**: _______________
**Versión**: _______________
**Resultado**: ⬜ APROBADO  ⬜ RECHAZADO

**Incidencias encontradas**:
1. _______________
2. _______________
3. _______________

**Notas adicionales**:
_______________________________________________
_______________________________________________
_______________________________________________
