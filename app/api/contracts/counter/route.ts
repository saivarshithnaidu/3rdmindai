import { NextRequest, NextResponse } from 'next/server';
import contractService from '../../../../services/contract.service';

export async function POST(req: NextRequest) {
  try {
    const { contractId } = await req.json();
    if (!contractId) {
      return NextResponse.json({ error: 'Missing contractId' }, { status: 400 });
    }

    const proposal = await contractService.generateCounterProposal(contractId);
    return NextResponse.json({ success: true, counter_proposal: proposal });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
