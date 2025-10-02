/**
 * Validación de variables de entorno
 *
 * Este archivo valida que todas las variables de entorno requeridas
 * estén presentes al inicio de la aplicación.
 *
 * Si falta alguna variable, la app no arrancará y mostrará un error claro.
 */

// Variables requeridas en TODAS las ejecuciones
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
] as const;

// Variables requeridas solo en desarrollo
const devOnlyEnvVars = [] as const;

// Variables requeridas solo en producción
const prodOnlyEnvVars = [] as const;

type RequiredEnvVar = typeof requiredEnvVars[number];

/**
 * Valida que todas las variables de entorno requeridas estén presentes
 * @throws {Error} Si falta alguna variable requerida
 */
export function validateEnv(): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Verificar variables requeridas siempre
  const missing = requiredEnvVars.filter(
    (key) => !process.env[key] || process.env[key] === ''
  );

  // Verificar variables específicas de ambiente
  if (isDevelopment) {
    const missingDev = devOnlyEnvVars.filter(
      (key) => !process.env[key] || process.env[key] === ''
    );
    missing.push(...missingDev);
  }

  if (isProduction) {
    const missingProd = prodOnlyEnvVars.filter(
      (key) => !process.env[key] || process.env[key] === ''
    );
    missing.push(...missingProd);
  }

  if (missing.length > 0) {
    const errorMessage = [
      '❌ Error: Faltan variables de entorno requeridas:',
      '',
      ...missing.map(key => `  - ${key}`),
      '',
      '📝 Copia .env.example a .env.local y completa los valores.',
      '📚 Docs: README.md',
    ].join('\n');

    throw new Error(errorMessage);
  }

  // Verificar formato de URLs
  validateUrl('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL!);

  if (process.env.NEXT_PUBLIC_APP_URL) {
    validateUrl('NEXT_PUBLIC_APP_URL', process.env.NEXT_PUBLIC_APP_URL);
  }
}

/**
 * Valida que una variable de entorno sea una URL válida
 */
function validateUrl(name: string, value: string): void {
  try {
    new URL(value);
  } catch {
    throw new Error(
      `❌ Error: ${name} no es una URL válida.\n` +
      `Valor actual: "${value}"\n` +
      `Formato esperado: https://ejemplo.com`
    );
  }
}

/**
 * Obtiene una variable de entorno de forma segura
 * @param key - Nombre de la variable
 * @returns El valor de la variable
 * @throws {Error} Si la variable no existe
 */
export function getEnvVar(key: RequiredEnvVar): string {
  const value = process.env[key];

  if (!value || value === '') {
    throw new Error(
      `❌ Error: Variable de entorno "${key}" no está definida.\n` +
      `Asegúrate de que existe en .env.local`
    );
  }

  return value;
}

/**
 * Verifica si estamos en entorno de producción
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Verifica si estamos en entorno de desarrollo
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Verifica si el modo debug está habilitado
 */
export function isDebugMode(): boolean {
  return process.env.NEXT_PUBLIC_DEBUG_MODE === 'true';
}

// Validar al cargar el módulo (solo en servidor)
if (typeof window === 'undefined') {
  validateEnv();
}
