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
  const tables = [
    // Coding Agent
    'coding_sessions', 'code_files', 'code_reviews',
    // Learning / Self-Improving
    'agent_performance_logs', 'agent_learnings', 'agent_strategy_versions', 'outcome_events', 'user_feedback',
    // Ad Intel
    'competitor_profiles', 'competitor_ads', 'ad_variations', 'ad_intel_reports', 'generated_campaigns',
    // Briefings
    'voice_briefings',
    // Browser
    'browser_sessions',
    // Board
    'board_resolutions',
    // Due Diligence
    'due_diligence_reports',
    // Funding
    'funding_applications',
    // Hiring
    'hiring_pipelines', 'candidates',
    // Reputation
    'reputation_mentions',
    // Procurement
    'procurement_orders',
    // Health
    'website_health_checks',
    // Contracts
    'contracts_metadata'
  ];

  const missing = [];
  const existing = [];

  for (const table of tables) {
    const { error } = await supabase.from(table).select('id').limit(1);
    if (error && error.message.includes("Could not find the table")) {
      missing.push(table);
    } else {
      existing.push(table);
    }
  }

  console.log("EXISTING:", existing);
  console.log("MISSING:", missing);
}

check();
