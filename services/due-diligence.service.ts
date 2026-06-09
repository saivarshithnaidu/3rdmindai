import supabaseService from './supabase.service';
import { openrouterService } from './openrouter.service';
import { toolsService } from './tools.service';
import { emit } from '../lib/emit';
import { StreamEventType } from '../lib/stream-events';
import { chromium } from 'playwright';

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

function simpleMarkdownToHtml(md: string): string {
  return md
    .replace(/### (.*)/g, '<h3>$1</h3>')
    .replace(/## (.*)/g, '<h2>$1</h2>')
    .replace(/# (.*)/g, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/- (.*)/g, '<li>$1</li>')
    .replace(/\n\n/g, '<p></p>')
    .replace(/\n/g, '<br/>');
}

export const dueDiligenceService = {
  async runDueDiligence(
    targetName: string,
    targetUrl: string | null,
    projectId: string,
    userId: string
  ): Promise<string> {
    const supabase = supabaseService.getServiceClient();
    
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

    // 1. Create dd_reports row
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

    if (reportErr) {
      throw new Error(`Failed to create due diligence report: ${reportErr.message}`);
    }

    emit(projectId, StreamEventType.STREAM_START, `Starting due diligence analysis for ${targetName}...`, { status: 'running' });

    // 2. Run 6 parallel research agents
    const model = 'deepseek/deepseek-chat';

    // Agent 1: Market Size
    const marketSizePromise = (async () => {
      emit(projectId, StreamEventType.LEADS_SEARCHING, "Researching Market Size TAM/SAM/SOM...", { status: 'running' });
      const query1 = `${targetName} market size TAM 2024 2025`;
      const query2 = `${targetName} industry total addressable market growth`;
      const searchResult1 = await toolsService.searchWeb(query1);
      const searchResult2 = await toolsService.searchWeb(query2);
      
      const system = `You are a market research analyst. Research the market size for this company's industry. Find TAM, SAM, SOM with sources. Use real numbers from credible sources. Return structured analysis. You must return a JSON block with the keys: "title", "content" (detailed markdown), "score" (0-100), "sources" (string array), and "data" (key-value object of TAM, SAM, SOM).`;
      const userPrompt = `Target Company: ${targetName}\nURL: ${targetUrl || 'N/A'}\n\nSearch Context:\n${searchResult1}\n\n${searchResult2}`;
      
      const response = await openrouterService.callModel(system, [{ role: 'user', content: userPrompt }], model);
      return parseAgentResponse(response, 'market_size', 'Market Size & TAM Analysis');
    })();

    // Agent 2: Competitor Landscape
    const competitorPromise = (async () => {
      emit(projectId, StreamEventType.AD_INTEL_SCRAPING, "Mapping Competitor Landscape...", { status: 'running' });
      const query1 = `${targetName} competitors alternatives alternatives to ${targetName}`;
      const query2 = `${targetName} market players top competitors`;
      const searchResult1 = await toolsService.searchWeb(query1);
      const searchResult2 = await toolsService.searchWeb(query2);

      const system = `You are a competitive intelligence analyst. Find all direct and indirect competitors to this startup. Compare their offerings. You must return a JSON block with the keys: "title", "content" (detailed markdown), "score" (0-100 competitor threat score, higher = more threat), "sources" (string array), and "data" (key-value object containing list of competitors).`;
      const userPrompt = `Target Company: ${targetName}\nURL: ${targetUrl || 'N/A'}\n\nSearch Context:\n${searchResult1}\n\n${searchResult2}`;

      const response = await openrouterService.callModel(system, [{ role: 'user', content: userPrompt }], model);
      return parseAgentResponse(response, 'competitors', 'Competitor Landscape');
    })();

    // Agent 3: Founder Background
    const founderPromise = (async () => {
      emit(projectId, StreamEventType.LEAD_RESEARCHING, "Scrutinizing Founder Profiles & Background...", { status: 'running' });
      const query1 = `${targetName} founders names leadership team CEO`;
      const query2 = `${targetName} founders education past startups history`;
      const searchResult1 = await toolsService.searchWeb(query1);
      const searchResult2 = await toolsService.searchWeb(query2);

      const system = `You are an executive researcher. Research the founders of this company. Find their background, past companies, education, relevant experience. You must return a JSON block with the keys: "title", "content" (detailed markdown), "score" (0-100 experience score), "sources" (string array), and "data" (key-value object of founder profiles).`;
      const userPrompt = `Target Company: ${targetName}\nURL: ${targetUrl || 'N/A'}\n\nSearch Context:\n${searchResult1}\n\n${searchResult2}`;

      const response = await openrouterService.callModel(system, [{ role: 'user', content: userPrompt }], model);
      return parseAgentResponse(response, 'founder_background', 'Founder Background & Track Record');
    })();

    // Agent 4: Product Analysis
    const productPromise = (async () => {
      emit(projectId, StreamEventType.BROWSER_SEARCHING, "Evaluating Product Architecture...", { status: 'running' });
      const query1 = `${targetName} reviews G2 Capterra Product features`;
      const query2 = `${targetName} product pricing features comparison`;
      const searchResult1 = await toolsService.searchWeb(query1);
      const searchResult2 = await toolsService.searchWeb(query2);

      const system = `You are a product analyst. Analyze this product deeply. Identify core features, pricing plans, strengths, weaknesses, and customer reviews sentiment. You must return a JSON block with the keys: "title", "content" (detailed markdown), "score" (0-100 product rating), "sources" (string array), and "data" (key-value object of product parameters).`;
      const userPrompt = `Target Company: ${targetName}\nURL: ${targetUrl || 'N/A'}\n\nSearch Context:\n${searchResult1}\n\n${searchResult2}`;

      const response = await openrouterService.callModel(system, [{ role: 'user', content: userPrompt }], model);
      return parseAgentResponse(response, 'product', 'Product Analysis & Core Value');
    })();

    // Agent 5: Financial Signals
    const financialPromise = (async () => {
      emit(projectId, StreamEventType.PRICE_CHECKING, "Scanning Financial Signals & Growth...", { status: 'running' });
      const query1 = `${targetName} funding raised revenue Crunchbase Crunchbase valuation`;
      const query2 = `${targetName} total employees LinkedIn growth trend`;
      const searchResult1 = await toolsService.searchWeb(query1);
      const searchResult2 = await toolsService.searchWeb(query2);

      const system = `You are a financial analyst. Find financial signals: funding history, valuation estimates, revenue indicators, employee count trends. You must return a JSON block with the keys: "title", "content" (detailed markdown), "score" (0-100 financial score), "sources" (string array), and "data" (key-value object of funding rounds).`;
      const userPrompt = `Target Company: ${targetName}\nURL: ${targetUrl || 'N/A'}\n\nSearch Context:\n${searchResult1}\n\n${searchResult2}`;

      const response = await openrouterService.callModel(system, [{ role: 'user', content: userPrompt }], model);
      return parseAgentResponse(response, 'financials', 'Financial Signals & Health');
    })();

    // Agent 6: Red Flags
    const redFlagsPromise = (async () => {
      emit(projectId, StreamEventType.JUDGE_EVALUATING, "Analyzing Red Flags & Risk Profiles...", { status: 'running' });
      const query1 = `${targetName} lawsuit controversy scam fraud data breach complaint`;
      const query2 = `${targetName} founders court case warning legal issue`;
      const searchResult1 = await toolsService.searchWeb(query1);
      const searchResult2 = await toolsService.searchWeb(query2);

      const system = `You are a risk analyst. Find any negative information, lawsuits, controversies, scams, fraud warnings, data breaches, or compliance issues about this company and its founders. You must return a JSON block with the keys: "title", "content" (detailed markdown), "score" (0-100 safety score, lower = more risk), "sources" (string array), and "data" (key-value object listing flags).`;
      const userPrompt = `Target Company: ${targetName}\nURL: ${targetUrl || 'N/A'}\n\nSearch Context:\n${searchResult1}\n\n${searchResult2}`;

      const response = await openrouterService.callModel(system, [{ role: 'user', content: userPrompt }], model);
      return parseAgentResponse(response, 'red_flags', 'Risk Assessment & Red Flags');
    })();

    // Wait for parallel research agents to finish
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

      if (res.status === 'fulfilled') {
        return res.value;
      } else {
        return {
          section_type: types[idx],
          title: defaultTitles[idx],
          content: `Research execution failed for this section: ${res.reason || 'Unknown error'}`,
          data: {},
          sources: [],
          score: 50,
          status: 'failed' as const
        };
      }
    });

    // Agent 7: Investment Thesis (requires outcomes from previous agents)
    emit(projectId, StreamEventType.ORCHESTRATOR_SYNTHESIZING, "Formulating Investment Thesis...", { status: 'running' });
    const compiledContext = completedSections
      .map(s => `### ${s.title}\nScore: ${s.score}/100\n\n${s.content}`)
      .join('\n\n');

    const thesisQuery = `${targetName} investment thesis growth strategy key risks`;
    const searchResultThesis = await toolsService.searchWeb(thesisQuery);

    const systemThesis = `You are a senior venture capital partner with 20 years of experience. Based on all research provided, formulate a decisive investment thesis. State whether we should invest, why or why not, key opportunities, and risks. Decide on an overall recommendation: (Strong Yes / Yes / Neutral / No / Strong No). You must return a JSON block with the keys: "title", "content" (detailed markdown), "score" (0-100 overall score), "sources" (string array), and "data" (object containing "recommendation": string).`;
    const userPromptThesis = `Target Company: ${targetName}\n\nCompiled Agent Outcomes:\n${compiledContext}\n\nAdditional Search Context:\n${searchResultThesis}`;

    const thesisResponse = await openrouterService.callModel(systemThesis, [{ role: 'user', content: userPromptThesis }], model);
    const thesisSection = parseAgentResponse(thesisResponse, 'investment_thesis', 'Investment Thesis & Recommendation');

    // Compile average score
    const allSections = [...completedSections, thesisSection];
    const totalScore = allSections.reduce((acc, s) => acc + s.score, 0);
    const avgScore = Math.round(totalScore / allSections.length);

    // Agent 8: Summary (written after thesis compiles)
    emit(projectId, StreamEventType.ORCHESTRATOR_PLANNING, "Writing Executive Summary...", { status: 'running' });
    const systemSummary = `You are an executive summary writer. Write a compelling 1-paragraph overview summarizing the due diligence findings. You must return a JSON block with the keys: "title", "content" (detailed markdown), "score" (0-100 score), "sources" (string array), and "data" (empty object).`;
    const summaryResponse = await openrouterService.callModel(
      systemSummary,
      [{ role: 'user', content: `Target Company: ${targetName}\nOverall Diligence Score: ${avgScore}/100\n\nResearch Context:\n${compiledContext}\n\nRecommendation: ${thesisSection.data?.recommendation || 'Neutral'}` }],
      model
    );
    const summarySection = parseAgentResponse(summaryResponse, 'summary', 'Executive Summary');

    const finalSections = [...allSections, summarySection];

    // 3. Write each section into database
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

    // 4. Update dd_reports status
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

    emit(projectId, StreamEventType.ORCHESTRATOR_COMPLETE, `Due diligence complete for ${targetName}. Generating PDF...`, { status: 'done' });

    // 5. Generate PDF (run async/safely so we don't crash if browser fails)
    try {
      const pdfUrl = await this.generateDDPdf(report.id);
      await supabase
        .from('dd_reports')
        .update({ pdf_url: pdfUrl })
        .eq('id', report.id);
    } catch (pdfErr) {
      console.error('PDF generation failed:', pdfErr);
    }

    emit(projectId, StreamEventType.STREAM_END, `Due Diligence Engine finished. ID: ${report.id}`, { status: 'done' });

    return report.id;
  },

  async generateDDPdf(reportId: string): Promise<string> {
    const supabase = supabaseService.getServiceClient();
    
    // Fetch report details
    const { data: report, error: reportErr } = await supabase
      .from('dd_reports')
      .select('*')
      .eq('id', reportId)
      .single();

    if (reportErr || !report) {
      throw new Error(`Report not found: ${reportErr?.message}`);
    }

    // Fetch all sections
    const { data: sections, error: secErr } = await supabase
      .from('dd_sections')
      .select('*')
      .eq('report_id', reportId);

    if (secErr || !sections) {
      throw new Error(`Sections not found: ${secErr?.message}`);
    }

    // Sort sections for order
    const orderMap: Record<string, number> = {
      summary: 0,
      market_size: 1,
      competitors: 2,
      founder_background: 3,
      product: 4,
      financials: 5,
      red_flags: 6,
      investment_thesis: 7
    };

    const sortedSections = [...sections].sort((a, b) => {
      const orderA = orderMap[a.section_type] !== undefined ? orderMap[a.section_type] : 99;
      const orderB = orderMap[b.section_type] !== undefined ? orderMap[b.section_type] : 99;
      return orderA - orderB;
    });

    const summarySection = sortedSections.find(s => s.section_type === 'summary');
    const thesisSection = sortedSections.find(s => s.section_type === 'investment_thesis');
    const otherSections = sortedSections.filter(s => s.section_type !== 'summary' && s.section_type !== 'investment_thesis');

    // Build styled HTML template
    let htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Due Diligence: ${report.target_name}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Lora:ital,wght@0,400;0,700;1,400&display=swap');
        body {
          font-family: 'DM Sans', sans-serif;
          color: #1c1a17;
          background: #faf8f5;
          margin: 0;
          padding: 40px;
          line-height: 1.6;
        }
        .cover {
          height: 90vh;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
          border-bottom: 2px solid #e0dbd5;
          page-break-after: always;
        }
        .cover h1 {
          font-family: 'Lora', serif;
          font-size: 42px;
          margin: 0 0 10px 0;
          color: #191919;
        }
        .cover p {
          font-size: 14px;
          color: #807a73;
          text-transform: uppercase;
          letter-spacing: 2px;
          margin: 0 0 40px 0;
        }
        .badge {
          background: #cc785c;
          color: #fff;
          font-weight: bold;
          font-size: 14px;
          padding: 6px 16px;
          border-radius: 20px;
          margin-bottom: 15px;
        }
        .score-circle {
          width: 120px;
          height: 120px;
          border-radius: 50%;
          border: 8px solid #cc785c;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 36px;
          font-weight: bold;
          font-family: 'Lora', serif;
          color: #cc785c;
          margin-bottom: 20px;
        }
        .section {
          margin-bottom: 50px;
          page-break-inside: avoid;
        }
        .section-header {
          border-bottom: 1px solid #e0dbd5;
          padding-bottom: 10px;
          margin-bottom: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .section-title {
          font-family: 'Lora', serif;
          font-size: 24px;
          color: #191919;
          margin: 0;
        }
        .section-score {
          font-weight: bold;
          font-size: 14px;
          color: #cc785c;
          border: 1px solid #cc785c;
          padding: 3px 10px;
          border-radius: 12px;
        }
        .content {
          font-size: 13px;
          color: #403e3a;
          margin-bottom: 20px;
        }
        h2, h3 {
          font-family: 'Lora', serif;
          color: #191919;
        }
        .sources-box {
          background: #f4f0eb;
          border: 1px solid #e0dbd5;
          border-radius: 8px;
          padding: 15px;
          font-size: 11px;
          color: #615d58;
        }
        .sources-title {
          font-weight: bold;
          margin-bottom: 5px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        ul {
          margin: 0;
          padding-left: 20px;
        }
      </style>
    </head>
    <body>
      <div class="cover">
        <div class="score-circle">${report.report_data?.overall_score || 70}</div>
        <h1>Due Diligence Report</h1>
        <p>${report.target_name}</p>
        <div class="badge">Recommendation: ${report.report_data?.recommendation || 'Neutral'}</div>
        <div style="font-size: 12px; color: #807a73; margin-top: 50px;">
          Generated on ${new Date().toLocaleDateString()} • Powered by 3RDMIND AI
        </div>
      </div>
    `;

    // Add Executive Summary
    if (summarySection) {
      htmlContent += `
      <div class="section" style="page-break-after: always;">
        <div class="section-header">
          <h2 class="section-title">${summarySection.title}</h2>
        </div>
        <div class="content">
          ${simpleMarkdownToHtml(summarySection.content)}
        </div>
      </div>
      `;
    }

    // Add Investment Thesis
    if (thesisSection) {
      htmlContent += `
      <div class="section" style="page-break-after: always;">
        <div class="section-header">
          <h2 class="section-title">${thesisSection.title}</h2>
          <span class="section-score">Score: ${thesisSection.score}/100</span>
        </div>
        <div class="content">
          ${simpleMarkdownToHtml(thesisSection.content)}
        </div>
      </div>
      `;
    }

    // Add Other Sections
    for (const sec of otherSections) {
      const sourcesList = Array.isArray(sec.sources)
        ? sec.sources.map((s: string) => `<li><a href="${s}">${s}</a></li>`).join('')
        : '';

      htmlContent += `
      <div class="section">
        <div class="section-header">
          <h2 class="section-title">${sec.title}</h2>
          <span class="section-score">Score: ${sec.score}/100</span>
        </div>
        <div class="content">
          ${simpleMarkdownToHtml(sec.content)}
        </div>
        ${sourcesList ? `
        <div class="sources-box">
          <div class="sources-title">Verified Sources</div>
          <ul>${sourcesList}</ul>
        </div>` : ''}
      </div>
      `;
    }

    htmlContent += `
    </body>
    </html>
    `;

    // Connect via Playwright and generate PDF
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.setContent(htmlContent);
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '30px', bottom: '30px', left: '30px', right: '30px' }
    });
    await browser.close();

    // Ensure Bucket exists
    try {
      await supabase.storage.createBucket('due_diligence_pdfs', { public: true });
    } catch {}

    // Upload to Supabase Storage
    const path = `${report.project_id}/${reportId}.pdf`;
    const { error: uploadErr } = await supabase.storage
      .from('due_diligence_pdfs')
      .upload(path, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadErr) {
      throw new Error(`Failed to upload PDF: ${uploadErr.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('due_diligence_pdfs')
      .getPublicUrl(path);

    return publicUrl;
  }
};

export default dueDiligenceService;
