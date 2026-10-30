// lib/db/queries/tasks.ts
import { executeQuery } from '@/lib/db';
import { Task, TaskStatus, TaskCreateInput, TaskUpdateInput } from '@/types/task';

export const TaskQueries = {
  async create(data: TaskCreateInput): Promise<Task> {
    const rows = await executeQuery<Task>(
      `INSERT INTO tasks (
        project_id, title, description, priority, assignee_id,
        start_date, end_date, risk_id, decision_id, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'TODO')
      RETURNING 
        id, project_id as "projectId", title, description, status, priority,
        assignee_id as "assigneeId", start_date as "startDate",
        end_date as "endDate", percent_complete as "percentComplete",
        completed_at as "completedAt", incomplete_reason as "incompleteReason",
        risk_id as "riskId", decision_id as "decisionId",
        created_at as "createdAt", updated_at as "updatedAt"`,
      [
        data.projectId,
        data.title,
        data.description,
        data.priority || 3,
        data.assigneeId || null,
        data.startDate,
        data.endDate,
        data.riskId || null,
        data.decisionId || null
      ]
    );
    return rows[0];
  },

async findById(id: string): Promise<Task | null> {
    const rows = await executeQuery<Task>(
      `SELECT 
        t.*,
        u.name as "assigneeName",
        p.name as "projectName"
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id::uuid
      LEFT JOIN projects p ON t.project_id = p.id::uuid
      WHERE t.id = $1::uuid`,
      [id]
    );
    return rows[0] || null;
  },

  async findByProject(projectId: string): Promise<Task[]> {
    return executeQuery<Task>(
      `SELECT 
        t.*,
        u.name as "assigneeName"
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      WHERE t.project_id::text = $1::text
      ORDER BY t.priority DESC, t.created_at ASC`,
      [projectId]
    );
  },

  async findByAssignee(userId: string): Promise<Task[]> {
    return executeQuery<Task>(
      `SELECT 
        t.*,
        u.name as "assigneeName",
        p.name as "projectName"
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE t.assignee_id = $1 AND t.status != 'COMPLETED'
      ORDER BY t.end_date ASC`,
      [userId]
    );
  },

  async update(id: string, data: TaskUpdateInput): Promise<Task> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const fieldMap: Record<string, string> = {
      assigneeId: 'assignee_id',
      startDate: 'start_date',
      endDate: 'end_date',
      percentComplete: 'percent_complete',
      riskId: 'risk_id',
      decisionId: 'decision_id'
    };

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        const dbField = fieldMap[key] || key;
        fields.push(`${dbField} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    });

    values.push(id);
    const query = `
      UPDATE tasks 
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING 
        id, project_id as "projectId", title, description, status, priority,
        assignee_id as "assigneeId", start_date as "startDate",
        end_date as "endDate", percent_complete as "percentComplete",
        completed_at as "completedAt", incomplete_reason as "incompleteReason",
        risk_id as "riskId", decision_id as "decisionId",
        created_at as "createdAt", updated_at as "updatedAt"
    `;

    const rows = await executeQuery<Task>(query, values);
    return rows[0];
  },

  async updateStatus(id: string, status: TaskStatus, reason?: string): Promise<Task> {
    let query = `
      UPDATE tasks 
      SET status = $1, updated_at = NOW()
    `;
    const params: any[] = [status, id];
    
    if (status === 'COMPLETED') {
      query += `, completed_at = NOW(), percent_complete = 100`;
    }
    
    if (status === 'INCOMPLETE' && reason) {
      query += `, incomplete_reason = $3`;
      params.push(reason);
    }

    query += ` WHERE id = $2
      RETURNING 
        id, project_id as "projectId", title, description, status, priority,
        assignee_id as "assigneeId", start_date as "startDate",
        end_date as "endDate", percent_complete as "percentComplete",
        completed_at as "completedAt", incomplete_reason as "incompleteReason",
        risk_id as "riskId", decision_id as "decisionId",
        created_at as "createdAt", updated_at as "updatedAt"
    `;

    const rows = await executeQuery<Task>(query, params);
    return rows[0];
  },

  async updateProgress(id: string, percentComplete: number): Promise<Task> {
    const rows = await executeQuery<Task>(
      `UPDATE tasks 
       SET percent_complete = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING 
        id, project_id as "projectId", title, description, status, priority,
        assignee_id as "assigneeId", start_date as "startDate",
        end_date as "endDate", percent_complete as "percentComplete",
        completed_at as "completedAt", incomplete_reason as "incompleteReason",
        risk_id as "riskId", decision_id as "decisionId",
        created_at as "createdAt", updated_at as "updatedAt"`,
      [percentComplete, id]
    );
    return rows[0];
  },

  async delete(id: string): Promise<void> {
    await executeQuery(
      'DELETE FROM tasks WHERE id = $1',
      [id]
    );
  },

  async getTaskStats(projectId: string): Promise<any> {
    const rows = await executeQuery(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'TODO' THEN 1 END) as todo,
        COUNT(CASE WHEN status = 'IN_PROGRESS' THEN 1 END) as "inProgress",
        COUNT(CASE WHEN status = 'BLOCKED' THEN 1 END) as blocked,
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'INCOMPLETE' THEN 1 END) as incomplete,
        AVG(percent_complete) as "avgComplete",
        COUNT(CASE WHEN end_date < NOW() AND status != 'COMPLETED' THEN 1 END) as overdue
      FROM tasks
      WHERE project_id = $1`,
      [projectId]
    );
    return rows[0] || {};
  },

  async getTasksByStatus(projectId: string): Promise<any> {
    return executeQuery(
      `SELECT 
        status,
        COUNT(*) as count,
        json_agg(
          json_build_object(
            'id', id,
            'title', title,
            'priority', priority,
            'assigneeName', (SELECT name FROM users WHERE id = assignee_id),
            'endDate', end_date,
            'percentComplete', percent_complete
          )
          ORDER BY priority DESC
        ) as tasks
      FROM tasks
      WHERE project_id = $1
      GROUP BY status`,
      [projectId]
    );
  }
};