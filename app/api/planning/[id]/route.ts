// app/api/planning/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/user';
import { PlanningQueries } from '@/lib/db/queries/planning';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth('PROJECT_MANAGER');
    const { id } = await params;

    await PlanningQueries.deletePlan(id);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting plan item:', error);
    return NextResponse.json(
      { error: 'Failed to delete plan item' },
      { status: 500 }
    );
  }
}