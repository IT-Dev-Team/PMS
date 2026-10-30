// app/api/projects/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, require2Auth } from '@/lib/auth/user';
import { executeQuery } from '@/lib/db';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalise a role string so 'project manager', 'PROJECT_MANAGER',
 * 'Project-Manager' all collapse to 'PROJECT_MANAGER'.
 */
function normalizeRole(role: string | null | undefined): string {
  return (role || '').toUpperCase().replace(/[\s-]/g, '_');
}

// ---------------------------------------------------------------------------
// POST Handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth('PROJECT_MANAGER');
    const body = await request.json();

    const {
      name,
      code,
      description,
      portfolioId,
      departmentId,
      projectType,
      startDate,
      endDate,
      phase,
      scopeStatement,
      deliverables,
      milestones,
      budget,
      currency,
      resourceRequirements,
      teamMembers,
      initialRisks,
      governanceModel,
      reportingFrequency,
      stakeholders,
      managerId,
    } = body;

    // Validate required fields
    if (!name || !code || !portfolioId || !startDate || !endDate || !budget) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if project code already exists
    const existing = await executeQuery(
      `SELECT id FROM projects WHERE code = $1`,
      [code]
    );

    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'Project code already exists' },
        { status: 409 }
      );
    }

    // Insert project
    const result = await executeQuery(
      `INSERT INTO projects (
        name, code, description, portfolio_id, department_id,
        project_type, start_date, end_date, phase,
        scope_statement, deliverables, milestones,
        budget, currency,
        resource_requirements, team_members,
        initial_risks, governance_model,
        reporting_frequency, stakeholders,
        status, manager_id, progress
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, 'INITIATING', $21, 0)
      RETURNING
        id, name, code, status, progress,
        created_at as "createdAt"
      `,
      [
        name,
        code,
        description || null,
        portfolioId,
        departmentId || null,
        projectType || 'CAPITAL',
        startDate,
        endDate,
        phase || 'INITIATING',
        scopeStatement || null,
        JSON.stringify(deliverables || []),
        JSON.stringify(milestones || []),
        budget,
        currency || 'USD',
        JSON.stringify(resourceRequirements || []),
        JSON.stringify(teamMembers || []),
        JSON.stringify(initialRisks || []),
        governanceModel || null,
        reportingFrequency || 'MONTHLY',
        JSON.stringify(stakeholders || []),
        managerId || user.id,
      ]
    );

    // Create initial budget line items
    await executeQuery(
      `INSERT INTO budget_line_items (project_id, category, planned_amount, actual_amount, remaining_amount)
       VALUES ($1, 'Total Budget', $2, 0, $2)`,
      [result[0].id, budget]
    );

    // Create initial EVM data
    await executeQuery(
      `INSERT INTO evm_data (project_id, planned_value, earned_value, actual_cost, period)
       VALUES ($1, 0, 0, 0, NOW())`,
      [result[0].id]
    );

    // Create audit log
    await executeQuery(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        user.id,
        'CREATE_PROJECT',
        'PROJECT',
        result[0].id,
        JSON.stringify(body),
        JSON.stringify({ timestamp: new Date().toISOString() }),
      ]
    );

    // Update portfolio timestamp
    await executeQuery(
      `UPDATE portfolios
       SET updated_at = NOW()
       WHERE id = $1`,
      [portfolioId]
    );

    return NextResponse.json({
      success: true,
      data: result[0],
      message: 'Project registered successfully',
    });
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// GET Handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    // Both PROJECT_MANAGER and CEO may read projects.
    const user = await require2Auth('PROJECT_MANAGER', 'CEO');

    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get('id');
    const portfolioId = searchParams.get('portfolioId');
    const status = searchParams.get('status');

    // -----------------------------------------------------------------------
    // Role resolution
    //   - CEO              -> sees ALL projects
    //   - PROJECT_MANAGER  -> sees ONLY projects where manager_id = user.id
    //   - Portfolio mgr /  -> still see all (existing behaviour preserved)
    //     admin
    // -----------------------------------------------------------------------
    const role = normalizeRole((user as any).role);
    const isCEO = role === 'CEO' || role.includes('CEO');
    const isPortfolioManager = role.includes('PORTFOLIO_MANAGER');
    const isAdmin = Boolean((user as any).isAdmin) || role.includes('ADMIN');

    // CEO, portfolio managers and admins can see everything.
    // Everyone else (i.e. project managers) is restricted to their own projects.
    const canSeeAllProjects = isCEO || isPortfolioManager || isAdmin;

    console.log(
      '🔍 GET /api/projects - User:',
      user.id,
      'Role:',
      role,
      'canSeeAllProjects:',
      canSeeAllProjects,
      'projectId:',
      projectId
    );

    // -----------------------------------------------------------------------
    // Single project fetch
    // -----------------------------------------------------------------------
    if (projectId) {
      const result = await executeQuery(
        `SELECT
          p.*,
          u.name as manager_name,
          pf.name as portfolio_name,
          pf.code as portfolio_code,
          d.name as department_name,
          (
            SELECT COUNT(*) FROM tasks WHERE project_id = p.id
          ) as task_count,
          (
            SELECT COUNT(*) FROM risks WHERE project_id = p.id
          ) as risk_count,
          (
            SELECT COUNT(*) FROM decisions WHERE project_id = p.id
          ) as decision_count
        FROM projects p
        LEFT JOIN users u ON p.manager_id = u.id
        LEFT JOIN portfolios pf ON p.portfolio_id = pf.id
        LEFT JOIN departments d ON p.department_id = d.id
        WHERE p.id = $1::uuid`,
        [projectId]
      );

      if (result.length === 0) {
        return NextResponse.json(
          { error: 'Project not found' },
          { status: 404 }
        );
      }

      const project = result[0];

      // Enforce access for non-privileged users:
      // PROJECT_MANAGER may only read their own projects.
      if (!canSeeAllProjects && project.manager_id !== user.id) {
        return NextResponse.json(
          { error: 'Project not found or access denied' },
          { status: 403 }
        );
      }

      return NextResponse.json({ success: true, data: project });
    }

    // -----------------------------------------------------------------------
    // List projects with filters
    // -----------------------------------------------------------------------
    let query = `
      SELECT
        p.id, p.name, p.code, p.status,
        p.budget, p.progress,
        p.start_date, p.end_date,
        p.created_at,
        u.name as manager_name,
        pf.name as portfolio_name
      FROM projects p
      LEFT JOIN users u ON p.manager_id = u.id
      LEFT JOIN portfolios pf ON p.portfolio_id = pf.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (portfolioId) {
      query += ` AND p.portfolio_id = $${paramIndex}::uuid`;
      params.push(portfolioId);
      paramIndex++;
    }

    if (status) {
      query += ` AND p.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    // Apply manager filter ONLY for non-privileged users (i.e. project managers).
    if (!canSeeAllProjects) {
      query += ` AND p.manager_id = $${paramIndex}::uuid`;
      params.push(user.id);
      paramIndex++;
    }

    query += ` ORDER BY p.created_at DESC`;

    const result = await executeQuery(query, params);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching projects:', error);
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
      throw error;
    }
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}