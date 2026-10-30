// lib/services/projectService.ts
import { ProjectQueries } from '@/lib/db/queries/projects';
import { FinancialQueries } from '@/lib/db/queries/financial';
import { RiskQueries } from '@/lib/db/queries/risks';
import { TaskQueries } from '@/lib/db/queries/tasks';
import { GovernanceQueries } from '@/lib/db/queries/governance';
import { executeQuery, pool } from '@/lib/db';
import { calculateEVM } from '@/lib/utils/evmCalculations';
import { ProjectStatus } from '@/types/project';

export class ProjectService {
  async createProject(data: any, userId: string) {
    // Start transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Create project
      const project = await ProjectQueries.create({
        ...data,
        managerId: userId
      });

      // Create initial EVM data
      const evmData = calculateEVM({
        budget: data.budget,
        startDate: data.startDate,
        endDate: data.endDate
      });

      await FinancialQueries.createEVMData({
        projectId: project.id,
        ...evmData,
        period: new Date()
      });

      // Create audit log
      await executeQuery(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          userId,
          'CREATE_PROJECT',
          'PROJECT',
          project.id,
          JSON.stringify(data),
          JSON.stringify({ ip: 'system' })
        ]
      );

      await client.query('COMMIT');
      return project;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async updateProjectStatus(projectId: string, status: string | ProjectStatus, reason: string, userId: string) {
    const project = await ProjectQueries.updateStatus(projectId, status as ProjectStatus, reason);
    
    // Create audit log
    await executeQuery(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes, reason)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        userId,
        'UPDATE_PROJECT_STATUS',
        'PROJECT',
        projectId,
        JSON.stringify({ status }),
        reason
      ]
    );

    return project;
  }

  async getProjectDashboard(projectId: string) {
    const [project, evmData, risks, tasks, decisions] = await Promise.all([
      ProjectQueries.findById(projectId),
      FinancialQueries.getEVMData(projectId),
      RiskQueries.findByProject(projectId),
      TaskQueries.findByProject(projectId),
      GovernanceQueries.findByProject(projectId)
    ]);

    return {
      project,
      evmData,
      risks,
      tasks,
      decisions,
      metrics: this.calculateProjectMetrics(project, evmData, tasks)
    };
  }

  private calculateProjectMetrics(project: any, evmData: any, tasks: any[]) {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'COMPLETED').length;
    const overdueTasks = tasks.filter(t => 
      t.status !== 'COMPLETED' && t.end_date && new Date(t.end_date) < new Date()
    ).length;

    return {
      taskCompletion: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
      overdueTasks,
      scheduleVariance: evmData?.spi || 0,
      costVariance: evmData?.cpi || 0,
      riskCount: {
        critical: tasks.filter(t => t.risk_level === 'CRITICAL').length,
        high: tasks.filter(t => t.risk_level === 'HIGH').length
      }
    };
  }
}