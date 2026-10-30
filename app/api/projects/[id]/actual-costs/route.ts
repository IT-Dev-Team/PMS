// app/api/projects/[projectId]/actual-costs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { require2Auth,requireAuth } from '@/lib/auth/user';
import { ActualCostQueries } from '@/lib/db/queries/actualCosts';

// ============ GET ============
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await require2Auth('PROJECT_MANAGER','CEO');
    const { id: projectId } = await params;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    const costs = await ActualCostQueries.getByProject(projectId);
    return NextResponse.json(costs);
  } catch (error) {
    console.error('Error fetching actual costs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch actual costs' },
      { status: 500 }
    );
  }
}

// ============ POST ============
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth('PROJECT_MANAGER');
    const { id } = await params;
    console.log('🔍 id from params:', id);
    console.log('🔍 full URL:', request.url);
    if (!id) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      planId,
      period,
      amount,
      costType,
      description,
      referenceNumber,
      vendorId,
      invoiceNumber,
      poNumber,
      status,
      currency,
      exchangeRate,
      budgetLineItemId,
    } = body;

    // Validate required fields
    if (!period || amount == null ) {
      return NextResponse.json(
        { error: 'Missing required fields: period, amount, costType' },
        { status: 400 }
      );
    }

    const cost = await ActualCostQueries.create({
      projectId:id,
      planId,
      period,
      amount,
      costType,
      description,
      referenceNumber,
      vendorId,
      invoiceNumber,
      poNumber,
      approvedBy: user.id, // or from body if you want
      status,
      currency,
      exchangeRate,
      budgetLineItemId,
    });

    return NextResponse.json(cost, { status: 201 });
  } catch (error) {
    console.error('Error creating actual cost:', error);
    return NextResponse.json(
      { error: 'Failed to create actual cost' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth('PROJECT_MANAGER');
    const { id: projectId } = await params;
    const body = await request.json();
    const queryId = new URL(request.url).searchParams.get('id');
    const { id: bodyId, ...updateData } = body;
    const id = bodyId || queryId;

    if (!id) {
      return NextResponse.json({ error: 'Cost ID is required' }, { status: 400 });
    }

    const updated = await ActualCostQueries.update(id, updateData);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating actual cost:', error);
    return NextResponse.json({ error: 'Failed to update cost' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth('PROJECT_MANAGER');
    const { id: projectId } = await params;
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Cost ID is required' }, { status: 400 });
    }

    await ActualCostQueries.delete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting actual cost:', error);
    return NextResponse.json({ error: 'Failed to delete cost' }, { status: 500 });
  }
}
