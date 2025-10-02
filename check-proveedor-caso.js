require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProveedorCaso() {
  try {
    // Ver las primeras 10 incidencias para entender qué hay en la BD
    const { data: incidencias } = await supabase
      .from('incidencias')
      .select('id, num_solicitud, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    console.log('Últimas 10 incidencias en la BD:', incidencias);

    // Verificar si hay incidencias con proveedores asignados
    const { data: incidenciasConProveedor } = await supabase
      .from('proveedor_casos')
      .select(`
        incidencia_id,
        estado_proveedor,
        prioridad,
        asignado_en,
        activo,
        incidencias!inner(num_solicitud)
      `)
      .eq('activo', true)
      .limit(5);

    console.log('Incidencias con proveedor asignado:', incidenciasConProveedor);

  } catch (error) {
    console.error('Error:', error);
  }
}

checkProveedorCaso();