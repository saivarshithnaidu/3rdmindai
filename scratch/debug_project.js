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

async function check() {
  const managerId = '6e47b361-8fe3-4043-8849-9594da2c3cfa'; // StartupStrategyCouncil
  const { data: msgs } = await supabase
    .from('messages')
    .select('*')
    .eq('agent_id', managerId)
    .order('created_at', { ascending: true });
    
  console.log("Messages for StartupStrategyCouncil:");
  console.log(msgs?.map(m => ({ role: m.role, content: m.content })));
}

check();
