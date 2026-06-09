import supabaseService from './supabase.service';
import openrouterService from './openrouter.service';
import { JUDGE_IDENTITY } from '../lib/agent-identities';
import { AgentTask, StartupAgent, JudgeEvaluation } from '../types';
import { emit } from '../lib/emit';
import { StreamEventType } from '../lib/stream-events';

export const judgeService = {
  async evaluateTask(
    task: AgentTask,
    agent: StartupAgent,
    projectId: string
  ): Promise<any> {
    const supabase = supabaseService.getServiceClient();
    
    emit(projectId, StreamEventType.JUDGE_EVALUATING,
      `Judge evaluating ${agent.name} output...`,
      { agentId: agent.id });
    
    // User prompt
    const userPrompt = `Agent role: ${agent.role}
Agent name: ${agent.name}
Original task: ${task.description}
Agent output:
${task.output || ''}

Evaluate this output now.`;

    // Retrieve score evaluation from OpenRouter using GPT-4o
    const rawResult = await openrouterService.callModel(
      JUDGE_IDENTITY,
      [{ role: 'user', content: userPrompt }],
      'openai/gpt-4o'
    );

    // Clean JSON output
    let cleanJson = rawResult.trim();
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson
        .replace(/^```json\s*/i, '')
        .replace(/```$/, '')
        .trim();
    }

    let result: {
      scores: {
        completeness: number;
        accuracy: number;
        actionability: number;
        role_fidelity: number;
        quality: number;
      };
      total: number;
      passed: boolean;
      feedback: string;
      revision_prompt: string | null;
    };

    try {
      result = JSON.parse(cleanJson);
    } catch (parseErr) {
      console.warn('Failed to parse judge JSON response. Extracting with regex.', parseErr);
      // Fallback regex parsing or default scores
      const completenessMatch = cleanJson.match(/completeness["\s:]+(\d+)/i);
      const accuracyMatch = cleanJson.match(/accuracy["\s:]+(\d+)/i);
      const actionabilityMatch = cleanJson.match(/actionability["\s:]+(\d+)/i);
      const roleMatch = cleanJson.match(/role_fidelity["\s:]+(\d+)/i);
      const qualityMatch = cleanJson.match(/quality["\s:]+(\d+)/i);
      
      const comp = completenessMatch ? parseInt(completenessMatch[1]) : 7;
      const acc = accuracyMatch ? parseInt(accuracyMatch[1]) : 7;
      const act = actionabilityMatch ? parseInt(actionabilityMatch[1]) : 7;
      const role = roleMatch ? parseInt(roleMatch[1]) : 7;
      const qual = qualityMatch ? parseInt(qualityMatch[1]) : 7;
      
      const total = comp + acc + act + role + qual;
      
      result = {
        scores: {
          completeness: comp,
          accuracy: acc,
          actionability: act,
          role_fidelity: role,
          quality: qual
        },
        total,
        passed: total >= 35,
        feedback: 'The output was scored using a regex fallback parser due to formatting issues.',
        revision_prompt: total < 35 ? 'Please refine the overall quality, precision, and actionability of your output.' : null
      };
    }

    // Determine current round number
    const { data: evals } = await supabase
      .from('judge_evaluations')
      .select('round')
      .eq('task_id', task.id);
    const roundNumber = evals && evals.length > 0 ? evals.length + 1 : 1;

    // Save to judge_evaluations table
    const { error: insertErr } = await supabase
      .from('judge_evaluations')
      .insert({
        task_id: task.id,
        agent_id: agent.id,
        project_id: projectId,
        round: roundNumber,
        score_complete: result.scores.completeness,
        score_accurate: result.scores.accuracy,
        score_actionable: result.scores.actionability,
        score_role: result.scores.role_fidelity,
        score_quality: result.scores.quality,
        total_score: result.total,
        passed: result.passed,
        feedback: result.feedback,
        revision_prompt: result.revision_prompt
      });

    if (insertErr) {
      console.error('Failed to insert judge evaluation:', insertErr);
    }

    // Update agent_tasks
    const { error: updateErr } = await supabase
      .from('agent_tasks')
      .update({
        judge_score: result.total,
        judge_feedback: result.feedback,
        judge_passed: result.passed
      })
      .eq('id', task.id);

    if (updateErr) {
      console.error('Failed to update task with judge evaluation details:', updateErr);
    }

    if (result.passed) {
      emit(projectId, StreamEventType.JUDGE_PASSED,
        `${agent.name} quality passed: ${result.total}/50`,
        {
          agentId: agent.id,
          status: 'done',
          data: { score: result.total, passed: true }
        });
    } else {
      emit(projectId, StreamEventType.JUDGE_FAILED,
        `${agent.name} needs revision: ${result.total}/50`,
        {
          agentId: agent.id,
          status: 'error',
          data: { score: result.total, passed: false, feedback: result.feedback }
        });
    }

    return result;
  },

  async triggerRevision(
    originalTask: AgentTask,
    agent: StartupAgent,
    evaluation: { total: number; passed: boolean; feedback: string; revision_prompt: string | null },
    projectId: string,
    userId: string,
    isStreaming: boolean = true
  ): Promise<AgentTask> {
    if (evaluation.passed) {
      return originalTask;
    }

    const currentRound = originalTask.revision_round ?? 0;
    const supabase = supabaseService.getServiceClient();

    emit(projectId, StreamEventType.JUDGE_REVISION,
      `Revising ${agent.name} output (round ${currentRound + 1})`,
      {
        agentId: agent.id,
        detail: (evaluation.revision_prompt || '').substring(0, 100)
      });

    if (currentRound >= 3) {
      // Mark as done_with_warnings if max rounds reached
      const { data: updatedTask } = await supabase
        .from('agent_tasks')
        .update({ final_status: 'done_with_warnings' })
        .eq('id', originalTask.id)
        .select()
        .single();
      return updatedTask || originalTask;
    }

    // Build revision prompt
    const revisionContext = `Your previous output was evaluated.
Score: ${evaluation.total}/50
Feedback: ${evaluation.feedback}

Specific improvements needed:
${evaluation.revision_prompt || 'Please improve the output completeness and quality.'}

Previous output (do not repeat this):
${originalTask.output || ''}

Produce an improved version now.`;

    // Create a new task representing the revision execution round
    const { data: revisionTask, error: createErr } = await supabase
      .from('agent_tasks')
      .insert({
        agent_id: agent.id,
        project_id: projectId,
        title: `Revision ${currentRound + 1}: ${originalTask.title}`,
        description: revisionContext,
        revision_of_task_id: originalTask.id,
        revision_round: currentRound + 1,
        triggered_by: 'agent',
        status: 'queued',
        tools_used: []
      })
      .select()
      .single();

    if (createErr || !revisionTask) {
      throw new Error(`Failed to create revision task: ${createErr?.message}`);
    }

    // Run the agent task execution on this revision context
    // Load agentRuntimeService dynamically to avoid circular references
    const { default: agentRuntimeService } = await import('./agent-runtime.service');
    const completedRevisionTask = isStreaming
      ? await agentRuntimeService.runAgentTask(
          agent.id,
          revisionContext,
          userId,
          'agent',
          null,
          revisionTask.id
        )
      : await agentRuntimeService.executeAndSave(
          agent.id,
          revisionContext,
          userId,
          'agent',
          null,
          revisionTask.id
        );

    // Evaluate the new output
    const newEvaluation = await this.evaluateTask(completedRevisionTask, agent, projectId);

    // Propagate the latest results to the original parent task to maintain the single task node status
    await supabase
      .from('agent_tasks')
      .update({
        output: completedRevisionTask.output,
        judge_score: newEvaluation.total,
        judge_feedback: newEvaluation.feedback,
        judge_passed: newEvaluation.passed,
        revision_round: currentRound + 1,
        final_status: newEvaluation.passed ? 'done' : (currentRound + 1 >= 3 ? 'done_with_warnings' : 'done')
      })
      .eq('id', originalTask.id);

    // If still fails and round < 3, trigger revision recursively
    if (!newEvaluation.passed && currentRound + 1 < 3) {
      const nextRoundTask = await supabase
        .from('agent_tasks')
        .select('*')
        .eq('id', originalTask.id)
        .single();
      if (nextRoundTask.data) {
        return this.triggerRevision(nextRoundTask.data, agent, newEvaluation, projectId, userId, isStreaming);
      }
    }

    // Return the final updated task
    const { data: finalOriginal } = await supabase
      .from('agent_tasks')
      .select('*')
      .eq('id', originalTask.id)
      .single();

    return finalOriginal || completedRevisionTask;
  },

  async getTaskEvaluations(taskId: string): Promise<JudgeEvaluation[]> {
    const supabase = supabaseService.getClient();
    const { data, error } = await supabase
      .from('judge_evaluations')
      .select('*')
      .eq('task_id', taskId)
      .order('round', { ascending: true });

    if (error) {
      console.error(`Failed to fetch evaluations for task ${taskId}:`, error);
      return [];
    }
    return data || [];
  },

  async getAgentQualityStats(agentId: string, projectId: string): Promise<{
    average_score: number;
    pass_rate: number;
    most_common_failure_dimension: string;
    total_evaluations: number;
  }> {
    const supabase = supabaseService.getClient();
    const { data, error } = await supabase
      .from('judge_evaluations')
      .select('*')
      .eq('agent_id', agentId)
      .eq('project_id', projectId);

    if (error || !data || data.length === 0) {
      return {
        average_score: 0,
        pass_rate: 0,
        most_common_failure_dimension: 'None',
        total_evaluations: 0
      };
    }

    let totalScore = 0;
    let passCount = 0;
    
    // Track dimension failure sums
    const failures = {
      completeness: 0,
      accuracy: 0,
      actionability: 0,
      role_fidelity: 0,
      quality: 0
    };

    data.forEach((e) => {
      totalScore += e.total_score;
      if (e.passed) {
        passCount++;
      } else {
        // Find which dimension was lowest or below passing threshold (7 is good target)
        if (e.score_complete < 7) failures.completeness++;
        if (e.score_accurate < 7) failures.accuracy++;
        if (e.score_actionable < 7) failures.actionability++;
        if (e.score_role < 7) failures.role_fidelity++;
        if (e.score_quality < 7) failures.quality++;
      }
    });

    // Determine the dimension with the most failures
    let mostCommonFailure = 'None';
    let maxFailures = 0;

    for (const [dimension, count] of Object.entries(failures)) {
      if (count > maxFailures) {
        maxFailures = count;
        mostCommonFailure = dimension.replace('_', ' ');
      }
    }

    return {
      average_score: parseFloat((totalScore / data.length).toFixed(1)),
      pass_rate: Math.round((passCount / data.length) * 100),
      most_common_failure_dimension: mostCommonFailure.toUpperCase(),
      total_evaluations: data.length
    };
  }
};

export default judgeService;
