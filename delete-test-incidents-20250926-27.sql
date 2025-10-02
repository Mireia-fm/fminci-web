-- SQL Script to delete test incidents from 2025-09-26 and 2025-09-27
-- IMPORTANT: Execute in this exact order due to foreign key constraints

-- Test incidents found:
-- ID: 2e34c63d-acc9-4166-beaa-2f9dd21c8f33, num_solicitud: '20250927-01'
-- ID: 5950067d-0a1e-46aa-aec7-2648a34f1088, num_solicitud: '20250927-02'
-- ID: d94107eb-2bce-49e0-b566-4703267faeed, num_solicitud: '20250927-03'
-- ID: 2b6f05ab-1e36-4d22-b7d0-663c12b617ff, num_solicitud: '20250927-04'

-- 1. Delete attachments first (they reference incidencias)
DELETE FROM adjuntos
WHERE incidencia_id IN (
  '2e34c63d-acc9-4166-beaa-2f9dd21c8f33',
  '5950067d-0a1e-46aa-aec7-2648a34f1088',
  'd94107eb-2bce-49e0-b566-4703267faeed',
  '2b6f05ab-1e36-4d22-b7d0-663c12b617ff'
);

-- 2. Delete comments
DELETE FROM comentarios
WHERE incidencia_id IN (
  '2e34c63d-acc9-4166-beaa-2f9dd21c8f33',
  '5950067d-0a1e-46aa-aec7-2648a34f1088',
  'd94107eb-2bce-49e0-b566-4703267faeed',
  '2b6f05ab-1e36-4d22-b7d0-663c12b617ff'
);

-- 3. Delete provider appointments
DELETE FROM citas_proveedores
WHERE incidencia_id IN (
  '2e34c63d-acc9-4166-beaa-2f9dd21c8f33',
  '5950067d-0a1e-46aa-aec7-2648a34f1088',
  'd94107eb-2bce-49e0-b566-4703267faeed',
  '2b6f05ab-1e36-4d22-b7d0-663c12b617ff'
);

-- 4. Delete budgets
DELETE FROM presupuestos
WHERE incidencia_id IN (
  '2e34c63d-acc9-4166-beaa-2f9dd21c8f33',
  '5950067d-0a1e-46aa-aec7-2648a34f1088',
  'd94107eb-2bce-49e0-b566-4703267faeed',
  '2b6f05ab-1e36-4d22-b7d0-663c12b617ff'
);

-- 5. Delete state history
DELETE FROM historial_estados
WHERE incidencia_id IN (
  '2e34c63d-acc9-4166-beaa-2f9dd21c8f33',
  '5950067d-0a1e-46aa-aec7-2648a34f1088',
  'd94107eb-2bce-49e0-b566-4703267faeed',
  '2b6f05ab-1e36-4d22-b7d0-663c12b617ff'
);

-- 6. Delete provider cases
DELETE FROM proveedor_casos
WHERE incidencia_id IN (
  '2e34c63d-acc9-4166-beaa-2f9dd21c8f33',
  '5950067d-0a1e-46aa-aec7-2648a34f1088',
  'd94107eb-2bce-49e0-b566-4703267faeed',
  '2b6f05ab-1e36-4d22-b7d0-663c12b617ff'
);

-- 7. Finally, delete the incidents themselves
DELETE FROM incidencias
WHERE id IN (
  '2e34c63d-acc9-4166-beaa-2f9dd21c8f33',
  '5950067d-0a1e-46aa-aec7-2648a34f1088',
  'd94107eb-2bce-49e0-b566-4703267faeed',
  '2b6f05ab-1e36-4d22-b7d0-663c12b617ff'
);

-- NOTE: Files in Supabase Storage need to be deleted using the API/client library
-- The following paths would need to be cleaned up in Storage:
-- - incidencias/20250927-01/*
-- - incidencias/20250927-02/*
-- - incidencias/20250927-03/*
-- - incidencias/20250927-04/*

-- VERIFICATION QUERIES (run after deletion):
-- SELECT COUNT(*) FROM incidencias WHERE fecha IN ('2025-09-26', '2025-09-27');
-- SELECT COUNT(*) FROM comentarios WHERE incidencia_id IN ('2e34c63d-acc9-4166-beaa-2f9dd21c8f33','5950067d-0a1e-46aa-aec7-2648a34f1088','d94107eb-2bce-49e0-b566-4703267faeed','2b6f05ab-1e36-4d22-b7d0-663c12b617ff');