import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import {
  obtenerComentarios,
  crearComentario,
  type Comentario,
  type NuevoComentario,
  type AmbitoComentario
} from '@/lib/services/comentariosService';

/**
 * Custom hook para gestionar lógica común de chat
 * Maneja: usuario, comentarios, envío de mensajes
 */

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  rol: string;
}

export interface UseChatOptions {
  incidenciaId: string;
  ambito: AmbitoComentario;
  onComentarioEnviado?: () => void;
  autoScroll?: boolean;
}

export function useChat({ incidenciaId, ambito, onComentarioEnviado, autoScroll = true }: UseChatOptions) {
  const router = useRouter();

  // Estados de usuario
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loadingUsuario, setLoadingUsuario] = useState(true);

  // Estados de comentarios
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [loadingComentarios, setLoadingComentarios] = useState(true);

  // Estados de envío
  const [nuevoComentario, setNuevoComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);

  /**
   * Cargar datos del usuario autenticado
   */
  const cargarUsuario = useCallback(async () => {
    try {
      setLoadingUsuario(true);

      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError || !userData.user?.email) {
        router.push('/login');
        return null;
      }

      const userEmail = userData.user.email;

      const { data: persona, error: personaError } = await supabase
        .from('personas')
        .select('id, rol, nombre, email')
        .eq('email', userEmail)
        .maybeSingle();

      if (personaError || !persona) {
        console.error('Error cargando persona:', personaError);
        return null;
      }

      const usuarioData: Usuario = {
        id: persona.id,
        email: persona.email,
        nombre: persona.nombre || userEmail,
        rol: persona.rol
      };

      setUsuario(usuarioData);
      return usuarioData;
    } catch (error) {
      console.error('Error en cargarUsuario:', error);
      return null;
    } finally {
      setLoadingUsuario(false);
    }
  }, [router]);

  /**
   * Cargar comentarios del chat
   */
  const cargarComentarios = useCallback(async () => {
    try {
      setLoadingComentarios(true);
      const comentariosData = await obtenerComentarios(incidenciaId, ambito);
      setComentarios(comentariosData);
    } catch (error) {
      console.error('Error cargando comentarios:', error);
      setComentarios([]);
    } finally {
      setLoadingComentarios(false);
    }
  }, [incidenciaId, ambito]);

  /**
   * Enviar un comentario
   */
  const enviarComentario = useCallback(async (
    cuerpo: string,
    imagenUrl?: string | null,
    documentoUrl?: string | null,
    esSistema: boolean = false
  ) => {
    if (!usuario) {
      setErrorEnvio('Usuario no autenticado');
      return null;
    }

    if (!cuerpo.trim() && !imagenUrl && !documentoUrl) {
      setErrorEnvio('El comentario no puede estar vacío');
      return null;
    }

    try {
      setEnviando(true);
      setErrorEnvio(null);

      const nuevoComentarioData: NuevoComentario = {
        incidencia_id: incidenciaId,
        ambito,
        autor_id: usuario.id,
        autor_email: usuario.email,
        autor_rol: usuario.rol,
        cuerpo: cuerpo.trim(),
        es_sistema: esSistema
      };

      const comentarioCreado = await crearComentario(nuevoComentarioData);

      if (!comentarioCreado) {
        setErrorEnvio('Error al crear el comentario');
        return null;
      }

      // Recargar comentarios
      await cargarComentarios();

      // Limpiar campo
      setNuevoComentario('');

      // Callback opcional
      if (onComentarioEnviado) {
        onComentarioEnviado();
      }

      return comentarioCreado;
    } catch (error) {
      console.error('Error enviando comentario:', error);
      setErrorEnvio('Error inesperado al enviar comentario');
      return null;
    } finally {
      setEnviando(false);
    }
  }, [usuario, incidenciaId, ambito, cargarComentarios, onComentarioEnviado]);

  /**
   * Crear comentario del sistema (automático)
   */
  const enviarComentarioSistema = useCallback(async (mensaje: string) => {
    return await enviarComentario(mensaje, null, null, true);
  }, [enviarComentario]);

  /**
   * Recargar todos los datos del chat
   */
  const recargar = useCallback(async () => {
    await Promise.all([
      cargarUsuario(),
      cargarComentarios()
    ]);
  }, [cargarUsuario, cargarComentarios]);

  // Cargar usuario al montar
  useEffect(() => {
    cargarUsuario();
  }, [cargarUsuario]);

  // Cargar comentarios cuando hay usuario
  useEffect(() => {
    if (usuario) {
      cargarComentarios();
    }
  }, [usuario, cargarComentarios]);

  return {
    // Usuario
    usuario,
    loadingUsuario,

    // Comentarios
    comentarios,
    loadingComentarios,

    // Envío
    nuevoComentario,
    setNuevoComentario,
    enviarComentario,
    enviarComentarioSistema,
    enviando,
    errorEnvio,

    // Utilidades
    recargar,
    loading: loadingUsuario || loadingComentarios
  };
}

/**
 * Hook para suscripción en tiempo real a comentarios
 * Útil para actualizar chat automáticamente cuando otros usuarios comentan
 */
export function useChatRealtime(incidenciaId: string, onNuevoComentario?: (comentario: Comentario) => void) {
  const [conectado, setConectado] = useState(false);

  useEffect(() => {
    // Suscribirse a cambios en comentarios de esta incidencia
    const channel = supabase
      .channel(`comentarios:${incidenciaId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comentarios',
          filter: `incidencia_id=eq.${incidenciaId}`
        },
        (payload) => {
          console.log('Nuevo comentario recibido:', payload);
          if (onNuevoComentario && payload.new) {
            onNuevoComentario(payload.new as Comentario);
          }
        }
      )
      .subscribe((status) => {
        setConectado(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [incidenciaId, onNuevoComentario]);

  return { conectado };
}

/**
 * Hook para scroll automático al último mensaje
 */
export function useAutoScroll(dependency: unknown[]) {
  const [shouldScroll, setShouldScroll] = useState(true);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const messagesEnd = document.getElementById('messages-end');
    if (messagesEnd && shouldScroll) {
      messagesEnd.scrollIntoView({ behavior });
    }
  }, [shouldScroll]);

  useEffect(() => {
    if (shouldScroll) {
      scrollToBottom();
    }
  }, [...dependency, shouldScroll]);

  return {
    scrollToBottom,
    shouldScroll,
    setShouldScroll
  };
}

/**
 * Hook para formatear mensajes del chat
 */
export function useChatFormatting() {
  const formatearFecha = (fecha: string) => {
    const date = new Date(fecha);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatearHora = (fecha: string) => {
    const date = new Date(fecha);
    return date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatearFechaCompleta = (fecha: string) => {
    return `${formatearFecha(fecha)} ${formatearHora(fecha)}`;
  };

  const obtenerIniciales = (nombre: string) => {
    const palabras = nombre.split(' ');
    if (palabras.length === 1) {
      return palabras[0].substring(0, 2).toUpperCase();
    }
    return (palabras[0][0] + palabras[1][0]).toUpperCase();
  };

  return {
    formatearFecha,
    formatearHora,
    formatearFechaCompleta,
    obtenerIniciales
  };
}
