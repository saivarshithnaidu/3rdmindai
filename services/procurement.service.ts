import supabaseService from './supabase.service';
import { openrouterService } from './openrouter.service';
import { toolsService } from './tools.service';
import { emit } from '../lib/emit';
import { StreamEventType } from '../lib/stream-events';

export const procurementService = {
  /**
   * Find alternatives for an existing procurement item.
   * Searches G2, Product Hunt, Google via toolsService.searchWeb().
   * Uses LLM to compare and score each alternative.
   * Saves top 5 to procurement_alternatives.
   */
  async findAlternatives(itemId: string): Promise<any[]> {
    const supabase = supabaseService.getServiceClient();

    // 1. Fetch the procurement item
    const { data: item, error: fetchErr } = await supabase
      .from('procurement_items')
      .select('*')
      .eq('id', itemId)
      .single();

    if (fetchErr || !item) {
      throw new Error(`Procurement item not found: ${fetchErr?.message}`);
    }

    emit(item.project_id, StreamEventType.AGENT_STARTED, `Procurement Agent searching alternatives for "${item.name}"...`, { status: 'running' });

    // 2. Update status to evaluating
    await supabase
      .from('procurement_items')
      .update({ status: 'evaluating' })
      .eq('id', itemId);

    try {
      // 3. Search for alternatives across multiple sources
      const searchQueries = [
        `${item.name} alternatives competitors pricing ${item.category} 2025`,
        `best ${item.category} tools cheaper than ${item.current_provider || item.name} G2 reviews`,
        `${item.name} vs competitors comparison Product Hunt`
      ];

      emit(item.project_id, StreamEventType.TOOL_CALLING, `Searching web for "${item.name}" alternatives across G2, Product Hunt, Google...`, { status: 'running' });

      const searchResults: string[] = [];
      for (const query of searchQueries) {
        const result = await toolsService.searchWeb(query);
        searchResults.push(result);
      }

      const combinedSearchResults = searchResults.join('\n\n---\n\n');

      // 4. Use LLM to analyze and score alternatives
      emit(item.project_id, StreamEventType.AGENT_THINKING, `AI analyzing alternatives for "${item.name}" — scoring features match, calculating savings...`, { status: 'running' });

      const system = `You are a procurement intelligence analyst. Based on web search results, identify the top 5 alternative providers for the given software/service tool.

For each alternative, provide:
- provider_name: the name of the alternative tool/service
- price: estimated monthly price in ${item.currency || 'INR'} (convert if needed, use best estimate)
- billing_cycle: "monthly" or "annual" or "one-time"
- features_match: 0-100 score of how well it matches the original tool's features
- savings_amount: how much money saved per billing cycle compared to current price of ${item.current_price || 0} ${item.currency || 'INR'}/${item.billing_cycle || 'monthly'}
- recommendation: 1-2 sentence recommendation (why switch or stay)
- source_url: URL where this info was found (use best available from search results)

Return ONLY a clean JSON array. No markdown, no code block characters. The output must parse as:
[
  {
    "provider_name": "...",
    "price": 0,
    "billing_cycle": "monthly",
    "features_match": 85,
    "savings_amount": 500,
    "recommendation": "...",
    "source_url": "..."
  }
]

Rank by features_match descending. Only include realistic, real alternatives.`;

      const userPrompt = `CURRENT TOOL:
Name: ${item.name}
Category: ${item.category}
Current Provider: ${item.current_provider || 'Unknown'}
Current Price: ${item.current_price || 'Unknown'} ${item.currency || 'INR'}/${item.billing_cycle || 'monthly'}
Users: ${item.users_count || 'Unknown'}

WEB SEARCH RESULTS:
${combinedSearchResults}`;

      const model = 'deepseek/deepseek-chat';
      const response = await openrouterService.callModel(
        system,
        [{ role: 'user', content: userPrompt }],
        model
      );

      const cleaned = response.replace(/```json/gi, '').replace(/```/g, '').trim();
      const alternatives = JSON.parse(cleaned);

      // 5. Save top 5 alternatives to DB
      const top5 = alternatives.slice(0, 5);
      const insertRows = top5.map((alt: any) => ({
        item_id: itemId,
        provider_name: alt.provider_name,
        price: alt.price,
        billing_cycle: alt.billing_cycle || 'monthly',
        features_match: Math.min(100, Math.max(0, alt.features_match || 0)),
        savings_amount: alt.savings_amount || 0,
        recommendation: alt.recommendation || '',
        source_url: alt.source_url || ''
      }));

      const { data: saved, error: insErr } = await supabase
        .from('procurement_alternatives')
        .insert(insertRows)
        .select();

      if (insErr) throw insErr;

      // 6. Update item status back to active
      await supabase
        .from('procurement_items')
        .update({ status: 'active' })
        .eq('id', itemId);

      emit(item.project_id, StreamEventType.AGENT_COMPLETE, `Found ${top5.length} alternatives for "${item.name}". Top match: ${top5[0]?.provider_name || 'N/A'} with ${top5[0]?.features_match || 0}% feature match.`, { status: 'done' });

      return saved || [];

    } catch (err: any) {
      console.error('Failed to find alternatives:', err);
      await supabase
        .from('procurement_items')
        .update({ status: 'active' })
        .eq('id', itemId);

      emit(item.project_id, StreamEventType.STREAM_ERROR, `Failed finding alternatives for "${item.name}": ${err.message}`, { status: 'error' });
      throw err;
    }
  },

  /**
   * Research a new tool/service requirement.
   * Searches web, uses LLM to rank and recommend best options.
   * Saves results to procurement_requests.
   */
  async researchRequirement(requestId: string): Promise<any> {
    const supabase = supabaseService.getServiceClient();

    // 1. Fetch the request
    const { data: request, error: fetchErr } = await supabase
      .from('procurement_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchErr || !request) {
      throw new Error(`Procurement request not found: ${fetchErr?.message}`);
    }

    emit(request.project_id, StreamEventType.AGENT_STARTED, `Procurement Agent researching: "${request.requirement}"...`, { status: 'running' });

    try {
      // 2. Search web for matching tools
      const searchQueries = [
        `best tools for ${request.requirement} pricing comparison 2025`,
        `${request.requirement} software solutions India startups budget ${request.budget || ''}`,
        `top rated ${request.requirement} tools G2 Product Hunt reviews`
      ];

      emit(request.project_id, StreamEventType.TOOL_CALLING, `Searching web for tools matching: "${request.requirement}"...`, { status: 'running' });

      const searchResults: string[] = [];
      for (const query of searchQueries) {
        const result = await toolsService.searchWeb(query);
        searchResults.push(result);
      }

      const combinedResults = searchResults.join('\n\n---\n\n');

      // 3. Use LLM to analyze and recommend
      emit(request.project_id, StreamEventType.AGENT_THINKING, `AI ranking tools for "${request.requirement}" within budget...`, { status: 'running' });

      const system = `You are a startup procurement advisor. Based on web search results, recommend the top 5 tools/services for the given requirement.

Consider budget constraints, startup-friendliness, Indian market availability, and value for money.

Return ONLY a clean JSON object. No markdown, no code block characters:
{
  "top_picks": [
    {
      "name": "Tool Name",
      "provider": "Company",
      "price": 0,
      "currency": "INR",
      "billing_cycle": "monthly",
      "description": "What it does and why it fits",
      "pros": ["pro1", "pro2"],
      "cons": ["con1"],
      "url": "https://...",
      "fit_score": 90
    }
  ],
  "recommendation": "Overall recommendation paragraph explaining the best choice and why, considering budget and timeline."
}`;

      const userPrompt = `REQUIREMENT: ${request.requirement}
BUDGET: ${request.budget ? `₹${request.budget}` : 'Flexible'}
TIMELINE: ${request.timeline || 'No specific timeline'}

WEB SEARCH RESULTS:
${combinedResults}`;

      const model = 'deepseek/deepseek-chat';
      const response = await openrouterService.callModel(
        system,
        [{ role: 'user', content: userPrompt }],
        model
      );

      const cleaned = response.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      // 4. Save results to procurement_requests
      const { data: updated, error: updErr } = await supabase
        .from('procurement_requests')
        .update({
          status: 'complete',
          top_picks: parsed.top_picks || [],
          recommendation: parsed.recommendation || ''
        })
        .eq('id', requestId)
        .select()
        .single();

      if (updErr) throw updErr;

      emit(request.project_id, StreamEventType.AGENT_COMPLETE, `Research complete for "${request.requirement}". Found ${(parsed.top_picks || []).length} options. Top pick: ${parsed.top_picks?.[0]?.name || 'N/A'}.`, { status: 'done' });

      return updated;

    } catch (err: any) {
      console.error('Failed to research requirement:', err);
      await supabase
        .from('procurement_requests')
        .update({ status: 'failed' })
        .eq('id', requestId);

      emit(request.project_id, StreamEventType.STREAM_ERROR, `Failed researching "${request.requirement}": ${err.message}`, { status: 'error' });
      throw err;
    }
  },

  /**
   * Check for items with renewal dates within 14 days.
   * For each, find alternatives quickly and return alerts with savings info.
   */
  async checkRenewals(projectId: string): Promise<any[]> {
    const supabase = supabaseService.getServiceClient();

    emit(projectId, StreamEventType.AGENT_STARTED, `Checking upcoming renewals in the next 14 days...`, { status: 'running' });

    try {
      const now = new Date();
      const fourteenDaysLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

      const { data: items, error: fetchErr } = await supabase
        .from('procurement_items')
        .select('*')
        .eq('project_id', projectId)
        .gte('renewal_date', now.toISOString().split('T')[0])
        .lte('renewal_date', fourteenDaysLater.toISOString().split('T')[0])
        .order('renewal_date', { ascending: true });

      if (fetchErr) throw fetchErr;

      if (!items || items.length === 0) {
        emit(projectId, StreamEventType.AGENT_COMPLETE, `No renewals due in the next 14 days.`, { status: 'done' });
        return [];
      }

      const alerts: any[] = [];

      for (const item of items) {
        const renewalDate = new Date(item.renewal_date);
        const daysLeft = Math.ceil((renewalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        // Check if alternatives already exist
        const { data: existingAlts } = await supabase
          .from('procurement_alternatives')
          .select('*')
          .eq('item_id', item.id)
          .order('features_match', { ascending: false })
          .limit(3);

        const bestAlt = existingAlts && existingAlts.length > 0 ? existingAlts[0] : null;

        alerts.push({
          item,
          daysLeft,
          renewalDate: item.renewal_date,
          bestAlternative: bestAlt,
          potentialSavings: bestAlt?.savings_amount || 0,
          alternativesCount: existingAlts?.length || 0
        });
      }

      emit(projectId, StreamEventType.AGENT_COMPLETE, `Found ${alerts.length} renewal(s) due within 14 days. Total potential savings: ₹${alerts.reduce((sum, a) => sum + (a.potentialSavings || 0), 0).toLocaleString()}.`, { status: 'done' });

      return alerts;

    } catch (err: any) {
      console.error('Failed to check renewals:', err);
      emit(projectId, StreamEventType.STREAM_ERROR, `Failed checking renewals: ${err.message}`, { status: 'error' });
      throw err;
    }
  },

  /**
   * Generate a comprehensive stack report for the project.
   * Calculates spend, category breakdown, potential savings.
   * Uses LLM to generate insights and redundancy analysis.
   */
  async generateStackReport(projectId: string): Promise<any> {
    const supabase = supabaseService.getServiceClient();

    emit(projectId, StreamEventType.AGENT_STARTED, `Generating comprehensive stack report...`, { status: 'running' });

    try {
      // 1. Fetch all active items
      const { data: items, error: fetchErr } = await supabase
        .from('procurement_items')
        .select('*')
        .eq('project_id', projectId)
        .in('status', ['active', 'evaluating', 'renewal_due']);

      if (fetchErr) throw fetchErr;

      if (!items || items.length === 0) {
        emit(projectId, StreamEventType.AGENT_COMPLETE, `No active procurement items found to generate a report.`, { status: 'done' });
        return {
          totalMonthlySpend: 0,
          totalAnnualSpend: 0,
          toolsCount: 0,
          categoryBreakdown: [],
          potentialSavings: 0,
          overview: 'No tools in your stack yet. Add procurement items to generate a report.',
          redundancies: [],
          recommendations: []
        };
      }

      // 2. Calculate spend
      let totalMonthlySpend = 0;
      let totalAnnualSpend = 0;

      for (const item of items) {
        const price = Number(item.current_price) || 0;
        if (item.billing_cycle === 'monthly') {
          totalMonthlySpend += price;
          totalAnnualSpend += price * 12;
        } else if (item.billing_cycle === 'annual') {
          totalMonthlySpend += price / 12;
          totalAnnualSpend += price;
        } else if (item.billing_cycle === 'one-time') {
          totalAnnualSpend += price;
        }
      }

      // 3. Category breakdown
      const categoryMap: Record<string, { count: number; monthlySpend: number; tools: string[] }> = {};
      for (const item of items) {
        if (!categoryMap[item.category]) {
          categoryMap[item.category] = { count: 0, monthlySpend: 0, tools: [] };
        }
        categoryMap[item.category].count += 1;
        categoryMap[item.category].tools.push(item.name);
        const price = Number(item.current_price) || 0;
        if (item.billing_cycle === 'monthly') {
          categoryMap[item.category].monthlySpend += price;
        } else if (item.billing_cycle === 'annual') {
          categoryMap[item.category].monthlySpend += price / 12;
        }
      }

      const categoryBreakdown = Object.entries(categoryMap).map(([category, data]) => ({
        category,
        ...data,
        percentage: totalMonthlySpend > 0 ? Math.round((data.monthlySpend / totalMonthlySpend) * 100) : 0
      }));

      // 4. Calculate potential savings from alternatives
      const { data: allAlts } = await supabase
        .from('procurement_alternatives')
        .select('item_id, savings_amount, features_match')
        .in('item_id', items.map(i => i.id))
        .gte('features_match', 70)
        .order('savings_amount', { ascending: false });

      let potentialSavings = 0;
      const savingsByItem: Record<string, number> = {};
      for (const alt of (allAlts || [])) {
        if (!savingsByItem[alt.item_id]) {
          savingsByItem[alt.item_id] = Number(alt.savings_amount) || 0;
          potentialSavings += Number(alt.savings_amount) || 0;
        }
      }

      // 5. Use LLM to generate overview
      emit(projectId, StreamEventType.AGENT_THINKING, `AI analyzing stack for redundancies and optimization opportunities...`, { status: 'running' });

      const system = `You are a startup CTO and procurement strategist. Analyze this software stack and provide insights.

Return ONLY a clean JSON object:
{
  "overview": "2-3 paragraph overview of the stack health, efficiency, and areas for improvement",
  "redundancies": [
    {
      "tools": ["Tool A", "Tool B"],
      "category": "Category",
      "issue": "Why these overlap",
      "suggestion": "Which to keep and why"
    }
  ],
  "recommendations": [
    {
      "priority": "high" | "medium" | "low",
      "title": "Short recommendation title",
      "description": "Detailed actionable recommendation"
    }
  ]
}`;

      const userPrompt = `CURRENT STACK (${items.length} tools):
${items.map(i => `- ${i.name} (${i.category}) — ${i.current_provider || 'Self'} — ₹${i.current_price || 0}/${i.billing_cycle || 'monthly'} — ${i.users_count || '?'} users — Satisfaction: ${i.satisfaction || '?'}/5`).join('\n')}

CATEGORY BREAKDOWN:
${categoryBreakdown.map(c => `- ${c.category}: ${c.count} tools, ₹${Math.round(c.monthlySpend)}/mo (${c.percentage}%)`).join('\n')}

TOTAL MONTHLY SPEND: ₹${Math.round(totalMonthlySpend)}
TOTAL ANNUAL SPEND: ₹${Math.round(totalAnnualSpend)}
POTENTIAL SAVINGS FOUND: ₹${Math.round(potentialSavings)}`;

      const model = 'deepseek/deepseek-chat';
      const response = await openrouterService.callModel(
        system,
        [{ role: 'user', content: userPrompt }],
        model
      );

      const cleaned = response.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      const report = {
        totalMonthlySpend: Math.round(totalMonthlySpend),
        totalAnnualSpend: Math.round(totalAnnualSpend),
        toolsCount: items.length,
        categoryBreakdown,
        potentialSavings: Math.round(potentialSavings),
        overview: parsed.overview || '',
        redundancies: parsed.redundancies || [],
        recommendations: parsed.recommendations || []
      };

      emit(projectId, StreamEventType.AGENT_COMPLETE, `Stack report generated. ${items.length} tools tracked, ₹${Math.round(totalMonthlySpend)}/mo spend, ₹${Math.round(potentialSavings)} savings identified.`, { status: 'done' });

      return report;

    } catch (err: any) {
      console.error('Failed to generate stack report:', err);
      emit(projectId, StreamEventType.STREAM_ERROR, `Failed generating stack report: ${err.message}`, { status: 'error' });
      throw err;
    }
  }
};

export default procurementService;
