import { NextRequest, NextResponse } from 'next/server';
import supabaseService from '../../../../services/supabase.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const userId = searchParams.get('userId');
    const supabase = supabaseService.getServiceClient();

    if (!projectId || !userId) {
      return NextResponse.json({ error: 'Missing projectId or userId' }, { status: 400 });
    }

    const { data: config, error } = await supabase
      .from('briefing_configs')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ success: true, config: config || null });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, userId, deliveryTime, timezone, whatsappNumber, email, voiceId, sections, isActive } = body;
    const supabase = supabaseService.getServiceClient();

    if (!projectId || !userId) {
      return NextResponse.json({ error: 'Missing projectId or userId' }, { status: 400 });
    }

    const { data: config, error } = await supabase
      .from('briefing_configs')
      .insert({
        project_id: projectId,
        user_id: userId,
        delivery_time: deliveryTime || '08:00',
        timezone: timezone || 'Asia/Kolkata',
        whatsapp_number: whatsappNumber || null,
        email: email || null,
        voice_id: voiceId || 'rachel',
        sections: sections || [],
        is_active: isActive !== undefined ? isActive : true,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, config });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { configId, ...fields } = body;
    const supabase = supabaseService.getServiceClient();

    if (!configId) {
      return NextResponse.json({ error: 'Missing configId' }, { status: 400 });
    }

    // Map camelCase to snake_case for DB fields
    const updateData: Record<string, any> = {};
    if (fields.deliveryTime !== undefined) updateData.delivery_time = fields.deliveryTime;
    if (fields.timezone !== undefined) updateData.timezone = fields.timezone;
    if (fields.whatsappNumber !== undefined) updateData.whatsapp_number = fields.whatsappNumber;
    if (fields.email !== undefined) updateData.email = fields.email;
    if (fields.voiceId !== undefined) updateData.voice_id = fields.voiceId;
    if (fields.sections !== undefined) updateData.sections = fields.sections;
    if (fields.isActive !== undefined) updateData.is_active = fields.isActive;

    const { data: config, error } = await supabase
      .from('briefing_configs')
      .update(updateData)
      .eq('id', configId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, config });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
