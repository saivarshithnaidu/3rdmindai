const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Load environment variables manually
const envPath = './.env.local';
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

async function check() {
  console.log("Checking projects database columns...");
  const { data: colData, error: colError } = await supabase
    .from('projects')
    .select('master_resume, master_resume_filename')
    .limit(1);

  if (colError) {
    console.log("STATUS: MISSING_COLUMNS");
    console.error("Columns do not exist:", colError.message);
  } else {
    console.log("STATUS: COLUMNS_EXIST");
    console.log("Success! Columns already exist in the database.");
  }
}

check();
