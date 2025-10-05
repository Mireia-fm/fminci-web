# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 15 incident management system (FMINCI) built with TypeScript, React 19, and Supabase. The application manages incidents/cases for multiple institutions with role-based access control for different user types: Control (admin), Gestor (manager), Cliente (client), and Proveedor (provider).

## Essential Commands

```bash
# Development
npm run dev              # Start Next.js dev server on http://localhost:3000

# Production
npm run build            # Build for production (type-checks entire codebase)
npm start                # Start production server

# Quality
npm run lint             # Run ESLint

# Database/Storage Utilities (legacy migration scripts)
npm run migrate-storage  # Run storage migration script
npm run check-storage    # Check storage status
```

## Architecture Overview

### Application Structure

The app uses Next.js App Router with route groups:

- **`app/(app)/`** - Protected routes requiring authentication
  - Layout includes Topbar, Sidebar, and session guard
  - Main routes: `/` (dashboard), `/incidencias` (incidents list), `/incidencias/[id]/chat-*` (chat views)
  - `/control/*` - Admin panel (centros, alertas, proveedores, presupuestos) - restricted to "Control" role
  - `/calendario` - Provider calendar

- **`app/(auth)/`** - Public authentication routes
  - `/login` - Email/password login via Supabase Auth

### Key Components

- **`DashboardCliente.tsx`** - Main dashboard for clients/managers showing incident metrics by state, supports multi-institution views and center-specific views for "Gestor" role
- **`DashboardProveedor.tsx`** - Provider dashboard showing assigned incidents
- **`ModalAsignarProveedor.tsx`** - Modal for assigning providers to incidents
- **`NotificacionesProveedor.tsx`** - Provider notification system for new assignments
- **`SearchableSelect.tsx`** - Reusable searchable dropdown component
- **`Sidebar.tsx` / `Topbar.tsx`** - Navigation components

### Data Layer

**Supabase Client**: `lib/supabaseClient.ts` - Singleton Supabase client instance

**Key Database Tables** (referenced throughout codebase):
- `personas` - Users with email, rol (Control/Gestor/Cliente/Proveedor), acceso_todos_centros flag
- `personas_instituciones` - Many-to-many relationship between users and institutions
- `instituciones` - Centers/institutions (tipo: 'Centro' or 'Proveedor'). Providers are stored as institutions with tipo='Proveedor'
- `incidencias` - Core incidents table with estado_cliente, descripcion, num_solicitud, fecha, etc.
- `proveedor_casos` - Provider assignments with estado_proveedor, prioridad, activo flag. Links to instituciones table via proveedor_id
- `historial_estados` - State change audit log (tracks cliente/proveedor state transitions)
- `citas_proveedores` - Provider appointments for calendar

**Important Views**:
- `v_incidencias_por_estado` - Aggregated incident counts by estado_cliente (for Control users)

**State Management Helper**: `lib/historialEstados.ts`
- `registrarCambioEstado()` / `registrarCambiosEstado()` - Log state transitions
- `obtenerHistorialEstados()` - Retrieve state history for an incident

### User Roles & Access Control

The application implements role-based access at the data query level:

1. **Control** - Full access, uses global views (`v_incidencias_por_estado`)
2. **Gestor** - Access to specific institutions via `personas_instituciones`, can see all centers within assigned institutions
3. **Cliente** - Similar to Gestor but typically institution-specific
4. **Proveedor** - Access only to assigned cases via `proveedor_casos` with `activo=true`

Users with `acceso_todos_centros=true` bypass institution restrictions and see global data.

### Color Palette (PALETA)

The app uses a consistent color scheme defined in components:
- Background: `#5D6D52` (olive green)
- Text: `#EDF0E9` (light), `#4b4b4b` (dark)
- State colors: Various beiges, yellows, pinks for different incident states

## Development Workflow

### Working with Incidents

- Incidents have dual states: `estado_cliente` (client-facing) and `estado_proveedor` (provider-facing)
- State transitions MUST be logged via `registrarCambioEstado()` or `registrarCambiosEstado()`
- When querying incidents, always join with relevant tables: `instituciones`, `proveedor_casos`
- Providers are stored in `instituciones` table with tipo='Proveedor', not in a separate table

### Authentication Flow

1. Login via `app/(auth)/login/page.tsx` using Supabase Auth
2. Protected routes check session in `app/(app)/layout.tsx` via `supabase.auth.getSession()`
3. User role determined by querying `personas` table with authenticated email
4. Role stored in sessionStorage as 'tipoUsuario' for quick access

### Type Safety

- TypeScript strict mode enabled
- Path alias: `@/*` maps to project root
- Define component-level types for Supabase query results (e.g., `type Incidencia`)
- When working with providers, use the `instituciones` table with tipo='Proveedor'

### Building for Production

When running `npm run build`, Next.js will:
- Type-check all TypeScript files
- Build optimized bundles
- Generate static pages where possible
- Fail if there are TypeScript errors

Always fix type errors before deployment. Common issues:
- Missing null checks on Supabase query results
- Untyped props in components
- Inconsistent state types

## Important Notes

- Environment variables MUST include `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Many root-level `.js` files are legacy migration scripts for Wix → Supabase data migration (can be ignored for new development)
- The app uses Next.js 15's experimental features including React 19
- RLS (Row Level Security) policies in Supabase control data access - when debugging access issues, check both app logic AND database policies
