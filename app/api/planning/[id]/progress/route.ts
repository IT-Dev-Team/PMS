// app/api/planning/[id]/progress/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth,require2Auth } from '@/lib/auth/user';
import { executeQuery } from '@/lib/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await require2Auth('PROJECT_MANAGER','CEO');
    const { id } = await params;
    const body = await request.json();
    const { progress } = body;

    if (progress === undefined || progress < 0 || progress > 100) {
      return NextResponse.json(
        { error: 'Invalid progress value (0-100)' },
        { status: 400 }
      );
    }

    const result = await executeQuery(
      `UPDATE plans 
       SET progress = $1,
           status = CASE 
             WHEN $1 >= 100 THEN 'COMPLETED'
             WHEN $1 > 0 THEN 'IN_PROGRESS'
             ELSE 'NOT_STARTED'
           END,
           completed_at = CASE 
             WHEN $1 >= 100 THEN NOW()
             ELSE completed_at
           END,
           updated_at = NOW()
       WHERE id = $2::uuid
       RETURNING *`,
      [progress, id]
    );

    // Update parent progress if exists
    if (result[0]?.parent_id) {
      await executeQuery(
        `WITH child_stats AS (
          SELECT 
            COALESCE(AVG(progress), 0) as avg_progress,
            COUNT(*) as total,
            COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed
          FROM plans
          WHERE parent_id = $1::uuid
        )
        UPDATE plans 
        SET 
          progress = (SELECT avg_progress FROM child_stats),
          status = CASE 
            WHEN (SELECT completed FROM child_stats) = (SELECT total FROM child_stats) THEN 'COMPLETED'
            WHEN (SELECT avg_progress FROM child_stats) > 0 THEN 'IN_PROGRESS'
            ELSE 'NOT_STARTED'
          END,
          updated_at = NOW()
        WHERE id = $1::uuid`,
        [result[0].parent_id]
      );
    }

    return NextResponse.json({ success: true, data: result[0] });
  } catch (error) {
    console.error('Error updating progress:', error);
    return NextResponse.json(
      { error: 'Failed to update progress' },
      { status: 500 }
    );
  }
}