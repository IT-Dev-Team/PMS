// lib/db/queries/reports.ts
import { executeQuery } from '@/lib/db';

export const ReportQueries = {
  // ========== PROJECT STATUS REPORT ==========
  async getProjectStatusReport(projectId: string): Promise<any> {
    const [project, tasks, plans, risks, financials] = await Promise.all([
      executeQuery(
        `SELECT 
          id, name, code, status, progress,
          start_date, end_date, budget, actual_cost,
          created_at, updated_at
        FROM projects WHERE id = $1::uuid`,
        [projectId]
      ),
      executeQuery(
        `SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed,
          COUNT(CASE WHEN status = 'IN_PROGRESS' THEN 1 END) as in_progress,
          COUNT(CASE WHEN status = 'BLOCKED' THEN 1 END) as blocked,
          COUNT(CASE WHEN status = 'TODO' THEN 1 END) as todo,
          COUNT(CASE WHEN status != 'COMPLETED' AND end_date < NOW() THEN 1 END) as overdue,
          AVG(progress) as avg_progress
        FROM tasks WHERE project_id = $1::uuid`,
        [projectId]
      ),
      executeQuery(
        `SELECT 
          plan_type,
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed,
          AVG(progress) as avg_progress
        FROM plans 
        WHERE project_id = $1::uuid
        GROUP BY plan_type`,
        [projectId]
      ),
      executeQuery(
        `SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status != 'CLOSED' THEN 1 END) as open,
          COUNT(CASE WHEN risk_level = 'CRITICAL' THEN 1 END) as critical,
          COUNT(CASE WHEN risk_level = 'HIGH' THEN 1 END) as high,
          COUNT(CASE WHEN risk_level = 'MEDIUM' THEN 1 END) as medium,
          COUNT(CASE WHEN risk_level = 'LOW' THEN 1 END) as low
        FROM risks WHERE project_id = $1::uuid`,
        [projectId]
      ),
      executeQuery(
        `SELECT 
          budget,
          actual_cost as actualCost,
          progress,
          (SELECT planned_value FROM evm_data WHERE project_id = $1::uuid ORDER BY period DESC LIMIT 1) as plannedValue,
          (SELECT earned_value FROM evm_data WHERE project_id = $1::uuid ORDER BY period DESC LIMIT 1) as earnedValue,
          (SELECT cpi FROM evm_data WHERE project_id = $1::uuid ORDER BY period DESC LIMIT 1) as cpi,
          (SELECT spi FROM evm_data WHERE project_id = $1::uuid ORDER BY period DESC LIMIT 1) as spi,
          (SELECT eac FROM evm_data WHERE project_id = $1::uuid ORDER BY period DESC LIMIT 1) as eac
        FROM projects WHERE id = $1::uuid`,
        [projectId]
      )
    ]);

    return {
      project: project[0] || {},
      tasks: tasks[0] || {},
      plans: plans || [],
      risks: risks[0] || {},
      financials: financials[0] || {}
    };
  },

  // ========== PORTFOLIO STATUS REPORT ==========
  async getPortfolioStatusReport(portfolioId: string): Promise<any> {
    const projects = await executeQuery(
      `SELECT 
        id, name, code, status, progress,
        budget, actual_cost, start_date, end_date
      FROM projects WHERE portfolio_id = $1::uuid`,
      [portfolioId]
    );

    const projectIds = projects.map((p: any) => p.id);
    
    let taskStats = { total: 0, completed: 0, inProgress: 0, blocked: 0 };
    let riskStats = { total: 0, open: 0, critical: 0 };
    let totalBudget = 0;
    let totalSpent = 0;

    for (const project of projects as any[]) {
      const [tasks, risks] = await Promise.all([
        executeQuery(
          `SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed,
            COUNT(CASE WHEN status = 'IN_PROGRESS' THEN 1 END) as in_progress,
            COUNT(CASE WHEN status = 'BLOCKED' THEN 1 END) as blocked
          FROM tasks WHERE project_id = $1::uuid`,
          [project.id]
        ),
        executeQuery(
          `SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN status != 'CLOSED' THEN 1 END) as open,
            COUNT(CASE WHEN risk_level = 'CRITICAL' THEN 1 END) as critical
          FROM risks WHERE project_id = $1::uuid`,
          [project.id]
        )
      ]);

      const t: any = tasks[0] || {};
      const r: any = risks[0] || {};
      
      taskStats.total += t.total || 0;
      taskStats.completed += t.completed || 0;
      taskStats.inProgress += t.inProgress || 0;
      taskStats.blocked += t.blocked || 0;
      
      riskStats.total += r.total || 0;
      riskStats.open += r.open || 0;
      riskStats.critical += r.critical || 0;
      
      totalBudget += project.budget || 0;
      totalSpent += project.actual_cost || 0;
    }

    return {
      projects,
      taskStats,
      riskStats,
      totalBudget,
      totalSpent,
      avgProgress: projects.length > 0 
        ? projects.reduce((sum: number, p: any) => sum + (p.progress || 0), 0) / projects.length 
        : 0,
      onTrack: projects.filter((p: any) => p.progress >= 70).length,
      atRisk: projects.filter((p: any) => p.progress >= 40 && p.progress < 70).length,
      critical: projects.filter((p: any) => p.progress < 40).length
    };
  },

  // ========== GENERATE PROJECT STATUS UPDATE ==========
  async generateStatusUpdate(projectId: string): Promise<any> {
    const report = await this.getProjectStatusReport(projectId);
    
    return {
      generatedAt: new Date(),
      project: report.project,
      summary: {
        overallProgress: report.project.progress || 0,
        taskCompletion: report.tasks.completed || 0,
        taskTotal: report.tasks.total || 0,
        openRisks: report.risks.open || 0,
        criticalRisks: report.risks.critical || 0,
        budgetUtilization: report.project.budget > 0 
          ? ((report.project.actual_cost || 0) / report.project.budget) * 100 
          : 0
      },
      status: {
        color: report.project.progress >= 70 ? 'GREEN' :
               report.project.progress >= 40 ? 'AMBER' : 'RED',
        label: report.project.progress >= 70 ? 'On Track' :
               report.project.progress >= 40 ? 'At Risk' : 'Critical'
      },
      recommendations: this.generateRecommendations(report)
    };
  },

  // ========== GENERATE RECOMMENDATIONS ==========
  generateRecommendations(report: any): string[] {
    const recommendations: string[] = [];
    
    if (report.risks.critical > 0) {
      recommendations.push(`🔴 Address ${report.risks.critical} critical risks immediately`);
    }
    
    if (report.tasks.overdue > 0) {
      recommendations.push(`⚠️ ${report.tasks.overdue} tasks are overdue - review and prioritize`);
    }
    
    if (report.tasks.blocked > 0) {
      recommendations.push(`🚫 ${report.tasks.blocked} tasks are blocked - remove blockers`);
    }
    
    if (report.financials?.cpi < 0.8) {
      recommendations.push(`💰 Cost performance is critical (CPI: ${report.financials.cpi.toFixed(2)}) - review budget`);
    }
    
    if (report.financials?.spi < 0.8) {
      recommendations.push(`📅 Schedule performance is critical (SPI: ${report.financials.spi.toFixed(2)}) - accelerate work`);
    }
    
    if (report.project.budget > 0 && report.project.actual_cost / report.project.budget > 0.8) {
      recommendations.push(`⚠️ Budget utilization is high (${Math.round((report.project.actual_cost / report.project.budget) * 100)}%) - review remaining work`);
    }
    
    if (recommendations.length === 0) {
      recommendations.push('✅ Project is on track - continue current strategy');
    }
    
    return recommendations;
  }
};