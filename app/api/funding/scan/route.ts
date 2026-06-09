import { NextRequest, NextResponse } from 'next/server';
import fundingService from '../../../../services/funding.service';

export async function POST(req: NextRequest) {
  try {
    const { projectId } = await req.json();
    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    // Trigger scraping and matching in background asynchronously
    setTimeout(async () => {
      try {
        await fundingService.scrapeOpportunities(projectId);
        await fundingService.matchOpportunities(projectId);
        await fundingService.checkDeadlines(projectId);
      } catch (err) {
        console.error('Background funding scan/match failed:', err);
      }
    }, 100);

    return NextResponse.json({ success: true, message: 'Funding finder scan started in background' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
