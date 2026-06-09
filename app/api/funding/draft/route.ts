import { NextRequest, NextResponse } from 'next/server';
import fundingService from '../../../../services/funding.service';

export async function POST(req: NextRequest) {
  try {
    const { matchId } = await req.json();
    if (!matchId) {
      return NextResponse.json({ error: 'Missing matchId' }, { status: 400 });
    }

    const draft = await fundingService.draftApplication(matchId);
    return NextResponse.json({ success: true, application_draft: draft });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
