import { useEffect, useState } from 'react';

const FILTROS_STORAGE_KEY = 'incidencias_filtros';
const INCIDENCIA_DESTACADA_KEY = 'incidencia_destacada';

export type FiltrosIncidencias = {
  filtroEstado: string;
  filtroCentro: string;
  filtroNumero: string;
  filtroEstadoProveedor: string;
  filtroFecha: string;
  filtroCatalogacion: string;
  filtroPrioridadCliente: string;
  filtroPrioridadProveedor: string;
  filtroProveedor: string;
};

export function useFiltrosIncidencias() {
  // Guardar filtros en sessionStorage
  const guardarFiltros = (filtros: Partial<FiltrosIncidencias>) => {
    if (typeof window === 'undefined') return;

    try {
      const filtrosActuales = obtenerFiltros();
      const nuevosFiltros = { ...filtrosActuales, ...filtros };
      sessionStorage.setItem(FILTROS_STORAGE_KEY, JSON.stringify(nuevosFiltros));
    } catch (error) {
      console.error('Error guardando filtros:', error);
    }
  };

  // Obtener filtros desde sessionStorage
  const obtenerFiltros = (): FiltrosIncidencias => {
    if (typeof window === 'undefined') {
      return {
        filtroEstado: '',
        filtroCentro: '',
        filtroNumero: '',
        filtroEstadoProveedor: '',
        filtroFecha: '',
        filtroCatalogacion: '',
        filtroPrioridadCliente: '',
        filtroPrioridadProveedor: '',
        filtroProveedor: '',
      };
    }

    try {
      const filtrosGuardados = sessionStorage.getItem(FILTROS_STORAGE_KEY);
      if (filtrosGuardados) {
        return JSON.parse(filtrosGuardados);
      }
    } catch (error) {
      console.error('Error leyendo filtros:', error);
    }

    return {
      filtroEstado: '',
      filtroCentro: '',
      filtroNumero: '',
      filtroEstadoProveedor: '',
      filtroFecha: '',
      filtroCatalogacion: '',
      filtroPrioridadCliente: '',
      filtroPrioridadProveedor: '',
      filtroProveedor: '',
    };
  };

  // Limpiar filtros
  const limpiarFiltros = () => {
    if (typeof window === 'undefined') return;

    try {
      sessionStorage.removeItem(FILTROS_STORAGE_KEY);
    } catch (error) {
      console.error('Error limpiando filtros:', error);
    }
  };

  // Guardar ID de incidencia destacada
  const guardarIncidenciaDestacada = (incidenciaId: string) => {
    if (typeof window === 'undefined') return;

    try {
      sessionStorage.setItem(INCIDENCIA_DESTACADA_KEY, incidenciaId);
    } catch (error) {
      console.error('Error guardando incidencia destacada:', error);
    }
  };

  // Obtener ID de incidencia destacada
  const obtenerIncidenciaDestacada = (): string | null => {
    if (typeof window === 'undefined') return null;

    try {
      return sessionStorage.getItem(INCIDENCIA_DESTACADA_KEY);
    } catch (error) {
      console.error('Error leyendo incidencia destacada:', error);
      return null;
    }
  };

  // Limpiar incidencia destacada
  const limpiarIncidenciaDestacada = () => {
    if (typeof window === 'undefined') return;

    try {
      sessionStorage.removeItem(INCIDENCIA_DESTACADA_KEY);
    } catch (error) {
      console.error('Error limpiando incidencia destacada:', error);
    }
  };

  return {
    guardarFiltros,
    obtenerFiltros,
    limpiarFiltros,
    guardarIncidenciaDestacada,
    obtenerIncidenciaDestacada,
    limpiarIncidenciaDestacada,
  };
}
