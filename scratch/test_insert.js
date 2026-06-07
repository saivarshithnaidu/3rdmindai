const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w\.\-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testInsert() {
  const dummy = {
    slug: 'test-slug',
    name: 'Test Name',
    category: 'productivity',
    auth_type: 'none',
    is_active: false
  };

  const { data, error } = await supabase.from('connectors').insert(dummy).select();
  if (error) {
    console.log("Error inserting:", error.message);
  } else {
    console.log("Success inserting! Data:", data);
    // clean up
    await supabase.from('connectors').delete().eq('slug', 'test-slug');
  }
}

testInsert();
