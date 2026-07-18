import supabaseService from './supabase.service';
import openrouterService from './openrouter.service';
import { AgentPerformanceLog, AgentLearning, AgentStrategyVersion, OutcomeEvent, UserFeedback } from '../types';

export const learningService = {
  /**
   * Helper to perform simple keyword extraction from task descriptions
   */
  extractKeywords(text: string): string[] {
    if (!text) return [];
    const stopwords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'to', 'for', 'in', 'on', 'at', 'by',
      'this', 'that', 'these', 'those', 'with', 'about', 'from', 'as', 'of', 'for', 'our', 'your', 'my', 'their'
    ]);
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopwords.has(w))
      .slice(0, 10);
  },

  /**
   * Records task performance log after a task completes
   */
  async recordTaskPerformance(taskId: string, agentId: string, projectId: string): Promise<AgentPerformanceLog | null> {
    try {
      const supabase = supabaseService.getServiceClient();

      // 1. Fetch task
      const { data: task, error: taskErr } = await supabase
        .from('agent_tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      if (taskErr || !task) {
        console.warn(`Task ${taskId} not found for recording performance:`, taskErr?.message);
        return null;
      }

      // 2. Extract task category using OpenRouter (DeepSeek chat is fast and cost-effective)
      let category = 'General';
      try {
        const catPrompt = `Categorize this task in 2-3 words:\n"${task.description}"\nReturn ONLY the category name. Do not include quotes, punctuation, or any extra text.`;
        const res = await openrouterService.callModel(
          'Categorize this task in 2-3 words. Return ONLY the category name.',
          [{ role: 'user', content: task.description }],
          'deepseek/deepseek-chat'
        );
        if (res && res.trim().length > 0) {
          category = res.replace(/["'./]/g, '').trim();
        }
      } catch (err) {
        console.warn('Failed to extract task category via OpenRouter:', err);
      }

      // 3. Extract keywords
      const keywords = this.extractKeywords(task.description);

      // 4. Extract approach used
      let approach = 'Completed the task according to instructions.';
      try {
        const approachSystem = 'In 1 sentence, what approach did this agent use to complete this task? Return ONLY the approach sentence.';
        const approachUser = `Task: ${task.description}\nOutput: ${(task.output || '').substring(0, 1000)}`;
        const res = await openrouterService.callModel(
          approachSystem,
          [{ role: 'user', content: approachUser }],
          'deepseek/deepseek-chat'
        );
        if (res && res.trim().length > 0) {
          approach = res.trim();
        }
      } catch (err) {
        console.warn('Failed to extract approach via OpenRouter:', err);
      }

      // 5. Save to performance logs
      const { data: log, error: logErr } = await supabase
        .from('agent_performance_logs')
        .insert({
          agent_id: agentId,
          project_id: projectId,
          task_id: taskId,
          judge_score: task.judge_score || null,
          task_category: category,
          task_keywords: keywords,
          approach_used: approach,
          user_rating: null,
          user_edited: false,
          outcome_type: null,
          outcome_value: null,
          what_worked: task.judge_passed ? 'Passed judge quality checklist.' : null,
          what_failed: task.judge_passed === false ? task.judge_feedback : null
        })
        .select()
        .single();

      if (logErr) {
        console.error('Failed to save agent performance log:', logErr.message);
        return null;
      }

      return log;
    } catch (err) {
      console.error('Error in recordTaskPerformance:', err);
      return null;
    }
  },

  /**
   * Helper to update performance log judge score when judge evaluation completes
   */
  async updatePerformanceLogScore(taskId: string, judgeScore: number): Promise<void> {
    try {
      const supabase = supabaseService.getServiceClient();
      await supabase
        .from('agent_performance_logs')
        .update({ judge_score: judgeScore })
        .eq('task_id', taskId);
    } catch (err) {
      console.error('Failed to update performance log score:', err);
    }
  },

  /**
   * Records a real-world outcome event (e.g. email replied, content engagement)
   */
  async recordOutcome(
    taskId: string | null,
    agentId: string,
    projectId: string,
    eventType: string,
    eventValue?: number,
    metadata?: any
  ): Promise<OutcomeEvent | null> {
    try {
      const supabase = supabaseService.getServiceClient();

      const { data: event, error: eventErr } = await supabase
        .from('outcome_events')
        .insert({
          project_id: projectId,
          agent_id: agentId,
          task_id: taskId || null,
          event_type: eventType,
          event_value: eventValue !== undefined ? eventValue : null,
          metadata: metadata || {}
        })
        .select()
        .single();

      if (eventErr) {
        console.error('Failed to insert outcome event:', eventErr.message);
        return null;
      }

      // Reinforce learnings from this outcome
      await this.reinforceLearning(agentId, projectId, taskId, eventType, eventValue);

      return event;
    } catch (err) {
      console.error('Error in recordOutcome:', err);
      return null;
    }
  },

  /**
   * Updates learning confidence based on positive or negative outcomes
   */
  async reinforceLearning(
    agentId: string,
    projectId: string,
    taskId: string | null,
    eventType: string,
    value?: number
  ): Promise<AgentLearning[]> {
    try {
      const supabase = supabaseService.getServiceClient();

      // Retrieve task performance log to get category and approach if task is provided
      let category = 'General';
      let approach = '';
      if (taskId) {
        const { data: log } = await supabase
          .from('agent_performance_logs')
          .select('task_category, approach_used')
          .eq('task_id', taskId)
          .maybeSingle();
        if (log) {
          category = log.task_category;
          approach = log.approach_used;
        }
      }

      // Positive vs Negative outcome classification
      const positiveEvents = new Set([
        'email_replied', 'deal_closed', 'lead_converted', 'code_deployed', 'report_used', 'user_approved'
      ]);
      const isPositive = positiveEvents.has(eventType) || (eventType === 'content_engagement' && (value === undefined || value >= 0.5));
      const isNegative = eventType === 'user_rejected' || (eventType === 'content_engagement' && value !== undefined && value < 0.5);

      if (!isPositive && !isNegative) {
        return [];
      }

      // User feedback features get 2x weighting
      const weight = eventType.startsWith('user_') ? 2 : 1;

      // Query active learnings for this agent to find a match on category
      const { data: learnings } = await supabase
        .from('agent_learnings')
        .select('*')
        .eq('agent_id', agentId)
        .eq('project_id', projectId)
        .eq('category', category)
        .eq('is_active', true);

      const updatedLearnings: AgentLearning[] = [];

      if (learnings && learnings.length > 0 && approach) {
        // Find best matching learning using simple keyword overlap with task approach
        const approachWords = new Set(this.extractKeywords(approach));
        let bestMatch: AgentLearning | null = null;
        let maxOverlap = 0;

        for (const learning of learnings) {
          const insightWords = this.extractKeywords(learning.insight);
          const overlap = insightWords.filter(w => approachWords.has(w)).length;
          if (overlap > maxOverlap) {
            maxOverlap = overlap;
            bestMatch = learning;
          }
        }

        // If a matching learning is found, reinforce it
        if (bestMatch) {
          let newConfidence = bestMatch.confidence;
          if (isPositive) {
            newConfidence = Math.min(1.0, bestMatch.confidence + 0.1 * weight);
          } else {
            newConfidence = Math.max(0.0, bestMatch.confidence - 0.1 * weight);
          }

          const isActive = newConfidence >= 0.2;

          const { data: updated } = await supabase
            .from('agent_learnings')
            .update({
              confidence: newConfidence,
              evidence_count: bestMatch.evidence_count + weight,
              last_reinforced: new Date().toISOString(),
              is_active: isActive
            })
            .eq('id', bestMatch.id)
            .select()
            .single();

          if (updated) updatedLearnings.push(updated);
          return updatedLearnings;
        }
      }

      // If no matching learning is found, and it is a positive outcome, create a new learning
      if (isPositive && approach) {
        const { data: newLearning } = await supabase
          .from('agent_learnings')
          .insert({
            agent_id: agentId,
            project_id: projectId,
            learning_type: 'approach',
            category: category,
            insight: `Agent should use approach: ${approach}`,
            confidence: 0.5,
            evidence_count: weight,
            is_active: true
          })
          .select()
          .single();

        if (newLearning) updatedLearnings.push(newLearning);
      }

      return updatedLearnings;
    } catch (err) {
      console.error('Error in reinforceLearning:', err);
      return [];
    }
  },

  /**
   * Records user rating or edit feedback
   */
  async recordUserFeedback(
    taskId: string,
    agentId: string,
    projectId: string,
    rating?: number,
    feedbackText?: string,
    editedOutput?: string
  ): Promise<UserFeedback | null> {
    try {
      const supabase = supabaseService.getServiceClient();

      // Fetch original output
      const { data: task } = await supabase
        .from('agent_tasks')
        .select('output')
        .eq('id', taskId)
        .single();

      const originalOutput = task?.output || null;
      const isEdited = !!editedOutput && editedOutput !== originalOutput;

      const { data: feedback, error: feedbackErr } = await supabase
        .from('user_feedback')
        .insert({
          agent_id: agentId,
          task_id: taskId,
          project_id: projectId,
          rating: rating !== undefined ? rating : null,
          feedback_text: feedbackText || null,
          output_edited: isEdited,
          original_output: originalOutput,
          edited_output: editedOutput || null
        })
        .select()
        .single();

      if (feedbackErr) {
        console.error('Failed to record user feedback:', feedbackErr.message);
        return null;
      }

      // Update rating in performance log if exists
      if (rating !== undefined) {
        await supabase
          .from('agent_performance_logs')
          .update({
            user_rating: rating,
            user_edited: isEdited,
            user_edit_delta: isEdited ? `Original size: ${originalOutput?.length}, Edited size: ${editedOutput?.length}` : null
          })
          .eq('task_id', taskId);
      }

      // Determine Positive vs Negative signal
      // Rating >= 4 or No Edit = Positive approval
      if ((rating !== undefined && rating >= 4) || (rating === undefined && !isEdited)) {
        await this.recordOutcome(taskId, agentId, projectId, 'user_approved', rating ? rating / 5 : 1.0);
      } else if ((rating !== undefined && rating <= 2) || isEdited) {
        await this.recordOutcome(taskId, agentId, projectId, 'user_rejected', rating ? rating / 5 : 0.0);
      }

      // Analyze edit difference if edit was submitted
      if (isEdited && originalOutput && editedOutput) {
        this.analyzeEdit(originalOutput, editedOutput, agentId, projectId).catch(err => {
          console.error('Failed to analyze edit output:', err);
        });
      }

      return feedback;
    } catch (err) {
      console.error('Error in recordUserFeedback:', err);
      return null;
    }
  },

  /**
   * Calls OpenRouter to analyze the delta between original and edited outputs
   */
  async analyzeEdit(original: string, edited: string, agentId: string, projectId: string): Promise<void> {
    try {
      const supabase = supabaseService.getServiceClient();

      const systemPrompt = `Compare these two versions of the same AI output. The second is the human-edited version.

Original: ${original.substring(0, 3000)}
Edited: ${edited.substring(0, 3000)}

What did the human change and why?
Return ONLY JSON format:
{
  "changes": [{
    "type": "tone"|"length"|"format"|"content"|"structure",
    "description": "what changed",
    "learning": "what agent should do differently"
  }]
}`;

      const response = await openrouterService.callModel(
        'Compare these two versions of the same AI output and identify human adjustments.',
        [{ role: 'user', content: 'Compare versions.' }],
        'openai/gpt-4o'
      );

      let cleanJson = response.trim();
      if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson
          .replace(/^```json\s*/i, '')
          .replace(/```$/, '')
          .trim();
      }

      const parsed = JSON.parse(cleanJson);
      const changes = parsed.changes || [];

      for (const change of changes) {
        // Direct user edits have high confidence (0.8) and double weight (2) evidence
        await supabase
          .from('agent_learnings')
          .insert({
            agent_id: agentId,
            project_id: projectId,
            learning_type: change.type,
            category: 'User Preference',
            insight: change.learning,
            confidence: 0.8,
            evidence_count: 2,
            is_active: true
          });
      }
    } catch (err) {
      console.error('Error in analyzeEdit:', err);
    }
  },

  /**
   * Weekly learning extraction cron run
   */
  async extractLearnings(agentId: string, projectId: string): Promise<number> {
    try {
      const supabase = supabaseService.getServiceClient();

      // 1. Weekly confidence decay (-0.05 for learnings without reinforcement in past 7 days)
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const { data: decayingLearnings } = await supabase
        .from('agent_learnings')
        .select('*')
        .eq('agent_id', agentId)
        .eq('project_id', projectId)
        .eq('is_active', true)
        .lt('last_reinforced', oneWeekAgo.toISOString());

      if (decayingLearnings && decayingLearnings.length > 0) {
        for (const learning of decayingLearnings) {
          const decayedConfidence = Math.max(0.0, learning.confidence - 0.05);
          const isActive = decayedConfidence >= 0.2;
          await supabase
            .from('agent_learnings')
            .update({
              confidence: decayedConfidence,
              is_active: isActive
            })
            .eq('id', learning.id);
        }
      }

      // 2. Fetch last 20 performance logs
      const { data: logs, error: logsErr } = await supabase
        .from('agent_performance_logs')
        .select('*')
        .eq('agent_id', agentId)
        .eq('project_id', projectId)
        .not('judge_score', 'is', null)
        .order('created_at', { ascending: false })
        .limit(20);

      if (logsErr || !logs || logs.length === 0) {
        return 0;
      }

      // Group by category
      const groups: Record<string, typeof logs> = {};
      for (const log of logs) {
        if (!groups[log.task_category]) {
          groups[log.task_category] = [];
        }
        groups[log.task_category].push(log);
      }

      // Fetch agent info to get role
      const { data: agent } = await supabase
        .from('startup_agents')
        .select('role')
        .eq('id', agentId)
        .single();

      const roleName = agent?.role || 'agent';
      let newLearningsCount = 0;

      for (const [category, catLogs] of Object.entries(groups)) {
        // extractLearnings only runs with >= 3 tasks per category
        if (catLogs.length < 3) continue;

        const highScoring = catLogs.filter(l => (l.judge_score || 0) >= 35);
        const lowScoring = catLogs.filter(l => (l.judge_score || 0) < 25);

        if (highScoring.length === 0 && lowScoring.length === 0) continue;

        try {
          const prompt = `Analyze these task performance records for a ${roleName} agent.

High scoring tasks (score >= 35):
${highScoring.map(l => `- Category: ${l.task_category}, Approach: ${l.approach_used}`).join('\n')}

Low scoring tasks (score < 25):
${lowScoring.map(l => `- Category: ${l.task_category}, Approach: ${l.approach_used}`).join('\n')}

Extract actionable learnings:
What approaches work well for this agent?
What should it do differently?
What patterns lead to better outputs?

Return ONLY a valid JSON array of objects matching this signature (no explanation, markdown headers, or other text):
[
  {
    "learning_type": "approach"|"tone"|"format"|"tool_usage",
    "category": "${category}",
    "insight": "actionable insight description",
    "confidence": 0.75
  }
]`;

          const response = await openrouterService.callModel(
            'Extract actionable learnings in clean JSON from performance logs.',
            [{ role: 'user', content: prompt }],
            'openai/gpt-4o'
          );

          let cleanJson = response.trim();
          if (cleanJson.startsWith('```')) {
            cleanJson = cleanJson
              .replace(/^```json\s*/i, '')
              .replace(/```$/, '')
              .trim();
          }

          const learnings = JSON.parse(cleanJson);
          for (const learn of learnings) {
            // Check if exact insight already exists
            const { data: existing } = await supabase
              .from('agent_learnings')
              .select('*')
              .eq('agent_id', agentId)
              .eq('project_id', projectId)
              .eq('insight', learn.insight)
              .maybeSingle();

            if (existing) {
              await supabase
                .from('agent_learnings')
                .update({
                  confidence: Math.min(1.0, (existing.confidence + learn.confidence) / 2 + 0.1),
                  evidence_count: existing.evidence_count + 1,
                  last_reinforced: new Date().toISOString(),
                  is_active: true
                })
                .eq('id', existing.id);
            } else {
              await supabase
                .from('agent_learnings')
                .insert({
                  agent_id: agentId,
                  project_id: projectId,
                  learning_type: learn.learning_type || 'approach',
                  category: category,
                  insight: learn.insight,
                  confidence: learn.confidence || 0.5,
                  evidence_count: 1,
                  is_active: true
                });
              newLearningsCount++;
            }
          }
        } catch (catErr) {
          console.error(`Failed to extract learnings for category ${category}:`, catErr);
        }
      }

      return newLearningsCount;
    } catch (err) {
      console.error('Error in extractLearnings:', err);
      return 0;
    }
  },

  /**
   * Compiles active learnings and updates the agent system prompt strategy additions
   */
  async updateAgentStrategy(agentId: string, projectId: string): Promise<AgentStrategyVersion | null> {
    try {
      const supabase = supabaseService.getServiceClient();

      // 1. Fetch active learnings where confidence >= 0.6
      const { data: learnings } = await supabase
        .from('agent_learnings')
        .select('*')
        .eq('agent_id', agentId)
        .eq('project_id', projectId)
        .eq('is_active', true)
        .gte('confidence', 0.6);

      // Rule: updateAgentStrategy() only with >= 5 learnings
      if (!learnings || learnings.length < 5) {
        console.log(`Agent ${agentId} has only ${learnings?.length || 0} active learnings with confidence >= 0.6. Skipping strategy update.`);
        return null;
      }

      // 2. Fetch agent info
      const { data: agent } = await supabase
        .from('startup_agents')
        .select('*')
        .eq('id', agentId)
        .single();

      if (!agent) return null;

      // 3. Fetch last strategy version
      const { data: lastVersionRecord } = await supabase
        .from('agent_strategy_versions')
        .select('*')
        .eq('agent_id', agentId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      const lastVersion = lastVersionRecord?.version || 0;
      const currentStrategyAdditions = lastVersionRecord?.strategy_additions || 'None.';

      // Group learnings
      const performanceLearnings = learnings.filter(l => l.category !== 'User Preference');
      const userPreferences = learnings.filter(l => l.category === 'User Preference');

      // 4. Call OpenRouter to compile updated strategy additions
      const strategyPrompt = `You are updating the strategy additions for a ${agent.role} AI agent based on performance logs and feedback.

Current agent strategy additions (accumulated learnings so far):
${currentStrategyAdditions}

New learnings from recent performance:
${performanceLearnings.map(l => `• [${l.learning_type}] ${l.insight} (confidence: ${l.confidence}, evidence: ${l.evidence_count} tasks)`).join('\n')}

User preferences learned:
${userPreferences.map(l => `• ${l.insight} (confidence: ${l.confidence})`).join('\n')}

Produce an updated strategy additions block for this agent's system prompt. This will be appended to their base identity.
Format exactly as:
LEARNED STRATEGIES (v${lastVersion + 1}):
• {specific improvement 1}
• {specific improvement 2}
...

Only include high-confidence learnings. Be extremely specific — no generic advice. Max 10 bullet points.`;

      const response = await openrouterService.callModel(
        'Generate compiled agent strategy updates in bullet points.',
        [{ role: 'user', content: strategyPrompt }],
        'openai/gpt-4o'
      );

      const newStrategyText = response.trim();

      // Calculate average score of last 10 tasks before this update
      const { data: recentTasks } = await supabase
        .from('agent_tasks')
        .select('judge_score')
        .eq('agent_id', agentId)
        .not('judge_score', 'is', null)
        .order('created_at', { ascending: false })
        .limit(10);

      const totalScore = (recentTasks || []).reduce((acc, t) => acc + (t.judge_score || 0), 0);
      const avgScore = recentTasks && recentTasks.length > 0 ? totalScore / recentTasks.length : null;

      // 5. Save strategy version
      const { data: savedVersion, error: saveErr } = await supabase
        .from('agent_strategy_versions')
        .insert({
          agent_id: agentId,
          project_id: projectId,
          version: lastVersion + 1,
          strategy_additions: newStrategyText,
          strategy_removals: lastVersionRecord?.strategy_additions || null,
          triggered_by: 'performance',
          avg_score_before: lastVersionRecord?.avg_score_after || null,
          avg_score_after: avgScore
        })
        .select()
        .single();

      if (saveErr || !savedVersion) {
        console.error('Failed to save agent strategy version:', saveErr?.message);
        return null;
      }

      // Add to learnings as approach with high confidence
      await supabase
        .from('agent_learnings')
        .insert({
          agent_id: agentId,
          project_id: projectId,
          learning_type: 'approach',
          category: 'Strategy Compilation',
          insight: `Strategy updated to v${lastVersion + 1}: appended key operational improvements to system prompt.`,
          confidence: 0.9,
          evidence_count: 1,
          is_active: true
        });

      return savedVersion;
    } catch (err) {
      console.error('Error in updateAgentStrategy:', err);
      return null;
    }
  },

  /**
   * Generates the system prompt enhancement text containing strategy additions and active learnings
   */
  async getAgentContextWithLearnings(agentId: string, projectId: string, taskDescription: string): Promise<string> {
    try {
      const supabase = supabaseService.getServiceClient();

      // 1. Fetch total tasks count
      const { count: totalTasks } = await supabase
        .from('agent_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('agent_id', agentId)
        .eq('status', 'done');

      // 2. Fetch latest strategy version
      const { data: latestStrategy } = await supabase
        .from('agent_strategy_versions')
        .select('*')
        .eq('agent_id', agentId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      // 3. Fetch active learnings sorted by confidence desc
      const { data: activeLearnings } = await supabase
        .from('agent_learnings')
        .select('*')
        .eq('agent_id', agentId)
        .eq('project_id', projectId)
        .eq('is_active', true)
        .gte('confidence', 0.6)
        .order('confidence', { ascending: false });

      if (!activeLearnings || activeLearnings.length === 0) {
        if (latestStrategy) {
          return `
[LEARNED STRATEGIES (based on ${totalTasks || 0} tasks completed)]
${latestStrategy.strategy_additions}
`;
        }
        return '';
      }

      // Keyword relevance filtering (max 10 total learnings)
      const taskKeywords = new Set(this.extractKeywords(taskDescription));
      const relevantLearnings = [];
      const userPreferenceLearnings = [];

      for (const learning of activeLearnings) {
        // Stop if we have gathered 10 learnings
        if (relevantLearnings.length + userPreferenceLearnings.length >= 10) break;

        const isUserPreference = learning.category === 'User Preference';

        if (isUserPreference) {
          userPreferenceLearnings.push(learning);
        } else {
          // Check keyword overlap for relevance
          const insightWords = this.extractKeywords(learning.insight);
          const overlap = insightWords.some(w => taskKeywords.has(w));
          if (overlap || relevantLearnings.length < 5) {
            relevantLearnings.push(learning);
          }
        }
      }

      // Compile string
      let context = '\n';
      
      if (latestStrategy) {
        context += `[LEARNED STRATEGIES (based on ${totalTasks || 0} tasks completed)]\n${latestStrategy.strategy_additions}\n\n`;
      }

      if (relevantLearnings.length > 0) {
        context += `[RELEVANT PAST LEARNINGS]\n${relevantLearnings.map(l => `• [${l.learning_type}] ${l.insight}`).join('\n')}\n\n`;
      }

      if (userPreferenceLearnings.length > 0) {
        context += `[WHAT WORKS FOR THIS USER]\n${userPreferenceLearnings.map(l => `• ${l.insight}`).join('\n')}\n`;
      }

      return context;
    } catch (err) {
      console.error('Error in getAgentContextWithLearnings:', err);
      return '';
    }
  }
};

export default learningService;
