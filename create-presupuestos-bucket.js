const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createPresupuestosBucket() {
  console.log('🪣 Creando bucket "presupuestos"\n');
  console.log('='.repeat(70));

  // PASO 1: Crear el bucket
  console.log('\n📦 Creando bucket...');

  const { data: newBucket, error: createError } = await supabase.storage
    .createBucket('presupuestos', {
      public: false,
      fileSizeLimit: 10485760, // 10 MB
      allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    });

  if (createError) {
    if (createError.message.includes('already exists')) {
      console.log('✅ El bucket "presupuestos" ya existe');
    } else {
      console.error('❌ Error al crear bucket:', createError.message);
      return;
    }
  } else {
    console.log('✅ Bucket "presupuestos" creado exitosamente');
  }

  // PASO 2: Listar archivos en incidencias/presupuestos/
  console.log('\n📋 Listando archivos en incidencias/presupuestos/...');

  const { data: folders, error: listError } = await supabase.storage
    .from('incidencias')
    .list('presupuestos', { limit: 100 });

  if (listError) {
    console.error('❌ Error al listar:', listError.message);
    return;
  }

  console.log(`\nEncontradas ${folders?.length || 0} carpetas/archivos\n`);

  if (!folders || folders.length === 0) {
    console.log('⚠️  No hay archivos para migrar');
    return;
  }

  // Mostrar estructura
  for (const item of folders) {
    const type = item.id ? '📄 archivo' : '📂 carpeta';
    console.log(`${type}: ${item.name}`);

    // Si es carpeta, explorar contenido
    if (!item.id) {
      const { data: subItems } = await supabase.storage
        .from('incidencias')
        .list(`presupuestos/${item.name}`, { limit: 50 });

      if (subItems && subItems.length > 0) {
        subItems.forEach(sub => {
          const subType = sub.id ? '📄' : '📂';
          console.log(`   ${subType} ${sub.name}`);
        });
      }
    }
  }

  // PASO 3: Migrar archivos
  console.log('\n📦 Migrando archivos al bucket "presupuestos"...\n');
  console.log('='.repeat(70));

  let movedFiles = 0;
  let errors = 0;

  for (const item of folders) {
    if (!item.id) {
      // Es una carpeta, procesar archivos dentro
      const { data: files } = await supabase.storage
        .from('incidencias')
        .list(`presupuestos/${item.name}`, { limit: 100 });

      if (!files) continue;

      for (const file of files.filter(f => f.id)) {
        const oldPath = `presupuestos/${item.name}/${file.name}`;
        const newPath = `${item.name}/${file.name}`;

        console.log(`📄 ${oldPath}`);
        console.log(`   → presupuestos/${newPath}`);

        try {
          // Descargar del bucket incidencias
          const { data: fileData, error: downloadError } = await supabase.storage
            .from('incidencias')
            .download(oldPath);

          if (downloadError) {
            console.log(`   ❌ Error descargando: ${downloadError.message}`);
            errors++;
            continue;
          }

          // Subir al bucket presupuestos
          const { error: uploadError } = await supabase.storage
            .from('presupuestos')
            .upload(newPath, fileData, {
              contentType: file.metadata?.mimetype || 'application/pdf',
              upsert: true
            });

          if (uploadError) {
            console.log(`   ❌ Error subiendo: ${uploadError.message}`);
            errors++;
            continue;
          }

          console.log(`   ✅ Migrado exitosamente\n`);
          movedFiles++;

        } catch (err) {
          console.log(`   ❌ Error: ${err.message}\n`);
          errors++;
        }
      }
    } else {
      // Es un archivo directo en presupuestos/
      const oldPath = `presupuestos/${item.name}`;
      const newPath = item.name;

      console.log(`📄 ${oldPath}`);
      console.log(`   → presupuestos/${newPath}`);

      try {
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('incidencias')
          .download(oldPath);

        if (downloadError) {
          console.log(`   ❌ Error descargando: ${downloadError.message}`);
          errors++;
          continue;
        }

        const { error: uploadError } = await supabase.storage
          .from('presupuestos')
          .upload(newPath, fileData, {
            contentType: item.metadata?.mimetype || 'application/pdf',
            upsert: true
          });

        if (uploadError) {
          console.log(`   ❌ Error subiendo: ${uploadError.message}`);
          errors++;
          continue;
        }

        console.log(`   ✅ Migrado exitosamente\n`);
        movedFiles++;

      } catch (err) {
        console.log(`   ❌ Error: ${err.message}\n`);
        errors++;
      }
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('📊 RESUMEN DE MIGRACIÓN DE PRESUPUESTOS\n');
  console.log(`✅ Archivos migrados: ${movedFiles}`);
  console.log(`❌ Errores: ${errors}`);
  console.log('\n💡 Los archivos han sido COPIADOS (no eliminados) al nuevo bucket');
  console.log('   Los originales permanecen en incidencias/presupuestos/');
}

createPresupuestosBucket().catch(console.error);
