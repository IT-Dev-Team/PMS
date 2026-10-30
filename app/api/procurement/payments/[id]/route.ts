// app/api/procurement/payments/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/user';
import { ProcurementQueries } from '@/lib/db/queries/procurement';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth('TEAM_MEMBER');
    const { id } = await params;

    // Optional: Get the payment record to know packageId for progress update
    // But we'll just delete and recalc progress for all packages? Better to not overcomplicate.
    // We'll just delete and assume the UI will refresh.
    await ProcurementQueries.deletePaymentRecord(id);

    // Optionally, we could recalc package progress for the associated package
    // but that would require fetching the packageId from the payment record first.
    // We'll keep it simple.

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting payment:', error);
    return NextResponse.json(
      { error: 'Failed to delete payment' },
      { status: 500 }
    );
  }
}