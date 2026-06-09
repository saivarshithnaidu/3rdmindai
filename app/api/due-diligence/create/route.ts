import { NextRequest, NextResponse } from 'next/server';
import { dueDiligenceService } from '../../../../services/due-diligence.service';
import supabaseService from '../../../../services/supabase.service';

export async function POST(req: NextRequest) {
  try {
    const { targetName, targetUrl, projectId, userId = '00000000-0000-0000-0000-000000000000' } = await req.json();

    if (!targetName || !projectId) {
      return NextResponse.json({ error: 'Missing targetName or projectId' }, { status: 400 });
    }

    const supabase = supabaseService.getServiceClient();
    
    // Create dd_reports row first to return the ID immediately
    let targetDomain = '';
    if (targetUrl) {
      try {
        const urlToParse = targetUrl.includes('://') ? targetUrl : `https://${targetUrl}`;
        targetDomain = new URL(urlToParse).hostname;
      } catch {
        targetDomain = targetUrl;
      }
    } else {
      targetDomain = targetName.toLowerCase().replace(/\s+/g, '') + '.com';
    }

    const { data: report, error: reportErr } = await supabase
      .from('dd_reports')
      .insert({
        project_id: projectId,
        user_id: userId,
        target_name: targetName,
        target_url: targetUrl,
        target_domain: targetDomain,
        status: 'running'
      })
      .select()
      .single();

    if (reportErr || !report) {
      return NextResponse.json({ error: reportErr?.message || 'Failed to create report' }, { status: 500 });
    }

    // Trigger diligence execution asynchronously in background
    setTimeout(async () => {
      try {
        const model = 'deepseek/deepseek-chat';
        
        // Parallel research agents 1-6
        const marketSizePromise = (async () => {
          const query1 = `${targetName} market size TAM 2024 2025`;
          const query2 = `${targetName} industry total addressable market growth`;
          const searchResult1 = await toolsService.searchWeb(query1);
          const searchResult2 = await toolsService.searchWeb(query2);
          const system = `You are a market research analyst. Research the market size for this company's industry. Find TAM, SAM, SOM with sources. Use real numbers from credible sources. Return structured analysis. You must return a JSON block with the keys: "title", "content" (detailed markdown), "score" (0-100), "sources" (string array), and "data" (key-value object of TAM, SAM, SOM).`;
          const response = await openrouterService.callModel(system, [{ role: 'user', content: `Target Company: ${targetName}\nURL: ${targetUrl || 'N/A'}\n\nSearch Context:\n${searchResult1}\n\n${searchResult2}` }], model);
          return parseAgentResponse(response, 'market_size', 'Market Size & TAM Analysis');
        })();

        const competitorPromise = (async () => {
          const query1 = `${targetName} competitors alternatives alternatives to ${targetName}`;
          const query2 = `${targetName} market players top competitors`;
          const searchResult1 = await toolsService.searchWeb(query1);
          const searchResult2 = await toolsService.searchWeb(query2);
          const system = `You are a competitive intelligence analyst. Find all direct and indirect competitors to this startup. Compare their offerings. You must return a JSON block with the keys: "title", "content" (detailed markdown), "score" (0-100 competitor threat score, higher = more threat), "sources" (string array), and "data" (key-value object containing list of competitors).`;
          const response = await openrouterService.callModel(system, [{ role: 'user', content: `Target Company: ${targetName}\nURL: ${targetUrl || 'N/A'}\n\nSearch Context:\n${searchResult1}\n\n${searchResult2}` }], model);
          return parseAgentResponse(response, 'competitors', 'Competitor Landscape');
        })();

        const founderPromise = (async () => {
          const query1 = `${targetName} founders names leadership team CEO`;
          const query2 = `${targetName} founders education past startups history`;
          const searchResult1 = await toolsService.searchWeb(query1);
          const searchResult2 = await toolsService.searchWeb(query2);
          const system = `You are an executive researcher. Research the founders of this company. Find their background, past companies, education, relevant experience. You must return a JSON block with the keys: "title", "content" (detailed markdown), "score" (0-100 experience score), "sources" (string array), and "data" (key-value object of founder profiles).`;
          const response = await openrouterService.callModel(system, [{ role: 'user', content: `Target Company: ${targetName}\nURL: ${targetUrl || 'N/A'}\n\nSearch Context:\n${searchResult1}\n\n${searchResult2}` }], model);
          return parseAgentResponse(response, 'founder_background', 'Founder Background & Track Record');
        })();

        const productPromise = (async () => {
          const query1 = `${targetName} reviews G2 Capterra Product features`;
          const query2 = `${targetName} product pricing features comparison`;
          const searchResult1 = await toolsService.searchWeb(query1);
          const searchResult2 = await toolsService.searchWeb(query2);
          const system = `You are a product analyst. Analyze this product deeply. Identify core features, pricing plans, strengths, weaknesses, and customer reviews sentiment. You must return a JSON block with the keys: "title", "content" (detailed markdown), "score" (0-100 product rating), "sources" (string array), and "data" (key-value object of product parameters).`;
          const response = await openrouterService.callModel(system, [{ role: 'user', content: `Target Company: ${targetName}\nURL: ${targetUrl || 'N/A'}\n\nSearch Context:\n${searchResult1}\n\n${searchResult2}` }], model);
          return parseAgentResponse(response, 'product', 'Product Analysis & Core Value');
        })();

        const financialPromise = (async () => {
          const query1 = `${targetName} funding raised revenue Crunchbase Crunchbase valuation`;
          const query2 = `${targetName} total employees LinkedIn growth trend`;
          const searchResult1 = await toolsService.searchWeb(query1);
          const searchResult2 = await toolsService.searchWeb(query2);
          const system = `You are a financial analyst. Find financial signals: funding history, valuation estimates, revenue indicators, employee count trends. You must return a JSON block with the keys: "title", "content" (detailed markdown), "score" (0-100 financial score), "sources" (string array), and "data" (key-value object of funding rounds).`;
          const response = await openrouterService.callModel(system, [{ role: 'user', content: `Target Company: ${targetName}\nURL: ${targetUrl || 'N/A'}\n\nSearch Context:\n${searchResult1}\n\n${searchResult2}` }], model);
          return parseAgentResponse(response, 'financials', 'Financial Signals & Health');
        })();

        const redFlagsPromise = (async () => {
          const query1 = `${targetName} lawsuit controversy scam fraud data breach complaint`;
          const query2 = `${targetName} founders court case warning legal issue`;
          const searchResult1 = await toolsService.searchWeb(query1);
          const searchResult2 = await toolsService.searchWeb(query2);
          const system = `You are a risk analyst. Find any negative information, lawsuits, controversies, scams, fraud warnings, data breaches, or compliance issues about this company and its founders. You must return a JSON block with the keys: "title", "content" (detailed markdown), "score" (0-100 safety score, lower = more risk), "sources" (string array), and "data" (key-value object listing flags).`;
          const response = await openrouterService.callModel(system, [{ role: 'user', content: `Target Company: ${targetName}\nURL: ${targetUrl || 'N/A'}\n\nSearch Context:\n${searchResult1}\n\n${searchResult2}` }], model);
          return parseAgentResponse(response, 'red_flags', 'Risk Assessment & Red Flags');
        })();

        // Resolve parallel agents
        const results = await Promise.allSettled([
          marketSizePromise,
          competitorPromise,
          founderPromise,
          productPromise,
          financialPromise,
          redFlagsPromise
        ]);

        const completedSections = results.map((res, idx) => {
          const types = ['market_size', 'competitors', 'founder_background', 'product', 'financials', 'red_flags'];
          const defaultTitles = [
            'Market Size & TAM Analysis',
            'Competitor Landscape',
            'Founder Background & Track Record',
            'Product Deep Dive & Sentiment',
            'Financial Signals & Health',
            'Risk Assessment & Red Flags'
          ];
          if (res.status === 'fulfilled') return res.value;
          return {
            section_type: types[idx],
            title: defaultTitles[idx],
            content: `Failed to compile section: ${res.reason || 'Unknown error'}`,
            data: {},
            sources: [],
            score: 50,
            status: 'failed' as const
          };
        });

        // Thesis agent
        const compiledContext = completedSections.map(s => `### ${s.title}\nScore: ${s.score}/100\n\n${s.content}`).join('\n\n');
        const thesisQuery = `${targetName} investment thesis growth strategy key risks`;
        const searchResultThesis = await toolsService.searchWeb(thesisQuery);
        const systemThesis = `You are a senior venture capital partner with 20 years of experience. Based on all research provided, formulate a decisive investment thesis. State whether we should invest, why or why not, key opportunities, and risks. Decide on an overall recommendation: (Strong Yes / Yes / Neutral / No / Strong No). You must return a JSON block with the keys: "title", "content" (detailed markdown), "score" (0-100 overall score), "sources" (string array), and "data" (object containing "recommendation": string).`;
        const thesisResponse = await openrouterService.callModel(systemThesis, [{ role: 'user', content: `Target Company: ${targetName}\n\nCompiled Agent Outcomes:\n${compiledContext}\n\nAdditional Search Context:\n${searchResultThesis}` }], model);
        const thesisSection = parseAgentResponse(thesisResponse, 'investment_thesis', 'Investment Thesis & Recommendation');

        // Compile average score
        const allSections = [...completedSections, thesisSection];
        const totalScore = allSections.reduce((acc, s) => acc + s.score, 0);
        const avgScore = Math.round(totalScore / allSections.length);

        // Executive summary agent
        const systemSummary = `You are an executive summary writer. Write a compelling 1-paragraph overview summarizing the due diligence findings. You must return a JSON block with the keys: "title", "content" (detailed markdown), "score" (0-100 score), "sources" (string array), and "data" (empty object).`;
        const summaryResponse = await openrouterService.callModel(systemSummary, [{ role: 'user', content: `Target Company: ${targetName}\nOverall Diligence Score: ${avgScore}/100\n\nResearch Context:\n${compiledContext}\n\nRecommendation: ${thesisSection.data?.recommendation || 'Neutral'}` }], model);
        const summarySection = parseAgentResponse(summaryResponse, 'summary', 'Executive Summary');

        const finalSections = [...allSections, summarySection];

        // Insert sections
        for (const sec of finalSections) {
          await supabase.from('dd_sections').insert({
            report_id: report.id,
            section_type: sec.section_type,
            title: sec.title,
            content: sec.content,
            data: sec.data,
            sources: sec.sources,
            score: sec.score,
            status: 'complete'
          });
        }

        // Update report status
        await supabase
          .from('dd_reports')
          .update({
            status: 'complete',
            report_data: {
              overall_score: avgScore,
              recommendation: thesisSection.data?.recommendation || 'Neutral'
            }
          })
          .eq('id', report.id);

        // Render PDF
        try {
          const pdfUrl = await dueDiligenceService.generateDDPdf(report.id);
          await supabase
            .from('dd_reports')
            .update({ pdf_url: pdfUrl })
            .eq('id', report.id);
        } catch (pdfErr) {
          console.error('Background PDF compilation failed:', pdfErr);
        }

      } catch (err) {
        console.error('Error running background due diligence report:', err);
        await supabase
          .from('dd_reports')
          .update({ status: 'failed' })
          .eq('id', report.id);
      }
    }, 100);

    return NextResponse.json({ success: true, reportId: report.id });
  } catch (err: any) {
    console.error('Error creating due diligence report:', err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}

// Helpers for the background function scope
const { openrouterService } = require('../../../../services/openrouter.service');
const { toolsService } = require('../../../../services/tools.service');

function parseAgentResponse(response: string, sectionType: string, defaultTitle: string) {
  try {
    const cleaned = response.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return {
      section_type: sectionType,
      title: parsed.title || defaultTitle,
      content: parsed.content || response,
      data: parsed.data || {},
      sources: parsed.sources || [],
      score: parsed.score !== undefined ? Number(parsed.score) : 70,
      status: 'complete' as const
    };
  } catch {
    return {
      section_type: sectionType,
      title: defaultTitle,
      content: response,
      data: {},
      sources: [],
      score: 70,
      status: 'complete' as const
    };
  }
}
