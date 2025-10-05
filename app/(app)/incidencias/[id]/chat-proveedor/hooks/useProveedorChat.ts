import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { obtenerHistorialEstados } from '@/lib/historialEstados';

/**
 * Tipos
 */
type Adjunto = {
  id: string;
  tipo: string;
  nombre_archivo?: string | null;
  storage_key?: string | null;
  categoria?: string;
  visible_proveedor?: boolean;
};

type Incidencia = {
  id: string;
  num_solicitud: string;
  descripcion: string;
  estado_cliente: string;
  estado_proveedor?: string;
  prioridad_proveedor?: string;
  descripcion_proveedor?: string;
  centro?: string;
  fecha?: string;
  hora?: string;
  imagen_url?: string;
  catalogacion?: string;
  institucion_id?: string;
  fecha_creacion?: string;
  instituciones?: {
    nombre: string;
    direccion?: string;
  }[] | null;
  adjuntos_principales?: Adjunto[];
};

type ProveedorHistorico = {
  proveedor_nombre: string;
  fecha_asignacion: string;
  fecha_anulacion?: string | null;
  motivo_anulacion?: string | null;
  estado_proveedor: string;
  activo: boolean;
};

type CambioEstado = {
  id: string;
  estado_anterior: string | null;
  estado_nuevo: string;
  cambiado_en: string;
  motivo: string | null;
};

interface Perfil {
  persona_id: string;
  email: string;
  rol: string;
}

/**
 * Hook principal para gestionar el estado del chat proveedor
 * Maneja: incidencia, historial, dirección centro, etc.
 */
export function useProveedorChat(incidenciaId: string, perfil: Perfil | null) {
  const router = useRouter();

  // Estados principales
  const [incidencia, setIncidencia] = useState<Incidencia | null>(null);
  const [loading, setLoading] = useState(true);
  const [proveedorAsignado, setProveedorAsignado] = useState(false);
  const [nombreProveedor, setNombreProveedor] = useState<string | null>(null);
  const [direccionCentro, setDireccionCentro] = useState<string | null>(null);
  const [fechaAsignacionProveedor, setFechaAsignacionProveedor] = useState<string | null>(null);

  // Historial
  const [historialProveedores, setHistorialProveedores] = useState<ProveedorHistorico[]>([]);
  const [historialProveedor, setHistorialProveedor] = useState<CambioEstado[]>([]);

  /**
   * Cargar dirección del centro
   */
  const cargarDireccionCentro = async (institucionId?: string, nombreCentro?: string) => {
    try {
      let query = supabase.from("instituciones").select("direccion");

      if (institucionId) {
        query = query.eq("id", institucionId);
      } else if (nombreCentro) {
        query = query.eq("nombre", nombreCentro);
      } else {
        return;
      }

      const { data, error } = await query.maybeSingle();

      if (!error && data?.direccion) {
        setDireccionCentro(data.direccion);
      }
    } catch (error) {
      console.error("Error cargando dirección del centro:", error);
    }
  };

  /**
   * Cargar todos los datos de la incidencia
   */
  const cargarDatos = async () => {
    try {
      setLoading(true);

      // Verificar que tenemos perfil del AuthContext
      if (!perfil) {
        router.push('/login');
        return;
      }

      // Cargar incidencia con adjuntos principales
      const { data: incidenciaData, error: incidenciaError } = await supabase
        .from("incidencias")
        .select(`
          id,
          num_solicitud,
          descripcion,
          estado_cliente,
          centro,
          fecha,
          hora,
          imagen_url,
          catalogacion,
          institucion_id,
          fecha_creacion,
          instituciones(nombre, direccion)
        `)
        .eq("id", incidenciaId)
        .single();

      // Verificar si la incidencia está asignada a un proveedor
      let estadoProveedor = null;
      let prioridadProveedor = null;
      let descripcionProveedor = null;
      let asignado = false;

      if (incidenciaData) {
        // Permitir acceso a usuarios Control y Proveedor
        if (perfil.rol === 'Control' || perfil.rol === 'Proveedor') {
          asignado = true;

          // Obtener datos del proveedor (fecha de asignación, estado y prioridad)
          // Buscar el caso más reciente (activo o anulado)
          console.log('Buscando proveedor_casos para incidencia:', incidenciaId);

          const { data: proveedorCaso, error: proveedorError } = await supabase
            .from("proveedor_casos")
            .select("asignado_en, estado_proveedor, prioridad, descripcion_proveedor, activo")
            .eq("incidencia_id", incidenciaId)
            .order("asignado_en", { ascending: false })
            .limit(1)
            .maybeSingle();

          console.log('Resultado proveedor_casos:', { proveedorCaso, proveedorError });

          if (proveedorCaso) {
            if (proveedorCaso.asignado_en) {
              setFechaAsignacionProveedor(proveedorCaso.asignado_en);
            }
            estadoProveedor = proveedorCaso.estado_proveedor;
            prioridadProveedor = proveedorCaso.prioridad;
            descripcionProveedor = proveedorCaso.descripcion_proveedor;

            console.log('Datos asignados:', {
              estadoProveedor,
              prioridadProveedor,
              descripcionProveedor,
              fechaAsignacion: proveedorCaso.asignado_en
            });
          } else {
            console.log('No se encontró proveedor_casos o está inactivo');
          }
        }
      }

      setProveedorAsignado(asignado);

      // Cargar adjuntos principales (imágenes de la incidencia)
      let adjuntosPrincipales: Adjunto[] = [];
      if (incidenciaData) {
        const { data: adjuntosData } = await supabase
          .from("adjuntos")
          .select("*")
          .eq("incidencia_id", incidenciaId)
          .eq("categoria", "imagen_principal");

        // Filtrar solo las imágenes visibles para el proveedor
        // (visible_proveedor = true O null, pero NO false)
        adjuntosPrincipales = (adjuntosData || []).filter(
          adj => adj.visible_proveedor !== false
        );

        // Fallback a imagen_url SOLO si no existen adjuntos en la base de datos
        // (no usar el fallback si hay adjuntos pero están todos excluidos)
        const existenAdjuntos = (adjuntosData || []).length > 0;
        if (incidenciaData.imagen_url && !existenAdjuntos) {
          // Crear un adjunto virtual para imagen_url
          adjuntosPrincipales = [{
            id: 'imagen_url_' + incidenciaId,
            tipo: 'imagen',
            nombre_archivo: 'Imagen de la incidencia',
            storage_key: incidenciaData.imagen_url,
            categoria: 'imagen_principal'
          }];
        }
      }

      if (incidenciaError) {
        console.error("Error cargando incidencia:", incidenciaError);
      } else {
        setIncidencia({
          ...incidenciaData,
          estado_proveedor: estadoProveedor,
          prioridad_proveedor: prioridadProveedor,
          descripcion_proveedor: descripcionProveedor,
          adjuntos_principales: adjuntosPrincipales
        });

        // Cargar dirección del centro
        if (incidenciaData.institucion_id) {
          await cargarDireccionCentro(incidenciaData.institucion_id);
        } else if (incidenciaData.centro) {
          await cargarDireccionCentro(undefined, incidenciaData.centro);
        }
      }

      // Cargar historial de proveedores (solo para Control)
      if (perfil.rol === 'Control') {
        const { data: proveedoresHistoricos } = await supabase
          .from("proveedor_casos")
          .select(`
            proveedor_id,
            asignado_en,
            anulado_en,
            motivo_anulacion,
            estado_proveedor,
            activo
          `)
          .eq("incidencia_id", incidenciaId)
          .order("asignado_en", { ascending: false });

        if (proveedoresHistoricos && proveedoresHistoricos.length > 0) {
          // Obtener nombres de proveedores
          const proveedorIds = proveedoresHistoricos.map(p => p.proveedor_id);
          const { data: proveedoresData } = await supabase
            .from("instituciones")
            .select("id, nombre")
            .in("id", proveedorIds);

          const proveedoresMap = new Map(
            (proveedoresData || []).map(p => [p.id, p.nombre])
          );

          const historialFormateado: ProveedorHistorico[] = proveedoresHistoricos.map(p => ({
            proveedor_nombre: proveedoresMap.get(p.proveedor_id) || 'Proveedor desconocido',
            fecha_asignacion: p.asignado_en,
            fecha_anulacion: p.anulado_en,
            motivo_anulacion: p.motivo_anulacion,
            estado_proveedor: p.estado_proveedor || 'Sin estado',
            activo: p.activo
          }));

          setHistorialProveedores(historialFormateado);

          // Obtener el nombre del proveedor activo actual
          const proveedorActivo = proveedoresHistoricos.find(p => p.activo);
          if (proveedorActivo) {
            const nombreProveedorActivo = proveedoresMap.get(proveedorActivo.proveedor_id) || null;
            setNombreProveedor(nombreProveedorActivo);
          }
        }
      }

      // Cargar historial de estados del proveedor
      const { data: historialData } = await supabase
        .from("historial_estados")
        .select("id, estado_anterior, estado_nuevo, cambiado_en, motivo")
        .eq("incidencia_id", incidenciaId)
        .eq("tipo_estado", "proveedor")
        .order("cambiado_en", { ascending: false });

      setHistorialProveedor(historialData || []);

    } catch (error) {
      console.error("Error cargando datos:", error);
    } finally {
      setLoading(false);
    }
  };

  // Cargar datos al montar o cuando cambie incidenciaId
  useEffect(() => {
    if (perfil) {
      cargarDatos();
    }
  }, [incidenciaId, perfil]);

  return {
    // Estados
    incidencia,
    loading,
    proveedorAsignado,
    nombreProveedor,
    direccionCentro,
    fechaAsignacionProveedor,
    historialProveedores,
    historialProveedor,
    // Funciones
    cargarDatos
  };
}
