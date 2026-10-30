// lib/db/queries/ceo.ts
import { executeQuery } from '@/lib/db';

// ============ Types ============
export interface PortfolioKPIs {
  totalValue: number;
  activeProjects: number;
  onTrackProjects: number;
  atRiskProjects: number;
  criticalProjects: number;
  openRisks: number;
  pendingApprovals: number;
  openTasks: number;
}

export interface PendingApproval {
  id: string;
  title: string;
  description: string | null;
  amount: number | null;
  priority: string;
  status: string;
  created_at: string;
  justification: string | null;
  projectName: string | null;
  requesterName: string | null;
}

export interface RiskBreakdown {
  critical: number;
  high: number;
  medium: number;
  low: number;
  totalRisks: number;
  totalExposure: number;
}

export interface TopProject {
  id: string;
  name: string;
  budget: number;
  percentComplete: number;
  managerName: string | null;
  status: string;
}

export interface ProjectHealth {
  total: number;
  healthy: number;
  atRisk: number;
  critical: number;
  avgCompletion: number;
}

export interface BudgetUtilization {
  total: number;
  used: number;
  remaining: number;
}

export interface PortfolioTrend {
  month: string;
  projects: number;
  budget: number;
  avgCompletion: number;
}

export interface ExecutiveSummary {
  kpis: PortfolioKPIs;
  health: ProjectHealth;
  budget: BudgetUtilization;
  risks: RiskBreakdown;
  timestamp: Date;
}

export interface RiskInsights {
  totalRisks: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  avgRiskScore: number;
  maxRiskScore: number;
  totalExposure: number;
}

export interface PerformanceMetrics {
  onTrack: number;
  atRisk: number;
  critical: number;
  avgCompletion: number;
  avgBudget: number;
  budgetUtilization: number;
  overBudget: number;
  healthScore: number;
  performance: 'strong' | 'stable' | 'needs improvement';
  trend: 'upward' | 'stable' | 'downward';
}

export interface AIRecommendation {
  id: string;
  title: string;
  description: string;
  priority: 'High' | 'Medium' | 'Low';
  impact: string;
  actions: string[];
}

export interface RecentDecision {
  id: string;
  title: string;
  status: string;
  created_at: string;
  projectName: string | null;
  requesterName: string | null;
}

// ============ Queries ============
export const CEOQueries = {
  async getPortfolioKPIs(): Promise<PortfolioKPIs> {
    const rows = await executeQuery(`
      SELECT 
        COALESCE(SUM(budget), 0) as "totalValue",
        COUNT(*) as "activeProjects",
        COUNT(CASE WHEN status IN ('EXECUTING', 'MONITORING') THEN 1 END) as "onTrackProjects",
        COUNT(CASE WHEN status = 'PLANNING' THEN 1 END) as "atRiskProjects",
        COUNT(CASE WHEN status = 'INITIATING' THEN 1 END) as "criticalProjects",
        (
          SELECT COUNT(*) FROM risks WHERE status != 'CLOSED'
        ) as "openRisks",
        (
          SELECT COUNT(*) FROM decisions WHERE status IN ('SUBMITTED', 'UNDER_REVIEW')
        ) as "pendingApprovals",
        (
          SELECT COUNT(*) FROM tasks WHERE status != 'COMPLETED'
        ) as "openTasks"
      FROM projects
      WHERE status IN ('INITIATING', 'PLANNING', 'EXECUTING', 'MONITORING')
    `);
    return (rows[0] as PortfolioKPIs) || {
      totalValue: 0,
      activeProjects: 0,
      onTrackProjects: 0,
      atRiskProjects: 0,
      criticalProjects: 0,
      openRisks: 0,
      pendingApprovals: 0,
      openTasks: 0
    };
  },

  async getPendingApprovals(): Promise<PendingApproval[]> {
    return executeQuery(`
      SELECT 
        d.id,
        d.title,
        d.description,
        d.amount,
        d.priority,
        d.status,
        d.created_at,
        d.justification,
        p.name as "projectName",
        u.name as "requesterName"
      FROM decisions d
      LEFT JOIN projects p ON d.project_id = p.id
      LEFT JOIN users u ON d.requester_id = u.id
      WHERE d.status IN ('SUBMITTED', 'UNDER_REVIEW')
      ORDER BY 
        CASE d.priority 
          WHEN 'CRITICAL' THEN 1
          WHEN 'HIGH' THEN 2
          WHEN 'MEDIUM' THEN 3
          WHEN 'LOW' THEN 4
        END ASC,
        d.created_at ASC
    `);
  },

  async getRiskBreakdown(): Promise<RiskBreakdown> {
    const rows = await executeQuery(`
      SELECT 
        COUNT(CASE WHEN risk_level = 'CRITICAL' THEN 1 END) as critical,
        COUNT(CASE WHEN risk_level = 'HIGH' THEN 1 END) as high,
        COUNT(CASE WHEN risk_level = 'MEDIUM' THEN 1 END) as medium,
        COUNT(CASE WHEN risk_level = 'LOW' THEN 1 END) as low,
        COUNT(*) as "totalRisks",
        SUM(CASE 
          WHEN risk_level = 'CRITICAL' THEN 1000000
          WHEN risk_level = 'HIGH' THEN 100000
          WHEN risk_level = 'MEDIUM' THEN 10000
          ELSE 1000
        END) as "totalExposure"
      FROM risks
      WHERE status != 'CLOSED'
    `);
    return rows[0] || { 
      critical: 0, 
      high: 0, 
      medium: 0, 
      low: 0, 
      totalRisks: 0, 
      totalExposure: 0 
    };
  },

  async getTopProjects(): Promise<TopProject[]> {
    return executeQuery(`
      SELECT 
        p.id,
        p.name,
        p.budget,
        p.progress as "percentComplete",
        u.name as "managerName",
        p.status
      FROM projects p
      LEFT JOIN users u ON p.manager_id = u.id
      WHERE p.status IN ('EXECUTING', 'MONITORING')
      ORDER BY p.budget DESC
      LIMIT 10
    `);
  },

  async getProjectHealth(): Promise<ProjectHealth> {
    const rows = await executeQuery(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN progress >= 70 THEN 1 END) as healthy,
        COUNT(CASE WHEN progress BETWEEN 30 AND 69 THEN 1 END) as "atRisk",
        COUNT(CASE WHEN progress < 30 THEN 1 END) as critical,
        COALESCE(AVG(progress), 0) as "avgCompletion"
      FROM projects
      WHERE status IN ('EXECUTING', 'MONITORING')
    `);
    return rows[0] || { 
      total: 0, 
      healthy: 0, 
      atRisk: 0, 
      critical: 0, 
      avgCompletion: 0 
    };
  },

  async getBudgetUtilization(): Promise<BudgetUtilization> {
    const rows = await executeQuery(`
      SELECT 
        COALESCE(SUM(budget), 0) as total,
        COALESCE(SUM(actual_cost), 0) as used,
        COALESCE(SUM(budget - actual_cost), 0) as remaining
      FROM projects
      WHERE status IN ('INITIATING', 'PLANNING', 'EXECUTING', 'MONITORING')
    `);
    return rows[0] || { total: 0, used: 0, remaining: 0 };
  },

  async getPortfolioTrends(): Promise<PortfolioTrend[]> {
    return executeQuery(`
      SELECT 
        DATE_TRUNC('month', created_at) as month,
        COUNT(*) as projects,
        COALESCE(SUM(budget), 0) as budget,
        COALESCE(AVG(progress), 0) as "avgCompletion"
      FROM projects
      WHERE created_at >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month ASC
    `);
  },

  async getExecutiveSummary(): Promise<ExecutiveSummary> {
    const [kpis, health, budget, risks] = await Promise.all([
      this.getPortfolioKPIs(),
      this.getProjectHealth(),
      this.getBudgetUtilization(),
      this.getRiskBreakdown()
    ]);

    return {
      kpis,
      health,
      budget,
      risks,
      timestamp: new Date()
    };
  },

  async getRiskInsights(): Promise<RiskInsights> {
    const rows = await executeQuery(`
      SELECT 
        COUNT(*) as "totalRisks",
        COUNT(CASE WHEN risk_level = 'CRITICAL' THEN 1 END) as critical,
        COUNT(CASE WHEN risk_level = 'HIGH' THEN 1 END) as high,
        COUNT(CASE WHEN risk_level = 'MEDIUM' THEN 1 END) as medium,
        COUNT(CASE WHEN risk_level = 'LOW' THEN 1 END) as low,
        COALESCE(AVG(risk_score), 0) as "avgRiskScore",
        COALESCE(MAX(risk_score), 0) as "maxRiskScore",
        SUM(CASE 
          WHEN risk_level = 'CRITICAL' THEN 1000000
          WHEN risk_level = 'HIGH' THEN 100000
          WHEN risk_level = 'MEDIUM' THEN 10000
          ELSE 1000
        END) as "totalExposure"
      FROM risks
      WHERE status != 'CLOSED'
    `);
    return rows[0] || { 
      totalRisks: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      avgRiskScore: 0,
      maxRiskScore: 0,
      totalExposure: 0
    };
  },

  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const rows = await executeQuery(`
      SELECT 
        COUNT(CASE WHEN progress >= 70 THEN 1 END) as "onTrack",
        COUNT(CASE WHEN progress BETWEEN 30 AND 69 THEN 1 END) as "atRisk",
        COUNT(CASE WHEN progress < 30 THEN 1 END) as "critical",
        COALESCE(AVG(progress), 0) as "avgCompletion",
        COALESCE(AVG(budget), 0) as "avgBudget",
        COALESCE(SUM(actual_cost) / NULLIF(SUM(budget), 0) * 100, 0) as "budgetUtilization",
        COUNT(CASE WHEN actual_cost > budget THEN 1 END) as "overBudget"
      FROM projects
      WHERE status IN ('EXECUTING', 'MONITORING')
    `);
    const data = rows[0] || { 
      onTrack: 0,
      atRisk: 0,
      critical: 0,
      avgCompletion: 0,
      avgBudget: 0,
      budgetUtilization: 0,
      overBudget: 0
    };
    
    const avgCompletion = data.avgCompletion || 0;
    
    return {
      ...data,
      healthScore: Math.round(avgCompletion),
      performance: avgCompletion > 70 ? 'strong' : 
                   avgCompletion > 40 ? 'stable' : 'needs improvement',
      trend: avgCompletion > 50 ? 'upward' : 'stable'
    };
  },

  async getAIRecommendations(): Promise<AIRecommendation[]> {
    const [risks, metrics, budget] = await Promise.all([
      this.getRiskInsights(),
      this.getPerformanceMetrics(),
      this.getBudgetUtilization()
    ]);

    const recommendations: AIRecommendation[] = [];

    // Risk-based recommendation
    if (risks.critical > 0) {
      recommendations.push({
        id: 'risk-mitigation',
        title: 'Immediate Risk Mitigation Required',
        description: `${risks.critical} critical risks need immediate attention. Focus on the highest impact risks first.`,
        priority: 'High',
        impact: 'Prevents potential project failures and cost overruns',
        actions: [
          'Schedule emergency risk review meeting',
          'Assign owners to each critical risk',
          'Develop mitigation plans',
          'Monitor daily until resolved'
        ]
      });
    }

    // Budget-based recommendation
    if (budget.total > 0 && (budget.used / budget.total) > 0.8) {
      recommendations.push({
        id: 'budget-optimization',
        title: 'Budget Optimization Needed',
        description: `Budget utilization is at ${Math.round((budget.used / budget.total) * 100)}%. Review and optimize spending.`,
        priority: 'High',
        impact: 'Prevents budget overruns and improves financial health',
        actions: [
          'Review all project budgets',
          'Identify cost-saving opportunities',
          'Reprioritize discretionary spending',
          'Consider reallocation of resources'
        ]
      });
    }

    // Performance-based recommendation
    if (metrics.avgCompletion < 50) {
      recommendations.push({
        id: 'performance-improvement',
        title: 'Performance Improvement Plan',
        description: `Average project completion is ${Math.round(metrics.avgCompletion)}%. Need to accelerate progress.`,
        priority: 'Medium',
        impact: 'Improves overall portfolio performance and delivery speed',
        actions: [
          'Identify bottlenecks in project execution',
          'Reallocate resources to critical path items',
          'Implement daily stand-up meetings',
          'Review and adjust project timelines'
        ]
      });
    }

    // Add general recommendation if no specific issues
    if (recommendations.length === 0) {
      recommendations.push({
        id: 'maintain-momentum',
        title: 'Maintain Current Momentum',
        description: 'Portfolio is performing well. Continue monitoring key metrics and addressing issues proactively.',
        priority: 'Low',
        impact: 'Sustains current performance levels and prevents future issues',
        actions: [
          'Continue regular portfolio reviews',
          'Maintain proactive risk management',
          'Keep stakeholders informed',
          'Document lessons learned'
        ]
      });
    }

    return recommendations;
  },

  async getRecentDecisions(limit: number = 10): Promise<RecentDecision[]> {
    return executeQuery(`
      SELECT 
        d.id,
        d.title,
        d.status,
        d.created_at,
        p.name as "projectName",
        u.name as "requesterName"
      FROM decisions d
      LEFT JOIN projects p ON d.project_id = p.id
      LEFT JOIN users u ON d.requester_id = u.id
      ORDER BY d.created_at DESC
      LIMIT $1
    `, [limit]);
  }
};