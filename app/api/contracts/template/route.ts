import { NextRequest, NextResponse } from 'next/server';
import contractService from '../../../../services/contract.service';

export async function POST(req: NextRequest) {
  try {
    const { templateType, projectId, variables } = await req.json();
    if (!templateType || !projectId || !variables) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const template = await contractService.generateTemplate(templateType, projectId, variables);
    return NextResponse.json({ success: true, template });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
