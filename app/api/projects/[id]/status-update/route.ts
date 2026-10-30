// app/api/projects/[id]/status-report/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { require2Auth } from '@/lib/auth/user';
import { ReportQueries } from '@/lib/db/queries/reports';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await require2Auth('PROJECT_MANAGER','CEO');
    const { id } = await params;

    const report = await ReportQueries.generateStatusUpdate(id);

    return NextResponse.json({ 
      success: true, 
      data: report,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating status report:', error);
    return NextResponse.json(
      { error: 'Failed to generate status report' },
      { status: 500 }
    );
  }
}