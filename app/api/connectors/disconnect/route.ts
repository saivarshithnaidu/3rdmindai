import { NextRequest, NextResponse } from 'next/server';
import supabaseService from '../../../../services/supabase.service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, userId } = body;

    if (!slug) {
      return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
    }

    const activeUserId = userId || '00000000-0000-0000-0000-000000000000';
    const supabase = supabaseService.getServiceClient();

    // Deactivate connection and clear secrets for security
    const { error } = await supabase
      .from('connectors')
      .update({
        is_active: false,
        api_key: null,
        access_token: null,
        refresh_token: null,
        token_expiry: null,
        scopes: null
      })
      .eq('user_id', activeUserId)
      .eq('slug', slug);

    if (error) {
      console.error('Failed to deactivate connector:', error.message);
      return NextResponse.json({ error: `Database error: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Disconnect connector failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
