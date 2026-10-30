// lib/db/queries/projects.ts
import { executeQuery } from '@/lib/db';
import { Project, ProjectStatus, ProjectCreateInput, ProjectUpdateInput } from '@/types/project';

export interface ProjectSummary {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalBudget: number;
  totalActualCost: number;
  totalVariance: number;
  avgProgress: number;
  projects: any[];
}

export const ProjectQueries = {
  async create(data: ProjectCreateInput): Promise<Project> {
    console.log('[ProjectQueries.create]', { data });
    const rows = await executeQuery<Project>(
      `INSERT INTO projects (
        code, name, description, department_id, manager_id,
        start_date, end_date, budget, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING
        id, code, name, description, status, department_id as "departmentId",
        manager_id as "managerId", start_date as "startDate", end_date as "endDate",
        budget, actual_cost as "actualCost", progress  as "percentComplete",
        baseline_id as "baselineId", created_at as "createdAt", updated_at as "updatedAt"`,
      [
        data.code,
        data.name,
        data.description,
        data.departmentId || null,
        data.managerId,
        data.startDate,
        data.endDate,
        data.budget,
        data.status || 'INITIATING',
      ]
    );
    console.log('[ProjectQueries.create] result:', rows[0]?.id);
    return rows[0];
  },

  async findById(id: string): Promise<Project | null> {
    console.log('[ProjectQueries.findById]', { id });
    const rows = await executeQuery<Project>(
      `SELECT
        p.id, p.code, p.name, p.description, p.status,
        p.department_id as "departmentId",
        p.manager_id as "managerId",
        p.start_date as "startDate",
        p.end_date as "endDate",
        p.budget, p.actual_cost as "actualCost",
        p.progress as "percentComplete",
        p.baseline_id as "baselineId",
        p.created_at as "createdAt",
        p.updated_at as "updatedAt",
        u.name as "managerName"
      FROM projects p
      LEFT JOIN users u ON p.manager_id::uuid = u.id::uuid
      WHERE p.id::text = $1::text`,
      [id]
    );
    console.log('[ProjectQueries.findById] rows:', rows.length);
    return rows[0] || null;
  },

  async getProjectSummary(userId: string): Promise<ProjectSummary> {
    console.log('[ProjectQueries.getProjectSummary]', { userId });
    const rows = await executeQuery(
      `
      WITH user_projects AS (
        SELECT
          id, name, code, budget, actual_cost, progress, status,
          start_date, end_date, portfolio_id, manager_id
        FROM projects
        WHERE manager_id = $1 AND status != 'CANCELLED'
      )
      SELECT
        COUNT(*) as "totalProjects",
        COUNT(CASE WHEN status IN ('EXECUTING', 'MONITORING', 'PLANNING', 'INITIATING') THEN 1 END) as "activeProjects",
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as "completedProjects",
        COALESCE(SUM(budget), 0) as "totalBudget",
        COALESCE(SUM(actual_cost), 0) as "totalActualCost",
        COALESCE(SUM(budget) - SUM(actual_cost), 0) as "totalVariance",
        COALESCE(AVG(progress), 0) as "avgProgress",
        COALESCE(
          json_agg(
            json_build_object(
              'id', id,
              'name', name,
              'code', code,
              'budget', budget,
              'actualCost', actual_cost,
              'percentComplete', progress,
              'status', status,
              'startDate', start_date,
              'endDate', end_date
            ) ORDER BY name ASC
          ) FILTER (WHERE id IS NOT NULL),
          '[]'
        ) as projects
      FROM user_projects
      `,
      [userId]
    );
    const summary = (rows[0] as ProjectSummary) || {
      totalProjects: 0,
      activeProjects: 0,
      completedProjects: 0,
      totalBudget: 0,
      totalActualCost: 0,
      totalVariance: 0,
      avgProgress: 0,
      projects: [],
    };
    return summary;
  },

  // -------------------------------------------------------------------------
  // UPDATED: optional managerId (2nd arg) narrows results to that manager.
  // -------------------------------------------------------------------------
  async getProjectsWithMetrics(
    portfolioId?: string,
    managerId?: string
  ): Promise<any[]> {
    console.log('[ProjectQueries.getProjectsWithMetrics]', { portfolioId, managerId });
    let query = `
      SELECT
        p.id,
        p.name,
        p.code,
        p.status,
        p.budget,
        p.actual_cost as actualCost,
        p.progress as percentComplete,
        e.planned_value as plannedValue,
        e.earned_value as earnedValue,
        e.actual_cost as evmActualCost,
        e.cpi,
        e.spi,
        e.eac,
        e.vac,
        e.etc,
        (
          SELECT COUNT(*) FROM risks WHERE project_id = p.id AND status != 'CLOSED'
        ) as openRisks
      FROM projects p
      LEFT JOIN evm_data e ON p.id = e.project_id
      WHERE p.status IN ('EXECUTING', 'MONITORING', 'PLANNING')
    `;
    const params: any[] = [];
    let idx = 1;

    if (portfolioId) {
      query += ` AND p.portfolio_id = $${idx}::uuid`;
      params.push(portfolioId);
      idx++;
    }
    if (managerId) {
      query += ` AND p.manager_id = $${idx}::uuid`;
      params.push(managerId);
      idx++;
    }

    query += ` ORDER BY p.name`;
    const rows = await executeQuery(query, params);
    console.log('[ProjectQueries.getProjectsWithMetrics] rows:', rows.length);
    return rows;
  },

  async findByManager(managerId: string): Promise<Project[]> {
    console.log('[ProjectQueries.findByManager]', { managerId });
    const rows = await executeQuery<Project>(
      `SELECT
        p.id, p.code, p.name, p.description, p.status,
        p.department_id as "departmentId",
        p.manager_id as "managerId",
        p.start_date as "startDate",
        p.end_date as "endDate",
        p.budget, p.actual_cost as "actualCost",
        p.progress as "percentComplete",
        p.baseline_id as "baselineId",
        p.created_at as "createdAt",
        p.updated_at as "updatedAt",
        u.name as "managerName"
      FROM projects p
      LEFT JOIN users u ON p.manager_id = u.id
      WHERE p.manager_id = $1
      ORDER BY p.created_at DESC`,
      [managerId]
    );
    console.log('[ProjectQueries.findByManager] rows:', rows.length);
    return rows;
  },

  async findAll(filters?: {
    status?: ProjectStatus;
    departmentId?: string;
    managerId?: string;
    search?: string;
  }): Promise<Project[]> {
    console.log('[ProjectQueries.findAll]', { filters });
    let query = `
      SELECT
        p.id, p.code, p.name, p.description, p.status,
        p.department_id as "departmentId",
        p.manager_id as "managerId",
        p.start_date as "startDate",
        p.end_date as "endDate",
        p.budget, p.actual_cost as "actualCost",
        p.progress as "percentComplete",
        p.baseline_id as "baselineId",
        p.created_at as "createdAt",
        p.updated_at as "updatedAt",
        u.name as "managerName",
        d.name as "departmentName"
      FROM projects p
      LEFT JOIN users u ON p.manager_id = u.id
      LEFT JOIN departments d ON p.department_id = d.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.status) {
      query += ` AND p.status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }
    if (filters?.departmentId) {
      query += ` AND p.department_id = $${paramIndex}`;
      params.push(filters.departmentId);
      paramIndex++;
    }
    if (filters?.managerId) {
      query += ` AND p.manager_id = $${paramIndex}`;
      params.push(filters.managerId);
      paramIndex++;
    }
    if (filters?.search) {
      query += ` AND (p.name ILIKE $${paramIndex} OR p.code ILIKE $${paramIndex})`;
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    query += ` ORDER BY p.created_at DESC`;
    const rows = await executeQuery<Project>(query, params);
    console.log('[ProjectQueries.findAll] rows:', rows.length);
    return rows;
  },

  async update(id: string, data: ProjectUpdateInput): Promise<Project> {
    console.log('[ProjectQueries.update]', { id, data });
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const fieldMap: Record<string, string> = {
      departmentId: 'department_id',
      managerId: 'manager_id',
      startDate: 'start_date',
      endDate: 'end_date',
      percentComplete: 'progress',
      actualCost: 'actual_cost',
    };

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id') {
        const dbField = fieldMap[key] || key;
        fields.push(`${dbField} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    });

    values.push(id);
    const query = `
      UPDATE projects
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING
        id, code, name, description, status,
        department_id as "departmentId",
        manager_id as "managerId",
        start_date as "startDate",
        end_date as "endDate",
        budget, actual_cost as "actualCost",
        progress as "percentComplete",
        baseline_id as "baselineId",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `;
    const rows = await executeQuery<Project>(query, values);
    console.log('[ProjectQueries.update] updated id:', rows[0]?.id);
    return rows[0];
  },

  async updateStatus(id: string, status: ProjectStatus, reason?: string): Promise<Project> {
    console.log('[ProjectQueries.updateStatus]', { id, status, reason });
    const rows = await executeQuery<Project>(
      `UPDATE projects
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING
        id, code, name, description, status,
        department_id as "departmentId",
        manager_id as "managerId",
        start_date as "startDate",
        end_date as "endDate",
        budget, actual_cost as "actualCost",
        progress as "percentComplete",
        baseline_id as "baselineId",
        created_at as "createdAt",
        updated_at as "updatedAt"`,
      [status, id]
    );
    console.log('[ProjectQueries.updateStatus] updated id:', rows[0]?.id);
    return rows[0];
  },

  async delete(id: string): Promise<void> {
    console.log('[ProjectQueries.delete]', { id });
    const tasks = await executeQuery(
      `SELECT id FROM tasks WHERE project_id = $1 LIMIT 1`,
      [id]
    );
    if (tasks.length > 0) {
      console.warn('[ProjectQueries.delete] Project has tasks, aborting deletion');
      throw new Error('Cannot delete project with associated tasks');
    }
    await executeQuery(`DELETE FROM projects WHERE id = $1`, [id]);
    console.log('[ProjectQueries.delete] Deleted project', id);
  },

  // -------------------------------------------------------------------------
  // UPDATED: optional managerId
  // -------------------------------------------------------------------------
  async getPortfolioScorecard(managerId?: string): Promise<any[]> {
    console.log('[ProjectQueries.getPortfolioScorecard]', { managerId });
    let query = `
      SELECT
        p.id,
        p.code,
        p.name,
        p.status,
        p.budget,
        p.actual_cost as "actualCost",
        p.progress as "percentComplete",
        u.name as "managerName",
        
        COUNT(DISTINCT t.id) as "taskCount",
        COUNT(DISTINCT r.id) as "riskCount",
        CASE
          WHEN p.progress < 30 THEN 'RED'
          WHEN p.progress < 70 THEN 'AMBER'
          ELSE 'GREEN'
        END as "ragStatus"
      FROM projects p
      LEFT JOIN users u ON p.manager_id = u.id
      LEFT JOIN tasks t ON p.id = t.project_id
      LEFT JOIN risks r ON p.id = r.project_id AND r.status != 'CLOSED'
    `;
    const params: any[] = [];
    if (managerId) {
      query += ` WHERE p.manager_id = $1::uuid`;
      params.push(managerId);
    }
    query += ` GROUP BY p.id, u.name ORDER BY p.created_at DESC`;
    const rows = await executeQuery(query, params);
    console.log('[ProjectQueries.getPortfolioScorecard] rows:', rows.length);
    return rows;
  },

  // -------------------------------------------------------------------------
  // UPDATED: optional managerId
  // -------------------------------------------------------------------------
  async getProjectCounts(managerId?: string): Promise<any> {
    console.log('[ProjectQueries.getProjectCounts]', { managerId });
    let query = `
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'INITIATING' THEN 1 END) as initiating,
        COUNT(CASE WHEN status = 'PLANNING' THEN 1 END) as planning,
        COUNT(CASE WHEN status = 'EXECUTING' THEN 1 END) as executing,
        COUNT(CASE WHEN status = 'MONITORING' THEN 1 END) as monitoring,
        COUNT(CASE WHEN status = 'CLOSING' THEN 1 END) as closing
      FROM projects
    `;
    const params: any[] = [];
    if (managerId) {
      query += ` WHERE manager_id = $1::uuid`;
      params.push(managerId);
    }
    const rows = await executeQuery(query, params);
    console.log('[ProjectQueries.getProjectCounts] result:', rows[0]);
    return rows[0] || {};
  },

  // -------------------------------------------------------------------------
  // UPDATED: optional managerId
  // -------------------------------------------------------------------------
  async getPortfolioHealthSummary(managerId?: string): Promise<any> {
    console.log('[ProjectQueries.getPortfolioHealthSummary]', { managerId });
    let query = `
      SELECT
        COUNT(CASE WHEN progress >= 70 THEN 1 END) as green,
        COUNT(CASE WHEN progress BETWEEN 30 AND 69 THEN 1 END) as amber,
        COUNT(CASE WHEN progress < 30 THEN 1 END) as red,
        AVG(progress) as avgCompletion
      FROM projects
      WHERE status IN ('EXECUTING', 'MONITORING')
    `;
    const params: any[] = [];
    if (managerId) {
      query += ` AND manager_id = $1::uuid`;
      params.push(managerId);
    }
    const rows = await executeQuery(query, params);
    console.log('[ProjectQueries.getPortfolioHealthSummary] result:', rows[0]);
    return rows[0] || {};
  },

  // -------------------------------------------------------------------------
  // UPDATED: optional managerId
  // -------------------------------------------------------------------------
  async findByPortfolio(portfolioId: string, managerId?: string): Promise<Project[]> {
    console.log('[ProjectQueries.findByPortfolio]', { portfolioId, managerId });
    let query = `
      SELECT
        p.id, p.code, p.name, p.description, p.status,
        p.department_id as "departmentId",
        p.manager_id as "managerId",
        p.start_date as "startDate",
        p.end_date as "endDate",
        p.budget, p.actual_cost as "actualCost",
        p.progress as "percentComplete",
        p.baseline_id as "baselineId",
        p.created_at as "createdAt",
        p.updated_at as "updatedAt",
        u.name as "managerName",
        d.name as "departmentName",
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as "taskCount",
        (SELECT COUNT(*) FROM risks WHERE project_id = p.id AND status != 'CLOSED') as "openRisks",
        (SELECT COUNT(*) FROM risks WHERE project_id = p.id) as "riskCount"
      FROM projects p
      LEFT JOIN users u ON p.manager_id = u.id
      LEFT JOIN departments d ON p.department_id = d.id
      WHERE p.portfolio_id = $1::uuid
    `;
    const params: any[] = [portfolioId];
    if (managerId) {
      query += ` AND p.manager_id = $2::uuid`;
      params.push(managerId);
    }
    query += ` ORDER BY p.created_at DESC`;
    const rows = await executeQuery<Project>(query, params);
    console.log('[ProjectQueries.findByPortfolio] rows:', rows.length);
    return rows;
  },

  async findByStatus(status: ProjectStatus): Promise<Project[]> {
    console.log('[ProjectQueries.findByStatus]', { status });
    const rows = await executeQuery<Project>(
      `SELECT
        p.id, p.code, p.name, p.description, p.status,
        p.department_id as "departmentId",
        p.manager_id as "managerId",
        p.start_date as "startDate",
        p.end_date as "endDate",
        p.budget, p.actual_cost as "actualCost",
        p.progress as "percentComplete",
        p.baseline_id as "baselineId",
        p.created_at as "createdAt",
        p.updated_at as "updatedAt",
        u.name as "managerName",
        d.name as "departmentName"
      FROM projects p
      LEFT JOIN users u ON p.manager_id = u.id
      LEFT JOIN departments d ON p.department_id = d.id
      WHERE p.status = $1
      ORDER BY p.created_at DESC`,
      [status]
    );
    console.log('[ProjectQueries.findByStatus] rows:', rows.length);
    return rows;
  },

  // -------------------------------------------------------------------------
  // UPDATED: optional managerId
  // -------------------------------------------------------------------------
  async getPortfolioSummary(portfolioId: string, managerId?: string): Promise<any> {
    console.log('[ProjectQueries.getPortfolioSummary]', { portfolioId, managerId });
    let query = `
      SELECT
        COUNT(*) as "totalProjects",
        COALESCE(SUM(budget), 0) as "totalBudget",
        COALESCE(SUM(actual_cost), 0) as "totalSpent",
        COALESCE(AVG(progress), 0) as "avgProgress",
        COUNT(CASE WHEN progress >= 70 THEN 1 END) as "onTrack",
        COUNT(CASE WHEN progress >= 30 AND progress < 70 THEN 1 END) as "atRisk",
        COUNT(CASE WHEN progress < 30 THEN 1 END) as "critical",
        COUNT(CASE WHEN status = 'INITIATING' THEN 1 END) as "initiating",
        COUNT(CASE WHEN status = 'PLANNING' THEN 1 END) as "planning",
        COUNT(CASE WHEN status = 'EXECUTING' THEN 1 END) as "executing",
        COUNT(CASE WHEN status = 'MONITORING' THEN 1 END) as "monitoring",
        COUNT(CASE WHEN status = 'CLOSING' THEN 1 END) as "closing"
      FROM projects
      WHERE portfolio_id = $1::uuid
    `;
    const params: any[] = [portfolioId];
    if (managerId) {
      query += ` AND manager_id = $2::uuid`;
      params.push(managerId);
    }
    const rows = await executeQuery(query, params);
    console.log('[ProjectQueries.getPortfolioSummary] result:', rows[0]);
    return rows[0] || {};
  },

  async updatePortfolio(projectId: string, portfolioId: string): Promise<Project> {
    console.log('[ProjectQueries.updatePortfolio]', { projectId, portfolioId });
    const rows = await executeQuery<Project>(
      `UPDATE projects
       SET portfolio_id = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING
        id, code, name, description, status,
        department_id as "departmentId",
        manager_id as "managerId",
        start_date as "startDate",
        end_date as "endDate",
        budget, actual_cost as "actualCost",
        progress as "percentComplete",
        baseline_id as "baselineId",
        created_at as "createdAt",
        updated_at as "updatedAt"`,
      [portfolioId, projectId]
    );
    console.log('[ProjectQueries.updatePortfolio] updated id:', rows[0]?.id);
    return rows[0];
  },

  // -------------------------------------------------------------------------
  // UPDATED: optional managerId
  // -------------------------------------------------------------------------
  async getPortfolioProjectsWithMetrics(
    portfolioId: string,
    managerId?: string
  ): Promise<any[]> {
    console.log('[ProjectQueries.getPortfolioProjectsWithMetrics]', {
      portfolioId,
      managerId,
    });
    let query = `
      SELECT
        p.id,
        p.name,
        p.code,
        p.status,
        p.budget,
        p.actual_cost as "actualCost",
        p.progress as "percentComplete",
        p.start_date as "startDate",
        p.manager_id as "managerId",
        p.end_date as "endDate",
        u.name as "managerName",

        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as "taskCount",
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'COMPLETED') as "completedTasks",
        (SELECT COUNT(*) FROM risks WHERE project_id = p.id AND status != 'CLOSED') as "openRisks",
        (SELECT COUNT(*) FROM risks WHERE project_id = p.id) as "totalRisks",
        CASE
          WHEN p.progress >= 70 THEN 'GREEN'
          WHEN p.progress >= 30 THEN 'AMBER'
          ELSE 'RED'
        END as "ragStatus"
      FROM projects p
      LEFT JOIN users u ON p.manager_id = u.id
      WHERE p.portfolio_id = $1::uuid
    `;
    const params: any[] = [portfolioId];
    if (managerId) {
      query += ` AND p.manager_id = $2::uuid`;
      params.push(managerId);
    }
    query += `
      ORDER BY
        CASE
          WHEN p.progress >= 70 THEN 1
          WHEN p.progress >= 30 THEN 2
          ELSE 3
        END,
        p.progress DESC
    `;
    const rows = await executeQuery(query, params);
    console.log('[ProjectQueries.getPortfolioProjectsWithMetrics] rows:', rows.length);
    return rows;
  },

  // -------------------------------------------------------------------------
  // UPDATED: optional managerId
  // -------------------------------------------------------------------------
  async getPortfolioHealth(portfolioId: string, managerId?: string): Promise<any> {
    console.log('[ProjectQueries.getPortfolioHealth]', { portfolioId, managerId });
    let query = `
      SELECT
        COUNT(*) as "totalProjects",
        COUNT(CASE WHEN progress >= 70 THEN 1 END) as "healthy",
        COUNT(CASE WHEN progress >= 30 AND progress < 70 THEN 1 END) as "atRisk",
        COUNT(CASE WHEN progress < 30 THEN 1 END) as "critical",
        AVG(progress) as "avgCompletion",
        COALESCE(SUM(budget), 0) as "totalBudget",
        COALESCE(SUM(actual_cost), 0) as "totalSpent",
        COALESCE(SUM(budget - actual_cost), 0) as "totalVariance"
      FROM projects
      WHERE portfolio_id = $1::uuid
    `;
    const params: any[] = [portfolioId];
    if (managerId) {
      query += ` AND manager_id = $2::uuid`;
      params.push(managerId);
    }
    const rows = await executeQuery(query, params);
    console.log('[ProjectQueries.getPortfolioHealth] result:', rows[0]);
    return rows[0] || {};
  },

  // -------------------------------------------------------------------------
  // UPDATED: optional managerId
  // -------------------------------------------------------------------------
  async findByDepartment(departmentId: string, managerId?: string): Promise<Project[]> {
    console.log('[ProjectQueries.findByDepartment]', { departmentId, managerId });
    let query = `
      SELECT
        p.id, p.code, p.name, p.description, p.status,
        p.department_id as "departmentId",
        p.manager_id as "managerId",
        p.start_date as "startDate",
        p.end_date as "endDate",
        p.budget, p.actual_cost as "actualCost",
        p.progress  as "percentComplete",
        p.baseline_id as "baselineId",
        p.created_at as "createdAt",
        p.updated_at as "updatedAt",
        u.name as "managerName",
        d.name as "departmentName"
      FROM projects p
      LEFT JOIN users u ON p.manager_id = u.id
      LEFT JOIN departments d ON p.department_id = d.id
      WHERE p.department_id = $1::uuid
    `;
    const params: any[] = [departmentId];
    if (managerId) {
      query += ` AND p.manager_id = $2::uuid`;
      params.push(managerId);
    }
    query += ` ORDER BY p.created_at DESC`;
    const rows = await executeQuery<Project>(query, params);
    console.log('[ProjectQueries.findByDepartment] rows:', rows.length);
    return rows;
  },

  async getProjectStats(projectId: string): Promise<any> {
    console.log('[ProjectQueries.getProjectStats]', { projectId });
    const rows = await executeQuery(
      `SELECT
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as "totalTasks",
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'COMPLETED') as "completedTasks",
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status != 'COMPLETED') as "openTasks",
        (SELECT COUNT(*) FROM risks WHERE project_id = p.id AND status != 'CLOSED') as "openRisks",
        (SELECT COUNT(*) FROM decisions WHERE project_id = p.id AND status = 'SUBMITTED') as "pendingDecisions",
        (SELECT COUNT(*) FROM documents WHERE project_id = p.id) as "totalDocuments"
      FROM projects p
      WHERE p.id = $1::uuid`,
      [projectId]
    );
    console.log('[ProjectQueries.getProjectStats] result:', rows[0]);
    return rows[0] || {};
  },
};