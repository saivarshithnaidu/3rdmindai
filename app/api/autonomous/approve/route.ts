import { NextRequest, NextResponse } from 'next/server';
import autonomousService from '../../../../services/autonomous.service';

export async function POST(req: NextRequest) {
  try {
    const { approvalId, userId, decision, reason } = await req.json();
    if (!approvalId || !userId || !decision) {
      return NextResponse.json({ error: 'Missing approvalId, userId, or decision' }, { status: 400 });
    }

    let result;
    if (decision === 'approve') {
      result = await autonomousService.approveAction(approvalId, userId);
    } else if (decision === 'reject') {
      result = await autonomousService.rejectAction(approvalId, userId, reason);
    } else {
      return NextResponse.json({ error: 'Invalid decision value. Must be approve or reject' }, { status: 400 });
    }

    return NextResponse.json({ approval: result });
  } catch (err: any) {
    console.error('Error in autonomous approve API route:', err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
