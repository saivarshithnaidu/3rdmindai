import { NextRequest, NextResponse } from 'next/server';
import contractService from '../../../../services/contract.service';

export async function POST(req: NextRequest) {
  try {
    const { contractId } = await req.json();
    if (!contractId) {
      return NextResponse.json({ error: 'Missing contractId' }, { status: 400 });
    }

    // Trigger analysis in background
    setTimeout(async () => {
      try {
        await contractService.analyzeContract(contractId);
      } catch (err) {
        console.error('Background contract analyze failed:', err);
      }
    }, 100);

    return NextResponse.json({ success: true, message: 'Analysis triggered in background' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
