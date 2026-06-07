const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envPath = 'c:/agentx/3rd-mind/.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w\.\-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    process.env[key] = value.trim();
  }
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  console.log("Checking if webhook_configs table exists...");
  const { data, error } = await supabase
    .from('webhook_configs')
    .select('id')
    .limit(1);

  if (error) {
    console.log("webhook_configs table does not exist or error:", error.message);
  } else {
    console.log("webhook_configs table exists successfully!");
  }
}

check();
