// app/api/procurement/milestones/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/user';
import { ProcurementQueries } from '@/lib/db/queries/procurement';

// app/api/procurement/milestones/[id]/route.ts
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth('TEAM_MEMBER');
    const { id } = await params;
    const body = await request.json();

    const { status } = body;

    if (!status) {
      return NextResponse.json(
        { error: 'Status is required' },
        { status: 400 }
      );
    }

    // Validate status value
    const validStatuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const milestone = await ProcurementQueries.updateMilestoneStatus(id, status);

    return NextResponse.json({ success: true, data: milestone });
  } catch (error) {
    console.error('Error updating milestone:', error);
    return NextResponse.json(
      { error: 'Failed to update milestone' },
      { status: 500 }
    );
  }
}
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth('TEAM_MEMBER');
    const { id } = await params;

    await ProcurementQueries.deleteMilestone(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting milestone:', error);
    return NextResponse.json(
      { error: 'Failed to delete milestone' },
      { status: 500 }
    );
  }
}