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
  // Try calling common helper RPC names or query functions
  const rpcs = ['exec_sql', 'execute_sql', 'run_sql', 'sql'];
  for (const rpc of rpcs) {
    try {
      const { data, error } = await supabase.rpc(rpc, { sql: 'SELECT 1;' });
      if (!error) {
        console.log(`RPC function found: ${rpc}`);
        return;
      } else {
        console.log(`RPC ${rpc} failed with:`, error.message);
      }
    } catch (e) {
      console.log(`RPC ${rpc} catch error:`, e.message);
    }
  }
  console.log("No custom SQL execution RPC function found.");
}

check();
