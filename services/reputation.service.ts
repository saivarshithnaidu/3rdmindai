import supabaseService from './supabase.service';
import { openrouterService } from './openrouter.service';
import { toolsService } from './tools.service';
import { emit } from '../lib/emit';
import { StreamEventType } from '../lib/stream-events';

export const reputationService = {
  async scanMentions(monitorId: string): Promise<number> {
    const supabase = supabaseService.getServiceClient();

    // Fetch monitor config
    const { data: monitor, error: mErr } = await supabase
      .from('reputation_monitors')
      .select('*')
      .eq('id', monitorId)
      .single();

    if (mErr || !monitor) {
      throw new Error(`Reputation monitor not found: ${mErr?.message}`);
    }

    emit(monitor.project_id, StreamEventType.AD_INTEL_SCRAPING, `Scanning web mentions for brand "${monitor.brand_name}"...`, { status: 'running' });

    let newMentionsCount = 0;

    for (const platform of monitor.platforms) {
      const platName = platform.toLowerCase();
      
      // Construct platform search query
      let query = `"${monitor.brand_name}"`;
      if (platName === 'reddit') query = `site:reddit.com "${monitor.brand_name}"`;
      else if (platName === 'twitter') query = `site:x.com OR site:twitter.com "${monitor.brand_name}"`;
      else if (platName === 'linkedin') query = `site:linkedin.com/posts "${monitor.brand_name}"`;
      else if (platName === 'g2') query = `site:g2.com "${monitor.brand_name}" reviews`;
      else query = `"${monitor.brand_name}" brand reviews feedback`;

      try {
        const searchResults = await toolsService.searchWeb(query);

        // Call OpenRouter to parse links and text into structured mentions
        const system = `You are a sentiment crawler parser. Parse the web search results and extract list of brand mentions.
        For each mention, extract: Author name, Content/snippet of mention, Source URL, and platform.
        Return ONLY a JSON array: [{"author": "Author", "content": "Mention content text", "source_url": "URL", "platform": "${platName}"}]`;

        const response = await openrouterService.callModel(system, [{ role: 'user', content: searchResults }], 'deepseek/deepseek-chat');
        const cleaned = response.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsedList = JSON.parse(cleaned);

        if (Array.isArray(parsedList)) {
          for (const item of parsedList) {
            if (!item.content || !item.source_url) continue;

            // Check if duplicate URL exists in database
            const { data: existing } = await supabase
              .from('brand_mentions')
              .select('id')
              .eq('source_url', item.source_url)
              .maybeSingle();

            if (!existing) {
              // 1. Analyze Sentiment
              const analysis = await this.analyzeSentiment(item.content, monitor.brand_name);
              
              // 2. Insert mention
              const { data: insertedMention, error: insErr } = await supabase
                .from('brand_mentions')
                .insert({
                  monitor_id: monitorId,
                  platform: item.platform || platName,
                  source_url: item.source_url,
                  author: item.author || 'Anonymous User',
                  content: item.content,
                  sentiment: analysis.sentiment,
                  sentiment_score: analysis.score,
                  urgency: analysis.urgency
                })
                .select()
                .single();

              if (!insErr && insertedMention) {
                newMentionsCount++;

                // 3. Draft response draft immediately if negative or critical
                if (analysis.sentiment === 'negative' || analysis.urgency === 'critical') {
                  const draftText = await this.draftResponse(insertedMention.id);
                  if (analysis.urgency === 'critical') {
                    emit(monitor.project_id, StreamEventType.STREAM_ERROR, `🚨 CRITICAL brand mention found on ${platName}!`, {
                      detail: `Content: "${item.content.substring(0, 80)}..."`
                    });
                  }
                }

                emit(monitor.project_id, StreamEventType.LEAD_FOUND, `New Brand Mention on ${platName} (${analysis.sentiment})`, {
                  detail: item.content.slice(0, 100)
                });
              }
            }
          }
        }
      } catch (err) {
        console.warn(`Reputation crawler failed for platform ${platName}:`, err);
      }
    }

    // Update last checked at
    await supabase
      .from('reputation_monitors')
      .update({ last_checked_at: new Date().toISOString() })
      .eq('id', monitorId);

    emit(monitor.project_id, StreamEventType.ORCHESTRATOR_COMPLETE, `Reputation scan complete. Found ${newMentionsCount} new mentions.`, { status: 'done' });
    return newMentionsCount;
  },

  async analyzeSentiment(content: string, brandName: string): Promise<{
    sentiment: 'positive' | 'neutral' | 'negative';
    score: number;
    urgency: 'critical' | 'high' | 'medium' | 'low';
    topics: string[];
    summary: string;
  }> {
    const system = `Analyze the sentiment of this brand mention about ${brandName}.
    Assign:
    - sentiment: "positive" | "neutral" | "negative"
    - score: float between -1.0 (highly negative) and 1.0 (highly positive)
    - urgency: "critical" (direct customer complaint/legal issue) | "high" (negative review on popular forum) | "medium" (neutral/question) | "low" (minor mention)
    - topics: string array of themes discussed
    - summary: 1-sentence recap of the mention
    Return ONLY a JSON block:
    {"sentiment": "neutral", "score": 0.0, "urgency": "low", "topics": [], "summary": ""}`;

    try {
      const response = await openrouterService.callModel(system, [{ role: 'user', content }], 'deepseek/deepseek-chat');
      const cleaned = response.replace(/```json/gi, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    } catch {
      return {
        sentiment: 'neutral',
        score: 0.0,
        urgency: 'low',
        topics: ['General'],
        summary: 'Neutral brand mention.'
      };
    }
  },

  async draftResponse(mentionId: string): Promise<string> {
    const supabase = supabaseService.getServiceClient();

    const { data: mention } = await supabase
      .from('brand_mentions')
      .select('*, reputation_monitors(brand_name, project_id)')
      .eq('id', mentionId)
      .single();

    if (!mention) throw new Error('Mention not found');
    const brandName = mention.reputation_monitors.brand_name;
    const projectId = mention.reputation_monitors.project_id;

    emit(projectId, StreamEventType.AGENT_THINKING, `Community Manager drafting response to ${mention.platform} mention...`, { status: 'running' });

    const system = `You are the community relations manager for ${brandName}. Write a professional, empathetic response to this user mention.
    Platform: ${mention.platform}
    Content: ${mention.content}
    Sentiment: ${mention.sentiment}
    
    Guidelines:
    - Reddit: Casual, helpful, conversational.
    - Twitter/X: Concise, witty/empathetic, direct.
    - G2/Google: Professional, corporate, offering direct contact resolution.
    - LinkedIn: Encouraging, supportive, professional.
    Keep the draft under 100 words. Return ONLY the response text itself, no explanations.`;

    const responseText = await openrouterService.callModel(system, [{ role: 'user', content: mention.content }], 'deepseek/deepseek-chat');

    await supabase
      .from('brand_mentions')
      .update({ response_draft: responseText })
      .eq('id', mentionId);

    return responseText;
  },

  async generateWeeklyReport(monitorId: string): Promise<string> {
    const supabase = supabaseService.getServiceClient();

    // Fetch monitor config
    const { data: monitor } = await supabase
      .from('reputation_monitors')
      .select('*')
      .eq('id', monitorId)
      .single();

    if (!monitor) throw new Error('Monitor not found');

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    // Fetch mentions in last 7 days
    const { data: mentions } = await supabase
      .from('brand_mentions')
      .select('*')
      .eq('monitor_id', monitorId)
      .gte('found_at', oneWeekAgo.toISOString());

    const total = mentions?.length || 0;
    const positive = mentions?.filter(m => m.sentiment === 'positive').length || 0;
    const neutral = mentions?.filter(m => m.sentiment === 'neutral').length || 0;
    const negative = mentions?.filter(m => m.sentiment === 'negative').length || 0;
    const avgScore = total > 0 ? (mentions?.reduce((acc, m) => acc + (m.sentiment_score || 0), 0) || 0) / total : 0.0;

    const system = `You are a brand reputation analyst. Write a concise, 2-paragraph weekly reputation summary for ${monitor.brand_name}.
    Metrics:
    - Total Mentions: ${total}
    - Positive: ${positive}
    - Neutral: ${neutral}
    - Negative: ${negative}
    - Average Sentiment Score: ${avgScore.toFixed(2)} (-1 to 1)
    Highlight trends, key customer sentiments, and recommendations.`;

    const summary = await openrouterService.callModel(system, [{ role: 'user', content: 'Generate report summary' }], 'deepseek/deepseek-chat');

    // Create report record
    const { data: report } = await supabase
      .from('reputation_reports')
      .insert({
        monitor_id: monitorId,
        week_start: oneWeekAgo.toISOString().split('T')[0],
        total_mentions: total,
        positive_count: positive,
        neutral_count: neutral,
        negative_count: negative,
        avg_sentiment: avgScore,
        top_topics: { topics: ['Product Quality', 'Pricing', 'Service'] },
        summary
      })
      .select()
      .single();

    emit(monitor.project_id, StreamEventType.AGENT_COMPLETE, `Weekly Brand Reputation Report compiled. Avg Sentiment: ${avgScore.toFixed(2)}`, {
      status: 'done'
    });

    return report.id;
  }
};

export default reputationService;
