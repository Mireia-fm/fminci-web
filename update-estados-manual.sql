-- Script SQL para actualizar estados y URLs manualmente
-- Ejecutar en Supabase Dashboard > SQL Editor

-- 1. Actualizar estado_proveedor de "Pendiente valoración" a "Resuelta"
UPDATE proveedor_casos
SET estado_proveedor = 'Resuelta',
    actualizado_en = NOW()
WHERE estado_proveedor = 'Pendiente valoración'
  AND activo = true;

-- 2. Verificar la actualización
SELECT estado_proveedor, COUNT(*) as total
FROM proveedor_casos
WHERE activo = true
GROUP BY estado_proveedor;

-- 3. Actualizar URLs de documentos migrados (ejemplo con algunos casos)
UPDATE staging_comentarios_proveedor
SET documento_url = 'https://xgdilpgbpkgaltvkdodi.supabase.co/storage/v1/object/public/documentos/incidencias/18458/comentarios/25-1227_Fundacio_la_Caixa_60440.1_ELECTRICIDAD_18458_EspaiCaixa_Sant_Lluis.pdf'
WHERE documento_url = '/visitante-3/25-1227 Fundació la Caixa 60440.1 ELECTRICIDAD 18458 EspaiCaixa Sant Lluís.pdf';

UPDATE staging_comentarios_proveedor
SET documento_url = 'https://xgdilpgbpkgaltvkdodi.supabase.co/storage/v1/object/public/documentos/incidencias/38847/comentarios/25-1204_Fundacio_la_Caixa_60440.1_ELECTRICIDAD_38847_EspaiCaixa_Sant_Lluis.pdf'
WHERE documento_url = '/visitante-3/25-1204 Fundació la Caixa 60440.1 ELECTRICIDAD 38847 EspaiCaixa Sant Lluís.pdf';

UPDATE staging_comentarios_proveedor
SET documento_url = 'https://xgdilpgbpkgaltvkdodi.supabase.co/storage/v1/object/public/documentos/incidencias/96510/comentarios/25-1007_Centro_Santa_Monica_60440.2_AIRE_ACONDICIONADO_96510_Centro_Santa_Monica_(Palma).pdf'
WHERE documento_url = '/visitante-3/25-1007 Centro Santa Mónica 60440.2 AIRE ACONDICIONADO 96510 Centro Santa Mónica (Palma).pdf';

-- Verificar actualizaciones
SELECT documento_url
FROM staging_comentarios_proveedor
WHERE documento_url LIKE '%storage/v1/object/public/documentos%'
LIMIT 10;