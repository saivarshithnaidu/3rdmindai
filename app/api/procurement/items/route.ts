import { NextRequest, NextResponse } from 'next/server';
import supabaseService from '../../../../services/supabase.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const supabase = supabaseService.getServiceClient();

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    // Fetch all procurement items for the project
    const { data: items, error } = await supabase
      .from('procurement_items')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Enrich each item with alternatives count
    const enrichedItems = await Promise.all(
      (items || []).map(async (item) => {
        const { count } = await supabase
          .from('procurement_alternatives')
          .select('*', { count: 'exact', head: true })
          .eq('item_id', item.id);

        return {
          ...item,
          alternatives_count: count || 0
        };
      })
    );

    return NextResponse.json({ success: true, items: enrichedItems });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      projectId,
      name,
      category,
      currentProvider,
      currentPrice,
      billingCycle,
      renewalDate,
      usersCount,
      satisfaction,
      notes
    } = body;

    if (!projectId || !name || !category) {
      return NextResponse.json({ error: 'Missing required fields: projectId, name, category' }, { status: 400 });
    }

    const supabase = supabaseService.getServiceClient();

    const { data: item, error } = await supabase
      .from('procurement_items')
      .insert({
        project_id: projectId,
        name,
        category,
        current_provider: currentProvider || null,
        current_price: currentPrice || null,
        billing_cycle: billingCycle || 'monthly',
        renewal_date: renewalDate || null,
        users_count: usersCount || null,
        satisfaction: satisfaction || null,
        notes: notes || null
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, item });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
