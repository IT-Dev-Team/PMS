// lib/db/queries/financial.ts
import { executeQuery } from '@/lib/db';

// ---------- Logging wrapper ----------
async function executeQueryWithLog(sql: string, params: any[] = []) {
  console.log('[SQL]', sql);
  console.log('[PARAMS]', JSON.stringify(params));
  try {
    return await executeQuery(sql, params);
  } catch (error: any) {
    console.error('[SQL ERROR]', error.message);
    throw error;
  }
}
// -------------------------------------

// ---------- UUID helpers ----------
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);

const EMPTY_PROJECT_FINANCIAL_SUMMARY = {
  budget: 0,
  actualCost: 0,
  percentComplete: 0,
  variance: 0,
  totalCosts: 0,
  pendingCosts: 0,
  approvedCosts: 0,
  rejectedCosts: 0,
  plannedValue: 0,
  earnedValue: 0,
  cpi: 1,
  spi: 1,
  eac: 0,
  vac: 0,
  totalPlans: 0,
  completedPlans: 0,
} as const;

const EMPTY_PROJECT_EVM_SUMMARY = {
  earnedValue: 0,
  plannedValue: 0,
  actualCost: 0,
  cpi: 1,
  spi: 1,
  eac: 0,
  vac: 0,
  percentComplete: 0,
} as const;
// -------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PortfolioFinancial {
  id: string;
  name: string;
  code: string;
  totalBudget: number;
  totalActualCost: number;
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalVariance: number;
  investmentAmount: number;
  percentComplete: number;
  cpi: number;
  spi: number;
  eac: number;
  vac: number;
}

export interface ProjectFinancial {
  id: string;
  name: string;
  code: string;
  portfolioId: string;
  portfolioName?: string;
  budget: number;
  actualCost: number;
  variance: number;
  percentComplete: number;
  status: string;
  cpi: number;
  spi: number;
  eac: number;
  startDate: string;
  endDate: string;
  managerName?: string;
}

export interface ActualCost {
  id: string;
  projectId: string;
  projectName?: string;
  planId: string | null;
  planName?: string;
  amount: number;
  period: string;
  costType: string;
  description: string | null;
  vendorId: string | null;
  vendorName?: string;
  invoiceNumber: string | null;
  poNumber: string | null;
  status: string;
  currency: string;
  exchangeRate: number;
  referenceNumber: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Vendor {
  id: string;
  name: string;
  code: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  rating: number | null;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

export interface PortfolioSummary {
  totalPortfolios: number;
  totalProjects: number;
  totalBudget: number;
  totalActualCost: number;
  totalVariance: number;
  avgProgress: number;
}

// ---------------------------------------------------------------------------
// Financial Queries Class
// ---------------------------------------------------------------------------

export class FinancialQueries {
  /**
   * Get financial data for all portfolios with EVM calculated from plans and actual costs
   * percentComplete is calculated from completed plans
   */
  static async getPortfolioFinancials(): Promise<PortfolioFinancial[]> {
    const rows = await executeQueryWithLog(`
      WITH portfolio_metrics AS (
        SELECT 
          p.id,
          p.name,
          p.code,
          p.investment_amount as investment_amount,
          COALESCE(SUM(pr.budget), 0) as total_budget,
          COALESCE(SUM(pr.actual_cost), 0) as total_actual,
          COUNT(DISTINCT pr.id) as total_projects,
          COUNT(DISTINCT CASE WHEN pr.status IN ('EXECUTING', 'MONITORING', 'PLANNING', 'INITIATING') THEN pr.id END) as active_projects,
          COUNT(DISTINCT CASE WHEN pr.status = 'COMPLETED' THEN pr.id END) as completed_projects,
          -- Calculate percent complete from plans
          COALESCE(
            CASE 
              WHEN (SELECT COALESCE(SUM(pl.budget), 0) FROM plans pl WHERE pl.project_id = pr.id) > 0 
              THEN (SELECT COALESCE(SUM(pl.budget), 0) FROM plans pl WHERE pl.project_id = pr.id AND pl.status = 'COMPLETED') * 100.0 / 
                   (SELECT COALESCE(SUM(pl.budget), 0) FROM plans pl WHERE pl.project_id = pr.id)
              WHEN (SELECT COUNT(*) FROM plans pl WHERE pl.project_id = pr.id) > 0
              THEN (SELECT COUNT(*) FROM plans pl WHERE pl.project_id = pr.id AND pl.status = 'COMPLETED') * 100.0 / 
                   (SELECT COUNT(*) FROM plans pl WHERE pl.project_id = pr.id)
              ELSE pr.progress
            END, 0
          ) as avg_progress,
          -- Calculate EV from plans: sum of budgets for COMPLETED plans
          COALESCE(
            (SELECT COALESCE(SUM(pl.budget), 0) 
             FROM plans pl 
             WHERE pl.project_id = pr.id AND pl.status = 'COMPLETED' and pl.plan_type IN ('TASK')
            ), 0
          ) as earned_value,
          -- Calculate PV from plans: sum of all plan budgets
          COALESCE(
            (SELECT COALESCE(SUM(pl.budget), 0) 
             FROM plans pl 
             WHERE pl.project_id = pr.id and pl.plan_type IN ('TASK')
            ), 0
          ) as planned_value
        FROM portfolios p
        LEFT JOIN projects pr ON pr.portfolio_id = p.id
        WHERE p.status = 'ACTIVE'
        GROUP BY p.id, p.name, p.code, p.investment_amount, pr.id
      ),
      aggregated_metrics AS (
        SELECT 
          id,
          name,
          code,
          investment_amount,
          SUM(total_budget) as total_budget,
          SUM(total_actual) as total_actual,
          SUM(total_projects) as total_projects,
          SUM(active_projects) as active_projects,
          SUM(completed_projects) as completed_projects,
          AVG(avg_progress) as avg_progress,
          SUM(earned_value) as earned_value,
          SUM(planned_value) as planned_value
        FROM portfolio_metrics
        GROUP BY id, name, code, investment_amount
      )
      SELECT 
        id,
        name,
        code,
        investment_amount as "investmentAmount",
        total_budget as "totalBudget",
        total_actual as "totalActualCost",
        total_projects as "totalProjects",
        active_projects as "activeProjects",
        completed_projects as "completedProjects",
        total_budget - total_actual as "totalVariance",
        COALESCE(avg_progress, 0) as "percentComplete",
        CASE 
          WHEN total_actual > 0 THEN earned_value / total_actual
          ELSE 1
        END as cpi,
        CASE 
          WHEN planned_value > 0 THEN earned_value / planned_value
          ELSE 1
        END as spi,
        CASE 
          WHEN total_actual > 0 AND earned_value > 0 THEN total_budget / (earned_value / total_actual)
          ELSE total_budget
        END as eac,
        CASE 
          WHEN total_actual > 0 AND earned_value > 0 THEN total_budget - (total_budget / (earned_value / total_actual))
          ELSE 0
        END as vac
      FROM aggregated_metrics
      ORDER BY name ASC
    `);

    return rows as PortfolioFinancial[];
  }

  /**
   * Get financial data for all projects with EVM from plans and actual costs
   * percentComplete is calculated from completed plans
   */
  static async getProjectFinancials(projectId?: string): Promise<ProjectFinancial[]> {
    const hasId = isUuid(projectId);
    const whereClause = hasId
      ? `WHERE p.status != 'CANCELLED' AND p.id::text = $1::text`
      : `WHERE p.status != 'CANCELLED'`;
    const queryParams = hasId ? [projectId] : [];

    const rows = await executeQueryWithLog(`
      SELECT 
        p.id,
        p.name,
        p.code,
        p.portfolio_id as "portfolioId",
        pf.name as "portfolioName",
        COALESCE(p.budget, 0) as budget,
        COALESCE(p.actual_cost, 0) as "actualCost",
        COALESCE(p.budget, 0) - COALESCE(p.actual_cost, 0) as variance,
        p.status,
        p.start_date as "startDate",
        p.end_date as "endDate",
        u.name as "managerName",
        -- Calculate EV from plans (sum of budgets for COMPLETED plans)
        COALESCE(
          (SELECT COALESCE(SUM(pl.budget), 0) 
           FROM plans pl 
           WHERE pl.project_id = p.id AND pl.status = 'COMPLETED'
          ), 0
        ) as earned_value,
        -- Calculate PV from plans (sum of all plan budgets)
        COALESCE(
          (SELECT COALESCE(SUM(pl.budget), 0) 
           FROM plans pl 
           WHERE pl.project_id = p.id
          ), 0
        ) as planned_value,
        -- Calculate AC from actual costs
        COALESCE(
          (SELECT COALESCE(SUM(ac.amount), 0) 
           FROM actual_costs ac 
           WHERE ac.project_id = p.id AND ac.status = 'APPROVED'
          ), 0
        ) as actual_cost_from_costs,
        -- Count total plans
        COALESCE(
          (SELECT COUNT(*) 
           FROM plans pl 
           WHERE pl.project_id = p.id
          ), 0
        ) as total_plans,
        -- Count completed plans
        COALESCE(
          (SELECT COUNT(*) 
           FROM plans pl 
           WHERE pl.project_id = p.id AND pl.status = 'COMPLETED'
          ), 0
        ) as completed_plans,
        -- Total plan budget
        COALESCE(
          (SELECT COALESCE(SUM(pl.budget), 0) 
           FROM plans pl 
           WHERE pl.project_id = p.id
          ), 0
        ) as total_plan_budget,
        -- Database percent complete as fallback
        COALESCE(p.progress, 0) as db_progress
      FROM projects p
      LEFT JOIN portfolios pf ON pf.id = p.portfolio_id
      LEFT JOIN users u ON u.id = p.manager_id
      ${whereClause}
      ORDER BY p.name ASC
    `, queryParams);

    // Calculate EVM metrics for each project
    return rows.map((row: any) => {
      const ev = row.earned_value || 0;
      const pv = row.planned_value || 0;
      const ac = row.actual_cost_from_costs || row.actualCost || 0;
      const totalPlans = parseInt(row.total_plans) || 0;
      const completedPlans = parseInt(row.completed_plans) || 0;
      const totalPlanBudget = parseFloat(row.total_plan_budget) || 0;

      // Calculate percent complete from plans
      let percentComplete = 0;
      if (totalPlanBudget > 0) {
        // By budget (preferred)
        percentComplete = (ev / totalPlanBudget) * 100;
      } else if (totalPlans > 0) {
        // By count (fallback)
        percentComplete = (completedPlans / totalPlans) * 100;
      } else {
        // Database value (last resort)
        percentComplete = parseFloat(row.db_progress) || 0;
      }

      const isCompleted = row.status === 'COMPLETED' || percentComplete >= 100;
      const finalPercentComplete = isCompleted ? 100 : Math.min(Math.max(percentComplete, 0), 100);

      return {
        id: row.id,
        name: row.name,
        code: row.code,
        portfolioId: row.portfolioId,
        portfolioName: row.portfolioName,
        budget: row.budget,
        actualCost: row.actualCost,
        variance: row.variance,
        percentComplete: finalPercentComplete,
        status: row.status,
        startDate: row.startDate,
        endDate: row.endDate,
        managerName: row.managerName,
        cpi: ac > 0 ? ev / ac : 1,
        spi: pv > 0 ? ev / pv : 1,
        eac: ac > 0 && ev > 0 ? row.budget / (ev / ac) : row.budget,
      };
    });
  }

  /**
   * Get financial summary for a single project with complete EVM data
   * percentComplete is calculated from completed plans
   */
  static async getProjectFinancialSummary(projectId: string): Promise<{
    budget: number;
    actualCost: number;
    percentComplete: number;
    variance: number;
    totalCosts: number;
    pendingCosts: number;
    approvedCosts: number;
    rejectedCosts: number;
    plannedValue: number;
    earnedValue: number;
    cpi: number;
    spi: number;
    eac: number;
    vac: number;
    totalPlans: number;
    completedPlans: number;
  }> {
    if (!isUuid(projectId)) return { ...EMPTY_PROJECT_FINANCIAL_SUMMARY };

    const rows = await executeQueryWithLog(`
    SELECT
      COALESCE(p.budget, 0) as budget,
      COALESCE(p.actual_cost, 0) as "actualCost",
      COALESCE(p.progress, 0) as "dbPercentComplete",
      COALESCE(p.budget, 0) - COALESCE(p.actual_cost, 0) as variance,
      COALESCE((SELECT SUM(amount) FROM actual_costs
                WHERE project_id::text = p.id::text), 0) as "totalCosts",
      COALESCE((SELECT SUM(amount) FROM actual_costs
                WHERE project_id::text = p.id::text AND status = 'PENDING'), 0) as "pendingCosts",
      COALESCE((SELECT SUM(amount) FROM actual_costs
                WHERE project_id::text = p.id::text AND status = 'APPROVED'), 0) as "approvedCosts",
      COALESCE((SELECT SUM(amount) FROM actual_costs
                WHERE project_id::text = p.id::text AND status = 'REJECTED'), 0) as "rejectedCosts",
      COALESCE((SELECT COALESCE(SUM(pl.budget), 0) FROM plans pl
                WHERE pl.project_id::text = p.id::text), 0) as "plannedValue",
      COALESCE((SELECT COALESCE(SUM(pl.budget), 0) FROM plans pl
                WHERE pl.project_id::text = p.id::text AND pl.status = 'COMPLETED'), 0) as "earnedValue",
      COALESCE((SELECT COUNT(*) FROM plans pl
                WHERE pl.project_id::text = p.id::text), 0) as "totalPlans",
      COALESCE((SELECT COUNT(*) FROM plans pl
                WHERE pl.project_id::text = p.id::text AND pl.status = 'COMPLETED'), 0) as "completedPlans",
      COALESCE((SELECT COALESCE(SUM(pl.budget), 0) FROM plans pl
                WHERE pl.project_id::text = p.id::text), 0) as "totalPlanBudget"
    FROM projects p
    WHERE p.id::text = $1::text
    `, [projectId]);

    const row = rows[0] || {
      budget: 0,
      actualCost: 0,
      dbPercentComplete: 0,
      variance: 0,
      totalCosts: 0,
      pendingCosts: 0,
      approvedCosts: 0,
      rejectedCosts: 0,
      plannedValue: 0,
      earnedValue: 0,
      totalPlans: 0,
      completedPlans: 0,
      totalPlanBudget: 0,
    };

    // Calculate percent complete from plans
    let percentComplete = 0;
    if (row.totalPlanBudget > 0) {
      // By budget (preferred)
      percentComplete = (row.earnedValue / row.totalPlanBudget) * 100;
    } else if (row.totalPlans > 0) {
      // By count (fallback)
      percentComplete = (row.completedPlans / row.totalPlans) * 100;
    } else {
      // Database value (last resort)
      percentComplete = row.dbPercentComplete;
    }

    const isCompleted = percentComplete >= 100;
    const finalPercentComplete = isCompleted ? 100 : Math.min(Math.max(percentComplete, 0), 100);

    // Calculate EVM metrics
    const ev = row.earnedValue || 0;
    const pv = row.plannedValue || 0;
    const ac = row.actualCost || 0;
    const budget = row.budget || 0;

    // For completed projects, EV = PV = Budget
    const effectiveEV = isCompleted ? budget : ev;
    const effectivePV = isCompleted ? budget : pv;

    return {
      budget: row.budget,
      actualCost: row.actualCost,
      percentComplete: finalPercentComplete,
      variance: row.variance,
      totalCosts: row.totalCosts,
      pendingCosts: row.pendingCosts,
      approvedCosts: row.approvedCosts,
      rejectedCosts: row.rejectedCosts,
      plannedValue: effectivePV,
      earnedValue: effectiveEV,
      cpi: ac > 0 ? effectiveEV / ac : 1,
      spi: effectivePV > 0 ? effectiveEV / effectivePV : 1,
      eac: ac > 0 && effectiveEV > 0 ? budget / (effectiveEV / ac) : budget,
      vac: ac > 0 && effectiveEV > 0 ? budget - (budget / (effectiveEV / ac)) : 0,
      totalPlans: row.totalPlans,
      completedPlans: row.completedPlans,
    };
  }

  /**
   * Get actual costs for a project - returns array directly
   */
  static async getActualCosts(
    projectId: string,
    options?: {
      status?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<ActualCost[]> {
    const result = await this.getProjectCosts(projectId, options);
    return result.costs;
  }

  /**
   * Get EVM summary for a specific project
   */
  static async getProjectEVMSummary(projectId: string): Promise<{
    earnedValue: number;
    plannedValue: number;
    actualCost: number;
    cpi: number;
    spi: number;
    eac: number;
    vac: number;
    percentComplete: number;
  }> {
    if (!isUuid(projectId)) return { ...EMPTY_PROJECT_EVM_SUMMARY };

    const rows = await executeQueryWithLog(`
      SELECT 
        COALESCE(p.budget, 0) as budget,
        COALESCE(p.actual_cost, 0) as actual_cost,
        COALESCE(p.progress, 0) as progress,
        -- EV: Sum of budgets for COMPLETED plans
        COALESCE(
          (SELECT COALESCE(SUM(pl.budget), 0) 
           FROM plans pl 
           WHERE pl.project_id = p.id AND pl.status = 'COMPLETED' AND pl.plan_type IN ('TASK')
          ), 0
        ) as earned_value,
        -- PV: Sum of all plan budgets
        COALESCE(
          (SELECT COALESCE(SUM(pl.budget), 0) 
           FROM plans pl 
           WHERE pl.project_id = p.id AND pl.plan_type IN ('TASK')
          ), 0
        ) as planned_value,
        -- AC: Sum of actual costs
        COALESCE(
          (SELECT COALESCE(SUM(ac.amount), 0) 
           FROM actual_costs ac 
           WHERE ac.project_id = p.id
          ), 0
        ) as actual_cost_from_costs
      FROM projects p
      WHERE p.id = $1
    `, [projectId]);

    const row = rows[0] || {
      budget: 0,
      actual_cost: 0,
      progress: 0,
      earned_value: 0,
      planned_value: 0,
      actual_cost_from_costs: 0,
    };

    const ev = row.earned_value || 0;
    const pv = row.planned_value || 0;
    const ac = row.actual_cost_from_costs || row.actual_cost || 0;
    const budget = row.budget || 0;

    return {
      earnedValue: ev,
      plannedValue: pv,
      actualCost: ac,
      cpi: ac > 0 ? ev / ac : 1,
      spi: pv > 0 ? ev / pv : 1,
      eac: ac > 0 && ev > 0 ? budget / (ev / ac) : budget,
      vac: ac > 0 && ev > 0 ? budget - (budget / (ev / ac)) : 0,
      percentComplete: row.progress || 0,
    };
  }

  /**
   * Get EVM metrics for all projects in a portfolio
   */
  static async getPortfolioEVM(portfolioId: string): Promise<{
    totalEV: number;
    totalPV: number;
    totalAC: number;
    cpi: number;
    spi: number;
    projects: any[];
  }> {
    if (!isUuid(portfolioId)) {
      return { totalEV: 0, totalPV: 0, totalAC: 0, cpi: 1, spi: 1, projects: [] };
    }

    const projects = await executeQueryWithLog(`
      SELECT 
        p.id,
        p.name,
        p.code,
        p.budget,
        -- EV per project
        COALESCE(
          (SELECT COALESCE(SUM(pl.budget), 0) 
           FROM plans pl 
           WHERE pl.project_id = p.id AND pl.status = 'COMPLETED' AND pl.plan_type IN ('TASK')
          ), 0
        ) as earned_value,
        -- PV per project
        COALESCE(
          (SELECT COALESCE(SUM(pl.budget), 0) 
           FROM plans pl 
           WHERE pl.project_id = p.id AND pl.plan_type IN ('TASK')
          ), 0
        ) as planned_value,
        -- AC per project
        COALESCE(
          (SELECT COALESCE(SUM(ac.amount), 0) 
           FROM actual_costs ac 
           WHERE ac.project_id = p.id 
          ), 0
        ) as actual_cost
      FROM projects p
      WHERE p.portfolio_id = $1 AND p.status != 'CANCELLED'
    `, [portfolioId]);

    let totalEV = 0;
    let totalPV = 0;
    let totalAC = 0;

    const projectMetrics = projects.map((p: any) => {
      const ev = p.earned_value || 0;
      const pv = p.planned_value || 0;
      const ac = p.actual_cost || 0;

      totalEV += ev;
      totalPV += pv;
      totalAC += ac;

      return {
        id: p.id,
        name: p.name,
        code: p.code,
        budget: p.budget || 0,
        earnedValue: ev,
        plannedValue: pv,
        actualCost: ac,
        cpi: ac > 0 ? ev / ac : 1,
        spi: pv > 0 ? ev / pv : 1,
      };
    });

    return {
      totalEV,
      totalPV,
      totalAC,
      cpi: totalAC > 0 ? totalEV / totalAC : 1,
      spi: totalPV > 0 ? totalEV / totalPV : 1,
      projects: projectMetrics,
    };
  }

  /**
   * Get recent costs with project and plan names
   */
  static async getRecentCosts(limit: number = 50): Promise<ActualCost[]> {
    const rows = await executeQueryWithLog(
      `
      SELECT 
        ac.id,
        ac.project_id as "projectId",
        p.name as "projectName",
        ac.plan_id as "planId",
        pl.title as "planName",
        ac.amount,
        ac.period,
        ac.cost_type as "costType",
        ac.description,
        ac.vendor_id as "vendorId",
        v.name as "vendorName",
        ac.invoice_number as "invoiceNumber",
        ac.po_number as "poNumber",
        ac.status,
        ac.currency,
        ac.exchange_rate as "exchangeRate",
        ac.reference_number as "referenceNumber",
        ac.approved_by as "approvedBy",
        ac.approved_at as "approvedAt",
        ac.created_at as "createdAt",
        ac.updated_at as "updatedAt"
      FROM actual_costs ac
      LEFT JOIN projects p ON p.id = ac.project_id
      LEFT JOIN plans pl ON pl.id = ac.plan_id
      LEFT JOIN vendors v ON v.id = ac.vendor_id
      WHERE ac.status != 'REJECTED'
      ORDER BY ac.period DESC, ac.created_at DESC
      LIMIT $1
      `,
      [limit]
    );

    return rows;
  }

  /**
   * Get costs for a specific project
   */
  static async getProjectCosts(
    projectId: string,
    options?: {
      status?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ costs: ActualCost[]; total: number }> {
    if (!isUuid(projectId)) return { costs: [], total: 0 };

    let query = `
      SELECT 
        ac.id,
        ac.project_id as "projectId",
        p.name as "projectName",
        ac.plan_id as "planId",
        pl.title as "planName",
        ac.amount,
        ac.period,
        ac.cost_type as "costType",
        ac.description,
        ac.vendor_id as "vendorId",
        v.name as "vendorName",
        ac.invoice_number as "invoiceNumber",
        ac.po_number as "poNumber",
        ac.status,
        ac.currency,
        ac.exchange_rate as "exchangeRate",
        ac.reference_number as "referenceNumber",
        ac.approved_by as "approvedBy",
        ac.approved_at as "approvedAt",
        ac.created_at as "createdAt",
        ac.updated_at as "updatedAt"
      FROM actual_costs ac
      LEFT JOIN projects p ON p.id = ac.project_id
      LEFT JOIN plans pl ON pl.id = ac.plan_id
      LEFT JOIN vendors v ON v.id = ac.vendor_id
      WHERE ac.project_id = $1
    `;

    const params: any[] = [projectId];
    let paramIndex = 2;

    if (options?.status) {
      query += ` AND ac.status = $${paramIndex}`;
      params.push(options.status);
      paramIndex++;
    }

    if (options?.startDate) {
      query += ` AND ac.period >= $${paramIndex}`;
      params.push(options.startDate);
      paramIndex++;
    }

    if (options?.endDate) {
      query += ` AND ac.period <= $${paramIndex}`;
      params.push(options.endDate);
      paramIndex++;
    }

    query += ` ORDER BY ac.period DESC, ac.created_at DESC`;

    if (options?.limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(options.limit);
      paramIndex++;
    }

    if (options?.offset) {
      query += ` OFFSET $${paramIndex}`;
      params.push(options.offset);
      paramIndex++;
    }

    const costs = await executeQueryWithLog(query, params);

    // Get total count
    const countParams: any[] = [projectId];
    let countParamIndex = 2;
    let countQuery = `SELECT COUNT(*) as total FROM actual_costs WHERE project_id = $1`;

    if (options?.status) {
      countQuery += ` AND status = $${countParamIndex}`;
      countParams.push(options.status);
      countParamIndex++;
    }

    if (options?.startDate) {
      countQuery += ` AND period >= $${countParamIndex}`;
      countParams.push(options.startDate);
      countParamIndex++;
    }

    if (options?.endDate) {
      countQuery += ` AND period <= $${countParamIndex}`;
      countParams.push(options.endDate);
      countParamIndex++;
    }

    const countResult = await executeQueryWithLog(countQuery, countParams);

    return {
      costs,
      total: parseInt(countResult[0]?.total || '0'),
    };
  }

  /**
   * Get vendor methods
   */
  static async getVendors(options?: {
    search?: string;
    status?: 'ACTIVE' | 'INACTIVE' | 'ALL';
    rating?: number;
  }): Promise<Vendor[]> {
    let query = `
      SELECT 
        id, 
        name, 
        code, 
        contact_name as "contactName", 
        email, 
        phone, 
        rating, 
        status,
        created_at as "createdAt", 
        updated_at as "updatedAt"
      FROM vendors
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (options?.status && options.status !== 'ALL') {
      query += ` AND status = $${paramIndex}`;
      params.push(options.status);
      paramIndex++;
    }

    if (options?.rating !== undefined && options.rating > 0) {
      query += ` AND rating >= $${paramIndex}`;
      params.push(options.rating);
      paramIndex++;
    }

    if (options?.search) {
      query += ` AND (
        name ILIKE $${paramIndex} OR 
        code ILIKE $${paramIndex} OR 
        contact_name ILIKE $${paramIndex}
      )`;
      params.push(`%${options.search}%`);
      paramIndex++;
    }

    query += ` ORDER BY name ASC`;

    const rows = await executeQueryWithLog(query, params);
    return rows;
  }

  /**
   * Get a single vendor by ID
   */
  static async getVendorById(id: string): Promise<Vendor | null> {
    if (!isUuid(id)) return null;

    const rows = await executeQueryWithLog(
      `SELECT 
        id, 
        name, 
        code, 
        contact_name as "contactName", 
        email, 
        phone, 
        rating, 
        status,
        created_at as "createdAt", 
        updated_at as "updatedAt"
      FROM vendors
      WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  }

  /**
   * Create a vendor
   */
  static async createVendor(data: {
    name: string;
    code: string;
    contactName?: string | null;
    email?: string | null;
    phone?: string | null;
    rating?: number | null;
  }): Promise<Vendor> {
    const rows = await executeQueryWithLog(
      `INSERT INTO vendors (name, code, contact_name, email, phone, rating, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE')
       RETURNING 
        id, 
        name, 
        code, 
        contact_name as "contactName", 
        email, 
        phone, 
        rating, 
        status, 
        created_at as "createdAt", 
        updated_at as "updatedAt"`,
      [
        data.name,
        data.code,
        data.contactName || null,
        data.email || null,
        data.phone || null,
        data.rating || null,
      ]
    );
    return rows[0];
  }

  /**
   * Update a vendor
   */
  static async updateVendor(
    id: string,
    data: Partial<{
      name: string;
      code: string;
      contactName: string;
      email: string;
      phone: string;
      rating: number;
      status: 'ACTIVE' | 'INACTIVE';
    }>
  ): Promise<Vendor | null> {
    if (!isUuid(id)) return null;

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      params.push(data.name);
      paramIndex++;
    }
    if (data.code !== undefined) {
      updates.push(`code = $${paramIndex}`);
      params.push(data.code);
      paramIndex++;
    }
    if (data.contactName !== undefined) {
      updates.push(`contact_name = $${paramIndex}`);
      params.push(data.contactName);
      paramIndex++;
    }
    if (data.email !== undefined) {
      updates.push(`email = $${paramIndex}`);
      params.push(data.email);
      paramIndex++;
    }
    if (data.phone !== undefined) {
      updates.push(`phone = $${paramIndex}`);
      params.push(data.phone);
      paramIndex++;
    }
    if (data.rating !== undefined) {
      updates.push(`rating = $${paramIndex}`);
      params.push(data.rating);
      paramIndex++;
    }
    if (data.status !== undefined) {
      updates.push(`status = $${paramIndex}`);
      params.push(data.status);
      paramIndex++;
    }

    if (updates.length === 0) {
      return null;
    }

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const rows = await executeQueryWithLog(
      `UPDATE vendors 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING 
        id, 
        name, 
        code, 
        contact_name as "contactName", 
        email, 
        phone, 
        rating, 
        status,
        created_at as "createdAt", 
        updated_at as "updatedAt"`,
      params
    );
    return rows[0] || null;
  }

  static async getProjectCashFlow(projectId: string): Promise<{ period: string; total: number }[]> {
    if (!isUuid(projectId)) return [];

    const rows = await executeQueryWithLog(
      `SELECT 
         DATE_TRUNC('month', period) as period,
         SUM(amount) as total
       FROM actual_costs
       WHERE project_id = $1 AND status = 'APPROVED'
       GROUP BY DATE_TRUNC('month', period)
       ORDER BY period ASC`,
      [projectId]
    );

    return rows as { period: string; total: number }[];
  }

  static async getEVMData(projectId: string): Promise<any> {
    return this.getProjectEVMSummary(projectId);
  }

  static async createEVMData(data: {
    projectId: string;
    plannedValue?: number;
    earnedValue?: number;
    actualCost?: number;
    pv?: number;
    ev?: number;
    ac?: number;
    cpi?: number;
    spi?: number;
    period?: Date | string;
  }): Promise<any> {
    if (!isUuid(data.projectId)) {
      throw new Error('createEVMData: a valid projectId (UUID) is required');
    }

    const pv = data.plannedValue ?? data.pv ?? 0;
    const ev = data.earnedValue ?? data.ev ?? 0;
    const ac = data.actualCost ?? data.ac ?? 0;
    const period = data.period || new Date();
    const rows = await executeQueryWithLog(
      `INSERT INTO evm_data (project_id, planned_value, earned_value, actual_cost, period, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [data.projectId, pv, ev, ac, period]
    );
    return rows[0];
  }

  static async getBudgetLineItems(projectId: string): Promise<any[]> {
    if (!isUuid(projectId)) return [];

    return executeQueryWithLog(
      `SELECT 
        id, project_id as "projectId", category, planned_amount as "plannedAmount",
        actual_amount as "actualAmount", remaining_amount as "remainingAmount",
        status, created_at as "createdAt", updated_at as "updatedAt"
       FROM budget_line_items
       WHERE project_id = $1::uuid
       ORDER BY category ASC`,
      [projectId]
    );
  }

  static async getFinancialEntries(projectId: string, limit: number = 50): Promise<any[]> {
    if (!isUuid(projectId)) return [];

    return executeQueryWithLog(
      `SELECT 
        id, project_id as "projectId", amount, cost_type as "costType",
        period, description, status, vendor_id as "vendorId",
        created_at as "createdAt"
       FROM actual_costs
       WHERE project_id = $1::uuid
       ORDER BY period DESC
       LIMIT $2`,
      [projectId, limit]
    );
  }

  static async getEVMHistory(projectId: string, limit: number = 12): Promise<any[]> {
    if (!isUuid(projectId)) return [];

    const rows = await executeQueryWithLog(
      `SELECT 
        id, project_id as "projectId",
        planned_value as "plannedValue",
        earned_value as "earnedValue",
        actual_cost as "actualCost",
        period, created_at as "createdAt"
       FROM evm_data
       WHERE project_id = $1::uuid
       ORDER BY period ASC
       LIMIT $2`,
      [projectId, limit]
    );
    if (rows && rows.length > 0) return rows;
    return this.getProjectCashFlow(projectId);
  }

  static async getBudgetVariance(projectId: string): Promise<any> {
    const summary = await this.getProjectFinancialSummary(projectId);
    return {
      budget: summary.budget,
      actualCost: summary.actualCost,
      variance: summary.variance,
      percentComplete: summary.percentComplete,
    };
  }

  static async getEarnedValueMetrics(projectId: string): Promise<any> {
    return this.getProjectEVMSummary(projectId);
  }

  static async getCostBreakdown(projectId: string): Promise<any[]> {
    if (!isUuid(projectId)) return [];

    const rows = await executeQueryWithLog(
      `SELECT 
        cost_type as "category",
        COALESCE(SUM(amount), 0) as "amount",
        COUNT(*) as "count"
       FROM actual_costs
       WHERE project_id = $1::uuid AND status = 'APPROVED'
       GROUP BY cost_type
       ORDER BY "amount" DESC`,
      [projectId]
    );
    return rows;
  }

  /**
   * Delete a vendor (soft delete)
   */
  static async deleteVendor(id: string): Promise<boolean> {
    if (!isUuid(id)) return false;

    const result = await executeQueryWithLog(
      `UPDATE vendors 
       SET status = 'INACTIVE', updated_at = NOW()
       WHERE id = $1
       RETURNING id`,
      [id]
    );
    return result.length > 0;
  }
}