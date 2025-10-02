require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
);

async function extractPendientesValoracion() {
  // 1. Obtener todos los casos con 'Pendiente valoración'
  const { data: pendientes, error } = await supabase
    .from('proveedor_casos')
    .select(`
      proveedor_email,
      asignado_en,
      actualizado_en,
      incidencia_id,
      incidencias!inner(num_solicitud, descripcion)
    `)
    .eq('estado_proveedor', 'Pendiente valoración')
    .eq('activo', true)
    .order('incidencia_id');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('📋 CASOS PENDIENTES DE VALORACIÓN ENCONTRADOS:', pendientes?.length || 0);

  if (!pendientes || pendientes.length === 0) {
    console.log('✅ No hay casos pendientes de valoración');
    return;
  }

  // 2. Crear contenido del archivo
  let contenido = 'INCIDENCIAS CON ESTADO "PENDIENTE VALORACIÓN" - ANTES DEL CAMBIO DE WORKFLOW\n';
  contenido += '='.repeat(80) + '\n';
  contenido += `Fecha de extracción: ${new Date().toLocaleDateString('es-ES')}\n`;
  contenido += `Total de casos: ${pendientes.length}\n\n`;

  contenido += 'LISTADO DETALLADO:\n';
  contenido += '-'.repeat(50) + '\n\n';

  pendientes.forEach((caso, index) => {
    contenido += `${index + 1}. SOLICITUD: ${caso.incidencias.num_solicitud}\n`;
    contenido += `   Proveedor: ${caso.proveedor_email}\n`;
    contenido += `   Descripción: ${caso.incidencias.descripcion?.substring(0, 100)}...\n`;
    contenido += `   Asignado: ${new Date(caso.asignado_en).toLocaleDateString('es-ES')}\n`;
    contenido += `   Actualizado: ${new Date(caso.actualizado_en).toLocaleDateString('es-ES')}\n`;
    contenido += `   ID Incidencia: ${caso.incidencia_id}\n\n`;
  });

  contenido += '\nACCIONES A REALIZAR:\n';
  contenido += '- Estos casos se cambiarán automáticamente de "Pendiente valoración" a "Resuelta"\n';
  contenido += '- Los proveedores deberán valorar económicamente estas incidencias\n';
  contenido += '- Una vez valoradas, Control podrá cerrarlas siguiendo el nuevo workflow\n';

  // 3. Guardar archivo
  fs.writeFileSync('./casos-pendiente-valoracion.txt', contenido);
  console.log('💾 Archivo guardado: casos-pendiente-valoracion.txt');

  // 4. Mostrar resumen
  console.log('\n📊 RESUMEN POR PROVEEDOR:');
  const porProveedor = pendientes.reduce((acc, caso) => {
    acc[caso.proveedor_email] = (acc[caso.proveedor_email] || 0) + 1;
    return acc;
  }, {});

  Object.entries(porProveedor)
    .sort((a, b) => b[1] - a[1])
    .forEach(([email, count]) => {
      console.log(`${email}: ${count} casos`);
    });

  return pendientes;
}

extractPendientesValoracion().catch(console.error);