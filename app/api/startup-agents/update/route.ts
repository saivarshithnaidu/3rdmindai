import { NextRequest, NextResponse } from 'next/server';
import supabaseService from '../../../../services/supabase.service';

export async function PATCH(req: NextRequest) {
  try {
    const { agentId, name, model, isActive } = await req.json();

    if (!agentId) {
      return NextResponse.json({ error: 'Missing agentId' }, { status: 400 });
    }

    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = name;
    if (model !== undefined) updateData.model = model;
    if (isActive !== undefined) updateData.is_active = isActive;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const supabase = supabaseService.getServiceClient();
    const { data: updated, error } = await supabase
      .from('startup_agents')
      .update(updateData)
      .eq('id', agentId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ agent: updated });
  } catch (err: any) {
    console.error('Error in startup-agents update route:', err);
    return NextResponse.json(
      { error: err.message || String(err) },
      { status: 500 }
    );
  }
}
