require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
);

async function extractPendientesValoracion() {
  // 1. Obtener casos básicos
  const { data: casos, error } = await supabase
    .from('proveedor_casos')
    .select('*')
    .eq('estado_proveedor', 'Pendiente valoración')
    .eq('activo', true);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('📋 CASOS PENDIENTES DE VALORACIÓN ENCONTRADOS:', casos?.length || 0);

  if (!casos || casos.length === 0) {
    console.log('✅ No hay casos pendientes de valoración');
    return;
  }

  // 2. Para cada caso, obtener datos de la incidencia
  const casosCompletos = [];
  for (const caso of casos) {
    const { data: incidencia } = await supabase
      .from('incidencias')
      .select('num_solicitud, descripcion')
      .eq('id', caso.incidencia_id)
      .single();

    casosCompletos.push({
      ...caso,
      incidencia
    });
  }

  // 3. Crear archivo
  let contenido = 'INCIDENCIAS CON ESTADO "PENDIENTE VALORACIÓN" - ANTES DEL CAMBIO DE WORKFLOW\n';
  contenido += '='.repeat(80) + '\n';
  contenido += `Fecha de extracción: ${new Date().toLocaleDateString('es-ES')}\n`;
  contenido += `Total de casos: ${casosCompletos.length}\n\n`;

  contenido += 'LISTADO DETALLADO:\n';
  contenido += '-'.repeat(50) + '\n\n';

  casosCompletos.forEach((caso, index) => {
    contenido += `${index + 1}. SOLICITUD: ${caso.incidencia?.num_solicitud || 'N/A'}\n`;
    contenido += `   ID Incidencia: ${caso.incidencia_id}\n`;
    contenido += `   Proveedor ID: ${caso.proveedor_id}\n`;
    contenido += `   Descripción: ${caso.incidencia?.descripcion?.substring(0, 100) || 'N/A'}...\n`;
    contenido += `   Estado: ${caso.estado_proveedor}\n`;
    contenido += `   Asignado: ${new Date(caso.asignado_en).toLocaleDateString('es-ES')}\n`;
    contenido += `   Actualizado: ${new Date(caso.actualizado_en).toLocaleDateString('es-ES')}\n\n`;
  });

  contenido += '\nACCIONES A REALIZAR:\n';
  contenido += '- Estos casos se cambiarán automáticamente de "Pendiente valoración" a "Resuelta"\n';
  contenido += '- Los proveedores deberán valorar económicamente estas incidencias\n';
  contenido += '- Una vez valoradas, Control podrá cerrarlas siguiendo el nuevo workflow\n';

  // 4. Guardar archivo
  fs.writeFileSync('./casos-pendiente-valoracion.txt', contenido);
  console.log('💾 Archivo guardado: casos-pendiente-valoracion.txt');

  // 5. Mostrar en consola
  casosCompletos.forEach((caso, index) => {
    console.log(`${index + 1}. ${caso.incidencia?.num_solicitud} - Proveedor ${caso.proveedor_id}`);
  });

  return casosCompletos;
}

extractPendientesValoracion().catch(console.error);