// app/api/procurement/payments/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/user';
import { ProcurementQueries } from '@/lib/db/queries/procurement';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth('TEAM_MEMBER');
    const searchParams = request.nextUrl.searchParams;
    const packageId = searchParams.get('packageId');

    if (!packageId) {
      return NextResponse.json(
        { error: 'packageId is required' },
        { status: 400 }
      );
    }

    const [payments, totalPaid] = await Promise.all([
      ProcurementQueries.getPaymentRecords(packageId),
      ProcurementQueries.getTotalPaid(packageId)
    ]);

    return NextResponse.json({ 
      success: true, 
      data: payments,
      totalPaid
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payments' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth('TEAM_MEMBER');
    const body = await request.json();

    const { packageId, milestoneId, amount, paidDate, referenceNumber, notes } = body;

    if (!packageId || amount === undefined || !paidDate) {
      return NextResponse.json(
        { error: 'packageId, amount, and paidDate are required' },
        { status: 400 }
      );
    }

    // Validate amount
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json(
        { error: 'Amount must be a positive number' },
        { status: 400 }
      );
    }

    // Create payment record
    const payment = await ProcurementQueries.createPaymentRecord({
      packageId,
      milestoneId: milestoneId || null,
      amount: amountNum,
      paidDate: new Date(paidDate),
      referenceNumber: referenceNumber || null,
      notes: notes || null,
    });

    // If milestone is provided, mark it as completed and update package progress
    if (milestoneId) {
      await ProcurementQueries.updateMilestoneStatus(milestoneId, 'COMPLETED');
      // updatePackageProgress is called inside updateMilestoneStatus
      // but we also call it here in case the milestone update didn't trigger it
      await ProcurementQueries.updatePackageProgress(packageId);
    } else {
      // Still update package progress if no milestone
      await ProcurementQueries.updatePackageProgress(packageId);
    }

    return NextResponse.json({ success: true, data: payment });
  } catch (error) {
    console.error('Error creating payment record:', error);
    return NextResponse.json(
      { error: 'Failed to create payment record' },
      { status: 500 }
    );
  }
}