# Plan de Pruebas Completo - FMINCI

## Resumen Ejecutivo

Este documento detalla **todas las casuísticas** del sistema de gestión de incidencias FMINCI para realizar pruebas exhaustivas antes de su puesta en producción.

**Fases:**
1. ✅ Pruebas en local (`localhost:3000`)
2. ⏳ Volcado de datos de Wix a Supabase (noche previa)
3. ⏳ Pruebas en producción (ambiente real)
4. ⏳ Apertura al público

---

## Estados del Sistema

### Estados Cliente (`estado_cliente`)
- **Abierta** - Incidencia recién creada
- **En espera** - Pausada temporalmente por Control
- **En tramitación** - Proveedor asignado y trabajando
- **Resuelta** - Proveedor ha resuelto, pendiente de validación
- **Cerrada** - Finalizada y validada por Control
- **Anulada** - Cancelada por Control

### Estados Proveedor (`estado_proveedor`)
- **Abierta** - Asignada al proveedor
- **Ofertada** - Proveedor envió presupuesto
- **Oferta aprobada** - Control aprobó presupuesto
- **En resolución** - Proveedor trabajando en la solución
- **Resuelta** - Proveedor resolvió técnicamente
- **Valorada** - Proveedor añadió valoración económica
- **Cerrada** - Finalizada
- **Anulada** - Asignación anulada por Control

---

## Estructura de Pruebas por Rol

### 1. ROL: CONTROL (Admin)

#### 1.1 Gestión de Incidencias Nuevas

**Caso 1.1.1: Crear nueva incidencia**
- [ ] Ir a `/incidencias/nueva`
- [ ] Rellenar formulario completo:
  - Centro: Seleccionar institución existente
  - Email de contacto
  - Descripción detallada
  - Catalogación (opcional)
  - Prioridad
  - Adjuntar archivos (probar con imágenes y PDFs)
- [ ] Verificar que se crea con `estado_cliente = "Abierta"`
- [ ] Verificar que aparece en el dashboard
- [ ] Verificar que se genera `num_solicitud` único

**Caso 1.1.2: Ver incidencia sin proveedor asignado**
- [ ] Abrir incidencia recién creada en `/incidencias/[id]/chat-control-cliente`
- [ ] Verificar que muestra datos correctos
- [ ] Verificar que el botón "Asignar Proveedor" está visible
- [ ] Verificar que el botón "Poner en Espera" está visible
- [ ] Verificar que NO aparece botón "Anular Asignación"

#### 1.2 Asignación de Proveedores

**Caso 1.2.1: Asignar proveedor a incidencia nueva**
- [ ] Click en "Asignar Proveedor"
- [ ] Seleccionar proveedor del dropdown
- [ ] Establecer prioridad (Alta/Media/Baja)
- [ ] Añadir descripción para el proveedor
- [ ] Confirmar asignación
- [ ] Verificar que:
  - Se crea registro en `proveedor_casos` con `activo=true`
  - `estado_cliente` pasa a "En tramitación"
  - `estado_proveedor` es "Abierta"
  - Se crea comentario del sistema
  - Se registra en `historial_estados`
  - El proveedor recibe notificación

**Caso 1.2.2: Ver incidencia con proveedor asignado**
- [ ] Abrir incidencia con proveedor asignado
- [ ] Verificar que muestra información del proveedor actual
- [ ] Verificar que el botón "Asignar Proveedor" ya NO está visible
- [ ] Verificar que el botón "Anular Asignación" SÍ está visible
- [ ] Verificar que puede ver comentarios del ámbito "proveedor"

#### 1.3 Anulación y Reasignación

**Caso 1.3.1: Anular asignación de proveedor**
- [ ] Abrir incidencia con proveedor asignado
- [ ] Click en "Anular Asignación"
- [ ] Escribir motivo de anulación
- [ ] Confirmar anulación
- [ ] Verificar que:
  - `proveedor_casos.activo` pasa a `false`
  - `proveedor_casos.estado_proveedor` pasa a "Anulada"
  - `estado_cliente` pasa a "En espera"
  - Se crea comentario del sistema con el motivo
  - Se registra en `historial_estados`
  - El proveedor deja de ver la incidencia en su lista

**Caso 1.3.2: Reasignar a nuevo proveedor después de anular**
- [ ] Después de anular, verificar que botón "Asignar Proveedor" vuelve a aparecer
- [ ] Asignar a un proveedor diferente
- [ ] Verificar que:
  - Se crea nuevo registro en `proveedor_casos` con `activo=true`
  - El caso anterior mantiene `activo=false` y `estado_proveedor="Anulada"`
  - El nuevo proveedor NO ve comentarios del proveedor anterior
  - Control SÍ puede ver historial completo si lo necesita
  - Los comentarios nuevos se vinculan al nuevo `proveedor_caso_id`

**Caso 1.3.3: Múltiples reasignaciones (3+ proveedores)**
- [ ] Crear incidencia
- [ ] Asignar a Proveedor A → Anular
- [ ] Asignar a Proveedor B → Anular
- [ ] Asignar a Proveedor C
- [ ] Verificar que:
  - Solo el caso de Proveedor C tiene `activo=true`
  - Los casos de A y B tienen `activo=false`
  - Solo Proveedor C ve la incidencia
  - Cada proveedor tuvo su propio conjunto de comentarios aislados

#### 1.4 Gestión de Estados Cliente

**Caso 1.4.1: Poner incidencia en espera (sin proveedor)**
- [ ] Abrir incidencia sin proveedor
- [ ] Click en "Poner en Espera"
- [ ] Confirmar
- [ ] Verificar que `estado_cliente` pasa a "En espera"
- [ ] Verificar que se registra en historial

**Caso 1.4.2: Reabrir incidencia desde espera**
- [ ] Incidencia en estado "En espera"
- [ ] Click en "Reabrir Incidencia"
- [ ] Verificar que vuelve a estado "Abierta"

**Caso 1.4.3: Anular incidencia completa**
- [ ] Abrir incidencia
- [ ] Click en "Anular Incidencia"
- [ ] Escribir motivo
- [ ] Confirmar
- [ ] Verificar que:
  - `estado_cliente` pasa a "Anulada"
  - Si tenía proveedor, `estado_proveedor` también pasa a "Anulada"
  - Se crea comentario del sistema
  - Ya no aparece en dashboards activos

#### 1.5 Gestión de Presupuestos

**Caso 1.5.1: Recibir presupuesto de proveedor**
- [ ] Proveedor envía presupuesto (ver sección Proveedor)
- [ ] Control recibe notificación
- [ ] Abrir incidencia
- [ ] Verificar que muestra modal de gestión de presupuesto
- [ ] Ver detalles: fecha inicio, duración, importe, documento adjunto

**Caso 1.5.2: Aprobar presupuesto**
- [ ] Click en "Aprobar Presupuesto"
- [ ] Confirmar aprobación
- [ ] Verificar que:
  - `estado_proveedor` pasa a "Oferta aprobada"
  - Se crea comentario de aprobación
  - El proveedor recibe notificación de aprobación
  - Se registra en historial

**Caso 1.5.3: Solicitar revisión de presupuesto**
- [ ] Click en "Solicitar Revisión"
- [ ] Escribir motivo de revisión
- [ ] Confirmar
- [ ] Verificar que:
  - `estado_proveedor` vuelve a "Abierta"
  - Se crea comentario con el motivo
  - El proveedor puede enviar nuevo presupuesto

#### 1.6 Gestión de Resoluciones

**Caso 1.6.1: Recibir resolución técnica del proveedor**
- [ ] Proveedor marca como resuelta (ver sección Proveedor)
- [ ] Control ve que `estado_proveedor = "Resuelta"`
- [ ] Verificar que muestra modal de validación
- [ ] Ver detalles de la resolución

**Caso 1.6.2: Aprobar resolución técnica**
- [ ] Click en "Aprobar Resolución"
- [ ] Confirmar
- [ ] Verificar que:
  - Control puede esperar valoración económica del proveedor
  - Incidencia sigue activa para el proveedor

**Caso 1.6.3: Rechazar resolución técnica**
- [ ] Click en "Rechazar Resolución"
- [ ] Escribir motivo de rechazo
- [ ] Confirmar
- [ ] Verificar que:
  - `estado_proveedor` vuelve a "En resolución"
  - Se crea comentario con el motivo
  - El proveedor recibe notificación del rechazo

**Caso 1.6.4: Recibir valoración económica**
- [ ] Proveedor envía valoración económica
- [ ] Verificar que muestra importe y documento adjunto
- [ ] Ver detalles de la valoración

**Caso 1.6.5: Cerrar incidencia tras valoración**
- [ ] Click en "Cerrar Incidencia"
- [ ] Confirmar
- [ ] Verificar que:
  - `estado_cliente` pasa a "Cerrada"
  - `estado_proveedor` pasa a "Cerrada"
  - Se crea comentario de cierre
  - Ya no aparece en listados activos
  - Se registra en historial

**Caso 1.6.6: Resolución manual (sin proveedor)**
- [ ] Incidencia sin proveedor asignado
- [ ] Click en "Resolver Manualmente"
- [ ] Escribir motivo de resolución manual
- [ ] Confirmar
- [ ] Verificar que:
  - `estado_cliente` pasa a "Resuelta"
  - Se crea comentario del sistema
  - Luego puede cerrarla desde "Cerrar Incidencia"

#### 1.7 Chat y Comunicaciones

**Caso 1.7.1: Enviar mensaje a cliente (chat-control-cliente)**
- [ ] Abrir `/incidencias/[id]/chat-control-cliente`
- [ ] Escribir mensaje
- [ ] Adjuntar archivos (opcional)
- [ ] Enviar
- [ ] Verificar que:
  - Mensaje se crea con `ambito="cliente"`
  - Aparece en el chat inmediatamente
  - Cliente puede verlo (si tiene acceso al chat cliente)

**Caso 1.7.2: Ver mensajes del proveedor (chat-proveedor)**
- [ ] Abrir `/incidencias/[id]/chat-proveedor`
- [ ] Verificar que ve mensajes del proveedor
- [ ] Enviar respuesta
- [ ] Verificar que mensaje se vincula al `proveedor_caso_id` activo

**Caso 1.7.3: Ver historial después de reasignación**
- [ ] Incidencia con proveedor reasignado
- [ ] Abrir chat-proveedor
- [ ] Verificar que:
  - Solo ve mensajes del proveedor activo actual
  - NO se mezclan mensajes del proveedor anterior
  - (Opcionalmente implementar vista de historial completo)

#### 1.8 Dashboard y Alertas

**Caso 1.8.1: Ver dashboard con todas las incidencias**
- [ ] Ir a `/` (dashboard principal)
- [ ] Verificar que muestra contadores por estado:
  - Abierta
  - En espera
  - En tramitación
  - Resuelta
  - Cerrada
  - Anulada
- [ ] Click en cada estado para filtrar
- [ ] Verificar que el listado coincide con el contador

**Caso 1.8.2: Ver alertas críticas**
- [ ] Ir a `/control/alertas`
- [ ] Verificar alertas de:
  - **Incidencias críticas**: +4h sin comentarios
  - **Proveedores sin respuesta**: +24h sin respuesta
  - **SLA próximo a vencer**: 8h antes del límite de 48h
- [ ] Click en alerta → debe navegar a la incidencia

**Caso 1.8.3: Filtrar alertas por tipo**
- [ ] Probar filtros: Todas / Críticas / SLA / Proveedores / Escaladas
- [ ] Verificar contadores actualizados

#### 1.9 Gestión de Centros

**Caso 1.9.1: Ver listado de centros**
- [ ] Ir a `/control/centros`
- [ ] Verificar que muestra todas las instituciones tipo "Centro"
- [ ] Ver contadores de incidencias por centro

**Caso 1.9.2: Ver detalle de un centro**
- [ ] Click en un centro
- [ ] Verificar que muestra todas sus incidencias
- [ ] Probar filtros por estado

#### 1.10 Gestión de Proveedores

**Caso 1.10.1: Ver listado de proveedores**
- [ ] Ir a `/control/proveedores`
- [ ] Verificar que muestra todas las instituciones tipo "Proveedor"
- [ ] Ver métricas de cada proveedor

**Caso 1.10.2: Ver detalle de un proveedor**
- [ ] Click en un proveedor
- [ ] Verificar que muestra:
  - Incidencias activas asignadas
  - Incidencias históricas
  - Métricas de rendimiento

#### 1.11 Gestión de Presupuestos Globales

**Caso 1.11.1: Ver listado de presupuestos**
- [ ] Ir a `/control/presupuestos`
- [ ] Verificar que muestra todos los presupuestos del sistema
- [ ] Filtrar por estado: Pendiente / Aprobado / En revisión
- [ ] Ver documentos adjuntos

---

### 2. ROL: PROVEEDOR

#### 2.1 Recepción de Asignaciones

**Caso 2.1.1: Recibir notificación de nueva asignación**
- [ ] Control asigna incidencia al proveedor
- [ ] Verificar que aparece notificación en `/`
- [ ] Click en notificación
- [ ] Navega a `/incidencias/[id]/chat-proveedor`
- [ ] Verificar que muestra:
  - Datos de la incidencia
  - Descripción para el proveedor
  - Prioridad asignada
  - Estado: "Abierta"

**Caso 2.1.2: Ver lista de incidencias asignadas**
- [ ] Ir a `/incidencias`
- [ ] Verificar que SOLO ve incidencias con `proveedor_casos.activo=true`
- [ ] Verificar que NO ve incidencias anuladas
- [ ] Probar filtro por estado_proveedor

**Caso 2.1.3: Dashboard de proveedor**
- [ ] Ir a `/` (dashboard)
- [ ] Verificar contadores por `estado_proveedor`:
  - Abierta
  - Ofertada
  - Oferta aprobada
  - En resolución
  - Resuelta
  - Valorada
  - Cerrada
- [ ] Verificar que solo cuenta incidencias activas

#### 2.2 Chat y Comunicaciones

**Caso 2.2.1: Ver chat de incidencia asignada**
- [ ] Abrir `/incidencias/[id]/chat-proveedor`
- [ ] Verificar que solo ve mensajes vinculados a su `proveedor_caso_id`
- [ ] Verificar que NO ve mensajes de proveedores anteriores (si hubo reasignación)

**Caso 2.2.2: Enviar mensaje a Control**
- [ ] Escribir mensaje en el chat
- [ ] Adjuntar archivos (opcional)
- [ ] Enviar
- [ ] Verificar que:
  - Mensaje se crea con `ambito="proveedor"` o `ambito="ambos"`
  - Se vincula al `proveedor_caso_id` correcto
  - Control puede verlo en chat-proveedor

#### 2.3 Calendarización de Visitas

**Caso 2.3.1: Calendarizar visita**
- [ ] Abrir incidencia asignada
- [ ] Click en "Calendarizar Visita"
- [ ] Seleccionar fecha
- [ ] Seleccionar horario (mañana/tarde)
- [ ] Confirmar
- [ ] Verificar que:
  - Se crea registro en `citas_proveedores`
  - Se crea comentario del sistema con la fecha
  - Control ve la cita en el chat
  - Aparece en `/calendario` del proveedor

**Caso 2.3.2: Ver calendario de visitas**
- [ ] Ir a `/calendario`
- [ ] Verificar que muestra todas las citas activas
- [ ] Probar navegación por semanas
- [ ] Click en cita → navega a la incidencia

#### 2.4 Gestión de Presupuestos

**Caso 2.4.1: Enviar presupuesto (oferta)**
- [ ] Abrir incidencia en estado "Abierta"
- [ ] Click en "Enviar Presupuesto"
- [ ] Rellenar formulario:
  - Fecha estimada de inicio
  - Duración estimada (días)
  - Importe total sin IVA
  - Descripción
  - Adjuntar documento PDF
- [ ] Enviar
- [ ] Verificar que:
  - `estado_proveedor` pasa a "Ofertada"
  - Se crea comentario con los datos
  - Se sube el archivo a Storage
  - Control recibe notificación
  - Se registra en historial

**Caso 2.4.2: Recibir aprobación de presupuesto**
- [ ] Control aprueba presupuesto
- [ ] Verificar que `estado_proveedor = "Oferta aprobada"`
- [ ] Ver comentario de aprobación
- [ ] Ahora puede marcar como "En resolución" o enviar resolución

**Caso 2.4.3: Recibir solicitud de revisión**
- [ ] Control solicita revisión
- [ ] Verificar que `estado_proveedor` vuelve a "Abierta"
- [ ] Ver motivo de revisión en el comentario
- [ ] Poder enviar nuevo presupuesto corregido

#### 2.5 Resolución de Incidencias

**Caso 2.5.1: Resolver incidencia técnicamente**
- [ ] Abrir incidencia en estado "Oferta aprobada" o "En resolución"
- [ ] Click en "Resolver Incidencia"
- [ ] Rellenar formulario:
  - Descripción de la solución
  - Adjuntar fotos/documentos (opcional)
- [ ] Confirmar
- [ ] Verificar que:
  - `estado_proveedor` pasa a "Resuelta"
  - `estado_cliente` pasa a "Resuelta"
  - Se crea comentario con la solución
  - Control puede validar la resolución
  - Se registra en historial

**Caso 2.5.2: Recibir rechazo de resolución**
- [ ] Control rechaza resolución
- [ ] Verificar que `estado_proveedor` vuelve a "En resolución"
- [ ] Ver motivo del rechazo
- [ ] Poder volver a enviar resolución corregida

**Caso 2.5.3: Enviar valoración económica**
- [ ] Resolución técnica aprobada
- [ ] Click en "Enviar Valoración Económica"
- [ ] Rellenar formulario:
  - Importe total sin IVA
  - Adjuntar documento PDF con desglose
- [ ] Enviar
- [ ] Verificar que:
  - `estado_proveedor` pasa a "Valorada"
  - Se crea comentario con importe y documento
  - Control puede cerrar la incidencia
  - Se registra en historial

#### 2.6 Escenarios de Anulación

**Caso 2.6.1: Ser anulado por Control**
- [ ] Control anula la asignación
- [ ] Verificar que:
  - La incidencia desaparece del listado del proveedor
  - Ya no puede acceder al chat
  - Si intenta acceder, ve mensaje de "Asignación anulada"
  - El `proveedor_caso_id` pasa a `activo=false`

**Caso 2.6.2: Seguir viendo incidencias anuladas (opcional)**
- [ ] Implementar filtro "Ver incidencias anuladas"
- [ ] Verificar que puede ver el historial pero no interactuar

---

### 3. ROL: GESTOR

#### 3.1 Dashboard Multi-Centro

**Caso 3.1.1: Ver dashboard con múltiples centros asignados**
- [ ] Iniciar sesión como Gestor con múltiples instituciones
- [ ] Ir a `/`
- [ ] Verificar que muestra:
  - Vista general con todos los centros
  - Contadores globales por estado
  - Selector de centros

**Caso 3.1.2: Filtrar por centro específico**
- [ ] Seleccionar un centro del dropdown
- [ ] Verificar que:
  - Contadores se actualizan solo para ese centro
  - Listado muestra solo incidencias de ese centro

**Caso 3.1.3: Ver todas las instituciones**
- [ ] Seleccionar "Todas las instituciones"
- [ ] Verificar que muestra datos agregados

#### 3.2 Gestión de Incidencias

**Caso 3.2.1: Ver listado de incidencias**
- [ ] Ir a `/incidencias`
- [ ] Verificar que solo ve incidencias de sus centros asignados
- [ ] Probar filtros por estado

**Caso 3.2.2: Ver detalle de incidencia**
- [ ] Abrir incidencia de su centro
- [ ] Verificar que puede ver:
  - Datos completos
  - Chat con Control (si implementado)
  - Estado actual y proveedor asignado

**Caso 3.2.3: Restricciones de acceso**
- [ ] Intentar acceder a incidencia de otro centro
- [ ] Verificar que no tiene acceso (error o redirect)

#### 3.3 Usuario con acceso_todos_centros

**Caso 3.3.1: Gestor con acceso global**
- [ ] Usuario Gestor con `acceso_todos_centros=true`
- [ ] Verificar que ve TODAS las incidencias del sistema
- [ ] Dashboard muestra datos globales
- [ ] Similar a Control pero con rol de Gestor

---

### 4. ROL: CLIENTE

#### 4.1 Dashboard Cliente

**Caso 4.1.1: Ver dashboard del centro**
- [ ] Iniciar sesión como Cliente
- [ ] Ir a `/`
- [ ] Verificar que muestra:
  - Contadores de incidencias de su institución
  - Solo estados cliente (no estados proveedor)

**Caso 4.1.2: Ver listado de incidencias**
- [ ] Ir a `/incidencias`
- [ ] Verificar que solo ve incidencias de su centro
- [ ] Probar filtros por estado_cliente

#### 4.2 Gestión de Incidencias (si tiene permisos)

**Caso 4.2.1: Crear nueva incidencia**
- [ ] Ir a `/incidencias/nueva`
- [ ] Verificar que puede crear incidencia
- [ ] El campo "Centro" está preseleccionado a su institución

**Caso 4.2.2: Ver detalle de incidencia**
- [ ] Abrir incidencia de su centro
- [ ] Verificar datos visibles
- [ ] Chat cliente (si implementado)

**Caso 4.2.3: Restricciones de acceso**
- [ ] NO puede asignar proveedores
- [ ] NO puede ver chat-proveedor
- [ ] NO puede gestionar presupuestos (solo Control)

---

## Pruebas de Integración y Edge Cases

### 5. Escenarios Complejos

**Caso 5.1: Ciclo completo con presupuesto**
1. [ ] Control crea incidencia
2. [ ] Control asigna Proveedor A
3. [ ] Proveedor A envía presupuesto
4. [ ] Control solicita revisión
5. [ ] Proveedor A envía presupuesto revisado
6. [ ] Control aprueba presupuesto
7. [ ] Proveedor A calendariza visita
8. [ ] Proveedor A resuelve técnicamente
9. [ ] Control aprueba resolución
10. [ ] Proveedor A envía valoración económica
11. [ ] Control cierra incidencia
12. [ ] Verificar que todos los comentarios están en orden cronológico
13. [ ] Verificar que todos los cambios están en `historial_estados`

**Caso 5.2: Ciclo con múltiples reasignaciones**
1. [ ] Control crea incidencia
2. [ ] Control asigna Proveedor A
3. [ ] Proveedor A envía presupuesto
4. [ ] Control anula a Proveedor A (ej: precio muy alto)
5. [ ] Control asigna Proveedor B
6. [ ] Proveedor B envía presupuesto
7. [ ] Control aprueba presupuesto de B
8. [ ] Proveedor B resuelve
9. [ ] Control rechaza resolución (mal hecha)
10. [ ] Control anula a Proveedor B
11. [ ] Control asigna Proveedor C
12. [ ] Proveedor C resuelve correctamente
13. [ ] Proveedor C valora
14. [ ] Control cierra
15. [ ] Verificar aislamiento de comentarios entre proveedores
16. [ ] Verificar que solo C aparece como activo

**Caso 5.3: Resolución manual sin proveedor**
1. [ ] Control crea incidencia
2. [ ] Control la resuelve manualmente (ej: duplicada)
3. [ ] Control cierra incidencia
4. [ ] Verificar que no se creó ningún `proveedor_caso`

**Caso 5.4: Incidencia anulada con proveedor asignado**
1. [ ] Control crea incidencia
2. [ ] Control asigna proveedor
3. [ ] Proveedor envía presupuesto
4. [ ] Control anula la incidencia completa (no solo al proveedor)
5. [ ] Verificar que `estado_cliente = "Anulada"`
6. [ ] Verificar que `estado_proveedor = "Anulada"`
7. [ ] Proveedor ya no la ve en su listado

**Caso 5.5: Poner en espera y reabrir**
1. [ ] Control crea incidencia
2. [ ] Control la pone en espera
3. [ ] Esperar un tiempo
4. [ ] Control reabre incidencia
5. [ ] Control asigna proveedor
6. [ ] Continuar flujo normal

**Caso 5.6: Adjuntar múltiples archivos**
1. [ ] Crear comentario con 3+ archivos adjuntos
2. [ ] Tipos: imagen JPG, imagen PNG, PDF
3. [ ] Verificar que todos se suben correctamente a Storage
4. [ ] Verificar que se crean registros en tabla `adjuntos`
5. [ ] Verificar que se pueden descargar

**Caso 5.7: Caracteres especiales en nombres de archivo**
- [ ] Subir archivo con nombre: `Presupuesto#2024 (revisión).pdf`
- [ ] Verificar que se sube sin errores
- [ ] Verificar que se puede descargar
- [ ] (Ya implementado fix en `FIX_CARACTERES_ESPECIALES_STORAGE.md`)

**Caso 5.8: Comentarios del sistema vs usuario**
- [ ] Verificar que comentarios automáticos tienen `es_sistema=true`
- [ ] Verificar que comentarios de usuario tienen `es_sistema=false`
- [ ] Verificar que se muestran con estilos diferentes en el chat

---

## Pruebas de Performance y Carga

### 6. Escalabilidad

**Caso 6.1: Dashboard con muchas incidencias**
- [ ] Dashboard con 500+ incidencias
- [ ] Verificar que usa `obtenerConteoPorEstado` (COUNT en DB)
- [ ] Verificar que NO carga todas las incidencias en memoria
- [ ] Tiempo de carga < 2 segundos

**Caso 6.2: Listado con paginación**
- [ ] Listado de incidencias con 1000+ registros
- [ ] Verificar que se pagina correctamente
- [ ] Probar scroll infinito o paginación manual

**Caso 6.3: Chat con muchos comentarios**
- [ ] Incidencia con 100+ comentarios
- [ ] Verificar que se cargan ordenados cronológicamente
- [ ] Probar scroll hasta comentarios antiguos

---

## Pruebas de Seguridad y Permisos

### 7. Row Level Security (RLS)

**Caso 7.1: Proveedor intentando acceder a otra incidencia**
- [ ] Proveedor A intenta acceder a incidencia de Proveedor B
- [ ] Verificar que RLS bloquea el acceso (403 o vacío)

**Caso 7.2: Cliente intentando acceder a otra institución**
- [ ] Cliente del Centro A intenta ver incidencia del Centro B
- [ ] Verificar que RLS bloquea el acceso

**Caso 7.3: Gestor sin acceso_todos_centros**
- [ ] Gestor solo ve incidencias de sus centros asignados
- [ ] No puede ver ni listar incidencias de otros centros

**Caso 7.4: URLs directas sin autenticación**
- [ ] Intentar acceder a `/incidencias/[id]/chat-proveedor` sin login
- [ ] Verificar redirect a `/login`

---

## Pruebas de Migración de Datos

### 8. Datos Migrados de Wix

**Caso 8.1: Verificar incidencias migradas**
- [ ] Comprobar que todas las incidencias de Wix están en Supabase
- [ ] Verificar que `num_solicitud` se respeta
- [ ] Verificar que estados se mapearon correctamente

**Caso 8.2: Verificar comentarios migrados**
- [ ] Comprobar que comentarios tienen `proveedor_caso_id` correcto
- [ ] Según doc: 2,888 de 2,893 comentarios migrados
- [ ] Verificar los 5 comentarios faltantes (si son críticos)

**Caso 8.3: Verificar adjuntos migrados**
- [ ] Comprobar que archivos están en Storage
- [ ] Verificar que URLs funcionan
- [ ] Probar descargas

**Caso 8.4: Verificar proveedores y centros**
- [ ] Todas las instituciones migradas
- [ ] Tipo correcto (Centro vs Proveedor)
- [ ] Relaciones `personas_instituciones` correctas

---

## Checklist Pre-Producción

### 9. Antes del Volcado de Datos

**Preparación Local:**
- [ ] Todas las pruebas anteriores pasan en local
- [ ] Build de producción sin errores: `npm run build`
- [ ] No hay warnings críticos de TypeScript
- [ ] No hay errores de ESLint críticos

**Preparación Supabase:**
- [ ] RLS policies configuradas correctamente
- [ ] Storage buckets creados: `incidencias-adjuntos`, `presupuestos`
- [ ] Funciones RPC creadas: `contar_incidencias_por_estado`
- [ ] Triggers y funciones de historial configurados

**Preparación Wix:**
- [ ] Scripts de migración probados en ambiente de prueba
- [ ] Backup completo de datos de Wix
- [ ] Plan de rollback en caso de error

### 10. Durante el Volcado de Datos (Noche)

**Secuencia:**
1. [ ] Backup de Supabase actual (si hay datos)
2. [ ] Ejecutar script de migración de instituciones
3. [ ] Ejecutar script de migración de personas
4. [ ] Ejecutar script de migración de incidencias
5. [ ] Ejecutar script de migración de comentarios
6. [ ] Ejecutar script de migración de adjuntos (Storage)
7. [ ] Ejecutar script de asignación de `proveedor_caso_id`
8. [ ] Verificar integridad de datos migrados

**Validaciones Post-Migración:**
- [ ] Contar incidencias migradas: `SELECT COUNT(*) FROM incidencias`
- [ ] Contar comentarios migrados: `SELECT COUNT(*) FROM comentarios`
- [ ] Contar adjuntos migrados: `SELECT COUNT(*) FROM adjuntos`
- [ ] Verificar usuarios: `SELECT COUNT(*) FROM personas`
- [ ] Verificar relaciones: `SELECT COUNT(*) FROM personas_instituciones`

### 11. Pruebas en Producción (Día Siguiente)

**Antes de abrir al público:**
- [ ] Repetir **TODAS** las pruebas de este documento en producción
- [ ] Usar datos reales migrados de Wix
- [ ] Probar con usuarios reales de cada rol
- [ ] Verificar emails de notificación (si implementado)
- [ ] Verificar que Storage sirve archivos correctamente
- [ ] Probar en diferentes navegadores (Chrome, Firefox, Safari)
- [ ] Probar en móvil (responsive)

**Smoke Tests Críticos en Producción:**
1. [ ] Login con usuario Control
2. [ ] Crear incidencia de prueba
3. [ ] Asignar a proveedor real
4. [ ] Proveedor recibe y puede ver la incidencia
5. [ ] Proveedor envía presupuesto
6. [ ] Control aprueba
7. [ ] Proveedor resuelve
8. [ ] Control cierra
9. [ ] Verificar que toda la data está en BD correctamente

### 12. Apertura al Público

**Checklist Final:**
- [ ] Todas las pruebas de producción pasan ✅
- [ ] Monitoreo configurado (logs, errores)
- [ ] Plan de soporte para primeros usuarios
- [ ] Documentación para usuarios disponible
- [ ] Equipo disponible para resolver incidencias críticas

**Comunicación:**
- [ ] Anunciar a usuarios que el sistema está disponible
- [ ] Enviar credenciales de acceso
- [ ] Proporcionar manual de usuario
- [ ] Canal de soporte habilitado (email, chat, etc.)

---

## Resumen de Archivos Clave para Testing

### Páginas Principales
- [/](app/(app)/page.tsx) - Dashboard
- [/incidencias](app/(app)/incidencias/page.tsx) - Listado
- [/incidencias/nueva](app/(app)/incidencias/nueva/page.tsx) - Crear
- [/incidencias/[id]/chat-control-cliente](app/(app)/incidencias/[id]/chat-control-cliente/page.tsx) - Chat Control-Cliente
- [/incidencias/[id]/chat-proveedor](app/(app)/incidencias/[id]/chat-proveedor/page.tsx) - Chat Proveedor
- [/calendario](app/(app)/calendario/page.tsx) - Calendario Proveedor
- [/control/alertas](app/(app)/control/alertas/page.tsx) - Dashboard Alertas
- [/control/centros](app/(app)/control/centros/page.tsx) - Gestión Centros
- [/control/proveedores](app/(app)/control/proveedores/page.tsx) - Gestión Proveedores
- [/control/presupuestos](app/(app)/control/presupuestos/page.tsx) - Gestión Presupuestos

### Servicios Críticos
- [lib/incidenciasService.ts](lib/incidenciasService.ts) - Queries de incidencias
- [lib/services/comentariosService.ts](lib/services/comentariosService.ts) - Gestión de comentarios
- [lib/services/asignacionProveedorService.ts](lib/services/asignacionProveedorService.ts) - Asignaciones
- [lib/services/citasService.ts](lib/services/citasService.ts) - Calendarización
- [lib/services/presupuestosService.ts](lib/services/presupuestosService.ts) - Presupuestos
- [lib/services/resolucionProveedorService.ts](lib/services/resolucionProveedorService.ts) - Resoluciones
- [lib/historialEstados.ts](lib/historialEstados.ts) - Historial de estados

### Modales Importantes
- [components/ModalAsignarProveedor.tsx](components/ModalAsignarProveedor.tsx)
- [components/ModalAnular.tsx](components/ModalAnular.tsx)
- [components/proveedor/ModalOferta.tsx](components/proveedor/ModalOferta.tsx)
- [components/proveedor/ModalResolver.tsx](components/proveedor/ModalResolver.tsx)
- [components/proveedor/ModalValoracion.tsx](components/proveedor/ModalValoracion.tsx)
- [components/proveedor/ModalCalendarizar.tsx](components/proveedor/ModalCalendarizar.tsx)
- [components/ModalCerrarIncidencia.tsx](components/ModalCerrarIncidencia.tsx)
- [components/ModalRechazarResolucion.tsx](components/ModalRechazarResolucion.tsx)
- [components/ModalResolucionManual.tsx](components/ModalResolucionManual.tsx)

---

## Notas Finales

- **Prioridad Alta**: Casos 1.2, 1.3, 2.1, 2.4, 2.5, 5.1, 5.2 (ciclos completos)
- **Prioridad Media**: Todos los casos de dashboard, listados, chat
- **Prioridad Baja**: Edge cases específicos, performance con datos masivos

**Tiempo Estimado de Pruebas:**
- Local: 4-6 horas (1 persona)
- Producción: 2-3 horas (1 persona)
- Total: ~8 horas de pruebas exhaustivas

**Recomendación Final:**
Sí, después de completar este plan de pruebas en local y producción, el sistema estará listo para abrirlo al público. El volcado de datos de Wix es crítico y debe hacerse con cuidado, pero con las validaciones post-migración deberías tener confianza en que los datos están correctos.

¡Éxito con el lanzamiento! 🚀
