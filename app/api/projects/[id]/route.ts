// app/api/projects/[id]/progress/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, require2Auth } from '@/lib/auth/user';
import { executeQuery } from '@/lib/db';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeRole(role: string | null | undefined): string {
  return (role || '').toUpperCase().replace(/[\s-]/g, '_');
}

/**
 * Verifies the caller has access to the given project.
 *   - CEO / ADMIN / PORTFOLIO_MANAGER  -> can access any project
 *   - PROJECT_MANAGER                  -> only if manager_id === user.id
 *
 * Returns null on success, or a NextResponse on failure.
 */
async function assertProjectAccess(
  user: any,
  projectId: string
): Promise<NextResponse | null> {
  const role = normalizeRole(user?.role);
  const isCEO = role === 'CEO' || role.includes('CEO');
  const isPortfolioManager = role.includes('PORTFOLIO_MANAGER');
  const isAdmin = Boolean(user?.isAdmin) || role.includes('ADMIN');
  const canAccessAll = isCEO || isPortfolioManager || isAdmin;

  const rows = await executeQuery(
    `SELECT id, manager_id FROM projects WHERE id = $1::uuid LIMIT 1`,
    [projectId]
  );

  if (rows.length === 0) {
    return NextResponse.json(
      { error: 'Project not found' },
      { status: 404 }
    );
  }

  const project = rows[0];

  if (!canAccessAll && project.manager_id !== user.id) {
    return NextResponse.json(
      { error: 'Project not found or access denied' },
      { status: 403 }
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// GET — comprehensive project progress
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await require2Auth('PROJECT_MANAGER', 'CEO');
    const { id } = await params;

    // ---- Access control: PMs can only see their own projects ----
    const denied = await assertProjectAccess(user, id);
    if (denied) return denied;

    // Get comprehensive project progress
    const [project, tasks, plans, risks, decisions, history] = await Promise.all([
      executeQuery(
        `SELECT id, name, percent_complete, status, start_date, end_date, budget, actual_cost
         FROM projects WHERE id = $1::uuid`,
        [id]
      ),
      executeQuery(
        `SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed,
          COUNT(CASE WHEN status = 'IN_PROGRESS' THEN 1 END) as in_progress,
          COUNT(CASE WHEN status = 'BLOCKED' THEN 1 END) as blocked,
          COUNT(CASE WHEN status = 'TODO' THEN 1 END) as todo,
          COUNT(CASE WHEN status != 'COMPLETED' AND end_date < NOW() THEN 1 END) as overdue,
          AVG(percent_complete) as avg_progress
        FROM tasks
        WHERE project_id = $1::uuid`,
        [id]
      ),
      executeQuery(
        `SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed,
          COUNT(CASE WHEN status = 'IN_PROGRESS' THEN 1 END) as in_progress,
          AVG(progress) as avg_progress
        FROM plans
        WHERE project_id = $1::uuid`,
        [id]
      ),
      executeQuery(
        `SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN status != 'CLOSED' THEN 1 END) as open,
          COUNT(CASE WHEN risk_level = 'CRITICAL' THEN 1 END) as critical,
          COUNT(CASE WHEN risk_level = 'HIGH' THEN 1 END) as high,
          COUNT(CASE WHEN status = 'CLOSED' THEN 1 END) as closed
        FROM risks
        WHERE project_id = $1::uuid`,
        [id]
      ),
      executeQuery(
        `SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'APPROVED' THEN 1 END) as approved,
          COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending
        FROM decisions
        WHERE project_id = $1::uuid`,
        [id]
      ),
      executeQuery(
        `SELECT
          percent_complete,
          updated_at as date
        FROM projects
        WHERE id = $1::uuid
        ORDER BY updated_at DESC
        LIMIT 12`,
        [id]
      ),
    ]);

    const data = {
      project: project[0] || {},
      taskStats:
        tasks[0] || {
          total: 0,
          completed: 0,
          inProgress: 0,
          blocked: 0,
          todo: 0,
          overdue: 0,
          avgProgress: 0,
        },
      planStats:
        plans[0] || {
          total: 0,
          completed: 0,
          inProgress: 0,
          avgProgress: 0,
        },
      riskStats:
        risks[0] || {
          total: 0,
          open: 0,
          critical: 0,
          high: 0,
          closed: 0,
        },
      decisionStats:
        decisions[0] || { total: 0, approved: 0, pending: 0 },
      percentComplete: project[0]?.percent_complete || 0,
      history: history || [],
    };

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching progress:', error);
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
      throw error;
    }
    return NextResponse.json(
      { error: 'Failed to fetch progress' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PATCH — update project progress
// ---------------------------------------------------------------------------

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth('PROJECT_MANAGER');
    const { id } = await params;
    const body = await request.json();
    const { percentComplete } = body;

    if (
      percentComplete === undefined ||
      percentComplete < 0 ||
      percentComplete > 100
    ) {
      return NextResponse.json(
        { error: 'Invalid percent complete value (0-100)' },
        { status: 400 }
      );
    }

    // ---- Access control: PMs can only update their own projects ----
    const denied = await assertProjectAccess(user, id);
    if (denied) return denied;

    // Update project progress
    const result = await executeQuery(
      `UPDATE projects
       SET percent_complete = $1, updated_at = NOW()
       WHERE id = $2::uuid
       RETURNING id, percent_complete, updated_at`,
      [percentComplete, id]
    );

    // Create audit log
    await executeQuery(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        user.id,
        'UPDATE_PROJECT_PROGRESS',
        'PROJECT',
        id,
        JSON.stringify({ percent_complete: percentComplete }),
        JSON.stringify({ timestamp: new Date().toISOString() }),
      ]
    );

    return NextResponse.json({
      success: true,
      data: result[0],
      message: 'Progress updated successfully',
    });
  } catch (error) {
    console.error('Error updating progress:', error);
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
      throw error;
    }
    return NextResponse.json(
      { error: 'Failed to update progress' },
      { status: 500 }
    );
  }
}