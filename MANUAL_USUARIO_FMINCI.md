# Manual de Usuario FMINCI
## Sistema de Gestión de Incidencias

**Versión:** 1.0
**Fecha:** Enero 2025

---

## Índice

1. [Introducción](#introducción)
2. [Roles de Usuario](#roles-de-usuario)
3. [Gestión de Incidencias](#gestión-de-incidencias)
4. [Flujo de Trabajo por Rol](#flujo-de-trabajo-por-rol)
5. [Funcionalidades Principales](#funcionalidades-principales)
6. [Preguntas Frecuentes](#preguntas-frecuentes)

---

## Introducción

FMINCI es un sistema centralizado de gestión de incidencias diseñado para coordinar de forma eficiente la comunicación entre centros, gestores, control y proveedores de mantenimiento.

### Objetivo del Sistema

- Centralizar la gestión de incidencias de mantenimiento
- Facilitar la comunicación entre todas las partes involucradas
- Mantener un registro histórico completo de cada incidencia
- Agilizar el proceso de asignación y resolución de incidencias
- Controlar la valoración económica de los servicios prestados

---

## Roles de Usuario

El sistema cuenta con cuatro roles principales, cada uno con funciones específicas:

### 1. Control (Administrador)

**Responsabilidades:**
- Gestión completa de incidencias
- Asignación de proveedores
- Aprobación o rechazo de presupuestos
- Valoración de incidencias resueltas
- Cierre final de incidencias
- Acceso a todos los centros e instituciones

**Permisos especiales:**
- Acceso global a todas las incidencias
- Puede anular asignaciones de proveedores
- Puede resolver incidencias como proveedor (resolución manual)

### 2. Gestor

**Responsabilidades:**
- Creación de nuevas incidencias
- Seguimiento del estado de incidencias de sus centros
- Comunicación con Control a través del chat cliente
- Visualización del dashboard de métricas

**Acceso:**
- Limitado a los centros asignados en su perfil
- Puede tener acceso a múltiples centros según configuración

### 3. Cliente

**Responsabilidades:**
- Creación de incidencias para su centro
- Seguimiento del estado de sus incidencias
- Comunicación con Control

**Acceso:**
- Limitado al centro específico asignado

### 4. Proveedor

**Responsabilidades:**
- Recepción de notificaciones de incidencias asignadas
- Gestión de su calendario de visitas
- Presentación de presupuestos
- Resolución de incidencias
- Valoración económica de servicios prestados

**Funcionalidades:**
- Calendarizar visitas técnicas
- Ofertar presupuestos
- Marcar incidencias como resueltas
- Realizar valoración económica final

---

## Gestión de Incidencias

### Ciclo de Vida de una Incidencia

```
1. CREACIÓN (Gestor/Cliente/Control)
   ↓
2. ABIERTA (Pendiente de asignación de proveedor)
   ↓
3. EN TRAMITACIÓN (Proveedor asignado por Control)
   ↓
4. Estados del Proveedor (flujos posibles):

   FLUJO CON PRESUPUESTO:
   Abierta → Ofertada → Oferta aprobada → Resuelta → Pendiente valoración → Valorada → Cerrada
                ↓
        Oferta a revisar → Ofertada (reenvío)

   FLUJO SIN PRESUPUESTO:
   Abierta → En resolución → Resuelta → Pendiente valoración → Valorada → Cerrada

   FLUJO DE CORRECCIÓN (cuando Control rechaza):
   Valorada → Revisar resolución → Corrección según tipo:
     • Solo técnica rechazada → Valorada (reenvío) → Cerrada
     • Solo económica rechazada → Valorada (reenvío) → Cerrada
     • Ambas rechazadas → Resuelta (corrige técnica) → Valorada (corrige económica) → Cerrada

   RESOLUCIÓN MANUAL (Control):
   Cualquier estado → Valorada (Control resuelve directamente) → Cerrada

   ANULACIONES:
   - Anulada (incidencia completa)
   - Anulada (solo asignación de proveedor, permite reasignar)
```

### Estados de Incidencia (Cliente)

- **Abierta**: Incidencia recién creada, pendiente de asignación
- **En tramitación**: Proveedor asignado, trabajando en la resolución
- **En espera**: Incidencia pausada temporalmente
- **Resuelta**: Incidencia solucionada, pendiente de valoración económica
- **Cerrada**: Proceso completo finalizado
- **Anulada**: Incidencia cancelada

### Estados de Incidencia (Proveedor)

- **Abierta**: Asignada al proveedor, pendiente de acción
- **En resolución**: Proveedor trabajando en la incidencia, ha calendarizado una visita al centro
- **Ofertada**: Presupuesto enviado, esperando aprobación de Control
- **Oferta aprobada**: Presupuesto aceptado por Control, puede proceder con el trabajo
- **Oferta a revisar**: Presupuesto rechazado por Control, debe enviar uno nuevo
- **Resuelta**: Trabajo completado a nivel técnico, esperando valoración de Control
- **Valorada**: Valoración económica completada, esperando que Control apruebe y cierre
- **Revisar resolución**: Control ha rechazado la resolución técnica y/o valoración económica, el proveedor debe corregir y reenviar
  - Si solo técnica → Botón "Resolver Incidencia" habilitado
  - Si solo económica → Botón "Valorar Incidencia" habilitado
  - Si ambas → Debe corregir primero técnica (→ Resuelta), luego económica (→ Valorada)
- **Cerrada**: Proceso finalizado, Control ha aceptado la resolución técnica y valoración económica
- **Anulada**: Asignación cancelada por Control

---

## Flujo de Trabajo por Rol

### CONTROL - Flujo de Trabajo Principal

#### 1. Recepción de Nueva Incidencia

Cuando entra una incidencia al sistema:

1. Acceder al panel de incidencias
2. Hacer clic en la incidencia sin proveedor asignado
3. El sistema abre automáticamente el **Chat Control-Cliente**

#### 2. Asignar Proveedor a una Incidencia

**Desde Chat Control-Cliente:**

1. Hacer clic en el botón **"Asignar Proveedor"**
2. Completar el formulario de asignación:

   **Campos obligatorios:**
   - **Proveedor**: Seleccionar de la lista o elegir "Proveedor externo"
     - Si es externo: Introducir CIF (9 caracteres)
   - **Prioridad**: Crítico / No crítico

   **Campos opcionales:**
   - **Descripción para el Proveedor**: Instrucciones específicas, se puede modificar el texto de descripcion inicial para dar mas detalles. 
   - **Imagen Principal**: Incluir/excluir imagen adjunta a la incidencia
   - **Archivos Adicionales**: Adjuntar imágenes o documentos adicionales
   - **Documentos del Chat Anterior**: (Solo en reasignaciones) Compartir documentos del proveedor anterior

3. Hacer clic en **"Asignar Proveedor"**

**Resultado:**
- El proveedor recibe una notificación
- La incidencia pasa a estado "En tramitación"
- Se crea un chat proveedor
- Se puede acceder al **Chat Proveedor** con el botón "Ir al Chat Proveedor"

#### 3. Gestionar Presupuestos

Cuando un proveedor envía un presupuesto:

1. Acceder al **Chat Proveedor** de la incidencia
2. Hacer clic en **"Gestionar Presupuesto"**
3. Revisar el presupuesto presentado
4. Elegir una opción:
   - **Aprobar Presupuesto**: El proveedor puede proceder
   - **Rechazar Presupuesto**: El proveedor debe presentar uno nuevo
   - Añadir comentarios sobre la decisión

#### 4. Valorar Incidencia Resuelta

Cuando el proveedor marca la incidencia como resuelta:

1. Acceder al **Chat Proveedor**
2. Hacer clic en **"Valorar Incidencia"**
3. Revisar la resolución técnica del proveedor
4. Confirmar si está conforme con la resolución
5. El sistema cambia el estado del proveedor a "Pendiente valoración"

#### 5. Cerrar o Rechazar Incidencia Valorada

Una vez el proveedor ha valorado económicamente:

1. Acceder al **Chat Proveedor**
2. Revisar la resolución técnica y valoración económica presentadas
3. Elegir una de las opciones:

**Opción A: Aprobar y Cerrar Incidencia**
- Hacer clic en **"Aprobar y Cerrar Incidencia"**
- Agregar motivo de cierre (opcional)
- Confirmar

**Resultado:**
- Estado cliente: "Cerrada"
- Estado proveedor: "Cerrada"
- Incidencia completamente finalizada

**Opción B: Rechazar Resolución**
- Hacer clic en **"Rechazar Resolución"**
- Seleccionar qué necesita corrección:
  - **Resolución técnica**: Solo la parte técnica necesita corrección
  - **Valoración económica**: Solo la parte económica necesita corrección
  - **Ambas (técnica y económica)**: Tanto la resolución como la valoración necesitan corrección
- Especificar motivo detallado del rechazo
- Confirmar rechazo

**Resultado:**
- Estado proveedor: "Revisar resolución"
- Se guarda el tipo de corrección requerida (`tipo_revision`)
- El proveedor recibe notificación con los detalles del rechazo
- El proveedor verá botones habilitados según lo que necesite corregir:
  - Solo técnica → Botón "Resolver Incidencia"
  - Solo económica → Botón "Valorar Incidencia"
  - Ambas → Botones "Resolver Incidencia" y "Valorar Incidencia"

**Flujo de Corrección por el Proveedor:**

1. **Si solo técnica rechazada:**
   - Proveedor corrige y hace clic en "Resolver Incidencia"
   - Estado cambia a: **"Valorada"**
   - Control puede aprobar y cerrar

2. **Si solo económica rechazada:**
   - Proveedor corrige y hace clic en "Valorar Incidencia"
   - Estado cambia a: **"Valorada"**
   - Control puede aprobar y cerrar

3. **Si ambas rechazadas:**
   - **Paso 1**: Proveedor corrige técnica y hace clic en "Resolver Incidencia"
   - Estado cambia a: **"Resuelta"** (intermedio)
   - **Paso 2**: Proveedor corrige económica y hace clic en "Valorar Incidencia"
   - Estado cambia a: **"Valorada"**
   - Control puede aprobar y cerrar

**Importante:** El sistema garantiza que todas las correcciones terminen en estado "Valorada" para que Control siempre pueda cerrar la incidencia desde el mismo estado.

**Nota sobre incidencias migradas:**
Si la incidencia fue migrada desde el sistema anterior y no tiene formularios de resolución/valoración registrados, el sistema mostrará un aviso informativo. Aun así, podrás aprobar y cerrar o rechazar la incidencia normalmente.

#### 6. Gestión de Archivos Adjuntos en Comentarios

Tanto en el Chat Control-Cliente como en el Chat Proveedor, puedes adjuntar archivos a tus comentarios:

**Tipos de archivos permitidos:**
- **Imágenes**: JPG, PNG, GIF, WEBP (hasta 10MB)
- **Documentos**: PDF, DOC, DOCX, TXT, CSV (hasta 20MB)

**Cómo adjuntar archivos:**
1. Escribir el comentario en el área de texto
2. Hacer clic en **"Añadir imagen"** o **"Añadir documento"**
3. Seleccionar el archivo desde tu dispositivo
4. Verás una vista previa del archivo seleccionado con:
   - Miniatura (para imágenes)
   - Nombre del archivo
   - Tamaño en KB
5. Puedes eliminar el archivo haciendo clic en la **×**
6. Hacer clic en **"Enviar"** para publicar el comentario con el adjunto

**Visualización de adjuntos:**
- Las imágenes se muestran como miniaturas clicables en el chat
- Los documentos aparecen como enlaces de descarga con icono 📄
- Puedes abrir imágenes en nueva pestaña haciendo clic sobre ellas

#### 7. Resolver como Proveedor (Resolución Manual)

**Cuándo usar esta opción:**

Esta funcionalidad se utiliza cuando el proveedor ha resuelto la incidencia **fuera de la plataforma** (por correo electrónico, teléfono, WhatsApp, etc.) y es necesario registrar la resolución manualmente en el sistema.

**Proceso:**

1. Acceder al **Chat Proveedor** de la incidencia
2. Hacer clic en **"Resolver como Proveedor"**
3. Se abre una página dedicada para completar la información

**Sección 1: RESOLUCIÓN TÉCNICA**

Campos obligatorios:
- **Solución aplicada**: Descripción detallada de cómo se resolvió la incidencia
- **Fecha de realización del trabajo**: Fecha en que se realizó el servicio

Campos opcionales:
- **Imagen de evidencia**: Foto del trabajo realizado
- **Documento parte de trabajo**: PDF del parte firmado o informe técnico

**Sección 2: VALORACIÓN ECONÓMICA**

Campos obligatorios:
- **Importe sin IVA**: Base imponible del servicio
- **Porcentaje de IVA**: Seleccionar 0%, 4%, 10% o 21%
- El sistema calcula automáticamente el **Importe con IVA**

Campos opcionales:
- **Documento justificativo**: Factura, presupuesto aceptado, albarán

4. Hacer clic en **"Resolver Incidencia"**

**Resultado:**
- La incidencia se marca como resuelta y valorada
- Se registra toda la información en el sistema
- Se pueden adjuntar los documentos necesarios
- Control puede proceder a cerrar la incidencia

#### 8. Otras Acciones de Control

**Anular Incidencia:**
- Disponible desde Chat Control-Cliente
- Cancela completamente la incidencia
- Estado final: "Anulada"

**Marcar Incidencia como Duplicada:**

Al anular una incidencia, existe la opción de marcarla como duplicada cuando varios centros o clientes crean múltiples solicitudes para el mismo problema:

1. Hacer clic en **"Anular incidencia"**
2. Marcar la casilla **"Esta incidencia está duplicada"**
3. Describir el motivo de la anulación
4. Confirmar

**Resultado:**
- La incidencia se marca con el flag `es_duplicada = TRUE`
- El motivo incluye el prefijo `[DUPLICADA]` en el historial
- Los comentarios del sistema indican que fue anulada por duplicación
- Se puede generar reportes estadísticos para identificar:
  - Centros con mayor índice de duplicados
  - Tendencias de duplicación por periodo
  - Necesidades de formación o comunicación con conserjes

**Usos del seguimiento de duplicadas:**
- Identificar patrones de comportamiento impaciente de ciertos centros
- Generar reportes periódicos para llamar la atención a conserjes
- Mejorar procesos de comunicación con usuarios
- Tomar decisiones sobre formación o cambios en el flujo de trabajo

**Poner en Espera:**
- Disponible desde Chat Control-Cliente
- Pausa temporalmente la incidencia
- Se puede reactivar posteriormente

**Anular Asignación de Proveedor:**
- Disponible desde Chat Proveedor
- Cancela solo la asignación actual
- Permite reasignar a otro proveedor
- Estado proveedor: "Anulada"

**Reasignar Proveedor:**
- Después de anular la asignación
- Permite asignar a un nuevo proveedor
- Opción de compartir documentos del proveedor anterior

---

### GESTOR / CLIENTE - Flujo de Trabajo

#### 1. Crear Nueva Incidencia

1. Ir a **Incidencias** → **Nueva Incidencia**
2. Completar el formulario:

   **Información básica:**
   - **Centro**: Seleccionar el centro afectado
   - **Descripción**: Detallar el problema
   - **Catalogación**: Tipo de incidencia (opcional)

   **Ubicación específica:**
   - Edificio, planta, aula (opcional)

   **Adjuntos:**
   - Imagen principal de la incidencia
   - Documentos adicionales

3. Hacer clic en **"Crear Incidencia"**

#### 2. Seguimiento de Incidencias

**Desde el Dashboard:**
- Ver métricas por estado
- Filtrar por centro (si tiene múltiples centros)
- Ver resumen de incidencias activas

**Desde el Panel de Incidencias:**
- Ver listado completo
- Filtrar por estado, centro, fecha
- Hacer clic en una incidencia para ver detalles

#### 3. Comunicación con Control

1. Acceder al **Chat Control-Cliente** de la incidencia
2. Enviar mensajes
3. Adjuntar archivos si es necesario
4. Ver el historial completo de la conversación

---

### PROVEEDOR - Flujo de Trabajo

#### 1. Recibir Notificación de Asignación

Cuando Control asigna una incidencia:
- Aparece una notificación en pantalla
- Se puede acceder desde el panel de incidencias

#### 2. Acciones Disponibles (según estado)

**Estado: Abierta / En resolución**

Opciones disponibles:

**a) Calendarizar Visita**
1. Hacer clic en **"Calendarizar Visita"**
2. Completar información:
   - Fecha de la visita
   - Hora de la visita
   - Comentarios adicionales
3. Confirmar

**b) Ofertar Presupuesto**
1. Hacer clic en **"Ofertar Presupuesto"**
2. Completar:
   - Descripción del servicio a realizar
   - Importe total del presupuesto
   - Adjuntar documento del presupuesto (opcional)
3. Enviar presupuesto

**Estado cambia a:** Ofertada (esperando respuesta de Control)

**c) Resolver Incidencia**
1. Hacer clic en **"Resolver Incidencia"**
2. Completar:
   - Descripción de la solución aplicada
   - Fecha de realización
   - Adjuntar evidencias (fotos, documentos)
3. Marcar como resuelta

**Estado cambia a:** Resuelta

**Estado: Oferta a revisar**

Si Control rechaza el presupuesto:
1. Ver comentarios de Control
2. Hacer clic en **"Ofertar Presupuesto"** nuevamente
3. Presentar presupuesto revisado

**Estado: Oferta aprobada**

Control ha aprobado el presupuesto:
- Puede calendarizar visita
- Puede resolver directamente

**Estado: Resuelta**

Después de que Control valore la resolución:

**Valorar Económicamente**
1. Hacer clic en **"Valorar Económicamente"**
2. Completar valoración:
   - Importe sin IVA
   - Porcentaje de IVA (0%, 4%, 10%, 21%)
   - El sistema calcula automáticamente el importe con IVA
   - Adjuntar documento justificativo (factura, etc.)
3. Enviar valoración

**Estado cambia a:** Valorada (Control procederá al cierre)

**Estado: Revisar resolución**

Si Control rechaza la resolución o valoración, verá botones habilitados según lo que necesite corregir:

**Caso 1: Solo resolución técnica rechazada**
1. Ver el comentario del sistema: "🔄 Resolución técnica rechazada"
2. Botón habilitado: **"Resolver Incidencia"**
3. Corregir: Solución aplicada, fecha, o evidencias fotográficas
4. Hacer clic en **"Resolver Incidencia"** para reenviar

**Estado cambia a:** Valorada (Control puede aprobar y cerrar)

**Caso 2: Solo valoración económica rechazada**
1. Ver el comentario del sistema: "🔄 Valoración económica rechazada"
2. Botón habilitado: **"Valorar Incidencia"**
3. Corregir: Importes o documento justificativo
4. Hacer clic en **"Valorar Incidencia"** para reenviar

**Estado cambia a:** Valorada (Control puede aprobar y cerrar)

**Caso 3: Ambas rechazadas (técnica y económica)**
1. Ver el comentario del sistema: "🔄 Resolución y valoración rechazadas"
2. Botones habilitados: **"Resolver Incidencia"** y **"Valorar Incidencia"**
3. **Orden de corrección obligatorio:**
   - **Paso 1**: Corregir primero la resolución técnica
   - Hacer clic en **"Resolver Incidencia"**
   - Estado cambia a: **"Resuelta"** (paso intermedio)
   - **Paso 2**: Luego corregir la valoración económica
   - Hacer clic en **"Valorar Incidencia"**
   - Estado cambia a: **"Valorada"** (Control puede aprobar y cerrar)

**Importante:** Cuando ambas están rechazadas, debe corregirlas en orden: primero técnica (→ Resuelta), luego económica (→ Valorada). Esto asegura que Control siempre reciba el estado "Valorada" al final y pueda cerrar la incidencia.

#### 3. Ver Calendario de Visitas

1. Ir a **Calendario**
2. Ver todas las citas programadas
3. Filtrar por fecha
4. Ver detalles de cada visita

---

## Funcionalidades Principales

### Sistema de Chat Dual

FMINCI utiliza un sistema de chat dual para separar la comunicación:

**Chat Control-Cliente:**
- Comunicación entre Control y el solicitante (Gestor/Cliente)
- Visible solo para Control y el solicitante
- Ámbito: "cliente"

**Chat Proveedor:**
- Comunicación entre Control y el Proveedor asignado
- Visible solo para Control y el Proveedor
- Ámbito: "proveedor"

**Acceso a los chats:**
- Control puede cambiar entre ambos chats usando los botones:
  - "Ir al Chat Cliente"
  - "Ir al Chat Proveedor"

### Gestión de Archivos

**Tipos de archivos soportados:**
- Imágenes: JPG, PNG, GIF, WEBP
- Documentos: PDF, DOC, DOCX

**Funcionalidades:**
- Adjuntar múltiples archivos en comentarios
- Preview de imágenes en el chat
- Descarga de documentos
- Control de visibilidad (algunos archivos pueden ocultarse al proveedor)

### Proveedores Externos

Cuando se necesita trabajar con un proveedor no registrado en el sistema:

1. Al asignar proveedor, seleccionar **"Proveedor externo"**
2. Introducir el **CIF** del proveedor (9 caracteres)
3. El sistema:
   - Busca si ya existe un proveedor con ese CIF
   - Si existe, lo reutiliza
   - Si no existe, crea uno nuevo automáticamente
4. Se registra el CIF para identificación única

### Historial de Estados

Cada incidencia mantiene un registro completo de:
- Todos los cambios de estado
- Quién realizó cada cambio
- Fecha y hora de cada transición
- Motivo del cambio

**Acceso al historial:**
- Visible en la parte inferior del chat
- Muestra timeline completo
- Diferencia entre estados de cliente y proveedor

### Dashboard de Métricas

**Control:**
- Vista global de todas las incidencias
- Métricas por estado
- Puede filtrar por centro

**Gestor/Cliente:**
- Vista de sus centros asignados
- Métricas por estado
- Puede cambiar entre centros (si tiene múltiples)

**Métricas mostradas:**
- Abiertas
- En tramitación
- En espera
- Resueltas
- Cerradas
- Anuladas

---

## Preguntas Frecuentes

### ¿Qué pasa si asigno un proveedor por error?

Control puede anular la asignación desde el Chat Proveedor usando el botón "Anular asignación proveedor". Después puede reasignar a otro proveedor.

### ¿Puedo cambiar el estado de una incidencia directamente?

No. Los cambios de estado se realizan automáticamente según las acciones tomadas (asignar proveedor, resolver, valorar, etc.)

### ¿Cómo sé si un proveedor ha respondido?

El sistema muestra los mensajes en tiempo real. Se recomienda revisar periódicamente el panel de incidencias activas.

### ¿Puedo adjuntar archivos después de crear la incidencia?

Sí, desde el chat se pueden adjuntar archivos adicionales en cualquier momento.

### ¿Qué diferencia hay entre "Resolver" y "Valorar"?

- **Resolver**: El proveedor indica que ha completado el trabajo técnico
- **Valorar**: Control confirma que está conforme con la resolución
- Después el proveedor realiza la **valoración económica** (importe)

### ¿Puedo ver incidencias de otros centros?

Depende de tu rol:
- **Control**: Ve todas las incidencias
- **Gestor con acceso_todos_centros=true**: Ve todas
- **Gestor normal**: Solo sus centros asignados
- **Cliente**: Solo su centro específico
- **Proveedor**: Solo las asignadas activamente

### ¿Cómo funciona el cálculo del IVA?

El sistema calcula automáticamente:
```
Importe con IVA = Importe sin IVA × (1 + Porcentaje IVA / 100)
```

Ejemplo:
- Base: 100€
- IVA 21%: 100 × 1.21 = 121€

### ¿Cómo puedo saber qué incidencias están duplicadas?

Las incidencias duplicadas se marcan durante el proceso de anulación. Para obtener estadísticas:

**Consulta SQL para reportes:**
```sql
SELECT
  instituciones.nombre AS centro,
  COUNT(*) AS total_duplicadas
FROM incidencias
JOIN instituciones ON incidencias.centro_id = instituciones.id
WHERE incidencias.es_duplicada = TRUE
  AND incidencias.estado_cliente = 'Anulada'
GROUP BY instituciones.nombre
ORDER BY total_duplicadas DESC;
```

Esta información es útil para:
- Revisiones periódicas (mensuales/trimestrales)
- Identificar centros problemáticos
- Planificar sesiones de formación con conserjes
- Ajustar procesos de comunicación

### ¿Qué estados permiten qué acciones?

**Control - Chat Control-Cliente:**
- Sin proveedor: Asignar proveedor, Anular (con opción de marcar como duplicada), Poner en espera
- Con proveedor: Ver chat, Ir al chat proveedor

**Control - Chat Proveedor:**
- Ofertada: Gestionar presupuesto (aprobar o rechazar)
- Resuelta: Valorar incidencia (validar resolución técnica)
- Valorada: Aprobar y cerrar incidencia o Rechazar resolución
- Revisar resolución: Esperar a que proveedor corrija y reenvíe
- Cualquier estado (excepto Cerrada/Anulada): Resolver como proveedor, Anular asignación

**Proveedor:**
- Abierta/En resolución: Calendarizar visita, Ofertar presupuesto, Resolver incidencia
- Oferta aprobada: Calendarizar visita, Resolver incidencia
- Oferta a revisar: Ofertar presupuesto nuevamente (corregido)
- Pendiente valoración: Valorar económicamente (tras validación técnica de Control)
- Revisar resolución: Resolver como proveedor (editar y reenviar lo rechazado)

---

## Soporte

Para consultas adicionales o problemas técnicos, contactar con el equipo de soporte técnico.

**Última actualización:** Enero 2025
**Versión del sistema:** 1.0
