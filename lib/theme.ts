// Paleta de colores unificada para toda la aplicación
export const PALETA = {
  // Colores base
  bg: "#5D6D52",           // Fondo principal (verde oliva)
  btn: "#C9D7A7",          // Botones principales
  texto: "#EDF0E9",        // Texto claro
  textoOscuro: "#4b4b4b",  // Texto oscuro

  // Colores para headers y filtros
  headerTable: "#D9B6A9",  // Header de tablas
  card: "#F9FAF8",         // Fondo de tarjetas
  filtros: "#E8B5A8",      // Fondo de filtros

  // Colores adicionales
  verdeClaro: "#A9B88C",   // Verde claro (usado en dashboard)
  verdeSombra: "#7A8A6F",  // Verde sombra (usado en calendario)

  // Colores para estados (badges circulares)
  b1: "#E8D36A",   // Amarillo - Estados iniciales/abiertos
  b2: "#E8B5A8",   // Rosa - Estados en progreso
  b3: "#A9B88C",   // Verde - Estados completados/positivos
  b4: "#8F9B83",   // Verde oscuro - Estados aprobados
  b5: "#D4C5A9",   // Beige cálido - Estados resueltos
  b6: "#C8B8A8",   // Beige rosado - Estados cerrados/espera
  b7: "#C7A88F",   // Marrón claro - Estados a revisar
  b8: "#9AAD7F",   // Verde suave - Estados secundarios
  b9: "#B8C99D",   // Verde claro - Estados de valoración
  b10: "#6B7A60",  // Verde muy oscuro - Estados adicionales
} as const;

// Estados del cliente
export const ESTADOS_CLIENTE = [
  "Abierta",
  "En espera",
  "En tramitación",
  "Resuelta",
  "Cerrada",
  "Anulada"
] as const;

export type EstadoCliente = typeof ESTADOS_CLIENTE[number];

// Estados del proveedor
export const ESTADOS_PROVEEDOR = [
  "Abierta",
  "En resolución",
  "Ofertada",
  "Oferta aprobada",
  "Oferta a revisar",
  "Resuelta",
  "Valorada",
  "Pendiente valoración",
  "Cerrada",
  "Anulada"
] as const;

export type EstadoProveedor = typeof ESTADOS_PROVEEDOR[number];

// Mapeo de colores por estado - Cliente
export const COLORES_ESTADOS_CLIENTE: Record<EstadoCliente, string> = {
  "Abierta": PALETA.b1,           // Amarillo
  "En tramitación": PALETA.b2,    // Rosa
  "Resuelta": PALETA.b5,          // Beige cálido
  "Cerrada": PALETA.b3,           // Verde
  "En espera": PALETA.b6,         // Beige rosado
  "Anulada": PALETA.b4,           // Verde oscuro
};

// Mapeo de colores por estado - Proveedor
export const COLORES_ESTADOS_PROVEEDOR: Record<EstadoProveedor, string> = {
  "Abierta": PALETA.b1,              // Amarillo
  "En resolución": PALETA.b2,        // Rosa
  "Ofertada": PALETA.b3,             // Verde
  "Oferta aprobada": PALETA.b4,      // Verde oscuro
  "Oferta a revisar": PALETA.b7,     // Marrón claro
  "Resuelta": PALETA.b4,             // Verde oscuro
  "Cerrada": PALETA.b6,              // Beige rosado
  "Anulada": PALETA.b8,              // Verde suave
  "Valorada": PALETA.b4,             // Verde oscuro
  "Pendiente valoración": PALETA.b9, // Verde claro
};

// Prioridades
export const PRIORIDADES_CLIENTE = ["Urgente", "Crítico", "Normal"] as const;
export const PRIORIDADES_PROVEEDOR = ["Crítico", "No crítico"] as const;

export type PrioridadCliente = typeof PRIORIDADES_CLIENTE[number];
export type PrioridadProveedor = typeof PRIORIDADES_PROVEEDOR[number];

// Helper para obtener color de estado
export function obtenerColorEstado(
  estado: string,
  tipo: "cliente" | "proveedor"
): string {
  if (tipo === "cliente") {
    return COLORES_ESTADOS_CLIENTE[estado as EstadoCliente] || PALETA.b8;
  }
  return COLORES_ESTADOS_PROVEEDOR[estado as EstadoProveedor] || PALETA.b8;
}
