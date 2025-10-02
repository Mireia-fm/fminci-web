'use client';

/**
 * ErrorBoundary Component
 *
 * Captura errores de React que ocurren en cualquier parte del árbol de componentes
 * y muestra una UI de fallback en lugar de crashear toda la aplicación.
 *
 * Uso:
 * <ErrorBoundary>
 *   <TuComponente />
 * </ErrorBoundary>
 */

import { Component, ReactNode } from 'react';
import { isProduction } from '@/lib/env';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Actualizar estado para mostrar UI de fallback en el siguiente render
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log del error
    console.error('❌ Error capturado por ErrorBoundary:', error);
    console.error('📍 Component stack:', errorInfo.componentStack);

    // Callback personalizado si se proporciona
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // En producción, enviar a servicio de logging
    if (isProduction()) {
      this.logErrorToService(error, errorInfo);
    }

    // Actualizar estado con información adicional
    this.setState({ errorInfo });
  }

  /**
   * Envía el error a un servicio de logging externo
   * Aquí puedes integrar Sentry, LogRocket, Datadog, etc.
   */
  private logErrorToService(_error: Error, _errorInfo: React.ErrorInfo) {
    // Ejemplo con Sentry:
    // Sentry.captureException(error, {
    //   contexts: {
    //     react: {
    //       componentStack: errorInfo.componentStack,
    //     },
    //   },
    // });

    // O enviar a tu propio backend:
    // fetch('/api/log-error', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     error: {
    //       message: error.message,
    //       stack: error.stack,
    //     },
    //     errorInfo: {
    //       componentStack: errorInfo.componentStack,
    //     },
    //     timestamp: new Date().toISOString(),
    //     userAgent: navigator.userAgent,
    //     url: window.location.href,
    //   }),
    // }).catch(console.error);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      // Si se proporciona un fallback personalizado, usarlo
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // UI de fallback por defecto
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
              <svg
                className="w-6 h-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
              Algo salió mal
            </h2>

            <p className="text-gray-600 text-center mb-6">
              Ha ocurrido un error inesperado. Intenta recargar la página o
              contacta a soporte si el problema persiste.
            </p>

            {!isProduction() && this.state.error && (
              <details className="mb-6 p-4 bg-gray-100 rounded-lg text-sm">
                <summary className="cursor-pointer font-semibold text-gray-700 mb-2">
                  Detalles del error (solo en desarrollo)
                </summary>
                <div className="mt-2 space-y-2">
                  <div>
                    <strong className="text-gray-700">Mensaje:</strong>
                    <p className="text-red-600 font-mono text-xs mt-1">
                      {this.state.error.message}
                    </p>
                  </div>
                  {this.state.error.stack && (
                    <div>
                      <strong className="text-gray-700">Stack trace:</strong>
                      <pre className="text-xs text-gray-600 mt-1 overflow-x-auto whitespace-pre-wrap">
                        {this.state.error.stack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Recargar página
              </button>

              <button
                onClick={this.handleReset}
                className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                Intentar de nuevo
              </button>
            </div>

            <button
              onClick={() => (window.location.href = '/')}
              className="w-full mt-3 text-gray-600 hover:text-gray-800 text-sm underline"
            >
              Volver al inicio
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
