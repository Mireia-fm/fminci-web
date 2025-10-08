/**
 * Script para sincronizar estados de incidencias desde CSV de Wix a Supabase
 * Solo actualiza el campo estado_cliente cuando ha cambiado
 */

const fs = require('fs');
const csv = require('csv-parser');
const { createClient } = require('@supabase/supabase-js');

// Configuración de Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Configuración
const CSV_PATH = process.argv[2] || './datos-incidencias-wix.csv';

async function syncEstados() {
  console.log('🔄 Iniciando sincronización de estados desde Wix...');
  console.log(`📂 Leyendo CSV desde: ${CSV_PATH}\n`);

  const incidenciasWix = [];

  // Leer CSV
  return new Promise((resolve, reject) => {
    fs.createReadStream(CSV_PATH)
      .pipe(csv())
      .on('data', (row) => {
        incidenciasWix.push(row);
      })
      .on('end', async () => {
        console.log(`✅ CSV leído: ${incidenciasWix.length} incidencias\n`);

        let actualizadas = 0;
        let sinCambios = 0;
        let errores = 0;
        let noEncontradas = 0;

        for (const incidenciaWix of incidenciasWix) {
          const numSolicitud = incidenciaWix.num_solicitud || incidenciaWix['num solicitud'];
          const estadoWix = incidenciaWix.estado;

          if (!numSolicitud || !estadoWix) {
            console.log(`⚠️  Fila sin num_solicitud o estado, omitiendo...`);
            errores++;
            continue;
          }

          try {
            // Buscar la incidencia en Supabase
            const { data: incidenciaSupabase, error: fetchError } = await supabase
              .from('incidencias')
              .select('id, num_solicitud, estado_cliente')
              .eq('num_solicitud', numSolicitud)
              .single();

            if (fetchError || !incidenciaSupabase) {
              console.log(`❌ No encontrada: ${numSolicitud}`);
              noEncontradas++;
              continue;
            }

            // Comparar estados
            if (incidenciaSupabase.estado_cliente !== estadoWix) {
              console.log(`🔄 Actualizando ${numSolicitud}:`);
              console.log(`   De: "${incidenciaSupabase.estado_cliente}" → A: "${estadoWix}"`);

              // Actualizar estado_cliente
              const { error: updateError } = await supabase
                .from('incidencias')
                .update({ estado_cliente: estadoWix })
                .eq('id', incidenciaSupabase.id);

              if (updateError) {
                console.log(`   ❌ Error al actualizar: ${updateError.message}`);
                errores++;
                continue;
              }

              actualizadas++;
            } else {
              sinCambios++;
            }
          } catch (error) {
            console.log(`❌ Error procesando ${numSolicitud}: ${error.message}`);
            errores++;
          }
        }

        console.log('\n📊 Resumen de sincronización:');
        console.log(`   ✅ Actualizadas: ${actualizadas}`);
        console.log(`   ⏭️  Sin cambios: ${sinCambios}`);
        console.log(`   ❌ No encontradas: ${noEncontradas}`);
        console.log(`   ⚠️  Errores: ${errores}`);

        resolve();
      })
      .on('error', reject);
  });
}

// Ejecutar
syncEstados()
  .then(() => {
    console.log('\n✅ Sincronización completada');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error en sincronización:', error);
    process.exit(1);
  });
