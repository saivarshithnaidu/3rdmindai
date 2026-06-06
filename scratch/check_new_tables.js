const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables manually from .env.local
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

async function check() {
  console.log("Checking for canvases table...");
  const { data: canvasData, error: canvasError } = await supabase
    .from('canvases')
    .select('id')
    .limit(1);

  if (canvasError) {
    console.error("canvases check failed:", canvasError.message);
  } else {
    console.log("canvases exists!");
  }

  console.log("Checking for canvas_rows table...");
  const { data: rowData, error: rowError } = await supabase
    .from('canvas_rows')
    .select('id')
    .limit(1);

  if (rowError) {
    console.error("canvas_rows check failed:", rowError.message);
  } else {
    console.log("canvas_rows exists!");
  }

  console.log("Checking for artifacts table...");
  const { data: artifactData, error: artifactError } = await supabase
    .from('artifacts')
    .select('id')
    .limit(1);

  if (artifactError) {
    console.error("artifacts check failed:", artifactError.message);
  } else {
    console.log("artifacts exists!");
  }
}

check();
