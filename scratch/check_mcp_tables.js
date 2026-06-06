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
  console.log("Checking for connectors table...");
  const { data: connData, error: connError } = await supabase
    .from('connectors')
    .select('id')
    .limit(1);

  if (connError) {
    console.error("connectors check failed:", connError.message);
  } else {
    console.log("connectors exists!");
  }

  console.log("Checking for tool_calls table...");
  const { data: toolData, error: toolError } = await supabase
    .from('tool_calls')
    .select('id')
    .limit(1);

  if (toolError) {
    console.error("tool_calls check failed:", toolError.message);
  } else {
    console.log("tool_calls exists!");
  }
}

check();
