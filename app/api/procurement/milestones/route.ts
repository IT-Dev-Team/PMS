// app/api/procurement/milestones/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/user';
import { ProcurementQueries } from '@/lib/db/queries/procurement';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth('TEAM_MEMBER');
    const body = await request.json();

    const { packageId, title, dueDate, percentage } = body;

    if (!packageId || !title || !dueDate) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const milestone = await ProcurementQueries.createMilestone({
      packageId,
      title,
      dueDate: new Date(dueDate),
      percentage: parseFloat(percentage) || 0,
    });

    return NextResponse.json({ success: true, data: milestone });
  } catch (error) {
    console.error('Error creating milestone:', error);
    return NextResponse.json(
      { error: 'Failed to create milestone' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth('TEAM_MEMBER');
    const searchParams = request.nextUrl.searchParams;
    const packageId = searchParams.get('packageId');

    if (!packageId) {
      return NextResponse.json(
        { error: 'Package ID is required' },
        { status: 400 }
      );
    }

    const milestones = await ProcurementQueries.getPackageMilestones(packageId);
    return NextResponse.json({ success: true, data: milestones });
  } catch (error) {
    console.error('Error fetching milestones:', error);
    return NextResponse.json(
      { error: 'Failed to fetch milestones' },
      { status: 500 }
    );
  }
}