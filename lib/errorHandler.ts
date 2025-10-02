/**
 * Error Handler para Supabase y manejo general de errores
 *
 * Proporciona funciones helper para manejar errores de forma consistente
 * en toda la aplicación.
 */

import { isProduction, isDebugMode } from './env';
import { PostgrestError } from '@supabase/supabase-js';

/**
 * Tipo de error de Supabase extendido
 */
export type SupabaseError = PostgrestError | Error | null;

/**
 * Contexto adicional para el error
 */
export interface ErrorContext {
  operation?: string;
  resource?: string;
  userId?: string;
  additionalData?: Record<string, unknown>;
}

/**
 * Maneja errores de Supabase de forma consistente
 *
 * @param error - El error de Supabase
 * @param context - Contexto adicional sobre dónde ocurrió el error
 * @returns Mensaje amigable para el usuario
 *
 * @example
 * ```typescript
 * const { data, error } = await supabase.from('incidencias').select();
 * if (error) {
 *   const userMessage = handleSupabaseError(error, 'obtener incidencias');
 *   toast.error(userMessage);
 *   return;
 * }
 * ```
 */
export function handleSupabaseError(
  error: SupabaseError,
  context?: string | ErrorContext
): string {
  if (!error) return 'Error desconocido';

  // Normalizar contexto
  const ctx = typeof context === 'string' ? { operation: context } : context;

  // Log completo en desarrollo
  if (!isProduction() || isDebugMode()) {
    console.error('🔴 Error de Supabase:', {
      error,
      context: ctx,
      timestamp: new Date().toISOString(),
    });
  }

  // Log en producción (enviar a servicio externo)
  if (isProduction()) {
    logErrorToService(error, ctx);
  }

  // Obtener mensaje del error
  const errorMessage = 'message' in error ? error.message : String(error);

  // Mapear errores comunes a mensajes amigables
  const userMessage = getUserFriendlyMessage(errorMessage, ctx?.operation);

  return userMessage;
}

/**
 * Mapea mensajes de error técnicos a mensajes amigables para el usuario
 */
function getUserFriendlyMessage(
  technicalMessage: string,
  operation?: string
): string {
  const lowerMessage = technicalMessage.toLowerCase();

  // Errores de autenticación
  if (lowerMessage.includes('jwt') || lowerMessage.includes('token')) {
    return 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.';
  }

  // Errores de permisos (RLS)
  if (lowerMessage.includes('row-level security') || lowerMessage.includes('rls')) {
    return 'No tienes permisos para realizar esta acción.';
  }

  if (lowerMessage.includes('permission denied') || lowerMessage.includes('forbidden')) {
    return 'No tienes permisos suficientes para esta operación.';
  }

  // Errores de conexión
  if (lowerMessage.includes('network') || lowerMessage.includes('fetch failed')) {
    return 'Problema de conexión. Verifica tu internet e intenta nuevamente.';
  }

  if (lowerMessage.includes('timeout')) {
    return 'La operación tardó demasiado. Intenta nuevamente.';
  }

  // Errores de validación
  if (lowerMessage.includes('unique constraint') || lowerMessage.includes('duplicate key')) {
    return 'Este registro ya existe en el sistema.';
  }

  if (lowerMessage.includes('foreign key constraint')) {
    return 'No se puede completar la operación: hay referencias dependientes.';
  }

  if (lowerMessage.includes('not null constraint')) {
    return 'Falta información requerida. Completa todos los campos obligatorios.';
  }

  if (lowerMessage.includes('check constraint')) {
    return 'Los datos ingresados no son válidos.';
  }

  // Errores de no encontrado
  if (lowerMessage.includes('not found') || lowerMessage.includes('no rows')) {
    return operation
      ? `No se encontró el registro solicitado (${operation}).`
      : 'No se encontró el registro solicitado.';
  }

  // Errores de tamaño/límites
  if (lowerMessage.includes('payload too large')) {
    return 'El archivo o datos son demasiado grandes. Intenta con un tamaño menor.';
  }

  // Error genérico pero con contexto
  if (operation) {
    return `Error al ${operation}. Por favor, intenta nuevamente.`;
  }

  // Fallback: mostrar mensaje técnico solo en desarrollo
  if (!isProduction()) {
    return `Error: ${technicalMessage}`;
  }

  return 'Ocurrió un error inesperado. Por favor, intenta nuevamente.';
}

/**
 * Envía el error a un servicio de logging externo
 * Implementa aquí la integración con Sentry, LogRocket, etc.
 */
function logErrorToService(_error: SupabaseError, _context?: ErrorContext) {
  // Ejemplo con Sentry:
  // if (typeof window !== 'undefined' && window.Sentry) {
  //   window.Sentry.captureException(error, {
  //     contexts: {
  //       supabase: context,
  //     },
  //   });
  // }

  // O enviar a tu propio backend:
  // fetch('/api/log-error', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({
  //     error: {
  //       message: 'message' in error ? error.message : String(error),
  //       code: 'code' in error ? error.code : undefined,
  //     },
  //     context,
  //     timestamp: new Date().toISOString(),
  //     userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
  //     url: typeof window !== 'undefined' ? window.location.href : undefined,
  //   }),
  // }).catch(console.error);
}

/**
 * Maneja errores generales (no específicos de Supabase)
 *
 * @example
 * ```typescript
 * try {
 *   // código que puede fallar
 * } catch (error) {
 *   const message = handleError(error, 'procesar datos');
 *   toast.error(message);
 * }
 * ```
 */
export function handleError(error: unknown, context?: string): string {
  // Log en desarrollo
  if (!isProduction() || isDebugMode()) {
    console.error('🔴 Error general:', {
      error,
      context,
      timestamp: new Date().toISOString(),
    });
  }

  // Si es un error de Supabase, usar su handler
  if (error && typeof error === 'object' && 'message' in error) {
    return handleSupabaseError(error as SupabaseError, context);
  }

  // Error desconocido
  if (context) {
    return `Error al ${context}. Por favor, intenta nuevamente.`;
  }

  return 'Ocurrió un error inesperado. Por favor, intenta nuevamente.';
}

/**
 * Wrapper para funciones async que maneja errores automáticamente
 *
 * @example
 * ```typescript
 * const result = await withErrorHandling(
 *   () => supabase.from('incidencias').select(),
 *   'cargar incidencias'
 * );
 * ```
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  context?: string
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    const message = handleError(error, context);
    throw new Error(message);
  }
}

/**
 * Assert que algo no es null/undefined
 * Útil para validaciones que deberían ser imposibles
 */
export function assert(
  condition: unknown,
  message: string = 'Assertion failed'
): asserts condition {
  if (!condition) {
    const error = new Error(message);
    console.error('❌ Assertion failed:', error);

    if (isProduction()) {
      logErrorToService(error, { operation: 'assertion', additionalData: { message } });
    }

    throw error;
  }
}

/**
 * Tipos de notificación para mostrar al usuario
 */
export type NotificationType = 'success' | 'error' | 'warning' | 'info';

/**
 * Interface para un sistema de notificaciones
 * Implementa esto con tu biblioteca preferida (react-hot-toast, sonner, etc.)
 */
export interface NotificationSystem {
  show: (message: string, type: NotificationType) => void;
}

// Variable global para el sistema de notificaciones
let notificationSystem: NotificationSystem | null = null;

/**
 * Registra el sistema de notificaciones
 * Llama esto una vez al inicio de la app
 */
export function registerNotificationSystem(system: NotificationSystem) {
  notificationSystem = system;
}

/**
 * Muestra una notificación al usuario
 */
export function notify(message: string, type: NotificationType = 'info') {
  if (notificationSystem) {
    notificationSystem.show(message, type);
  } else {
    // Fallback a console si no hay sistema registrado
    console.log(`[${type.toUpperCase()}] ${message}`);
  }
}
