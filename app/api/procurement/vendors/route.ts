// app/api/procurement/vendors/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/user';
import { ProcurementQueries } from '@/lib/db/queries/procurement';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth('PROJECT_MANAGER');
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const vendors = await ProcurementQueries.findAllVendors({ status: status || undefined, search: search || undefined });
    return NextResponse.json({ success: true, data: vendors });
  } catch (error) {
    console.error('Error fetching vendors:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vendors' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth('PROJECT_MANAGER');
    const body = await request.json();

    const vendor = await ProcurementQueries.createVendor({
      name: body.name,
      code: body.code,
      contactName: body.contactName || null,
      email: body.email || null,
      phone: body.phone || null,
      rating: body.rating ? parseInt(body.rating) : null,
    });

    return NextResponse.json({ success: true, data: vendor });
  } catch (error) {
    console.error('Error creating vendor:', error);
    return NextResponse.json(
      { error: 'Failed to create vendor' },
      { status: 500 }
    );
  }
}