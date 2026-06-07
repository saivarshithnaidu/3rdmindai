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

async function inspect() {
  const { data: conn, error: connErr } = await supabase.from('connectors').select().limit(1);
  if (connErr) {
    console.error("connectors inspect error:", connErr);
  } else {
    console.log("connectors cols:", conn.length > 0 ? Object.keys(conn[0]) : "Empty table");
  }

  const { data: tool, error: toolErr } = await supabase.from('tool_calls').select().limit(1);
  if (toolErr) {
    console.error("tool_calls inspect error:", toolErr);
  } else {
    console.log("tool_calls cols:", tool.length > 0 ? Object.keys(tool[0]) : "Empty table");
  }
}

inspect();
