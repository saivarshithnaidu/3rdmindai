import supabaseService from './supabase.service';
import openrouterService from './openrouter.service';
import { AdIntelReport, GeneratedCampaign, AdVariation } from '../types';

export const adGeneratorService = {
  /**
   * Generates high-converting ad copy variations inspired by competitor winning angles
   */
  async generateAdVariations(report: AdIntelReport, platform: string, projectId: string, count = 5): Promise<AdVariation[]> {
    const supabase = supabaseService.getServiceClient();
    
    // Get project details for startup context
    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    const startupContext = project ? `Goal: ${project.goal}\nName: ${project.name}` : '';

    const systemPrompt = `You are a performant growth marketer and conversion copywriter.
Generate ${count} ad variations for the ad platform: ${platform.toUpperCase()}.
Your copy must use the competitor's winning marketing angles, but match our startup's goal, voice, and unique offerings.

Make our copy noticeably better: write stronger emotional hooks, clearer value offers, and more direct call-to-actions.
Ensure you respect character count limit boundaries:
- Google: Headline max 30 chars, Body/Description max 90 chars.
- Meta: Headline max 40 chars, Body/Primary Text max 125 chars.

Return ONLY a valid JSON array matching this structure (no markdown code blocks, explanations or other text):
[
  {
    "variation_number": 1,
    "angle": "Name of the angle used",
    "headline": "Ad Headline text here",
    "body": "Ad Primary body text here",
    "cta": "Ad Button CTA here",
    "why_this_works": "Why this specific hook converts users",
    "inspired_by": "Brief reference of competitor's ad element that inspired this"
  }
]`;

    const userPrompt = `Competitor Top Angles:
${JSON.stringify(report.top_angles)}

Competitor Best Ads:
${(report.winning_ads || []).map((a, i) => `${i + 1}. Headline: ${a.headline} | Body: ${a.body}`).join('\n')}

Our Startup Context:
${startupContext}`;

    let adVariations: AdVariation[] = [];

    try {
      const response = await openrouterService.callModel(
        systemPrompt,
        [{ role: 'user', content: userPrompt }],
        'google/gemini-2.5-pro'
      );
      
      let cleanJson = response.trim();
      if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
      }
      adVariations = JSON.parse(cleanJson) || [];
    } catch (e) {
      console.warn('Failed to parse ad variations JSON, using fallback data:', e);
      // Fallback variations
      adVariations = Array.from({ length: Math.min(count, 3) }, (_, i) => ({
        variation_number: i + 1,
        angle: report.top_angles?.[i % report.top_angles.length]?.angle || 'Productivity Boost',
        headline: `Official ${project?.name || '3RDMIND'} | Run Workflows Now`,
        body: `Automate dev setups, design schemas, and build React pages instantly. 10x faster operations. Start free!`,
        cta: 'Learn More',
        why_this_works: 'Leads with immediate productivity utility and clear call-to-action.',
        inspired_by: 'Inspired by competitor focus on automation and speed.'
      }));
    }

    // Insert or update generated campaigns record
    const { error: insErr } = await supabase
      .from('generated_campaigns')
      .insert({
        project_id: projectId,
        competitor_id: report.competitor_id,
        report_id: report.id,
        platform,
        campaign_name: `${platform.toUpperCase()} - Competitive Target Campaign`,
        target_audience: `Users searching for competitor services or matching interest profiles`,
        ad_variations: adVariations,
        status: 'draft'
      });

    if (insErr) {
      console.error('Failed to save generated campaign:', insErr.message);
    }

    return adVariations;
  },

  /**
   * Generates a 30-day performances ad rollout plan
   */
  async generateCampaignStrategy(report: AdIntelReport, projectId: string): Promise<string> {
    const supabase = supabaseService.getServiceClient();
    
    const { data: project } = await supabase.from('projects').select('goal').eq('id', projectId).single();
    const startupGoal = project?.goal || '';

    const systemPrompt = `You are a Chief Marketing Officer (CMO) and performance ad planner.
Generate a complete, actionable 30-day advertising campaign strategy for our startup benchmarking competitor metrics.

Provide a premium, publication-grade markdown document structured exactly as:
# 30-DAY PERFORMANCE CAMPAIGN STRATEGY

## 🎯 CAMPAIGN OBJECTIVE & BENCHMARKS
(Define target CPA, CTR, and CPC targets using competitor active ad counts as benchmarks).

## 👥 AUDIENCE TARGETING & SEGMENTATION
(Identify high-intent search terms and core social interest audiences).

## 💰 BUDGET ALLOCATION
(Break down monthly budget allocation by channel, e.g. Meta Ads vs Google Search).

## 📅 WEEK-BY-WEEK ROLLOUT TIMELINE
- **Week 1 (Setup & A/B Testing)**: Specific setups.
- **Week 2 (Data Gathering)**: Specific tracking.
- **Week 3 (Optimization & Scaling)**: Scale hooks.
- **Week 4 (Retargeting Campaign)**: Retargeting specs.

## 📊 SUCCESS METRICS & CORE KPIs
(Primary and secondary metrics to evaluate).

Be specific. Avoid boilerplate guidelines.`;

    const userPrompt = `Competitor stats:
Total active ads: ${report.active_ads}
Top Angles: ${JSON.stringify(report.top_angles)}

Our Startup Goal:
${startupGoal}`;

    const strategy = await openrouterService.callModel(
      systemPrompt,
      [{ role: 'user', content: userPrompt }],
      'google/gemini-2.5-pro'
    );

    // Save to last generated campaign or update report
    const { data: campaigns } = await supabase
      .from('generated_campaigns')
      .select('id')
      .eq('report_id', report.id)
      .limit(1);

    if (campaigns && campaigns.length > 0) {
      await supabase
        .from('generated_campaigns')
        .update({ strategy })
        .eq('id', campaigns[0].id);
    }

    return strategy;
  },

  /**
   * Generates optimized landing page copy copywriter proposals
   */
  async generateLandingPageCopy(report: AdIntelReport, projectId: string): Promise<string> {
    const supabase = supabaseService.getServiceClient();
    const { data: project } = await supabase.from('projects').select('goal').eq('id', projectId).single();

    const systemPrompt = `You are a Conversion Rate Optimization (CRO) Lead and expert copywriter.
Analyze competitor ad positioning and write a conversion-optimized landing page structure and copies for our startup.

Make our landing page significantly better: optimize headline hooks, build value pillars, and frame clearer CTA actions.

Provide a beautiful markdown document structured exactly as:
# LANDING PAGE COPY PROPOSAL

## ⚡ HERO SECTION (ABOVE THE FOLD)
- **Headline (3 High-Converting Variations)**:
- **Subheadline**:
- **Primary CTA button copy**:
- **Social Proof / trust hook**:

## 💎 CORE VALUE PROPOSITION PILLARS
- **Pillar 1 (Benefit focus)**:
- **Pillar 2 (Usability focus)**:
- **Pillar 3 (Cost/Integrations focus)**:

## 🤝 TRUST & SOCIAL PROOF SECTIONS
(Specific reviews, client logos, or rating cards placements).

## ❓ FREQUENTLY ASKED QUESTIONS (FAQ)
(3-4 high-intent customer objections resolved directly).`;

    const userPrompt = `Competitor best performing angles:
${JSON.stringify(report.top_angles)}

Our Startup Goal:
${project?.goal || ''}`;

    const landingPageCopy = await openrouterService.callModel(
      systemPrompt,
      [{ role: 'user', content: userPrompt }],
      'google/gemini-2.5-pro'
    );

    return landingPageCopy;
  }
};

export default adGeneratorService;
