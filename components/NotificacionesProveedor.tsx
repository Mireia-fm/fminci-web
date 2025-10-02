"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

// Paleta de colores consistente
const PALETA = {
  fondo: "#5D6D52",
  headerTable: "#D9B6A9",
  card: "#F9FAF8",
  filtros: "#E8B5A8",
  texto: "#EDF0E9",
  textoOscuro: "#4b4b4b",
  verdeClaro: "#A9B88C",
};

type Notificacion = {
  id: string;
  incidencia_id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  leida: boolean;
  fecha_creacion: string;
  incidencias?: {
    num_solicitud: string;
  };
};

interface NotificacionesProveedorProps {
  proveedorId: string;
}

export default function NotificacionesProveedor({ proveedorId }: NotificacionesProveedorProps) {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargarNotificaciones = async () => {
    try {
      const { data, error } = await supabase
        .from("notificaciones")
        .select(`
          id,
          incidencia_id,
          tipo,
          titulo,
          mensaje,
          leida,
          fecha_creacion,
          incidencias(num_solicitud)
        `)
        .eq("proveedor_id", proveedorId)
        .eq("leida", false)
        .order("fecha_creacion", { ascending: false });

      if (!error && data) {
        // Transformar datos para que coincidan con el tipo Notificacion
        const notificacionesTransformadas: Notificacion[] = data.map((item: {
          id: string;
          incidencia_id: string;
          tipo: string;
          titulo: string;
          mensaje: string;
          leida: boolean;
          fecha_creacion: string;
          incidencias?: { num_solicitud: string }[] | { num_solicitud: string };
        }) => ({
          ...item,
          incidencias: Array.isArray(item.incidencias) ? item.incidencias[0] : item.incidencias
        }));
        setNotificaciones(notificacionesTransformadas);
      }
    } catch (error) {
      console.error("Error cargando notificaciones:", error);
    } finally {
      setCargando(false);
    }
  };

  const marcarComoLeida = async (notificacionId: string) => {
    try {
      await supabase
        .from("notificaciones")
        .update({ leida: true })
        .eq("id", notificacionId);

      // Actualizar estado local
      setNotificaciones(prev =>
        prev.filter(n => n.id !== notificacionId)
      );
    } catch (error) {
      console.error("Error marcando notificación como leída:", error);
    }
  };

  useEffect(() => {
    if (proveedorId) {
      cargarNotificaciones();
    }
  }, [proveedorId]);

  if (cargando) return null;

  if (notificaciones.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
      {notificaciones.map((notificacion) => (
        <div
          key={notificacion.id}
          className="rounded-lg p-4 shadow-lg border-l-4"
          style={{
            backgroundColor: PALETA.card,
            borderLeftColor: notificacion.tipo === 'anulacion' ? '#ef4444' : PALETA.verdeClaro
          }}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {notificacion.tipo === 'anulacion' && (
                  <span className="text-red-500">❌</span>
                )}
                <h4 className="font-semibold text-sm" style={{ color: PALETA.textoOscuro }}>
                  {notificacion.titulo}
                </h4>
              </div>

              <p className="text-sm mb-2" style={{ color: PALETA.textoOscuro }}>
                {notificacion.mensaje}
              </p>

              {notificacion.incidencias?.num_solicitud && (
                <p className="text-xs" style={{ color: PALETA.textoOscuro + '80' }}>
                  Incidencia: #{notificacion.incidencias.num_solicitud}
                </p>
              )}
            </div>

            <button
              onClick={() => marcarComoLeida(notificacion.id)}
              className="ml-2 px-2 py-1 text-xs rounded hover:opacity-80 transition-opacity"
              style={{
                backgroundColor: PALETA.textoOscuro + '20',
                color: PALETA.textoOscuro
              }}
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}