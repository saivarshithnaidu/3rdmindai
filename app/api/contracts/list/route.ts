import { NextRequest, NextResponse } from 'next/server';
import supabaseService from '../../../../services/supabase.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const contractId = searchParams.get('contractId');
    const supabase = supabaseService.getServiceClient();

    if (contractId) {
      const { data: contract, error: err1 } = await supabase
        .from('contracts')
        .select('*')
        .eq('id', contractId)
        .single();

      if (err1 || !contract) {
        return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
      }

      const { data: analysis } = await supabase
        .from('contract_analysis')
        .select('*')
        .eq('contract_id', contractId)
        .maybeSingle();

      return NextResponse.json({ success: true, contract, analysis });
    }

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    const { data: contracts, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Join analysis briefly for list display status
    const enrichedContracts = await Promise.all(
      (contracts || []).map(async (c) => {
        const { data: analysis } = await supabase
          .from('contract_analysis')
          .select('risk_level, overall_score')
          .eq('contract_id', c.id)
          .maybeSingle();

        return {
          ...c,
          risk_level: analysis?.risk_level || null,
          overall_score: analysis?.overall_score || null
        };
      })
    );

    return NextResponse.json({ success: true, contracts: enrichedContracts });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
