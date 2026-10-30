// lib/db/queries/procurement.ts
import { executeQuery } from '@/lib/db';
import { 
  ProcurementPackage, 
  ProcurementPackageCreateInput, 
  ProcurementPackageUpdateInput,
  ContractMilestone,
  MilestoneCreateInput,
  Vendor
} from '@/types/procurement';

export const ProcurementQueries = {
  // ========== VENDORS ==========

  // Add to lib/db/queries/procurement.ts
async createVendor(data: { name: string; code: string; contactName?: string | null; email?: string | null; phone?: string | null; rating?: number | null }): Promise<Vendor> {
  const rows = await executeQuery(
    `INSERT INTO vendors (name, code, contact_name, email, phone, rating, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE')
     RETURNING id, name, code, contact_name as "contactName", email, phone, rating, status, created_at as "createdAt", updated_at as "updatedAt"`,
    [data.name, data.code, data.contactName || null, data.email || null, data.phone || null, data.rating || null]
  );
  return rows[0];
},
// lib/db/queries/procurement.ts

 /**
   * Get all vendors with optional filtering
   */
   async getVendors(options?: {
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

    // Filter by status
    if (options?.status && options.status !== 'ALL') {
      query += ` AND status = $${paramIndex}`;
      params.push(options.status);
      paramIndex++;
    }

    // Filter by minimum rating
    if (options?.rating !== undefined && options.rating > 0) {
      query += ` AND rating >= $${paramIndex}`;
      params.push(options.rating);
      paramIndex++;
    }

    // Search by name, code, or contact name
    if (options?.search) {
      query += ` AND (
        name ILIKE $${paramIndex} OR 
        code ILIKE $${paramIndex} OR 
        contact_name ILIKE $${paramIndex}
      )`;
      params.push(`%${options.search}%`);
      paramIndex++;
    }

    // Order by name
    query += ` ORDER BY name ASC`;

    const rows = await executeQuery(query, params);
    return rows;
  },

  /**
   * Get a single vendor by ID
   */
   async getVendorById(id: string): Promise<Vendor | null> {
    const rows = await executeQuery(
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
  },

  /**
   * Get vendors by project (vendors that have costs logged for a project)
   */
   async getVendorsByProject(projectId: string): Promise<Vendor[]> {
    const rows = await executeQuery(
      `SELECT DISTINCT 
        v.id, 
        v.name, 
        v.code, 
        v.contact_name as "contactName", 
        v.email, 
        v.phone, 
        v.rating, 
        v.status,
        v.created_at as "createdAt", 
        v.updated_at as "updatedAt"
      FROM vendors v
      INNER JOIN actual_costs ac ON ac.vendor_id = v.id
      WHERE ac.project_id = $1
      ORDER BY v.name ASC`,
      [projectId]
    );
    return rows;
  },

  /**
   * Update a vendor
   */
   async updateVendor(
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

    const rows = await executeQuery(
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
  },

  /**
   * Delete a vendor (soft delete by setting status to INACTIVE)
   */
   async deleteVendor(id: string): Promise<boolean> {
    const result = await executeQuery(
      `UPDATE vendors 
       SET status = 'INACTIVE', updated_at = NOW()
       WHERE id = $1
       RETURNING id`,
      [id]
    );
    return result.length > 0;
  },

  /**
   * Hard delete a vendor (only if no costs associated)
   */
  async hardDeleteVendor(id: string): Promise<boolean> {
    // Check if vendor has associated costs
    const costs = await executeQuery(
      `SELECT COUNT(*) as count FROM actual_costs WHERE vendor_id = $1`,
      [id]
    );
    
    if (costs[0]?.count > 0) {
      throw new Error('Cannot delete vendor with associated costs. Consider deactivating instead.');
    }

    const result = await executeQuery(
      `DELETE FROM vendors WHERE id = $1 RETURNING id`,
      [id]
    );
    return result.length > 0;
  },

// lib/db/queries/procurement.ts

async getPackageCount(filters?: {
  portfolioId?: string;
  projectId?: string;
  vendorId?: string;
  status?: string;
  search?: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<number> {
  let query = `
    SELECT COUNT(*) as count
    FROM procurement_packages p
    LEFT JOIN projects pr ON p.project_id = pr.id
    LEFT JOIN vendors v ON p.vendor_id = v.id
    WHERE 1=1
  `;
  const params: any[] = [];
  let paramIndex = 1;

  if (filters?.portfolioId) {
    query += ` AND pr.portfolio_id = $${paramIndex}::uuid`;
    params.push(filters.portfolioId);
    paramIndex++;
  }

  if (filters?.projectId) {
    query += ` AND p.project_id = $${paramIndex}::uuid`;
    params.push(filters.projectId);
    paramIndex++;
  }

  if (filters?.vendorId) {
    query += ` AND p.vendor_id = $${paramIndex}::uuid`;
    params.push(filters.vendorId);
    paramIndex++;
  }

  if (filters?.status) {
    query += ` AND p.status = $${paramIndex}`;
    params.push(filters.status);
    paramIndex++;
  }

  if (filters?.search) {
    query += ` AND (p.title ILIKE $${paramIndex} OR p.code ILIKE $${paramIndex} OR v.name ILIKE $${paramIndex})`;
    params.push(`%${filters.search}%`);
    paramIndex++;
  }

  if (filters?.startDate) {
    query += ` AND p.start_date >= $${paramIndex}`;
    params.push(filters.startDate);
    paramIndex++;
  }

  if (filters?.endDate) {
    query += ` AND p.end_date <= $${paramIndex}`;
    params.push(filters.endDate);
    paramIndex++;
  }

  const result = await executeQuery(query, params);
  return parseInt(result[0]?.count || '0');
},
async createPaymentRecord(data: { 
  packageId: string; 
  milestoneId?: string; 
  amount: number; 
  paidDate: Date; 
  referenceNumber?: string; 
  notes?: string 
}): Promise<any> {
  const rows = await executeQuery(
    `INSERT INTO payment_records (package_id, milestone_id, amount, paid_date, reference_number, notes, status)
     VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, 'PAID')
     RETURNING id, package_id as "packageId", milestone_id as "milestoneId", amount, paid_date as "paidDate", reference_number as "referenceNumber", notes, status, created_at as "createdAt", updated_at as "updatedAt"`,
    [data.packageId, data.milestoneId || null, data.amount, data.paidDate, data.referenceNumber || null, data.notes || null]
  );
  return rows[0];
},

async getPaymentRecords(packageId: string): Promise<any[]> {
  return executeQuery(
    `SELECT 
      pr.*,
      cm.title as milestone_title,
      cm.percentage as milestone_percentage
     FROM payment_records pr
     LEFT JOIN contract_milestones cm ON pr.milestone_id = cm.id
     WHERE pr.package_id = $1::uuid
     ORDER BY pr.paid_date DESC, pr.created_at DESC`,
    [packageId]
  );
},

async getTotalPaid(packageId: string): Promise<number> {
  const result = await executeQuery(
    `SELECT COALESCE(SUM(amount), 0) as total FROM payment_records WHERE package_id = $1::uuid`,
    [packageId]
  );
  return parseFloat(result[0]?.total || 0);
},

async deletePaymentRecord(id: string): Promise<void> {
  await executeQuery(
    `DELETE FROM payment_records WHERE id = $1::uuid`,
    [id]
  );
},
// lib/db/queries/procurement.ts
async updatePackageProgress(packageId: string): Promise<void> {
  // Cast packageId to UUID
  const result = await executeQuery(
    `SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed
     FROM contract_milestones
     WHERE package_id = $1::uuid`,
    [packageId]
  );
  const stats = result[0] || { total: 0, completed: 0 };
  const progress = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
  await executeQuery(
    `UPDATE procurement_packages 
     SET progress = $1, updated_at = NOW() 
     WHERE id = $2::uuid`,
    [progress, packageId]
  );
},

// lib/db/queries/procurement.ts
async deleteMilestonesByPackage(packageId: string): Promise<void> {
  await executeQuery(
    `DELETE FROM contract_milestones WHERE package_id = $1::uuid`,
    [packageId]
  );
},
  async findAllVendors(filters?: { status?: string; search?: string }): Promise<Vendor[]> {
    let query = `
      SELECT 
        id, name, code, contact_name as "contactName",
        email, phone, rating, status,
        created_at as "createdAt", updated_at as "updatedAt"
      FROM vendors
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.status) {
      query += ` AND status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }
    if (filters?.search) {
      query += ` AND (name ILIKE $${paramIndex} OR code ILIKE $${paramIndex})`;
      params.push(`%${filters.search}%`);
      paramIndex++;
    }
    query += ` ORDER BY name ASC`;
    return executeQuery(query, params);
  },

  // ========== PACKAGES ==========
  async findAllPackages(filters?: {
    portfolioId?: string;
    projectId?: string;
    vendorId?: string;
    status?: string;
    search?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<ProcurementPackage[]> {
    let query = `
      SELECT 
        p.*,
        pr.name as "projectName",
        v.name as "vendorName",
        (
          SELECT COUNT(*) FROM contract_milestones WHERE package_id = p.id
        ) as "totalMilestones",
        (
          SELECT COUNT(*) FROM contract_milestones WHERE package_id = p.id AND status = 'COMPLETED'
        ) as "completedMilestones"
      FROM procurement_packages p
      LEFT JOIN projects pr ON p.project_id = pr.id
      LEFT JOIN vendors v ON p.vendor_id = v.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.projectId) {
      query += ` AND p.project_id = $${paramIndex}::uuid`;
      params.push(filters.projectId);
      paramIndex++;
    }
    if (filters?.portfolioId) {
      query += ` AND pr.portfolio_id = $${paramIndex}::uuid`;
      params.push(filters.portfolioId);
      paramIndex++;
    }
    if (filters?.vendorId) {
      query += ` AND p.vendor_id = $${paramIndex}::uuid`;
      params.push(filters.vendorId);
      paramIndex++;
    }
    if (filters?.status) {
      query += ` AND p.status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }
    if (filters?.search) {
      query += ` AND (p.title ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`;
      params.push(`%${filters.search}%`);
      paramIndex++;
    }
    query += ` ORDER BY p.created_at DESC`;
    if (filters?.limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(filters.limit);
      paramIndex++;
    }
    if (filters?.offset) {
      query += ` OFFSET $${paramIndex}`;
      params.push(filters.offset);
      paramIndex++;
    }
    return executeQuery(query, params);
  },

  async getPackageCount(filters?: {
    portfolioId?: string;
    projectId?: string;
    vendorId?: string;
    status?: string;
    search?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<number> {
    let query = `
      SELECT COUNT(*) as count
      FROM procurement_packages p
      LEFT JOIN projects pr ON p.project_id = pr.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.projectId) {
      query += ` AND p.project_id = $${paramIndex}::uuid`;
      params.push(filters.projectId);
      paramIndex++;
    }
    if (filters?.portfolioId) {
      query += ` AND pr.portfolio_id = $${paramIndex}::uuid`;
      params.push(filters.portfolioId);
      paramIndex++;
    }
    if (filters?.vendorId) {
      query += ` AND p.vendor_id = $${paramIndex}::uuid`;
      params.push(filters.vendorId);
      paramIndex++;
    }
    if (filters?.status) {
      query += ` AND p.status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }
    if (filters?.search) {
      query += ` AND (p.title ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`;
      params.push(`%${filters.search}%`);
      paramIndex++;
    }
    const rows = await executeQuery(query, params);
    return parseInt(rows[0]?.count || '0', 10);
  },
 async findPackageById(id: string): Promise<ProcurementPackage | null> {
  const rows = await executeQuery(
    `SELECT 
      p.*,
      pr.name as "projectName",
      v.name as "vendorName",
      (
        SELECT json_agg(
          json_build_object(
            'id', m.id,
            'title', m.title,
            'dueDate', m.due_date,
            'percentage', m.percentage,
            'status', m.status,
            'deliveredAt', m.delivered_at,
            'createdAt', m.created_at,
            'updatedAt', m.updated_at
          )
          ORDER BY m.due_date ASC
        )
        FROM contract_milestones m
        WHERE m.package_id = p.id
      ) as milestones
    FROM procurement_packages p
    LEFT JOIN projects pr ON p.project_id = pr.id
    LEFT JOIN vendors v ON p.vendor_id = v.id
    WHERE p.id = $1::uuid`,
    [id]
  );
  return rows[0] || null;
},

  async createPackage(data: ProcurementPackageCreateInput): Promise<ProcurementPackage> {
    const rows = await executeQuery(
      `INSERT INTO procurement_packages (
        project_id, vendor_id, title, description,
        contract_value, terms, status, payment_schedule
      ) VALUES ($1, $2, $3, $4, $5, $6, 'DRAFT', $7)
      RETURNING 
        id, project_id as "projectId", vendor_id as "vendorId",
        title, description, contract_value as "contractValue",
        terms, status, payment_schedule as "paymentSchedule",
        created_at as "createdAt", updated_at as "updatedAt"`,
      [
        data.projectId,
        data.vendorId || null,
        data.title,
        data.description || null,
        data.contractValue,
        data.terms || null,
        data.paymentSchedule || {}
      ]
    );
    return rows[0];
  },

  async updatePackage(id: string, data: ProcurementPackageUpdateInput): Promise<ProcurementPackage> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const fieldMap: Record<string, string> = {
      vendorId: 'vendor_id',
      contractValue: 'contract_value',
      paymentSchedule: 'payment_schedule',
    };

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        const dbField = fieldMap[key] || key;
        fields.push(`${dbField} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    });

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE procurement_packages 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}::uuid
      RETURNING 
        id, project_id as "projectId", vendor_id as "vendorId",
        title, description, contract_value as "contractValue",
        terms, status, payment_schedule as "paymentSchedule",
        created_at as "createdAt", updated_at as "updatedAt"
    `;

    const rows = await executeQuery(query, values);
    return rows[0];
  },

  async updatePackageStatus(id: string, status: string): Promise<ProcurementPackage> {
    const rows = await executeQuery(
      `UPDATE procurement_packages 
       SET status = $1, updated_at = NOW()
       WHERE id = $2::uuid
       RETURNING 
        id, project_id as "projectId", vendor_id as "vendorId",
        title, description, contract_value as "contractValue",
        terms, status, payment_schedule as "paymentSchedule",
        created_at as "createdAt", updated_at as "updatedAt"`,
      [status, id]
    );
    return rows[0];
  },

  async deletePackage(id: string): Promise<void> {
    // Delete milestones first
    await executeQuery(
      `DELETE FROM contract_milestones WHERE package_id = $1::uuid`,
      [id]
    );
    await executeQuery(
      `DELETE FROM procurement_packages WHERE id = $1::uuid`,
      [id]
    );
  },

  // ========== MILESTONES ==========
  async createMilestone(data: MilestoneCreateInput): Promise<ContractMilestone> {
    const rows = await executeQuery(
      `INSERT INTO contract_milestones (
        package_id, title, due_date, percentage, status
      ) VALUES ($1, $2, $3, $4, 'PENDING')
      RETURNING 
        id, package_id as "packageId",
        title, due_date as "dueDate",
        percentage, status,
        delivered_at as "deliveredAt",
        created_at as "createdAt", updated_at as "updatedAt"`,
      [
        data.packageId,
        data.title,
        data.dueDate,
        data.percentage
      ]
    );
    return rows[0];
  },

  async updateMilestoneStatus(id: string, status: string): Promise<ContractMilestone> {
    const rows = await executeQuery(
      `UPDATE contract_milestones 
       SET status = $1, 
           delivered_at = CASE WHEN $1 = 'COMPLETED' THEN NOW() ELSE delivered_at END,
           updated_at = NOW()
       WHERE id = $2::uuid
       RETURNING 
        id, package_id as "packageId",
        title, due_date as "dueDate",
        percentage, status,
        delivered_at as "deliveredAt",
        created_at as "createdAt", updated_at as "updatedAt"`,
      [status, id]
    );
    // Update package progress based on milestones
    await this.updatePackageProgress(rows[0].packageId);
    return rows[0];
  },

  async deleteMilestone(id: string): Promise<void> {
    const milestone = await executeQuery(
      `SELECT package_id FROM contract_milestones WHERE id = $1::uuid`,
      [id]
    );
    await executeQuery(
      `DELETE FROM contract_milestones WHERE id = $1::uuid`,
      [id]
    );
    if (milestone.length > 0) {
      await this.updatePackageProgress(milestone[0].package_id);
    }
  },

  async getProcurementDashboard(): Promise<any> {
    const rows = await executeQuery(
      `SELECT 
        COUNT(*) as "totalPackages",
        COALESCE(SUM(contract_value), 0) as "totalContractValue",
        COUNT(DISTINCT vendor_id) as "activeVendors",
        COUNT(CASE WHEN status IN ('IN_PROGRESS', 'AWARDED') THEN 1 END) as "packagesOnTrack",
        COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) as "packagesAtRisk",
        (
          SELECT COUNT(*) FROM contract_milestones
        ) as "totalMilestones",
        (
          SELECT COUNT(*) FROM contract_milestones WHERE status = 'COMPLETED'
        ) as "completedMilestones"
      FROM procurement_packages`
    );
    return rows[0] || {};
  },

  async getPackageMilestones(packageId: string): Promise<ContractMilestone[]> {
    return executeQuery(
      `SELECT 
        id, package_id as "packageId",
        title, due_date as "dueDate",
        percentage, status,
        delivered_at as "deliveredAt",
        created_at as "createdAt", updated_at as "updatedAt"
      FROM contract_milestones
      WHERE package_id = $1::uuid
      ORDER BY due_date ASC`,
      [packageId]
    );
  }
};