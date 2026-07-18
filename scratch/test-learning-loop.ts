import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

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

// Configure client environment variables for services
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

import { learningService } from '../services/learning.service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function runTest() {
  console.log('--- 🧪 STARTING E2E SELF-IMPROVING LOOP TEST ---');
  let testProjectId: string | null = null;
  let testAgentId: string | null = null;
  const mockTaskIds: string[] = [];
  const mockLearningIds: string[] = [];

  try {
    // 1. Fetch or create a test project and agent
    console.log('1. Checking for existing project and agent...');
    const { data: project } = await supabase.from('projects').select('id').limit(1).maybeSingle();
    if (project) {
      testProjectId = project.id;
      console.log(`Found project: ${testProjectId}`);
    } else {
      const { data: newProj, error: err } = await supabase
        .from('projects')
        .insert({ name: 'Test Improvement Project', goal: 'Verify self-improving loop' })
        .select()
        .single();
      if (err) throw err;
      testProjectId = newProj.id;
      console.log(`Created test project: ${testProjectId}`);
    }

    const { data: agent } = await supabase
      .from('startup_agents')
      .select('id, name')
      .eq('project_id', testProjectId)
      .limit(1)
      .maybeSingle();

    if (agent) {
      testAgentId = agent.id;
      console.log(`Found agent: ${agent.name} (${testAgentId})`);
    } else {
      const { data: newAgent, error: err } = await supabase
        .from('startup_agents')
        .insert({
          project_id: testProjectId,
          role: 'ceo',
          name: 'AI Advisor',
          model: 'openai/gpt-4o',
          is_active: true,
          tasks_completed: 0
        })
        .select()
        .single();
      if (err) throw err;
      testAgentId = newAgent.id;
      console.log(`Created test agent: ${newAgent.name} (${testAgentId})`);
    }

    // 2. Insert at least 3 dummy tasks and performance logs in the same category
    // This is required to satisfy category limit (>= 3 tasks)
    console.log('\n2. Creating dummy tasks and performance logs to satisfy category limit...');
    const category = 'Strategic Planning';
    for (let i = 1; i <= 3; i++) {
      const { data: task, error: tErr } = await supabase
        .from('agent_tasks')
        .insert({
          agent_id: testAgentId,
          project_id: testProjectId,
          title: `Test Task ${i}`,
          description: `Simulate high performance run ${i}`,
          status: 'done',
          output: `Mock strategy documentation output ${i} containing target guidelines.`,
          triggered_by: 'user',
          judge_score: 40 + i, // High scores
          completed_at: new Date().toISOString()
        })
        .select()
        .single();

      if (tErr) throw tErr;
      mockTaskIds.push(task.id);

      const { data: log, error: lErr } = await supabase
        .from('agent_performance_logs')
        .insert({
          agent_id: testAgentId,
          project_id: testProjectId,
          task_id: task.id,
          judge_score: task.judge_score,
          task_category: category,
          task_keywords: ['strategic', 'planning', 'mock'],
          approach_used: 'Structured frameworks with quantitative backing.',
          what_worked: 'Clear section summaries and crisp action items.',
          what_failed: ''
        })
        .select()
        .single();

      if (lErr) throw lErr;
      console.log(`Inserted performance log for Task ${i}: Score ${task.judge_score}`);
    }

    // 3. Trigger manual extraction
    console.log('\n3. Triggering extractLearnings using learningService...');
    const newLearningsCount = await learningService.extractLearnings(testAgentId!, testProjectId!);
    console.log(`Extraction run complete. New learnings generated: ${newLearningsCount}`);

    // Verify learnings in database
    const { data: learnings } = await supabase
      .from('agent_learnings')
      .select('*')
      .eq('agent_id', testAgentId!)
      .eq('project_id', testProjectId!);

    console.log(`Learnings in DB: ${learnings?.length || 0}`);
    if (learnings && learnings.length > 0) {
      learnings.forEach(l => {
        console.log(`- [${l.learning_type.toUpperCase()}] Confidence: ${l.confidence.toFixed(2)} - Insight: "${l.insight}"`);
        mockLearningIds.push(l.id);
      });
    }

    // 4. Record User Feedback and verify reinforcement (Rating = 5, should reinforce positive)
    if (mockTaskIds.length > 0) {
      console.log('\n4. Recording user feedback (5 stars) and checking reinforcement...');
      const targetTaskId = mockTaskIds[0];
      await learningService.recordUserFeedback(
        targetTaskId,
        testAgentId!,
        testProjectId!,
        5,
        'Excellent work! Follow this exact structure going forward.'
      );

      // Verify outcome_events contains user feedback trigger
      const { data: outcomes } = await supabase
        .from('outcome_events')
        .select('*')
        .eq('task_id', targetTaskId);
      
      console.log(`Outcomes created: ${outcomes?.length || 0}`);
      outcomes?.forEach(o => {
        console.log(`- Event: ${o.event_type}, Value: ${o.event_value}`);
      });
    }

    // 5. Test strategy versioning requirement: requires >= 5 active learnings with confidence >= 0.6
    console.log('\n5. Testing strategy update compilation requirements...');
    
    // We will inject 5 active high-confidence learnings to trigger strategy updates
    console.log('Injecting 5 mock high-confidence learnings...');
    for (let i = 1; i <= 5; i++) {
      const { data: ml } = await supabase
        .from('agent_learnings')
        .insert({
          agent_id: testAgentId!,
          project_id: testProjectId!,
          learning_type: 'approach',
          category: category,
          insight: `Mock insight number ${i} for high quality planning and structuring.`,
          confidence: 0.8,
          is_active: true,
          evidence_count: 3
        })
        .select()
        .single();
      if (ml) mockLearningIds.push(ml.id);
    }

    console.log('Triggering updateAgentStrategy...');
    const strategy = await learningService.updateAgentStrategy(testAgentId!, testProjectId!);
    if (strategy) {
      console.log(`🎉 SUCCESS: Strategy v${strategy.version} compiled!`);
      console.log(`Strategy additions:\n${strategy.strategy_additions}`);
    } else {
      console.log('Strategy not updated (limitations/rules not met)');
    }

    // 6. Test system prompt injection
    console.log('\n6. Testing prompt context injection...');
    const context = await learningService.getAgentContextWithLearnings(testAgentId!, testProjectId!, 'Prepare marketing strategy');
    console.log(`Prompt Context:\n${context}`);

  } catch (err) {
    console.error('❌ E2E TEST FAILED:', err);
  } finally {
    console.log('\n🧹 Cleaning up test data...');
    if (mockTaskIds.length > 0) {
      const { error } = await supabase.from('agent_tasks').delete().in('id', mockTaskIds);
      if (error) console.error('Failed to clean tasks:', error.message);
    }
    if (mockLearningIds.length > 0) {
      const { error } = await supabase.from('agent_learnings').delete().in('id', mockLearningIds);
      if (error) console.error('Failed to clean learnings:', error.message);
    }
    console.log('E2E TEST RUN COMPLETED.');
  }
}

runTest();
