# 🚀 Guía de Deployment - FMINCI Web

**Fecha:** 2025-10-02
**Versión:** Pre-producción v1.0

---

## 📋 Pre-Deployment Checklist

### ✅ Completado

- [x] Variables de entorno validadas
- [x] ErrorBoundary implementado
- [x] Error handling centralizado
- [x] Loading states creados
- [x] Build exitoso localmente
- [x] RLS habilitado en todas las tablas
- [x] Roles nativos de PostgreSQL implementados
- [x] AuthContext centralizado
- [x] Queries optimizadas (N+1 resuelto)

### ⚠️ Pendiente (No bloqueante para prueba)

- [ ] Validación de formularios con Zod
- [ ] Optimización de imágenes (<Image />)
- [ ] Storage policies revisadas
- [ ] Tests automatizados
- [ ] Monitoring/logging configurado

---

## 🎯 Plataformas Recomendadas

### Opción 1: Vercel (Recomendada) ⭐
**Ventajas:**
- Integración nativa con Next.js
- Deploy automático desde Git
- SSL gratuito
- CDN global
- Preview deployments por PR
- Logs y analytics incluidos

**Pasos:**
1. Conectar repositorio de GitHub
2. Configurar variables de entorno
3. Deploy automático

### Opción 2: Netlify
**Ventajas:**
- Similar a Vercel
- Funciones serverless
- Deploy previews

### Opción 3: Railway / Render
**Ventajas:**
- Más control sobre infraestructura
- Docker support
- Databases incluidas

---

## 🔧 Deployment en Vercel (Recomendado)

### Paso 1: Preparar el Repositorio

```bash
# 1. Asegurarse de que todo está commiteado
git status

# 2. Si hay cambios pendientes, commitearlos
git add .
git commit -m "feat: Preparar para deployment de prueba

- Variables de entorno validadas
- ErrorBoundary implementado
- Error handling centralizado
- Loading components creados
- Build exitoso
"

# 3. Push al repositorio
git push origin main
```

### Paso 2: Crear Cuenta en Vercel

1. Ir a [vercel.com](https://vercel.com)
2. Sign up con GitHub
3. Autorizar acceso a repositorios

### Paso 3: Importar Proyecto

1. Click en "Add New Project"
2. Seleccionar repositorio `fminci-web`
3. Click en "Import"

### Paso 4: Configurar Build Settings

Vercel detectará automáticamente Next.js:

```
Framework Preset: Next.js
Build Command: npm run build
Output Directory: .next
Install Command: npm install
```

**✅ No necesitas cambiar nada, Vercel lo detecta automáticamente**

### Paso 5: Configurar Variables de Entorno

En Vercel Dashboard → Settings → Environment Variables:

```bash
# Variables REQUERIDAS (copiar desde .env.local)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Variables opcionales
NEXT_PUBLIC_APP_URL=https://tu-dominio.vercel.app
NODE_ENV=production

# Si tienes analytics/monitoring
# NEXT_PUBLIC_SENTRY_DSN=...
# NEXT_PUBLIC_GA_ID=...
```

**⚠️ IMPORTANTE:**
- Marca todas como "Production", "Preview", y "Development"
- Nunca expongas `SUPABASE_SERVICE_ROLE_KEY` en variables que empiecen con `NEXT_PUBLIC_`

### Paso 6: Deploy

1. Click en "Deploy"
2. Esperar ~2-3 minutos
3. Vercel te dará una URL: `https://fminci-web-xxx.vercel.app`

---

## 🧪 Verificación Post-Deployment

### 1. Verificar que la App Carga

```bash
# Abrir en navegador
https://tu-proyecto.vercel.app
```

**Checklist:**
- [ ] La página de login carga correctamente
- [ ] Los estilos se ven correctamente
- [ ] No hay errores en consola del navegador

### 2. Verificar Autenticación

**Test como cada rol:**

1. **Login como Control:**
   - Email: [tu-email-control]
   - Verificar acceso a panel de control
   - Verificar que ve todas las incidencias

2. **Login como Gestor:**
   - Verificar dashboard de cliente
   - Verificar filtrado por centros asignados

3. **Login como Proveedor:**
   - Verificar notificaciones
   - Verificar casos asignados

### 3. Verificar Funcionalidad Core

```
✅ Tareas a verificar:
[ ] Ver lista de incidencias
[ ] Filtrar incidencias por estado
[ ] Ver detalle de incidencia
[ ] Crear nueva incidencia (si eres Control/Gestor)
[ ] Ver comentarios
[ ] Cambiar estado de incidencia
[ ] Ver calendario (si hay citas)
```

### 4. Verificar Errores en Vercel Logs

1. Ir a Vercel Dashboard → tu proyecto
2. Click en "Functions" o "Runtime Logs"
3. Buscar errores rojos
4. Si hay errores, revisar y corregir

### 5. Performance Check

```bash
# Lighthouse en Chrome DevTools
1. Abrir Chrome DevTools (F12)
2. Tab "Lighthouse"
3. Click "Generate report"
```

**Métricas objetivo:**
- Performance: >70
- Accessibility: >90
- Best Practices: >90
- SEO: >80

---

## 🐛 Troubleshooting Común

### Error: "Module not found"

**Causa:** Dependencia falta en package.json

**Solución:**
```bash
npm install
npm run build  # Verificar localmente
git commit -am "fix: Agregar dependencias faltantes"
git push
```

### Error: "Environment variable not defined"

**Causa:** Variables de entorno no configuradas en Vercel

**Solución:**
1. Vercel Dashboard → Settings → Environment Variables
2. Agregar variable faltante
3. Hacer Redeploy

### Error: "Failed to connect to Supabase"

**Causa:**
- URL o keys incorrectas
- Supabase project pausado

**Solución:**
1. Verificar variables en Vercel
2. Verificar que proyecto Supabase esté activo
3. Verificar que CORS esté configurado en Supabase:
   - Dashboard → Settings → API
   - Site URL: agregar `https://tu-proyecto.vercel.app`

### Error 500: "Internal Server Error"

**Causa:** Error en servidor (RLS, queries, etc.)

**Solución:**
1. Ver Vercel Runtime Logs
2. Reproducir error localmente
3. Revisar que RLS permite las queries

---

## 🔒 Configuración de Supabase para Producción

### 1. Configurar Site URL

```
Supabase Dashboard → Authentication → URL Configuration

Site URL: https://tu-proyecto.vercel.app
Redirect URLs: https://tu-proyecto.vercel.app/**
```

### 2. Configurar CORS (si es necesario)

```sql
-- Solo si tienes errores de CORS
-- Normalmente no es necesario con Supabase
```

### 3. Revisar Rate Limits

```
Supabase Dashboard → Settings → API

Rate Limiting:
- Anonymous key: 100 requests/10 seconds (default está bien para prueba)
- Service role: Sin límite
```

### 4. Backup de Base de Datos (Recomendado)

```bash
# Desde Supabase Dashboard
Project → Database → Backups → Enable automatic backups
```

---

## 📊 Monitoreo Post-Deployment

### Vercel Analytics (Gratuito)

1. Vercel Dashboard → tu proyecto
2. Tab "Analytics"
3. Ver métricas:
   - Visitantes
   - Page views
   - Tiempo de carga

### Vercel Logs

```
Vercel Dashboard → tu proyecto → Functions → Runtime Logs

Buscar:
- Errores 500
- Timeouts
- Errores de RLS
```

### Supabase Logs

```
Supabase Dashboard → Logs → Postgres Logs

Filtrar por:
- Errores de RLS
- Queries lentas
- Conexiones fallidas
```

---

## 🔄 Workflow de Desarrollo Continuo

### Para Cada Cambio:

```bash
# 1. Desarrollar localmente
npm run dev

# 2. Probar cambios
npm run build  # Verificar que compila

# 3. Commit
git add .
git commit -m "feat: Descripción del cambio"

# 4. Push
git push origin main

# 5. Vercel hace deploy automático
# 6. Verificar en URL de preview o producción
```

### Preview Deployments

```bash
# Crear branch para feature
git checkout -b feature/nueva-funcionalidad

# Desarrollar y commitear
git add .
git commit -m "feat: Nueva funcionalidad"

# Push al branch
git push origin feature/nueva-funcionalidad

# Vercel crea preview deployment automático
# URL: https://fminci-web-git-feature-nueva-funcionali-xxx.vercel.app
```

---

## 🎯 Próximos Pasos Después del Deployment

### Inmediato (Siguientes horas)
1. [ ] Probar todas las funcionalidades en producción
2. [ ] Compartir URL con equipo para testing
3. [ ] Recopilar feedback
4. [ ] Verificar logs por 24 horas

### Corto Plazo (Siguientes días)
1. [ ] Completar validación de formularios (Zod)
2. [ ] Optimizar imágenes (<Image />)
3. [ ] Configurar dominio personalizado
4. [ ] Configurar Sentry para error tracking

### Medio Plazo (Siguiente semana)
1. [ ] Implementar Fase 3 (comentariosService, presupuestosService)
2. [ ] Agregar tests automatizados
3. [ ] Performance optimization
4. [ ] Documentación de usuario

---

## 📞 Comandos Útiles

```bash
# Ver build localmente (simula producción)
npm run build && npm start

# Ver versión de Next.js
npx next --version

# Limpiar caché de Next.js
rm -rf .next

# Ver tamaño del bundle
npm install -g @next/bundle-analyzer
ANALYZE=true npm run build

# Ver variables de entorno (en desarrollo)
node -e "console.log(process.env)"
```

---

## 🆘 Soporte

### Documentación Oficial
- Next.js: https://nextjs.org/docs
- Vercel: https://vercel.com/docs
- Supabase: https://supabase.com/docs

### Si hay problemas:

1. **Revisar logs:**
   - Vercel Runtime Logs
   - Supabase Postgres Logs
   - Browser Console

2. **Verificar variables de entorno:**
   - Vercel Dashboard → Settings → Environment Variables
   - Hacer redeploy si cambias variables

3. **Verificar RLS:**
   - Supabase Dashboard → Table Editor → Policies
   - Security Advisors

---

## ✅ Checklist Final Pre-Go-Live

Antes de compartir con usuarios reales:

### Seguridad
- [ ] RLS habilitado en todas las tablas
- [ ] Variables de entorno correctas
- [ ] HTTPS habilitado (automático con Vercel)
- [ ] Service Role Key NUNCA expuesta en cliente
- [ ] CORS configurado correctamente

### Funcionalidad
- [ ] Todos los roles pueden hacer login
- [ ] CRUD de incidencias funciona
- [ ] Comentarios se crean correctamente
- [ ] Estados se actualizan
- [ ] Notificaciones funcionan

### Performance
- [ ] Lighthouse score >70
- [ ] Tiempo de carga <3s
- [ ] Sin errores en consola
- [ ] Imágenes cargan correctamente

### UX
- [ ] Loading states funcionan
- [ ] ErrorBoundary captura errores
- [ ] Mensajes de error son amigables
- [ ] Responsive en móvil/tablet/desktop

---

**¡Listo para deployment!** 🚀

**Comando para empezar:**
```bash
git status
git add .
git commit -m "chore: Preparar para deployment de prueba"
git push origin main
```

Luego ve a [vercel.com](https://vercel.com) e importa el proyecto.
