import supabaseService from './supabase.service';
import { openrouterService } from './openrouter.service';
import { emit } from '../lib/emit';
import { StreamEventType } from '../lib/stream-events';

export const contractService = {
  async analyzeContract(contractId: string): Promise<any> {
    const supabase = supabaseService.getServiceClient();

    // 1. Fetch contract text
    const { data: contract, error: fetchErr } = await supabase
      .from('contracts')
      .select('*')
      .eq('id', contractId)
      .single();

    if (fetchErr || !contract) {
      throw new Error(`Contract not found: ${fetchErr?.message}`);
    }

    emit(contract.project_id, StreamEventType.AGENT_STARTED, `Contract Intelligence Agent reviewing "${contract.name}"...`, { status: 'running' });

    const system = `You are a senior contract lawyer reviewing this document for a startup founder.
    Analyze the contract thoroughly. Find high, medium, and low risks. Identify missing standard clauses. Detail negotiation strategies.
    
    You must return ONLY a clean JSON block. Do not include markdown code block characters like \`\`\`json. The output must parse exactly as this JSON structure:
    {
      "risk_level": "high" | "medium" | "low",
      "overall_score": number (0-100, higher = safer/more founder-friendly),
      "plain_summary": "plain English summary (max 3 sentences)",
      "risky_clauses": [
        {
          "clause": "exact wording of the clause from the contract",
          "risk": "why this is risky for a startup founder",
          "severity": "critical" | "major" | "minor",
          "suggestion": "suggested revision wording or pushback guidance"
        }
      ],
      "missing_clauses": [
        {
          "clause_name": "clause name (e.g. Intellectual Property Assignment, Force Majeure)",
          "why_needed": "why a startup needs this standard clause",
          "suggested_text": "sample standard text to append"
        }
      ],
      "negotiation_points": [
        {
          "point": "brief negotiation pushback topic",
          "leverage": "why they might agree or our bargaining chip",
          "suggested_ask": "exactly what to propose instead"
        }
      ]
    }

    DISCLAIMER: Note that this is legal intelligence, not formal legal advice. Be extremely thorough.`;

    const model = 'deepseek/deepseek-chat';
    try {
      const response = await openrouterService.callModel(
        system,
        [{ role: 'user', content: contract.original_text }],
        model
      );

      const cleaned = response.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      // Save to contract_analysis
      const { data: analysis, error: insErr } = await supabase
        .from('contract_analysis')
        .insert({
          contract_id: contractId,
          risk_level: parsed.risk_level,
          risky_clauses: parsed.risky_clauses,
          missing_clauses: parsed.missing_clauses,
          negotiation_pts: parsed.negotiation_points,
          plain_summary: parsed.plain_summary,
          overall_score: parsed.overall_score
        })
        .select()
        .single();

      if (insErr) throw insErr;

      // Update status
      await supabase
        .from('contracts')
        .update({ status: 'complete' })
        .eq('id', contractId);

      emit(contract.project_id, StreamEventType.AGENT_COMPLETE, `Analysis complete for contract "${contract.name}". Score: ${parsed.overall_score}/100`, { status: 'done' });
      return analysis;

    } catch (err: any) {
      console.error('Failed to analyze contract:', err);
      await supabase
        .from('contracts')
        .update({ status: 'failed' })
        .eq('id', contractId);

      emit(contract.project_id, StreamEventType.STREAM_ERROR, `Failed reviewing contract "${contract.name}": ${err.message}`, { status: 'error' });
      throw err;
    }
  },

  async generateCounterProposal(contractId: string): Promise<string> {
    const supabase = supabaseService.getServiceClient();

    // Fetch contract text
    const { data: contract } = await supabase
      .from('contracts')
      .select('*')
      .eq('id', contractId)
      .single();

    // Fetch analysis details
    const { data: analysis } = await supabase
      .from('contract_analysis')
      .select('*')
      .eq('contract_id', contractId)
      .single();

    if (!contract || !analysis) {
      throw new Error('Contract or Analysis data not found.');
    }

    emit(contract.project_id, StreamEventType.AGENT_THINKING, `Formulating counter-proposal edits for "${contract.name}"...`, { status: 'running' });

    const system = `You are a contract negotiator. Based on the contract text and its risk analysis, rewrite the risky clauses to be founder-friendly.
    Generate a consolidated counter-proposal document representing the original contract but with suggested revisions tracked.
    Indicate tracked changes clearly inline using these markup patterns:
    [REMOVED: original wording]
    [ADDED: suggested founder-friendly replacement wording]
    [UNCHANGED: surrounding clause context]
    
    Make the revisions legally sound but clearly protective of the startup founder's interests.`;

    const userPrompt = `ORIGINAL CONTRACT:
    ${contract.original_text}
    
    RISK EVALUATION:
    Risky Clauses: ${JSON.stringify(analysis.risky_clauses)}
    Missing Clauses: ${JSON.stringify(analysis.missing_clauses)}`;

    const response = await openrouterService.callModel(
      system,
      [{ role: 'user', content: userPrompt }],
      'deepseek/deepseek-chat'
    );

    // Save to contract_analysis
    await supabase
      .from('contract_analysis')
      .update({ counter_proposal: response })
      .eq('id', analysis.id);

    emit(contract.project_id, StreamEventType.AGENT_COMPLETE, `Counter-proposal compiled for "${contract.name}".`, { status: 'done' });
    return response;
  },

  async generateTemplate(
    templateType: string,
    projectId: string,
    variables: Record<string, string>
  ): Promise<any> {
    const supabase = supabaseService.getServiceClient();

    emit(projectId, StreamEventType.AGENT_STARTED, `Generating standard template for "${templateType}"...`, { status: 'running' });

    const system = `Generate a complete, fully detailed ${templateType} legal contract template designed for a startup in India.
    Use clear, plain language. Do not use placeholders other than [FIELD_NAME] formats for variables.
    Company: ${variables.companyName || 'My Startup'}
    Context: ${variables.context || 'General Services'}
    
    Include all standard clauses (such as dispute resolution under Indian Arbitation laws, governing jurisdiction, liability limitations).
    Include this disclaimer at the top:
    "DISCLAIMER: This is a document template generated for informational purposes. It does not constitute legal advice. Please consult a qualified Indian lawyer to review the final document."`;

    const response = await openrouterService.callModel(
      system,
      [{ role: 'user', content: 'Generate document template' }],
      'deepseek/deepseek-chat'
    );

    const extractedVars = this.extractVariables(response);

    const { data: template, error: insErr } = await supabase
      .from('contract_templates')
      .insert({
        project_id: projectId,
        template_type: templateType,
        content: response,
        variables: extractedVars
      })
      .select()
      .single();

    if (insErr) throw insErr;

    emit(projectId, StreamEventType.AGENT_COMPLETE, `Standard ${templateType} template created.`, { status: 'done' });
    return template;
  },

  extractVariables(templateText: string): string[] {
    const pattern = /\[([A-Z0-9_ ]+)\]/g;
    const matches = new Set<string>();
    let match;
    while ((match = pattern.exec(templateText)) !== null) {
      matches.add(match[1].trim());
    }
    return Array.from(matches);
  }
};

export default contractService;
