require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function uploadLogo() {
  try {
    const logoPath = path.join(__dirname, 'public', 'images', 'fminci-logo.png');
    const fileBuffer = fs.readFileSync(logoPath);

    console.log('Uploading logo to Supabase Storage...');

    const { data, error } = await supabase.storage
      .from('system-assets')
      .upload('fminci-logo.png', fileBuffer, {
        contentType: 'image/png',
        upsert: true
      });

    if (error) {
      console.error('Error uploading logo:', error);
      return;
    }

    console.log('Logo uploaded successfully:', data);

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('system-assets')
      .getPublicUrl('fminci-logo.png');

    console.log('\n✅ Logo URL pública:');
    console.log(publicUrlData.publicUrl);
    console.log('\nUsa esta URL en tu plantilla de email');

  } catch (err) {
    console.error('Error:', err);
  }
}

uploadLogo();
