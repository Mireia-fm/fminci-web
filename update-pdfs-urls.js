require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
);

async function updatePdfsUrls() {
  console.log('🔄 Actualizando URLs de documentos migrados...');

  // Lista de archivos migrados con sus nuevas URLs
  const archivos = [
    { old: '/visitante-3/25-1227 Fundació la Caixa 60440.1 ELECTRICIDAD 18458 EspaiCaixa Sant Lluís.pdf', num_solicitud: '18458' },
    { old: '/visitante-3/25-1204 Fundació la Caixa 60440.1 ELECTRICIDAD 38847 EspaiCaixa Sant Lluís.pdf', num_solicitud: '38847' },
    { old: '/visitante-3/25-1007 Centro Santa Mónica 60440.2 AIRE ACONDICIONADO 96510 Centro Santa Mónica (Palma).pdf', num_solicitud: '96510' },
    { old: '/visitante-3/25-1007 Centro Santa Mónica 60440.2 AIRE ACONDICIONADO 29789 Centro Santa Mónica (Palma).pdf', num_solicitud: '29789' },
    { old: '/visitante-3/25-1006 CENTRE SANTA MONICA 60440.12 LIMPIEZA 98858 Centro Santa Mónica (Palma).pdf', num_solicitud: '98858' },
    { old: '/visitante-3/25-1101 Centro Baleares 60440.2 AIRE ACONDICIONADO 62811 Centro Baleares.pdf', num_solicitud: '62811' }
    // Continuar con los demás archivos según sea necesario
  ];

  let actualizados = 0;

  for (const archivo of archivos) {
    try {
      // Crear nuevo filename sanitizado
      const filename = archivo.old.split('/').pop().replace(/[àáâäèéêëìíîïòóôöùúûüçñ\[\]()]/g, (match) => {
        const replacements = {
          'à': 'a', 'á': 'a', 'â': 'a', 'ä': 'a',
          'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e',
          'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i',
          'ò': 'o', 'ó': 'o', 'ô': 'o', 'ö': 'o',
          'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u',
          'ç': 'c', 'ñ': 'n',
          '[': '_', ']': '_', '(': '_', ')': '_'
        };
        return replacements[match] || '_';
      }).replace(/\s+/g, '_');

      const newUrl = `https://xgdilpgbpkgaltvkdodi.supabase.co/storage/v1/object/public/documentos/incidencias/${archivo.num_solicitud}/comentarios/${filename}`;

      // Actualizar en staging_comentarios_proveedor
      const { data, error } = await supabase
        .from('staging_comentarios_proveedor')
        .update({ documento_url: newUrl })
        .eq('documento_url', archivo.old);

      if (error) {
        console.error(`❌ Error actualizando ${archivo.old}:`, error);
      } else {
        console.log(`✅ Actualizado: ${archivo.num_solicitud} -> ${filename}`);
        actualizados++;
      }

    } catch (err) {
      console.error(`❌ Error procesando ${archivo.old}:`, err);
    }
  }

  console.log(`\n📊 Total actualizados: ${actualizados}/${archivos.length}`);
  return actualizados;
}

updatePdfsUrls().catch(console.error);