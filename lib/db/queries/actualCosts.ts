// lib/db/queries/actualCosts.ts
import { executeQuery } from '@/lib/db';

export const ActualCostQueries = {
  /**
   * Create a new actual cost entry
   */
  async create(data: {
    projectId: string;
    planId?: string;               // optional – link to a planning item
    period: string;                // date (YYYY-MM-DD)
    amount: number;
    costType: string;              // e.g. 'LABOR', 'MATERIAL', 'EQUIPMENT', 'OTHER'
    description?: string;
    referenceNumber?: string;
    vendorId?: string;
    invoiceNumber?: string;
    poNumber?: string;
    approvedBy?: string;
    status?: string;               // default: 'PENDING'
    currency?: string;             // default: 'USD'
    exchangeRate?: number;         // default: 1
    budgetLineItemId?: string;     // optional link to budget line item
  }) {
    const rows = await executeQuery(
      `INSERT INTO actual_costs (
        project_id, plan_id, period, amount, cost_type, description,
        reference_number, vendor_id, invoice_number, po_number,
        approved_by, status, currency, exchange_rate, budget_line_item_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING 
        id, project_id as "projectId", plan_id as "planId", period, amount,
        cost_type as "costType", description, reference_number as "referenceNumber",
        vendor_id as "vendorId", invoice_number as "invoiceNumber", po_number as "poNumber",
        approved_by as "approvedBy", status, currency, exchange_rate as "exchangeRate",
        budget_line_item_id as "budgetLineItemId",
        created_at as "createdAt", updated_at as "updatedAt"`,
      [
        data.projectId,
        data.planId || null,
        data.period,
        data.amount,
        data.costType,
        data.description || null,
        data.referenceNumber || null,
        data.vendorId || null,
        data.invoiceNumber || null,
        data.poNumber || null,
        data.approvedBy || null,
        data.status || 'PENDING',
        data.currency || 'USD',
        data.exchangeRate || 1,
        data.budgetLineItemId || null,
      ]
    );
    return rows[0];
  },

  /**
   * Get all actual costs for a project (with optional plan name)
   */
  async getByProject(projectId: string) {
    return executeQuery(
      `SELECT 
        ac.id, ac.project_id as "projectId", ac.plan_id as "planId",
        ac.period, ac.amount, ac.cost_type as "costType", ac.description,
        ac.reference_number as "referenceNumber", ac.vendor_id as "vendorId",
        ac.invoice_number as "invoiceNumber", ac.po_number as "poNumber",
        ac.approved_by as "approvedBy", ac.status, ac.currency, ac.exchange_rate as "exchangeRate",
        ac.budget_line_item_id as "budgetLineItemId",
        ac.created_at as "createdAt", ac.updated_at as "updatedAt",
        p.title as planName,
        p.plan_type as "planType"
      FROM actual_costs ac
      LEFT JOIN plans p ON ac.plan_id = p.id
      WHERE ac.project_id = $1
      ORDER BY ac.period DESC, ac.created_at DESC`,
      [projectId]
    );
  },

  /**
   * Get all actual costs for a specific plan (phase/task)
   */
  async getByPlan(planId: string) {
    return executeQuery(
      `SELECT 
        id, project_id as "projectId", plan_id as "planId",
        period, amount, cost_type as "costType", description,
        reference_number as "referenceNumber", vendor_id as "vendorId",
        invoice_number as "invoiceNumber", po_number as "poNumber",
        approved_by as "approvedBy", status, currency, exchange_rate as "exchangeRate",
        budget_line_item_id as "budgetLineItemId",
        created_at as "createdAt", updated_at as "updatedAt"
      FROM actual_costs
      WHERE plan_id = $1
      ORDER BY period DESC`,
      [planId]
    );
  },

  /**
   * Get actual costs by budget line item
   */
  async getByBudgetLineItem(budgetLineItemId: string) {
    return executeQuery(
      `SELECT * FROM actual_costs WHERE budget_line_item_id = $1 ORDER BY period DESC`,
      [budgetLineItemId]
    );
  },

  /**
   * Update an actual cost
   */
  async update(id: string, data: {
    amount?: number;
    period?: string;
    description?: string;
    referenceNumber?: string;
    vendorId?: string;
    invoiceNumber?: string;
    poNumber?: string;
    approvedBy?: string;
    status?: string;
    currency?: string;
    exchangeRate?: number;
  }) {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.amount !== undefined) {
      fields.push(`amount = $${paramIndex}`);
      values.push(data.amount);
      paramIndex++;
    }
    if (data.period !== undefined) {
      fields.push(`period = $${paramIndex}`);
      values.push(data.period);
      paramIndex++;
    }
    if (data.description !== undefined) {
      fields.push(`description = $${paramIndex}`);
      values.push(data.description);
      paramIndex++;
    }
    if (data.referenceNumber !== undefined) {
      fields.push(`reference_number = $${paramIndex}`);
      values.push(data.referenceNumber);
      paramIndex++;
    }
    if (data.vendorId !== undefined) {
      fields.push(`vendor_id = $${paramIndex}`);
      values.push(data.vendorId);
      paramIndex++;
    }
    if (data.invoiceNumber !== undefined) {
      fields.push(`invoice_number = $${paramIndex}`);
      values.push(data.invoiceNumber);
      paramIndex++;
    }
    if (data.poNumber !== undefined) {
      fields.push(`po_number = $${paramIndex}`);
      values.push(data.poNumber);
      paramIndex++;
    }
    if (data.approvedBy !== undefined) {
      fields.push(`approved_by = $${paramIndex}`);
      values.push(data.approvedBy);
      paramIndex++;
    }
    if (data.status !== undefined) {
      fields.push(`status = $${paramIndex}`);
      values.push(data.status);
      paramIndex++;
    }
    if (data.currency !== undefined) {
      fields.push(`currency = $${paramIndex}`);
      values.push(data.currency);
      paramIndex++;
    }
    if (data.exchangeRate !== undefined) {
      fields.push(`exchange_rate = $${paramIndex}`);
      values.push(data.exchangeRate);
      paramIndex++;
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE actual_costs 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}::uuid
      RETURNING 
        id, project_id as "projectId", plan_id as "planId",
        period, amount, cost_type as "costType", description,
        reference_number as "referenceNumber", vendor_id as "vendorId",
        invoice_number as "invoiceNumber", po_number as "poNumber",
        approved_by as "approvedBy", status, currency, exchange_rate as "exchangeRate",
        budget_line_item_id as "budgetLineItemId",
        created_at as "createdAt", updated_at as "updatedAt"
    `;

    const rows = await executeQuery(query, values);
    return rows[0];
  },

  /**
   * Delete an actual cost
   */
  async delete(id: string) {
    await executeQuery(`DELETE FROM actual_costs WHERE id = $1`, [id]);
  },

  /**
   * Get summary (total) for a project
   */
  async getTotalForProject(projectId: string) {
    const rows = await executeQuery(
      `SELECT 
        SUM(amount) as total,
        COUNT(*) as count,
        MIN(period) as firstPeriod,
        MAX(period) as lastPeriod
      FROM actual_costs
      WHERE project_id = $1`,
      [projectId]
    );
    return rows[0] || { total: 0, count: 0 };
  },
};