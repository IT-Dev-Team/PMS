// app/api/planning/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, require2Auth } from '@/lib/auth/user';
import { executeQuery } from '@/lib/db';
import { PlanningQueries } from '@/lib/db/queries/planning';
import { ProjectQueries } from '@/lib/db/queries/projects';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Status = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED' | 'ON_HOLD' | 'DELAYED';

const STATUS_MAP: Record<string, Status> = {
  'Not started': 'NOT_STARTED',
  'In progress': 'IN_PROGRESS',
  'Completed': 'COMPLETED',
  'Blocked': 'BLOCKED',
  'On hold': 'ON_HOLD',
  'Delayed': 'DELAYED',
};

const STATUS_DISPLAY_MAP: Record<Status, string> = {
  'NOT_STARTED': 'Not started',
  'IN_PROGRESS': 'In progress',
  'COMPLETED': 'Completed',
  'BLOCKED': 'Blocked',
  'ON_HOLD': 'On hold',
  'DELAYED': 'Delayed',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatStatus(status: string | null | undefined): string {
  if (!status) return 'Not started';
  const upperStatus = status.toUpperCase();
  return (
    STATUS_DISPLAY_MAP[upperStatus as Status] ||
    status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
  );
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return 'N/A';
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'N/A';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function toISOString(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

function generateProjectCode(): string {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `PRJ-${timestamp}${random}`;
}

/**
 * Normalise a role string so that 'project manager', 'PROJECT_MANAGER',
 * 'Project-Manager' all collapse to 'PROJECT_MANAGER'.
 */
function normalizeRole(role: string | null | undefined): string {
  return (role || '').toUpperCase().replace(/[\s-]/g, '_');
}

// ---------------------------------------------------------------------------
// GET Handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    // Both PMs and CEOs are allowed to read planning data.
     const user = await require2Auth('PROJECT_MANAGER', 'CEO');

    // -------- DEBUG: log the actual user shape --------
    console.log('🔍 GET /api/planning - raw user:', {
      id: user?.id,
      idType: typeof user?.id,
      role: (user as any)?.role,
    });

    if (!user?.id || typeof user.id !== 'string') {
      // Bail out loudly rather than silently returning everything.
      return NextResponse.json(
        { error: 'Invalid user session (missing id)' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get('projectId');

    const role = normalizeRole((user as any).role);
    const isCEO = role === 'CEO' || role.includes('CEO');
    const isProjectManager = role.includes('PROJECT_MANAGER');

    console.log('🔍 GET /api/planning', {
      userId: user.id,
      role,
      isCEO,
      isProjectManager,
      projectId,
    });

    // -----------------------------------------------------------------------
    // Pick query based on role
    // -----------------------------------------------------------------------
    let sql: string;
    let params: any[];

    if (isCEO) {
      sql = `
        SELECT
          p.id,
          p.name,
          p.start_date,
          p.end_date,
          pf.name AS portfolio_name
        FROM projects p
        LEFT JOIN portfolios pf ON p.portfolio_id = pf.id
        ORDER BY p.name
      `;
      params = [];
    } else {
      // PROJECT_MANAGER (or anything else non-CEO) -> only own projects.
      sql = `
        SELECT
          p.id,
          p.name,
          p.start_date,
          p.end_date,
          pf.name AS portfolio_name
        FROM projects p
        LEFT JOIN portfolios pf ON p.portfolio_id = pf.id
        WHERE p.manager_id = $1::uuid
        ORDER BY p.name
      `;
      params = [user.id];
    }

    // -------- DEBUG: log the exact SQL and params --------
    console.log('🔍 /api/planning SQL:', sql.replace(/\s+/g, ' ').trim());
    console.log('🔍 /api/planning params:', params);

    const projectsData = await executeQuery(sql, params);

    console.log(
      '🔍 /api/planning rows returned:',
      projectsData.length,
      'ids:',
      projectsData.map((p: any) => p.id)
    );

    const projects = projectsData.map((p: any) => ({
      id: p.id,
      name: p.name,
      startDate: formatDate(p.start_date),
      endDate: formatDate(p.end_date),
      owner: p.manager_name || 'Unassigned',
      portfolio: p.portfolio_name || 'Unassigned',
    }));

    // Determine active project
    let activeProjectId = projectId;
    if (!activeProjectId && projects.length > 0) {
      activeProjectId = projects[0].id;
    }

    // Validate project access.
    //   - CEO: verify the project exists at all.
    //   - PM:  verify the project exists AND belongs to them.
    if (activeProjectId) {
      if (isCEO) {
        const exists = await executeQuery(
          `SELECT id FROM projects WHERE id = $1 LIMIT 1`,
          [activeProjectId]
        );
        if (!exists || exists.length === 0) {
          return NextResponse.json(
            { error: 'Project not found' },
            { status: 404 }
          );
        }
      } else if (!projects.some((p) => p.id === activeProjectId)) {
        return NextResponse.json(
          { error: 'Project not found or access denied' },
          { status: 403 }
        );
      }
    }

    // Fetch items and reports for the active project
    let items: any[] = [];
    let reports: any[] = [];

    if (activeProjectId) {
      [items, reports] = await Promise.all([
        PlanningQueries.getPlanHierarchy(activeProjectId),
        PlanningQueries.getReports(activeProjectId),
      ]);
    }

    // Format response
    const response = {
      projects,
      selectedProjectId: activeProjectId,
      items: items.map((p: any) => ({
        id: p.id,
        projectId: p.project_id || p.projectId,
        parentId: p.parent_id || p.parentId || null,
        name: p.title || p.name,
        itemType: (p.plan_type || p.planType || 'task').toLowerCase(),
        status: formatStatus(p.status),
        startDate: toISOString(p.start_date || p.startDate) || new Date().toISOString(),
        endDate: toISOString(p.end_date || p.endDate) || new Date().toISOString(),
        actualStartDate: toISOString(p.actual_start_date || p.actualStartDate),
        actualEndDate: toISOString(p.actual_end_date || p.actualEndDate),
        statusChangedAt: toISOString(p.status_changed_at || p.statusChangedAt),
        reasonCode: p.reason_code || p.reasonCode || null,
        reasonNotes: p.reason_notes || p.reasonNotes || null,
        owner: p.assignee_name || p.assigneeName || 'Unassigned',
        budget: p.budget || 0,
        progress: p.progress || 0,
        priority: p.priority || 3,
        estimatedHours: p.estimated_hours || p.estimatedHours || 0,
        children: p.children || [],
      })),
      reports: reports.map((r: any) => ({
        id: r.id,
        projectId: r.project_id || r.projectId,
        reportDate: formatDate(r.report_date || r.reportDate),
        summary: r.summary || '',
        blockers: r.blockers || null,
        nextSteps: r.next_steps || r.nextSteps || null,
        attachmentUrl: r.attachmentUrl || null,
        attachmentName: r.attachmentName || null,
        attachmentType: r.attachmentType || null,
        attachmentSize: r.attachmentSize || null,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        createdByName: r.createdByName || null,
      })),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching planning data:', error);
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
      throw error;
    }
    return NextResponse.json(
      { error: 'Failed to fetch planning data' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST Handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth('PROJECT_MANAGER');
    const body = await request.json();
    const { resource } = body;

    if (!resource) {
      return NextResponse.json(
        { error: 'Resource type is required' },
        { status: 400 }
      );
    }

    switch (resource) {
      case 'project':
        return await handleCreateProject(body, user.id);
      case 'item':
        return await handleCreateItem(body, user.id);
      case 'report':
        return await handleCreateReport(body, user.id);
        case 'reviewReport':
  return await handleReviewReport(body, user.id);
      case 'updateReport':
        return await handleUpdateReport(body, user.id);
      default:
        return NextResponse.json(
          { error: `Invalid resource type: ${resource}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error creating planning resource:', error);
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
      throw error;
    }
    return NextResponse.json(
      { error: 'Failed to create resource' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST Handlers - Sub-functions
// ---------------------------------------------------------------------------

async function handleCreateProject(body: any, userId: string) {
  const { name, owner, startDate, endDate, portfolio } = body;

  if (!name) {
    return NextResponse.json(
      { error: 'Project name is required' },
      { status: 400 }
    );
  }

  const result = await executeQuery(
    `INSERT INTO projects (
      name,
      code,
      description,
      manager_id,
      start_date,
      end_date,
      status,
      created_at,
      updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, 'INITIATING', NOW(), NOW())
    RETURNING id, name, start_date as "startDate", end_date as "endDate"`,
    [
      name,
      generateProjectCode(),
      null,
      userId,
      startDate || new Date().toISOString().split('T')[0],
      endDate ||
        new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
    ]
  );

  return NextResponse.json({
    success: true,
    data: result[0],
    message: 'Project created successfully',
  });
}

async function handleCreateItem(body: any, userId: string) {
  const {
    projectId,
    parentId,
    itemType,
    name,
    description,
    startDate,
    endDate,
    estimatedHours,
    budget,
    owner,
    priority,
  } = body;

  if (!projectId) {
    return NextResponse.json(
      { error: 'Project ID is required' },
      { status: 400 }
    );
  }

  if (!name) {
    return NextResponse.json(
      { error: 'Item name is required' },
      { status: 400 }
    );
  }

  const item = await PlanningQueries.createPlan({
    projectId,
    parentId: parentId || null,
    planType: (itemType || 'task').toUpperCase(),
    title: name,
    description: description || '',
    startDate: startDate || null,
    endDate: endDate || null,
    estimatedHours: estimatedHours || 0,
    budget: budget || 0,
    priority: priority || 3,
    assigneeId: owner || null,
    metadata: {
      owner: owner || 'Unassigned',
      createdBy: userId,
    },
  });

  return NextResponse.json({
    success: true,
    data: item,
    message: 'Plan item created successfully',
  });
}

async function handleCreateReport(body: any, userId: string) {
  const {
    projectId,
    reportDate,
    summary,
    blockers,
    nextSteps,
    attachmentUrl,
    attachmentName,
    attachmentType,
    attachmentSize,
  } = body;

  if (!projectId) {
    return NextResponse.json(
      { error: 'Project ID is required' },
      { status: 400 }
    );
  }

  if (!summary) {
    return NextResponse.json(
      { error: 'Report summary is required' },
      { status: 400 }
    );
  }

  if (attachmentUrl) {
    try {
      new URL(attachmentUrl);
    } catch {
      return NextResponse.json(
        { error: 'Invalid attachment URL format' },
        { status: 400 }
      );
    }

    if (attachmentSize && attachmentSize > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Attachment exceeds 5MB limit' },
        { status: 400 }
      );
    }
  }

  const report = await PlanningQueries.createReport({
    projectId,
    reportDate: reportDate || new Date().toISOString().split('T')[0],
    summary,
    blockers: blockers || null,
    nextSteps: nextSteps || null,
    attachmentUrl: attachmentUrl || null,
    attachmentName: attachmentName || null,
    attachmentType: attachmentType || null,
    attachmentSize: attachmentSize || null,
    createdBy: userId,
  });

  return NextResponse.json({
    success: true,
    data: report,
    message: 'Report submitted successfully',
  });
}
async function handleReviewReport(body: any, userId: string) {
  const { id, reviewStatus, reviewNotes } = body
  if (!id) return NextResponse.json({ error: 'Report ID is required' }, { status: 400 })
  if (!['PENDING_REVIEW', 'REVIEWED', 'NEEDS_REVISION'].includes(reviewStatus)) {
    return NextResponse.json({ error: 'Invalid review status' }, { status: 400 })
  }

  const existing = await PlanningQueries.getReportById(id)
  if (!existing) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

  const updated = await PlanningQueries.reviewReport(id, {
    reviewStatus,
    reviewNotes: reviewNotes || null,
    reviewedBy: userId,
    reviewedAt: new Date().toISOString(),
  })

  return NextResponse.json({ success: true, data: updated, message: 'Report reviewed' })
}
// ---------------------------------------------------------------------------
// POST Handler - Update Report with Attachment
// ---------------------------------------------------------------------------

async function handleUpdateReport(body: any, userId: string) {
  const {
    id,
    summary,
    blockers,
    nextSteps,
    attachmentUrl,
    attachmentName,
    attachmentType,
    attachmentSize,
  } = body;

  if (!id) {
    return NextResponse.json(
      { error: 'Report ID is required' },
      { status: 400 }
    );
  }

  const existingReport = await PlanningQueries.getReportById(id);
  if (!existingReport) {
    return NextResponse.json(
      { error: 'Report not found' },
      { status: 404 }
    );
  }

  if (attachmentUrl) {
    try {
      new URL(attachmentUrl);
    } catch {
      return NextResponse.json(
        { error: 'Invalid attachment URL format' },
        { status: 400 }
      );
    }

    if (attachmentSize && attachmentSize > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Attachment exceeds 5MB limit' },
        { status: 400 }
      );
    }
  }

  const updatedReport = await PlanningQueries.updateReport(id, {
    summary,
    blockers,
    nextSteps,
    attachmentUrl: attachmentUrl !== undefined ? attachmentUrl || null : undefined,
    attachmentName:
      attachmentName !== undefined ? attachmentName || null : undefined,
    attachmentType:
      attachmentType !== undefined ? attachmentType || null : undefined,
    attachmentSize:
      attachmentSize !== undefined ? attachmentSize || null : undefined,
  });

  await PlanningQueries.logPlanUpdate({
    planId: id,
    projectId: existingReport.projectId,
    action: 'REPORT_UPDATED',
    fieldChanged: 'report',
    reasonNotes: `Report updated with ${
      attachmentUrl ? 'new attachment' : 'attachment removed'
    }`,
    createdBy: userId,
  });

  return NextResponse.json({
    success: true,
    data: updatedReport,
    message: 'Report updated successfully',
  });
}

// ---------------------------------------------------------------------------
// PATCH Handler
// ---------------------------------------------------------------------------

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth('PROJECT_MANAGER');
    const body = await request.json();

    const {
      id,
      title,
      assignee_id,
      start_date,
      end_date,
      budget,
      weight,
      parent_id,
      status,
      progress,
      notes,
      reasonCode,
      reasonNotes,
      actualStartDate,
      actualEndDate,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Plan ID is required' },
        { status: 400 }
      );
    }

    const currentPlan = await PlanningQueries.getPlanById(id);
    if (!currentPlan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }

    await PlanningQueries.updatePlan(id, body);

    let updatedPlan = null;

    if (status) {
      updatedPlan = await PlanningQueries.updatePlanStatusWithLog(
        id,
        status,
        user.id,
        reasonCode,
        reasonNotes || notes
      );
    }

    if (progress !== undefined && progress !== null) {
      updatedPlan = await PlanningQueries.updatePlanProgressWithLog(
        id,
        progress,
        user.id,
        notes || `Progress updated to ${progress}%`
      );
    }

    if (notes && !status && progress === undefined) {
      updatedPlan = await PlanningQueries.addPlanNote(id, notes, user.id);
    }

    if (actualStartDate || actualEndDate) {
      const updateData: any = {};
      if (actualStartDate) updateData.actualStartDate = actualStartDate;
      if (actualEndDate) updateData.actualEndDate = actualEndDate;

      if (actualStartDate) {
        await PlanningQueries.logPlanUpdate({
          planId: id,
          projectId: currentPlan.project_id,
          action: 'UPDATED',
          fieldChanged: 'actual_start_date',
          oldValue: currentPlan.actual_start_date || null,
          newValue: actualStartDate,
          reasonNotes: reasonNotes,
          createdBy: user.id,
        });
      }
      if (actualEndDate) {
        await PlanningQueries.logPlanUpdate({
          planId: id,
          projectId: currentPlan.project_id,
          action: 'UPDATED',
          fieldChanged: 'actual_end_date',
          oldValue: currentPlan.actual_end_date || null,
          newValue: actualEndDate,
          reasonNotes: reasonNotes,
          createdBy: user.id,
        });
      }
    }

    if (!updatedPlan) {
      updatedPlan = currentPlan;
    }

    return NextResponse.json({
      success: true,
      data: updatedPlan,
      message: 'Plan updated successfully',
    });
  } catch (error) {
    console.error('Error updating plan:', error);
    return NextResponse.json(
      { error: 'Failed to update plan' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE Handler
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth('PROJECT_MANAGER');
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    const resource = searchParams.get('resource') || 'item';

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      );
    }

    if (resource === 'item') {
      const item = await PlanningQueries.getPlanById(id);
      if (!item) {
        return NextResponse.json(
          { error: 'Plan item not found' },
          { status: 404 }
        );
      }

      await PlanningQueries.deletePlan(id);

      if (item.parent_id) {
        await PlanningQueries.updateParentProgress(item.parent_id);
      }

      return NextResponse.json({
        success: true,
        message: 'Plan item deleted successfully',
      });
    }

    if (resource === 'report') {
      await PlanningQueries.deleteReport(id);
      return NextResponse.json({
        success: true,
        message: 'Report deleted successfully',
      });
    }

    return NextResponse.json(
      { error: `Invalid resource type: ${resource}` },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error deleting resource:', error);
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
      throw error;
    }
    return NextResponse.json(
      { error: 'Failed to delete resource' },
      { status: 500 }
    );
  }
}