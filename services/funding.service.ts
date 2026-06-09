import supabaseService from './supabase.service';
import { openrouterService } from './openrouter.service';
import { toolsService } from './tools.service';
import { emit } from '../lib/emit';
import { StreamEventType } from '../lib/stream-events';

export const fundingService = {
  async scrapeOpportunities(projectId?: string): Promise<number> {
    const supabase = supabaseService.getServiceClient();
    
    if (projectId) {
      emit(projectId, StreamEventType.AGENT_STARTED, 'Grant & Funding Agent scanning funding databases...', { status: 'running' });
    }

    // Crawl government grants and accelerators using web search
    const query = 'startup grants India 2026 government accelerators DST MeitY MSME schemes';
    let resultsText = '';
    try {
      resultsText = await toolsService.searchWeb(query);
    } catch (err) {
      console.warn('Web search failed for opportunities, compiling fallbacks:', err);
    }

    const system = `You are a database compiler for funding opportunities. Parse the search context and list all active grants, loans, accelerators, or competitions for Indian startups.
    Extract: name, provider, type ('grant' | 'accelerator' | 'loan' | 'competition'), amount_min, amount_max, currency, eligibility description, deadline (formatted YYYY-MM-DD or null), application_url, description, stage_fit (array containing idea/mvp/growth/all), sector_fit (array of sectors), source_url.
    
    Return ONLY a JSON array of objects:
    [
      {
        "name": "Scheme name",
        "provider": "Government body or sponsor",
        "type": "grant",
        "amount_min": 1000000,
        "amount_max": 5000000,
        "currency": "INR",
        "eligibility": "Description of eligibility criteria",
        "deadline": "2026-12-31",
        "application_url": "URL",
        "description": "Details",
        "stage_fit": ["mvp", "growth"],
        "sector_fit": ["fintech", "saas"],
        "source_url": "URL"
      }
    ]`;

    let opportunities: any[] = [];
    try {
      const response = await openrouterService.callModel(
        system,
        [{ role: 'user', content: resultsText || 'No context. Compile standard Indian startup grants (e.g. SISFS, NIDHI PRAYAS, MeitY SAMRIDH, YC, Techstars India).' }],
        'deepseek/deepseek-chat'
      );

      const cleaned = response.replace(/```json/gi, '').replace(/```/g, '').trim();
      opportunities = JSON.parse(cleaned);
    } catch (err) {
      console.error('Failed to parse scraped opportunities, using fallback catalog:', err);
      // Fallbacks
      opportunities = [
        {
          name: 'Startup India Seed Fund Scheme (SISFS)',
          provider: 'DPIIT, Ministry of Commerce',
          type: 'grant',
          amount_min: 1000000,
          amount_max: 5000000,
          currency: 'INR',
          eligibility: 'DPIIT recognized startup incorporated less than 2 years ago. Must have a proof of concept or prototype.',
          deadline: '2026-12-31',
          application_url: 'https://seedfund.startupindia.gov.in/',
          description: 'Provides financial assistance to startups for proof of concept, prototype development, product trials, market-entry, and commercialization.',
          stage_fit: ['idea', 'mvp'],
          sector_fit: ['all'],
          source_url: 'https://seedfund.startupindia.gov.in/'
        },
        {
          name: 'MeitY SAMRIDH Scheme',
          provider: 'Ministry of Electronics & IT',
          type: 'accelerator',
          amount_min: 2000000,
          amount_max: 4000000,
          currency: 'INR',
          eligibility: 'Software product startups with an existing MVP and customer interest. Seeking scale support.',
          deadline: '2026-10-15',
          application_url: 'https://samridh.meity.gov.in/',
          description: 'Aims to support selected accelerators for providing services like product development, scaling, and market access, alongside match-funding seed investments.',
          stage_fit: ['mvp', 'growth'],
          sector_fit: ['software', 'saas', 'ai'],
          source_url: 'https://samridh.meity.gov.in/'
        },
        {
          name: 'NIDHI-PRAYAS (Promoting and Accelerating Young and Aspiring technology entrepreneurs)',
          provider: 'Department of Science & Technology',
          type: 'grant',
          amount_min: 500000,
          amount_max: 1000000,
          currency: 'INR',
          eligibility: 'Individual innovators or tech startups with a physical product prototype idea. Requires lab or incubation facility support.',
          deadline: '2026-08-30',
          application_url: 'https://www.nidhi-prayas.org/',
          description: 'Supports technology-based startups and young entrepreneurs with prototype funding to convert raw ideas into working proof of concepts.',
          stage_fit: ['idea'],
          sector_fit: ['hardware', 'deeptech', 'science'],
          source_url: 'https://www.nidhi-prayas.org/'
        },
        {
          name: 'Y Combinator - Summer 2026 Cycle',
          provider: 'Y Combinator',
          type: 'accelerator',
          amount_min: 42000000,
          amount_max: 42000000,
          currency: 'INR',
          eligibility: 'Early-stage tech startups worldwide. Requires strong technical cofounders and high scalability.',
          deadline: '2026-09-01',
          application_url: 'https://www.ycombinator.com/apply/',
          description: 'World-renowned startup accelerator. Invests $500,000 in exchange for equity. 3-month intensive mentoring program culminating in Demo Day.',
          stage_fit: ['idea', 'mvp'],
          sector_fit: ['all', 'software', 'ai'],
          source_url: 'https://www.ycombinator.com/apply/'
        }
      ];
    }

    let savedCount = 0;
    for (const opt of opportunities) {
      // Check if already exists by name
      const { data: existing } = await supabase
        .from('funding_opportunities')
        .select('id')
        .eq('name', opt.name)
        .maybeSingle();

      if (!existing) {
        const { error: insErr } = await supabase
          .from('funding_opportunities')
          .insert({
            name: opt.name,
            provider: opt.provider,
            type: opt.type,
            amount_min: opt.amount_min,
            amount_max: opt.amount_max,
            currency: opt.currency || 'INR',
            eligibility: opt.eligibility,
            deadline: opt.deadline,
            application_url: opt.application_url,
            description: opt.description,
            stage_fit: opt.stage_fit || ['all'],
            sector_fit: opt.sector_fit || ['all'],
            source_url: opt.source_url,
            is_active: true
          });
        
        if (!insErr) {
          savedCount++;
        }
      }
    }

    if (projectId) {
      emit(projectId, StreamEventType.AGENT_COMPLETE, `Database scan complete. Loaded ${savedCount} new opportunities.`, { status: 'done' });
    }
    return savedCount;
  },

  async matchOpportunities(projectId: string): Promise<void> {
    const supabase = supabaseService.getServiceClient();

    emit(projectId, StreamEventType.JUDGE_EVALUATING, 'Matching active opportunities to startup profile...', { status: 'running' });

    // Fetch project context
    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (!project) throw new Error('Project not found');

    const startupContext = `Startup Name: ${project.name}\nGoal/Mission: ${project.goal}`;

    // Fetch active opportunities
    const { data: opportunities } = await supabase
      .from('funding_opportunities')
      .select('*')
      .eq('is_active', true);

    if (!opportunities || opportunities.length === 0) return;

    const system = `You are a startup matcher. Evaluate whether this funding opportunity matches the startup profile.
    Calculate a match score from 0-100. Provide a list of key reasons for the match.
    
    Opportunity:
    {opportunity}
    
    Startup Profile:
    {startupContext}
    
    Return ONLY a JSON block:
    {
      "match_score": number (0-100),
      "match_reasons": ["reason 1", "reason 2"],
      "eligibility_check": "eligible" | "maybe" | "not_eligible"
    }`;

    for (const opt of opportunities) {
      try {
        const userPrompt = `Opportunity: ${opt.name}\nProvider: ${opt.provider}\nEligibility: ${opt.eligibility}\nDescription: ${opt.description}`;
        const response = await openrouterService.callModel(
          system,
          [{ role: 'user', content: userPrompt }],
          'deepseek/deepseek-chat'
        );

        const cleaned = response.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleaned);

        // Only save matches >= 50
        if (parsed.match_score >= 50) {
          // Check if match already exists
          const { data: existing } = await supabase
            .from('funding_matches')
            .select('id')
            .eq('project_id', projectId)
            .eq('opportunity_id', opt.id)
            .maybeSingle();

          if (!existing) {
            await supabase
              .from('funding_matches')
              .insert({
                project_id: projectId,
                opportunity_id: opt.id,
                match_score: parsed.match_score,
                match_reasons: parsed.match_reasons,
                status: 'new'
              });
          } else {
            // Update score
            await supabase
              .from('funding_matches')
              .update({
                match_score: parsed.match_score,
                match_reasons: parsed.match_reasons
              })
              .eq('id', existing.id);
          }
        }
      } catch (err) {
        console.error(`Failed matching opportunity ${opt.id}:`, err);
      }
    }

    emit(projectId, StreamEventType.AGENT_COMPLETE, 'Funding matches scoring completed.', { status: 'done' });
  },

  async draftApplication(matchId: string): Promise<string> {
    const supabase = supabaseService.getServiceClient();

    // Fetch match details
    const { data: match } = await supabase
      .from('funding_matches')
      .select('*, funding_opportunities(*)')
      .eq('id', matchId)
      .single();

    if (!match) throw new Error('Match record not found');
    const opt = match.funding_opportunities;

    // Fetch project
    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', match.project_id)
      .single();

    if (!project) throw new Error('Project not found');

    emit(project.id, StreamEventType.EMAIL_DRAFTING, `Drafting application proposal for "${opt.name}"...`, { status: 'running' });

    const system = `You are a professional grant proposal writer. Draft a highly compelling grant/accelerator application response.
    Use details from the startup context to answer the program requirements. Make it sound specific and credible.
    
    Program Name: ${opt.name}
    Program Provider: ${opt.provider}
    Program Description: ${opt.description}
    Program Eligibility: ${opt.eligibility}
    
    Our Startup Name: ${project.name}
    Our Goal/Product: ${project.goal}
    
    Format the application answer text under structured sections in clear markdown:
    1. Executive Summary / Pitch
    2. Problem Statement (pain points solved)
    3. Product Solution & Technology Detail
    4. Traction, Customers & Growth Milestones
    5. Team Pedigree (background highlight)
    6. Financial Use of Funds & Project Execution Plan`;

    const userPrompt = `Draft the application response for ${project.name} to ${opt.name}.`;

    const response = await openrouterService.callModel(
      system,
      [{ role: 'user', content: userPrompt }],
      'deepseek/deepseek-chat'
    );

    // Save to match
    await supabase
      .from('funding_matches')
      .update({ 
        application_draft: response,
        status: 'applying'
      })
      .eq('id', matchId);

    emit(project.id, StreamEventType.AGENT_COMPLETE, `Application draft created for "${opt.name}".`, { status: 'done' });
    return response;
  },

  async checkDeadlines(projectId: string): Promise<void> {
    const supabase = supabaseService.getServiceClient();

    // Fetch matches with deadlines within 14 days and alert not sent
    const { data: matches } = await supabase
      .from('funding_matches')
      .select('*, funding_opportunities(*)')
      .eq('project_id', projectId)
      .in('status', ['new', 'interested', 'applying'])
      .eq('alert_sent', false);

    if (!matches || matches.length === 0) return;

    const today = new Date();

    for (const match of matches) {
      const opt = match.funding_opportunities;
      if (!opt.deadline) continue;

      const deadlineDate = new Date(opt.deadline);
      const diffTime = deadlineDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays >= 0 && diffDays <= 14) {
        // Send alert
        const alertMsg = `⏰ Funding Deadline Alert: "${opt.name}" is closing in ${diffDays} days! (Deadline: ${opt.deadline}). Amount: Up to ₹${opt.amount_max?.toLocaleString() || 'N/A'}. A customized application draft is ready in 3RDMIND.`;
        
        emit(projectId, StreamEventType.STREAM_ERROR, alertMsg, {
          detail: `Provider: ${opt.provider}`
        });

        // Update alert_sent
        await supabase
          .from('funding_matches')
          .update({ alert_sent: true })
          .eq('id', match.id);
      }
    }
  }
};

export default fundingService;
