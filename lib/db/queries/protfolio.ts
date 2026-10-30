// lib/db/queries/portfolio.ts
import { executeQuery } from '@/lib/db';

export interface PortfolioSummary {
  totalPortfolios: number;
  totalProjects: number;
  totalBudget: number;
  totalActualCost: number;
  totalVariance: number;
  avgProgress: number;
  // Removed: avgCPI, avgSPI since they don't exist in the database
}

export interface Portfolio {
  id: string;
  name: string;
  code: string;
  description?: string;
  type: string;
  industry?: string;
  sector?: string;
  objective: string;
  strategicAlignment?: string;
  businessCase?: string;
  expectedBenefits?: any;
  investmentAmount: number;
  currency: string;
  startDate: string;
  endDate: string;
  resourceRequirements?: any;
  keyStakeholders?: any;
  sponsorName?: string;
  sponsorEmail?: string;
  governanceStructure?: string;
  reportingRequirements?: string;
  approvalProcess?: string;
  status: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export const PortfolioQueries = {
  /**
   * Get all active portfolios
   */
  async getActivePortfolios() {
    return executeQuery(
      `SELECT 
        id, 
        name, 
        code, 
        type, 
        status,
        investment_amount as "investmentAmount",
        start_date as "startDate",
        end_date as "endDate",
        created_at as "createdAt"
      FROM portfolios 
      WHERE status = 'ACTIVE'
      ORDER BY name ASC`
    );
  },

  /**
   * Get portfolios with metrics (project counts, budget, etc.)
   */
  async getPortfoliosWithMetrics(): Promise<any[]> {
    return executeQuery(
      `SELECT 
        p.*,
        u.name as "createdByName",
        (
          SELECT COUNT(*) FROM projects WHERE portfolio_id = p.id
        ) as "totalProjects",
        (
          SELECT COALESCE(SUM(budget), 0) FROM projects WHERE portfolio_id = p.id
        ) as "totalBudget",
        (
          SELECT COALESCE(SUM(actual_cost), 0) FROM projects WHERE portfolio_id = p.id
        ) as "totalActualCost"
      FROM portfolios p
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.status = 'ACTIVE'
      ORDER BY p.created_at DESC`
    );
  },

  /**
   * Get projects for a specific portfolio
   */
  async getPortfolioProjects(portfolioId: string) {
    return executeQuery(
      `SELECT 
        id, 
        name, 
        code, 
        status,
        budget, 
        progress as "percentComplete",
        start_date as "startDate",
        end_date as "endDate",
        manager_id as "managerId"
      FROM projects 
      WHERE portfolio_id = $1
      ORDER BY created_at DESC`,
      [portfolioId]
    );
  },

  /**
   * Update portfolio status
   */
  async updatePortfolioStatus(id: string, status: string) {
    const result = await executeQuery(
      `UPDATE portfolios 
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, name, status`,
      [status, id]
    );
    return result[0];
  },

  /**
   * Get portfolio summary statistics
   * Removed CPI and SPI since they don't exist in the database
   */
  async getPortfolioSummary(): Promise<PortfolioSummary> {
    const rows = await executeQuery(`
      WITH portfolio_stats AS (
        SELECT 
          COUNT(DISTINCT p.id) as total_portfolios,
          COUNT(DISTINCT pr.id) as total_projects,
          COALESCE(SUM(pr.budget), 0) as total_budget,
          COALESCE(SUM(pr.actual_cost), 0) as total_actual,
          AVG(pr.progress) as avg_progress
        FROM portfolios p
        LEFT JOIN projects pr ON pr.portfolio_id = p.id
        WHERE pr.status != 'CANCELLED' OR pr.status IS NULL
      )
      SELECT 
        COALESCE(total_portfolios, 0) as "totalPortfolios",
        COALESCE(total_projects, 0) as "totalProjects",
        COALESCE(total_budget, 0) as "totalBudget",
        COALESCE(total_actual, 0) as "totalActualCost",
        COALESCE(total_budget - total_actual, 0) as "totalVariance",
        COALESCE(avg_progress, 0) as "avgProgress"
      FROM portfolio_stats
    `);

    // Return the first row or a default object
    return (rows[0] as PortfolioSummary) || {
      totalPortfolios: 0,
      totalProjects: 0,
      totalBudget: 0,
      totalActualCost: 0,
      totalVariance: 0,
      avgProgress: 0,
    };
  },

  /**
   * Get portfolio by ID with full details
   */
  async getPortfolioById(id: string): Promise<Portfolio | null> {
    const result = await executeQuery(
      `SELECT 
        p.id,
        p.name,
        p.code,
        p.description,
        p.type,
        p.industry,
        p.sector,
        p.objective,
        p.strategic_alignment as "strategicAlignment",
        p.business_case as "businessCase",
        p.expected_benefits as "expectedBenefits",
        p.investment_amount as "investmentAmount",
        p.currency,
        p.start_date as "startDate",
        p.end_date as "endDate",
        p.resource_requirements as "resourceRequirements",
        p.key_stakeholders as "keyStakeholders",
        p.sponsor_name as "sponsorName",
        p.sponsor_email as "sponsorEmail",
        p.governance_structure as "governanceStructure",
        p.reporting_requirements as "reportingRequirements",
        p.approval_process as "approvalProcess",
        p.status,
        p.created_by as "createdBy",
        p.created_at as "createdAt",
        p.updated_at as "updatedAt",
        u.name as "createdByName",
        (
          SELECT COUNT(*) FROM projects WHERE portfolio_id = p.id
        ) as "projectCount",
        (
          SELECT COALESCE(SUM(budget), 0) FROM projects WHERE portfolio_id = p.id
        ) as "totalBudget",
        (
          SELECT COALESCE(SUM(actual_cost), 0) FROM projects WHERE portfolio_id = p.id
        ) as "totalSpent"
      FROM portfolios p
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.id = $1`,
      [id]
    );
    return (result[0] as Portfolio) || null;
  },

  /**
   * Get portfolios with performance metrics
   */
// lib/db/queries/portfolio.ts

async getPortfoliosWithPerformance(): Promise<any[]> {
    const portfolios = await executeQuery(`
      SELECT 
        p.id,
        p.name,
        p.code,
        p.type,
        p.status,
        p.investment_amount as "investmentAmount",
        p.start_date as "startDate",
        p.end_date as "endDate",
        p.created_at as "createdAt",
        p.objective,
        p.industry,
        p.sector
      FROM portfolios p
      WHERE p.status = 'ACTIVE'
      ORDER BY p.created_at DESC
    `);

    const result = await Promise.all(
      portfolios.map(async (portfolio: any) => {
        const projects = await executeQuery(
          `
          SELECT 
            pr.id,
            pr.name,
            pr.code,
            pr.status,
            pr.budget,
            pr.actual_cost as "actualCost",
            pr.progress as "percentComplete",
            pr.start_date as "startDate",
            pr.end_date as "endDate",
            pr.manager_id as "managerId",
            u.name as "managerName",
            pr.portfolio_id as "portfolioId",
            pr.department_id as "departmentId",
            -- ✅ Calculate EV from completed plans
            COALESCE(
              (SELECT COALESCE(SUM(pl.budget), 0) 
               FROM plans pl 
               WHERE pl.project_id = pr.id AND pl.status = 'COMPLETED'
              ), 0
            ) as "earnedValue",
            -- ✅ Calculate PV from all plans
            COALESCE(
              (SELECT COALESCE(SUM(pl.budget), 0) 
               FROM plans pl 
               WHERE pl.project_id = pr.id
              ), 0
            ) as "plannedValue",
            -- ✅ Calculate total budget from plans (more accurate than project budget)
            COALESCE(
              (SELECT COALESCE(SUM(pl.budget), 0) 
               FROM plans pl 
               WHERE pl.project_id = pr.id
              ), 0
            ) as "planBudget",
            -- ✅ Count total plans
            COALESCE(
              (SELECT COUNT(*) 
               FROM plans pl 
               WHERE pl.project_id = pr.id
              ), 0
            ) as "totalPlans",
            -- ✅ Count completed plans
            COALESCE(
              (SELECT COUNT(*) 
               FROM plans pl 
               WHERE pl.project_id = pr.id AND pl.status = 'COMPLETED'
              ), 0
            ) as "completedPlans",
            -- ✅ Calculate AC from actual costs
            COALESCE(
              (SELECT COALESCE(SUM(ac.amount), 0) 
               FROM actual_costs ac 
               WHERE ac.project_id = pr.id AND ac.status = 'APPROVED'
              ), 0
            ) as "actualCostFromCosts",
            COALESCE(
              (SELECT COUNT(*) FROM risks WHERE project_id = pr.id AND status != 'CLOSED'),
              0
            ) as "openRisks",
            COALESCE(
              (SELECT json_agg(r.*) FROM risks r WHERE r.project_id = pr.id AND r.status != 'CLOSED' ORDER BY r.risk_level DESC LIMIT 10),
              '[]'
            ) as "risks"
          FROM projects pr
          LEFT JOIN users u ON u.id = pr.manager_id
          WHERE pr.portfolio_id = $1 AND pr.status != 'CANCELLED'
          ORDER BY pr.created_at DESC
          `,
          [portfolio.id]
        );

        // ✅ Process projects and calculate percentComplete from plans
        const processedProjects = projects.map((p: any) => {
          const budget = parseFloat(p.budget) || 0;
          const planBudget = parseFloat(p.planBudget) || 0;
          const earnedValue = parseFloat(p.earnedValue) || 0;
          const plannedValue = parseFloat(p.plannedValue) || 0;
          const ac = parseFloat(p.actualCostFromCosts) || parseFloat(p.actualCost) || 0;
          const totalPlans = parseInt(p.totalPlans) || 0;
          const completedPlans = parseInt(p.completedPlans) || 0;
          
          // ✅ Calculate percent complete from plans (by count)
          let percentCompleteByCount = 0;
          if (totalPlans > 0) {
            percentCompleteByCount = (completedPlans / totalPlans) * 100;
          }
          
          // ✅ Calculate percent complete from budget (by value)
          let percentCompleteByBudget = 0;
          if (planBudget > 0) {
            percentCompleteByBudget = (earnedValue / planBudget) * 100;
          }
          
          // ✅ Use the database percentComplete as fallback
          const dbPercentComplete = parseFloat(p.percentComplete) || 0;
          
          // ✅ Use the best available calculation
          // Prefer budget-based calculation if plans have budgets
          let calculatedProgress = 0;
          if (planBudget > 0) {
            calculatedProgress = percentCompleteByBudget;
          } else if (totalPlans > 0) {
            calculatedProgress = percentCompleteByCount;
          } else {
            calculatedProgress = dbPercentComplete;
          }
          
          // ✅ Check if project is completed
          const isCompleted = p.status === 'COMPLETED' || calculatedProgress >= 100;
          
          // ✅ For completed projects, set to 100%
          const finalProgress = isCompleted ? 100 : Math.min(Math.max(calculatedProgress, 0), 100);
          
          // For completed projects, EV = PV = Budget
          const effectiveEV = isCompleted ? budget : earnedValue;
          const effectivePV = isCompleted ? budget : plannedValue;
          
          // ✅ Calculate EVM metrics
          const cpi = ac > 0 ? effectiveEV / ac : 1;
          const spi = effectivePV > 0 ? effectiveEV / effectivePV : 1;
          const eac = ac > 0 && effectiveEV > 0 ? budget / (effectiveEV / ac) : budget;
          const vac = ac > 0 && effectiveEV > 0 ? budget - (budget / (effectiveEV / ac)) : 0;
          
          return {
            ...p,
            percentComplete: finalProgress,
            earnedValue: effectiveEV,
            plannedValue: effectivePV,
            totalPlans,
            completedPlans,
            financials: {
              earnedValue: effectiveEV,
              plannedValue: effectivePV,
              actualCost: ac,
              cpi: cpi,
              spi: spi,
              eac: eac,
              vac: vac,
            }
          };
        });

        // ✅ Calculate portfolio totals
        const totalBudget = processedProjects.reduce((sum: number, p: any) => sum + (parseFloat(p.budget) || 0), 0);
        const totalActualCost = processedProjects.reduce((sum: number, p: any) => sum + (parseFloat(p.actualCost) || 0), 0);
        const avgProgress = processedProjects.length > 0
          ? processedProjects.reduce((sum: number, p: any) => sum + (p.percentComplete || 0), 0) / processedProjects.length
          : 0;

        return {
          ...portfolio,
          projects: processedProjects,
          totalBudget,
          totalActualCost,
          avgProgress,
          openRisks: processedProjects.reduce((sum: number, p: any) => sum + (p.openRisks || 0), 0),
        };
      })
    );

    return result;
  },

  /**
   * Create a new portfolio
   */
  async createPortfolio(data: any) {
    const result = await executeQuery(
      `INSERT INTO portfolios (
        name,
        code,
        description,
        type,
        industry,
        sector,
        objective,
        strategic_alignment,
        business_case,
        expected_benefits,
        investment_amount,
        currency,
        start_date,
        end_date,
        resource_requirements,
        key_stakeholders,
        sponsor_name,
        sponsor_email,
        governance_structure,
        reporting_requirements,
        approval_process,
        status,
        created_by,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, NOW(), NOW())
      RETURNING id, name, code, status`,
      [
        data.name,
        data.code,
        data.description || null,
        data.type,
        data.industry || null,
        data.sector || null,
        data.objective,
        data.strategicAlignment || null,
        data.businessCase || null,
        data.expectedBenefits || [],
        data.investmentAmount,
        data.currency || 'USD',
        data.startDate,
        data.endDate,
        data.resourceRequirements || [],
        data.keyStakeholders || [],
        data.sponsorName || null,
        data.sponsorEmail || null,
        data.governanceStructure || null,
        data.reportingRequirements || null,
        data.approvalProcess || null,
        data.status || 'ACTIVE',
        data.createdBy,
      ]
    );
    return result[0];
  },

  /**
   * Update a portfolio
   */
  async updatePortfolio(id: string, data: any) {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    const fields = [
      'name',
      'code',
      'description',
      'type',
      'industry',
      'sector',
      'objective',
      'strategic_alignment',
      'business_case',
      'expected_benefits',
      'investment_amount',
      'currency',
      'start_date',
      'end_date',
      'resource_requirements',
      'key_stakeholders',
      'sponsor_name',
      'sponsor_email',
      'governance_structure',
      'reporting_requirements',
      'approval_process',
      'status',
    ];

    const fieldMap: Record<string, string> = {
      strategicAlignment: 'strategic_alignment',
      businessCase: 'business_case',
      expectedBenefits: 'expected_benefits',
      investmentAmount: 'investment_amount',
      startDate: 'start_date',
      endDate: 'end_date',
      resourceRequirements: 'resource_requirements',
      keyStakeholders: 'key_stakeholders',
      sponsorName: 'sponsor_name',
      sponsorEmail: 'sponsor_email',
      governanceStructure: 'governance_structure',
      reportingRequirements: 'reporting_requirements',
      approvalProcess: 'approval_process',
    };

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null) {
        const dbField = fieldMap[key] || key;
        updates.push(`${dbField} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return null;
    }

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const result = await executeQuery(
      `UPDATE portfolios 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, name, code, status`,
      params
    );
    return result[0];
  },

  /**
   * Delete a portfolio (soft delete by setting status to INACTIVE)
   */
  async deletePortfolio(id: string) {
    const result = await executeQuery(
      `UPDATE portfolios 
       SET status = 'INACTIVE', updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, status`,
      [id]
    );
    return result[0];
  },

  /**
   * Get portfolio financial summary
   */
  async getPortfolioFinancialSummary(portfolioId: string) {
    const result = await executeQuery(
      `SELECT 
        p.id,
        p.name,
        p.investment_amount as "investmentAmount",
        COALESCE(SUM(pr.budget), 0) as "totalBudget",
        COALESCE(SUM(pr.actual_cost), 0) as "totalActualCost",
        COALESCE(SUM(pr.budget) - SUM(pr.actual_cost), 0) as "totalVariance",
        COALESCE(AVG(pr.progress), 0) as "avgProgress",
        COUNT(DISTINCT pr.id) as "totalProjects"
      FROM portfolios p
      LEFT JOIN projects pr ON pr.portfolio_id = p.id
      WHERE p.id = $1
      GROUP BY p.id, p.name, p.investment_amount`,
      [portfolioId]
    );
    return result[0] || null;
  }
};