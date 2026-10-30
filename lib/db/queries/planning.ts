// lib/db/queries/planning.ts
import { executeQuery } from '@/lib/db';

// ---------- Logging wrapper ----------
async function executeQueryWithLog(sql: string, params: any[] = []) {
  console.log('[SQL]', sql);
  console.log('[PARAMS]', JSON.stringify(params));
  try {
    return await executeQuery(sql, params);
  } catch (error) {
    console.error('[SQL ERROR]', error.message);
    throw error;
  }
}
// -------------------------------------

export const PlanningQueries = {
  // ========== LOG PLAN UPDATE ==========
  async logPlanUpdate(data: {
    planId: string;
    projectId: string;
    action: string;
    fieldChanged?: string;
    oldValue?: string;
    newValue?: string;
    reasonNotes?: string;
    createdBy?: string;
  }): Promise<any> {
    const rows = await executeQueryWithLog(
      `INSERT INTO plans_logs (
        plan_id, project_id, action, field_changed, old_value, new_value, notes, created_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING id, plan_id as "planId", project_id as "projectId", action, field_changed as "fieldChanged", old_value as "oldValue", new_value as "newValue", notes, created_at as "createdAt"`,
      [
        data.planId,
        data.projectId,
        data.action,
        data.fieldChanged || null,
        data.oldValue || null,
        data.newValue || null,
        data.reasonNotes || null,
        data.createdBy || null,
      ]
    );
    return rows[0];
  },

  // ========== UPDATE PLAN STATUS WITH LOGGING ==========
  async updatePlanStatusWithLog(
    planId: string,
    status: string,
    userId?: string,
    reasonCode?: string,
    reasonNotes?: string
  ): Promise<any> {
    const currentPlan = await this.getPlanById(planId);
    if (!currentPlan) {
      throw new Error('Plan not found');
    }

    const oldStatus = currentPlan.status;
    const updatedPlan = await this.updatePlanStatus(planId, status, reasonCode, reasonNotes);

    if (updatedPlan && oldStatus !== status) {
      await this.logPlanUpdate({
        planId,
        projectId: currentPlan.project_id,
        action: 'STATUS_CHANGE',
        fieldChanged: 'status',
        oldValue: oldStatus,
        newValue: status,
        reasonNotes: reasonNotes || `Status changed from ${oldStatus} to ${status}`,
        createdBy: userId,
      });

      if (currentPlan.parent_id) {
        await this.updateParentProgress(currentPlan.parent_id);
      }
      await this.updateProjectProgress(currentPlan.project_id);
    }

    return updatedPlan;
  },

  // ========== UPDATE PLAN PROGRESS WITH LOGGING ==========
  async updatePlanProgressWithLog(
    planId: string,
    progress: number,
    userId?: string,
    reasonNotes?: string
  ): Promise<any> {
    const currentPlan = await this.getPlanById(planId);
    if (!currentPlan) {
      throw new Error('Plan not found');
    }

    const oldProgress = currentPlan.progress;

    const rows = await executeQueryWithLog(
      `UPDATE plans 
       SET progress = $1, updated_at = NOW()
       WHERE id = $2::uuid
       RETURNING *`,
      [progress, planId]
    );
    const updatedPlan = rows[0];

    if (updatedPlan && oldProgress !== progress) {
      await this.logPlanUpdate({
        planId,
        projectId: currentPlan.project_id,
        action: 'PROGRESS_UPDATE',
        fieldChanged: 'progress',
        oldValue: String(oldProgress),
        newValue: String(progress),
        reasonNotes: reasonNotes || `Progress updated from ${oldProgress}% to ${progress}%`,
        createdBy: userId,
      });

      if (currentPlan.parent_id) {
        await this.updateParentProgress(currentPlan.parent_id);
      }
      await this.updateProjectProgress(currentPlan.project_id);
    }

    return updatedPlan;
  },

  // ========== ADD NOTE TO PLAN ==========
  async addPlanNote(
    planId: string,
    note: string,
    userId?: string
  ): Promise<any> {
    const currentPlan = await this.getPlanById(planId);
    if (!currentPlan) {
      throw new Error('Plan not found');
    }

    return await this.logPlanUpdate({
      planId,
      projectId: currentPlan.project_id,
      action: 'NOTE_ADDED',
      fieldChanged: 'notes',
      newValue: note,
      reasonNotes: note,
      createdBy: userId,
    });
  },

  // ========== GET PLAN BY ID ==========
  async getPlanById(planId: string): Promise<any> {
    const rows = await executeQueryWithLog(
      `SELECT 
        p.*,
       p.assignee_id as assignee_name,
        (SELECT COUNT(*) FROM plans WHERE parent_id = p.id) as child_count
      FROM plans p
      WHERE p.id = $1::uuid`,
      [planId]
    );
    return rows[0] || null;
  },

  // ========== UPDATE PLAN STATUS (Core) ==========
  async updatePlanStatus(planId: string, status: string, reasonCode?: string, reasonNotes?: string): Promise<any> {
    const rows = await executeQueryWithLog(
      `UPDATE plans 
       SET status = $1,
           reason_code = $2,
           reason_notes = $3,
           status_changed_at = NOW(),
           updated_at = NOW()
       WHERE id = $4::uuid
       RETURNING *`,
      [status, reasonCode || null, reasonNotes || null, planId]
    );
    return rows[0] || null;
  },

  // ========== UPDATE PARENT PROGRESS ==========
  async updateParentProgress(parentId: string): Promise<void> {
    const result = await executeQueryWithLog(
      `WITH child_stats AS (
        SELECT 
          COALESCE(AVG(progress), 0) as avg_progress,
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed,
          COUNT(CASE WHEN status = 'IN_PROGRESS' THEN 1 END) as in_progress
        FROM plans
        WHERE parent_id = $1::uuid
      )
      UPDATE plans 
      SET 
        progress = (SELECT avg_progress FROM child_stats),
        status = CASE 
          WHEN (SELECT completed FROM child_stats) = (SELECT total FROM child_stats) THEN 'COMPLETED'
          WHEN (SELECT in_progress FROM child_stats) > 0 OR (SELECT completed FROM child_stats) > 0 THEN 'IN_PROGRESS'
          ELSE 'NOT_STARTED'
        END,
        updated_at = NOW()
      WHERE id = $1::uuid
      RETURNING id, status, progress`,
      [parentId]
    );
    
    if (result.length > 0) {
      const parent = result[0];
      const projectRow = await executeQueryWithLog(
        `SELECT project_id FROM plans WHERE id = $1::uuid`,
        [parentId]
      );
      if (projectRow.length > 0) {
        await this.logPlanUpdate({
          planId: parentId,
          projectId: projectRow[0].project_id,
          action: 'PROGRESS_UPDATE',
          fieldChanged: 'progress',
          newValue: String(parent.progress),
          reasonNotes: `Parent progress auto-updated to ${parent.progress}% based on children`,
        });
      }
    }
  },

  // ========== UPDATE PROJECT PROGRESS ==========
  async updateProjectProgress(projectId: string): Promise<void> {
    const query = `
      WITH project_stats AS (
        SELECT 
          COUNT(*) as total_plans,
          COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed_plans,
          SUM(budget::numeric) as total_budget,
          SUM(actual_hours::numeric) as total_actual_hours,
          SUM(estimated_hours::numeric) as total_estimated_hours
        FROM plans
        WHERE project_id = $1 and plan_type IN ('PHASE')
      )
      UPDATE projects
      SET 
        progress = CASE 
          WHEN total_plans = 0 THEN 0
          ELSE ROUND((completed_plans::numeric / total_plans::numeric) * 100, 2)
        END,
        budget = COALESCE(total_budget, 0),
        actual_hours = COALESCE(total_actual_hours, 0),
        estimated_hours = COALESCE(total_estimated_hours, 0),
        updated_at = NOW()
      FROM project_stats
      WHERE projects.id = $1
      RETURNING progress, budget, actual_hours, estimated_hours
    `;
    await executeQueryWithLog(query, [projectId]);
  },

  // ========== GET PLAN HIERARCHY ==========
  async getPlanHierarchy(projectId: string): Promise<any[]> {
    if (!projectId) return [];
    
    return executeQueryWithLog(
      `WITH RECURSIVE plan_tree AS (
        SELECT 
          p.*,
          0 as level,
          ARRAY[p.id] as path
        FROM plans p
       
        WHERE p.project_id = $1::uuid AND p.parent_id IS NULL
        
        UNION ALL
        
        SELECT 
          c.*,
          pt.level + 1,
          pt.path || c.id
        FROM plans c
        INNER JOIN plan_tree pt ON c.parent_id = pt.id
   
      )
      SELECT 
        id, project_id as "projectId", parent_id as "parentId",
        plan_type as "planType", title, description,
        status, progress, budget,
        start_date as "startDate", end_date as "endDate", due_date as "dueDate",
        assignee_id as "assigneeName",
        priority, estimated_hours as "estimatedHours", actual_hours as "actualHours",
        actual_start_date as "actualStartDate", actual_end_date as "actualEndDate",
        status_changed_at as "statusChangedAt", reason_code as "reasonCode", reason_notes as "reasonNotes",
        metadata, completed_at as "completedAt",
        level,
        path,
        created_at as "createdAt", updated_at as "updatedAt"
      FROM plan_tree
      ORDER BY path`,
      [projectId]
    );
  },

  // ========== GET PLAN LOGS ==========
  async getPlanLogs(planId: string, limit: number = 50): Promise<any[]> {
    return executeQueryWithLog(
      `SELECT 
        pl.id,
        pl.plan_id as "planId",
        pl.project_id as "projectId",
        pl.action,
        pl.field_changed as "fieldChanged",
        pl.old_value as "oldValue",
        pl.new_value as "newValue",
        pl.notes,
        pl.created_at as "createdAt",
        u.name as "createdByName"
      FROM plans_logs pl
      LEFT JOIN users u ON pl.created_by = u.id
      WHERE pl.plan_id = $1::uuid
      ORDER BY pl.created_at DESC
      LIMIT $2`,
      [planId, limit]
    );
  },

  // ========== GET PROJECT LOGS ==========
  async getProjectLogs(projectId: string, limit: number = 100): Promise<any[]> {
    return executeQueryWithLog(
      `SELECT 
        pl.id,
        pl.plan_id as "planId",
        p.title as "planName",
        pl.project_id as "projectId",
        pl.action,
        pl.field_changed as "fieldChanged",
        pl.old_value as "oldValue",
        pl.new_value as "newValue",
        pl.notes,
        pl.created_at as "createdAt",
        u.name as "createdByName"
      FROM plans_logs pl
      LEFT JOIN plans p ON pl.plan_id = p.id
      LEFT JOIN users u ON pl.created_by = u.id
      WHERE pl.project_id = $1::uuid
      ORDER BY pl.created_at DESC
      LIMIT $2`,
      [projectId, limit]
    );
  },

  // ========== GET PROJECT PROGRESS ==========
  async getProjectProgress(projectId: string): Promise<number> {
    const items = await this.getPlanHierarchy(projectId);
    if (!items.length) return 0;
    
    const map = new Map<string, any>();
    items.forEach(item => map.set(item.id, item));
    
    const compute = (id: string): number => {
      const item = map.get(id);
      if (!item) return 0;
      const children = items.filter(i => i.parent_id === id);
      if (!children.length) {
        return item.status === 'COMPLETED' ? 100 : 0;
      }
      const sum = children.reduce((acc, child) => acc + compute(child.id), 0);
      return Math.round(sum / children.length);
    };
    
    const roots = items.filter(i => !i.parent_id);
    if (!roots.length) return 0;
    const total = roots.reduce((acc, root) => acc + compute(root.id), 0);
    return Math.round(total / roots.length);
  },

  // ========== REPORTS ==========
  async getReports(projectId?: string): Promise<any[]> {
    if (!projectId) return [];
    
    return executeQueryWithLog(
      `SELECT 
        r.id,
        r.project_id as "projectId",
        r.report_date as "reportDate",
        r.summary,
        r.blockers,
        r.next_steps as "nextSteps",
        r.attachment_url as "attachmentUrl",
        r.attachment_name as "attachmentName",
        r.attachment_type as "attachmentType",
        r.attachment_size as "attachmentSize",
        r.created_at as "createdAt",
        r.updated_at as "updatedAt",
        u.name as "createdByName"
      FROM reports r
      LEFT JOIN users u ON r.created_by = u.id
      WHERE r.project_id = $1   -- removed ::uuid cast (column is text)
      ORDER BY r.report_date DESC, r.created_at DESC`,
      [projectId]
    );
  },

  // ========== CREATE REPORT WITH ATTACHMENT ==========
  async createReport(data: {
    projectId: string;
    reportDate?: string;
    summary: string;
    blockers?: string;
    nextSteps?: string;
    attachmentUrl?: string;
    attachmentName?: string;
    attachmentType?: string;
    attachmentSize?: number;
    createdBy?: string;
  }): Promise<any> {
    const rows = await executeQueryWithLog(
      `INSERT INTO reports (
        project_id, 
        report_date, 
        summary, 
        blockers, 
        next_steps,
        attachment_url,
        attachment_name,
        attachment_type,
        attachment_size,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING 
        id,
        project_id as "projectId",
        report_date as "reportDate",
        summary,
        blockers,
        next_steps as "nextSteps",
        attachment_url as "attachmentUrl",
        attachment_name as "attachmentName",
        attachment_type as "attachmentType",
        attachment_size as "attachmentSize",
        created_at as "createdAt",
        updated_at as "updatedAt"`,
      [
        data.projectId,
        data.reportDate || new Date().toISOString().split('T')[0],
        data.summary,
        data.blockers || null,
        data.nextSteps || null,
        data.attachmentUrl || null,
        data.attachmentName || null,
        data.attachmentType || null,
        data.attachmentSize || null,
        data.createdBy || null
      ]
    );
    return rows[0];
  },

  // ========== UPDATE REPORT WITH ATTACHMENT ==========
  async updateReport(
    id: string,
    data: {
      summary?: string;
      blockers?: string;
      nextSteps?: string;
      attachmentUrl?: string | null;
      attachmentName?: string | null;
      attachmentType?: string | null;
      attachmentSize?: number | null;
    }
  ): Promise<any> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.summary !== undefined) {
      fields.push(`summary = $${paramIndex}`);
      values.push(data.summary);
      paramIndex++;
    }
    if (data.blockers !== undefined) {
      fields.push(`blockers = $${paramIndex}`);
      values.push(data.blockers);
      paramIndex++;
    }
    if (data.nextSteps !== undefined) {
      fields.push(`next_steps = $${paramIndex}`);
      values.push(data.nextSteps);
      paramIndex++;
    }
    if (data.attachmentUrl !== undefined) {
      fields.push(`attachment_url = $${paramIndex}`);
      values.push(data.attachmentUrl);
      paramIndex++;
    }
    if (data.attachmentName !== undefined) {
      fields.push(`attachment_name = $${paramIndex}`);
      values.push(data.attachmentName);
      paramIndex++;
    }
    if (data.attachmentType !== undefined) {
      fields.push(`attachment_type = $${paramIndex}`);
      values.push(data.attachmentType);
      paramIndex++;
    }
    if (data.attachmentSize !== undefined) {
      fields.push(`attachment_size = $${paramIndex}`);
      values.push(data.attachmentSize);
      paramIndex++;
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE reports 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}::uuid
      RETURNING 
        id,
        project_id as "projectId",
        report_date as "reportDate",
        summary,
        blockers,
        next_steps as "nextSteps",
        attachment_url as "attachmentUrl",
        attachment_name as "attachmentName",
        attachment_type as "attachmentType",
        attachment_size as "attachmentSize",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `;

    const rows = await executeQueryWithLog(query, values);
    return rows[0];
  },

  // ========== GET REPORT BY ID WITH ATTACHMENT ==========
  async getReportById(id: string): Promise<any> {
    const rows = await executeQueryWithLog(
      `SELECT 
        r.id,
        r.project_id as "projectId",
        r.report_date as "reportDate",
        r.summary,
        r.blockers,
        r.next_steps as "nextSteps",
        r.attachment_url as "attachmentUrl",
        r.attachment_name as "attachmentName",
        r.attachment_type as "attachmentType",
        r.attachment_size as "attachmentSize",
        r.created_at as "createdAt",
        r.updated_at as "updatedAt",
        u.name as "createdByName",
        p.name as "projectName"
      FROM reports r
      LEFT JOIN users u ON r.created_by = u.id
      LEFT JOIN projects p ON r.project_id = p.id
      WHERE r.id = $1::uuid`,
      [id]
    );
    return rows[0] || null;
  },

  // ========== GET REPORT ATTACHMENT STATS ==========
  async getReportAttachmentStats(projectId: string): Promise<any> {
    const rows = await executeQueryWithLog(
      `SELECT 
        COUNT(*) as total,
        COUNT(attachment_url) as with_attachments,
        COALESCE(SUM(attachment_size), 0) as total_size_bytes,
        COUNT(DISTINCT attachment_type) as unique_types
      FROM reports
      WHERE project_id = $1   -- removed ::uuid cast (column is text)`,
      [projectId]
    );
    return rows[0] || {};
  },

  // ========== GET LATEST REPORT ==========
  async getLatestReport(projectId: string): Promise<any> {
    const rows = await executeQueryWithLog(
      `SELECT 
        r.id,
        r.project_id as "projectId",
        r.report_date as "reportDate",
        r.summary,
        r.blockers,
        r.next_steps as "nextSteps",
        r.created_at as "createdAt",
        r.updated_at as "updatedAt",
        u.name as "createdByName"
      FROM reports r
      LEFT JOIN users u ON r.created_by = u.id
      WHERE r.project_id = $1   -- removed ::uuid cast (column is text)
      ORDER BY r.report_date DESC
      LIMIT 1`,
      [projectId]
    );
    return rows[0] || null;
  },

  // ========== CREATE PLAN ==========
  async createPlan(data: {
    projectId: string;
    parentId?: string;
    planType: 'QUARTERLY' | 'MONTHLY' | 'WEEKLY' | 'DAILY' | 'ANNUAL' | 'PHASE' | 'TASK';
    title: string;
    description?: string;
    startDate?: Date;
    endDate?: Date;
    dueDate?: Date;
    assigneeId?: string;
    priority?: number;
    budget?: number;
    estimatedHours?: number;
    metadata?: any;
    status?: string;
  }): Promise<any> {
    const priority = data.priority !== undefined && data.priority !== null ? Number(data.priority) : 3;
    const estimatedHours = data.estimatedHours !== undefined && data.estimatedHours !== null ? Number(data.estimatedHours) : 0;
    const budget = data.budget !== undefined && data.budget !== null ? Number(data.budget) : 0;

    const rows = await executeQueryWithLog(
      `INSERT INTO plans (
        project_id, parent_id, plan_type, title, description,
        start_date, end_date, due_date,
        assignee_id, priority, estimated_hours, budget,
        metadata, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING 
        id, project_id as "projectId", parent_id as "parentId",
        plan_type as "planType", title, description,
        status, progress,
        start_date as "startDate", end_date as "endDate", due_date as "dueDate",
        assignee_id as "assigneeId", priority,
        estimated_hours as "estimatedHours", actual_hours as "actualHours",
        budget, completed_at as "completedAt",
        created_at as "createdAt", updated_at as "updatedAt"`,
      [
        data.projectId,
        data.parentId || null,
        data.planType,
        data.title,
        data.description || null,
        data.startDate || null,
        data.endDate || null,
        data.dueDate || null,
        data.assigneeId || null,
        priority,
        estimatedHours,
        budget,
        JSON.stringify(data.metadata || {}),
        data.status || 'NOT_STARTED'
      ]
    );
    
    if (rows.length > 0) {
      await this.logPlanUpdate({
        planId: rows[0].id,
        projectId: data.projectId,
        action: 'CREATED',
        fieldChanged: 'plan',
        newValue: data.title,
        reasonNotes: `Plan "${data.title}" created`,
      });
      await this.updateProjectProgress(data.projectId);
    }
    
    return rows[0];
  },

  // ========== UPDATE PLAN ==========
  async updatePlan(
    planId: string,
    data: {
      title?: string;
      description?: string;
      status?: string;
      progress?: number;
      startDate?: Date | string;
      endDate?: Date | string;
      dueDate?: Date | string;
      assigneeId?: string;
      priority?: number;
      budget?: number;
      estimatedHours?: number;
      actualHours?: number;
      weight?: number;
      parentId?: string;
      notes?: string;
      metadata?: any;
    },
    userId?: string
  ): Promise<any> {
    const currentPlan = await this.getPlanById(planId);
    if (!currentPlan) {
      throw new Error('Plan not found');
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    const logs: any[] = [];

    const validFields: Record<string, string> = {
      title: 'title',
      description: 'description',
      status: 'status',
      progress: 'progress',
      startDate: 'start_date',
      endDate: 'end_date',
      dueDate: 'due_date',
      assigneeId: 'assignee_id',
      priority: 'priority',
      budget: 'budget',
      estimatedHours: 'estimated_hours',
      actualHours: 'actual_hours',
      weight: 'weight',
      notes: 'notes',
      parentId: 'parent_id',
    };

    const processMetadata = (metadata: any) => {
      if (metadata && typeof metadata === 'object') {
        const currentMetadata = currentPlan.metadata || {};
        const newMetadata = { ...currentMetadata, ...metadata };
        return newMetadata;
      }
      return metadata;
    };

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null) {
        const dbField = validFields[key];
        if (!dbField) {
          if (key === 'metadata') {
            const processedMetadata = processMetadata(value);
            const oldValue = currentPlan.metadata;
            if (JSON.stringify(oldValue) !== JSON.stringify(processedMetadata)) {
              logs.push({
                field: 'metadata',
                oldValue: JSON.stringify(oldValue || {}),
                newValue: JSON.stringify(processedMetadata || {}),
              });
              updates.push(`metadata = $${paramIndex}`);
              values.push(processedMetadata);
              paramIndex++;
            }
          } else {
            console.warn(`Skipping unknown field: ${key}`);
          }
          continue;
        }
        const oldValue = currentPlan[key];
        if (oldValue !== value) {
          logs.push({
            field: dbField,
            oldValue: String(oldValue ?? ''),
            newValue: String(value),
          });
        }
        updates.push(`${dbField} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return currentPlan;
    }

    updates.push(`updated_at = NOW()`);
    values.push(planId);

    const query = `
      UPDATE plans 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}::uuid
      RETURNING *
    `;

    const rows = await executeQueryWithLog(query, values);
    const updatedPlan = rows[0];

    for (const log of logs) {
      await this.logPlanUpdate({
        planId,
        projectId: currentPlan.project_id,
        action: 'UPDATED',
        fieldChanged: log.field,
        oldValue: log.oldValue,
        newValue: log.newValue,
        reasonNotes: log.reasonNotes || `Field "${log.field}" updated from "${log.oldValue}" to "${log.newValue}"`,
        createdBy: userId,
      });
    }

    if (data.status !== undefined || data.progress !== undefined) {
      if (currentPlan.parent_id) {
        await this.updateParentProgress(currentPlan.parent_id);
      }
      await this.updateProjectProgress(currentPlan.project_id);
    }

    return updatedPlan;
  },

  // ========== DELETE PLAN ==========
  async deletePlan(id: string): Promise<void> {
    await executeQueryWithLog(
      `DELETE FROM plans WHERE id = $1::uuid`,
      [id]
    );
  },

  // ========== GET PLAN WITH CHILDREN ==========
  async getPlanWithChildren(planId: string): Promise<any> {
    const rows = await executeQueryWithLog(
      `WITH RECURSIVE plan_tree AS (
        SELECT 
          p.*,
          u.name as assignee_name,
          0 as level,
          ARRAY[p.id] as path
        FROM plans p
        LEFT JOIN users u ON p.assignee_id = u.id
        WHERE p.id = $1::uuid
        
        UNION ALL
        
        SELECT 
          c.*,
          u.name as assignee_name,
          pt.level + 1,
          pt.path || c.id
        FROM plans c
        INNER JOIN plan_tree pt ON c.parent_id = pt.id
        LEFT JOIN users u ON c.assignee_id = u.id
      )
      SELECT 
        id, project_id as "projectId", parent_id as "parentId",
        plan_type as "planType", title, description,
        status, progress,
        start_date as "startDate", end_date as "endDate", due_date as "dueDate",
        assignee_id as "assigneeName", 
        priority, estimated_hours as "estimatedHours", actual_hours as "actualHours",
        metadata, completed_at as "completedAt",
        level,
        path,
        created_at as "createdAt", updated_at as "updatedAt"
      FROM plan_tree
      ORDER BY path`,
      [planId]
    );
    return rows;
  },

  // ========== GET CHILDREN ==========
  async getChildren(parentId: string, planType?: string): Promise<any[]> {
    let query = `
      SELECT 
        p.*,
        p.assignee_id as "assignee_name",
        (
          SELECT COUNT(*) FROM plans WHERE parent_id = p.id
        ) as child_count
      FROM plans p
      WHERE p.parent_id = $1::uuid
    `;
    const params: any[] = [parentId];
    let paramIndex = 2;

    if (planType) {
      query += ` AND p.plan_type = $${paramIndex}`;
      params.push(planType);
      paramIndex++;
    }

    query += ` ORDER BY p.created_at ASC`;

    return executeQueryWithLog(query, params);
  },

  // ========== UPDATE PROGRESS ==========
  async updateProgress(planId: string): Promise<any> {
    const result = await executeQueryWithLog(
      `WITH child_progress AS (
        SELECT 
          COALESCE(AVG(progress), 0) as avg_progress,
          COUNT(*) as total_children,
          COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed_children
        FROM plans
        WHERE parent_id = $1::uuid
      )
      UPDATE plans 
      SET 
        progress = (
          SELECT 
            CASE 
              WHEN total_children = 0 THEN progress
              ELSE avg_progress
            END
          FROM child_progress
        ),
        status = (
          SELECT 
            CASE 
              WHEN total_children = 0 THEN status
              WHEN completed_children = total_children THEN 'COMPLETED'
              WHEN avg_progress > 0 THEN 'IN_PROGRESS'
              ELSE 'NOT_STARTED'
            END
          FROM child_progress
        ),
        updated_at = NOW()
      WHERE id = $1::uuid
      RETURNING 
        id, status, progress,
        updated_at as "updatedAt"`,
      [planId]
    );
    return result[0] || null;
  },

  // ========== UPDATE STATUS ==========
  async updateStatus(planId: string, status: string): Promise<any> {
    const rows = await executeQueryWithLog(
      `UPDATE plans 
       SET status = $1,
           completed_at = CASE 
             WHEN $1 = 'COMPLETED' THEN NOW()
             ELSE completed_at
           END,
           updated_at = NOW()
       WHERE id = $2::uuid
       RETURNING 
        id, status, progress,
        completed_at as "completedAt",
        updated_at as "updatedAt"`,
      [status, planId]
    );
    return rows[0];
  },

  // ========== GET PROJECT SUMMARY ==========
  async getProjectPlanningSummary(projectId: string): Promise<any> {
    const rows = await executeQueryWithLog(
      `SELECT 
        COUNT(*) as total_plans,
        COUNT(CASE WHEN plan_type = 'QUARTERLY' THEN 1 END) as quarters,
        COUNT(CASE WHEN plan_type = 'MONTHLY' THEN 1 END) as months,
        COUNT(CASE WHEN plan_type = 'WEEKLY' THEN 1 END) as weeks,
        COUNT(CASE WHEN plan_type = 'DAILY' THEN 1 END) as daily_tasks,
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'IN_PROGRESS' THEN 1 END) as in_progress,
        COUNT(CASE WHEN status = 'NOT_STARTED' THEN 1 END) as not_started,
        COUNT(CASE WHEN status = 'DELAYED' THEN 1 END) as delayed,
        COUNT(CASE WHEN status = 'BLOCKED' THEN 1 END) as blocked,
        AVG(progress) as avg_progress
      FROM plans
      WHERE project_id = $1::uuid`,
      [projectId]
    );
    return rows[0] || {};
  },

  // ========== GET PLAN BY TYPE ==========
  async getPlansByType(projectId: string, planType: string): Promise<any[]> {
    return executeQueryWithLog(
      `SELECT 
        p.*,
        p.assignee_id as assignee_name,
        (
          SELECT COUNT(*) FROM plans WHERE parent_id = p.id
        ) as child_count,
        (
          SELECT COALESCE(AVG(progress), 0) FROM plans WHERE parent_id = p.id
        ) as avg_child_progress
      FROM plans p

      WHERE p.project_id = $1::uuid AND p.plan_type = $2
      ORDER BY p.created_at ASC`,
      [projectId, planType]
    );
  },

  // ========== DELETE REPORT ==========
  async deleteReport(id: string): Promise<void> {
    await executeQueryWithLog(
      `DELETE FROM reports WHERE id = $1::uuid`,
      [id]
    );
  },

  // ========== GET REPORT STATS ==========
  async getReportStats(projectId: string): Promise<any> {
    const rows = await executeQueryWithLog(
      `SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT report_date) as uniqueDates,
        MIN(report_date) as firstReport,
        MAX(report_date) as lastReport
      FROM reports
      WHERE project_id = $1   -- removed ::uuid cast (column is text)`,
      [projectId]
    );
    return rows[0] || {};
  }
};