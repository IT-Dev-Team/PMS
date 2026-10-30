// app/api/procurement/packages/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/user';
import { ProcurementQueries } from '@/lib/db/queries/procurement';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth('TEAM_MEMBER');
    const { id } = await params;
    const pkg = await ProcurementQueries.findPackageById(id);

    if (!pkg) {
      return NextResponse.json(
        { error: 'Package not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: pkg });
  } catch (error) {
    console.error('Error fetching package:', error);
    return NextResponse.json(
      { error: 'Failed to fetch package' },
      { status: 500 }
    );
  }
}

// app/api/procurement/packages/[id]/route.ts
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth('TEAM_MEMBER');
    const { id } = await params;
    const body = await request.json();

    // 1. Update the package
    const pkg = await ProcurementQueries.updatePackage(id, {
      title: body.title,
      description: body.description,
      contractValue: body.contractValue ? parseFloat(body.contractValue) : undefined,
      vendorId: body.vendorId,
      terms: body.terms,
      status: body.status,
      paymentSchedule: body.paymentSchedule
    });

    // 2. Handle milestones if provided
    if (body.milestones && Array.isArray(body.milestones)) {
      // Delete existing milestones
      await ProcurementQueries.deleteMilestonesByPackage(id);
      
      // Insert new milestones
      for (const milestone of body.milestones) {
        await ProcurementQueries.createMilestone({
          packageId: id,
          title: milestone.title,
          dueDate: new Date(milestone.dueDate),
          percentage: parseFloat(milestone.percentage) || 0,
        });
      }
    }

    return NextResponse.json({ success: true, data: pkg });
  } catch (error) {
    console.error('Error updating package:', error);
    return NextResponse.json(
      { error: 'Failed to update package' },
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

    await ProcurementQueries.deletePackage(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting package:', error);
    return NextResponse.json(
      { error: 'Failed to delete package' },
      { status: 500 }
    );
  }
}