import { NextRequest, NextResponse } from 'next/server';
import learningService from '../../../../services/learning.service';

export async function POST(req: NextRequest) {
  try {
    const { agentId, projectId } = await req.json();

    if (!agentId || !projectId) {
      return NextResponse.json({ error: 'Missing agentId or projectId' }, { status: 400 });
    }

    const newLearnings = await learningService.extractLearnings(agentId, projectId);
    
    // Automatically trigger strategy update if new learnings found
    let strategyUpdated = false;
    if (newLearnings > 0) {
      const strategy = await learningService.updateAgentStrategy(agentId, projectId);
      if (strategy) {
        strategyUpdated = true;
      }
    }

    return NextResponse.json({ success: true, newLearnings, strategyUpdated });
  } catch (err: any) {
    console.error('Error in api/learning/extract:', err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
