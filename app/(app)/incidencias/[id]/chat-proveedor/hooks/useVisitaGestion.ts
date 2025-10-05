import { useState } from 'react';
import { calendarizarVisita } from '@/lib/services/citasService';

/**
 * Tipo de visita calendarizada
 */
type VisitaCalendarizada = {
  fecha: string;
  horario: string;
} | null;

interface Perfil {
  persona_id: string;
  email: string;
  rol: string;
}

/**
 * Hook para gestionar la calendarización de visitas
 */
export function useVisitaGestion(
  incidenciaId: string,
  perfil: Perfil | null,
  cargarDatos: () => void
) {
  // Estados del modal
  const [mostrarModalVisita, setMostrarModalVisita] = useState(false);
  const [fechaVisita, setFechaVisita] = useState('');
  const [horarioVisita, setHorarioVisita] = useState('');

  // Estado de la visita calendarizada
  const [visitaCalendarizada, setVisitaCalendarizada] = useState<VisitaCalendarizada>(null);

  // Estado de envío
  const [enviando, setEnviando] = useState(false);

  /**
   * Calendarizar visita
   */
  const handleCalendarizarVisita = async () => {
    if (!fechaVisita || !horarioVisita || !perfil) {
      alert('Por favor, complete todos los campos obligatorios (fecha y horario)');
      return;
    }

    try {
      setEnviando(true);

      const result = await calendarizarVisita({
        incidenciaId,
        fechaVisita,
        horarioVisita: horarioVisita as 'mañana' | 'tarde',
        autorId: perfil.persona_id
      });

      if (result.success && result.fechaFormateada && result.horarioTexto) {
        setVisitaCalendarizada({
          fecha: result.fechaFormateada,
          horario: result.horarioTexto
        });

        cerrarModal();
        cargarDatos();
      } else {
        alert(result.error || 'Error al calendarizar la visita');
      }
    } catch (error) {
      console.error("Error calendarizando visita:", error);
      alert('Error al calendarizar la visita');
    } finally {
      setEnviando(false);
    }
  };

  /**
   * Cerrar modal y limpiar formulario
   */
  const cerrarModal = () => {
    setMostrarModalVisita(false);
    setFechaVisita('');
    setHorarioVisita('');
  };

  return {
    // Estados del modal
    mostrarModalVisita,
    setMostrarModalVisita,
    fechaVisita,
    setFechaVisita,
    horarioVisita,
    setHorarioVisita,

    // Visita calendarizada
    visitaCalendarizada,
    setVisitaCalendarizada,

    // Estado de envío
    enviando,

    // Funciones
    handleCalendarizarVisita,
    cerrarModal
  };
}
