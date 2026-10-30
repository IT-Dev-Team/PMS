// lib/db/queries/audit.ts
import { executeQuery } from '@/lib/db';
import { AuditLog } from '@/types/common';

export interface AuditLogCreateInput {
  userId?: string;
  action: string;
  entityType: string;
  entityId: string;
  changes: any;
  reason?: string;
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
}

export const AuditQueries = {
  async create(data: AuditLogCreateInput): Promise<AuditLog> {
    const rows = await executeQuery<AuditLog>(
      `INSERT INTO audit_logs (
        user_id, action, entity_type, entity_id, changes,
        reason, metadata, ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING 
        id, user_id as "userId", action,
        entity_type as "entityType", entity_id as "entityId",
        changes, reason, metadata,
        ip_address as "ipAddress", user_agent as "userAgent",
        created_at as "createdAt"`,
      [
        data.userId || null,
        data.action,
        data.entityType,
        data.entityId,
        JSON.stringify(data.changes),
        data.reason || null,
        data.metadata || null,
        data.ipAddress || null,
        data.userAgent || null
      ]
    );
    return rows[0];
  },

  async findByEntity(entityType: string, entityId: string, limit: number = 50): Promise<AuditLog[]> {
    return executeQuery<AuditLog>(
      `SELECT 
        a.*,
        u.name as "userName"
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.entity_type = $1 AND a.entity_id = $2
      ORDER BY a.created_at DESC
      LIMIT $3`,
      [entityType, entityId, limit]
    );
  },

  async findByUser(userId: string, limit: number = 50): Promise<AuditLog[]> {
    return executeQuery<AuditLog>(
      `SELECT 
        a.*,
        u.name as "userName"
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.user_id = $1
      ORDER BY a.created_at DESC
      LIMIT $2`,
      [userId, limit]
    );
  },

  async findRecent(limit: number = 100): Promise<AuditLog[]> {
    return executeQuery<AuditLog>(
      `SELECT 
        a.*,
        u.name as "userName"
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      ORDER BY a.created_at DESC
      LIMIT $1`,
      [limit]
    );
  },

  async findWithFilters(filters: {
    entityType?: string;
    entityId?: string;
    userId?: string;
    action?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ data: AuditLog[]; total: number }> {
    let query = `
      SELECT 
        a.*,
        u.name as "userName"
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.entityType) {
      query += ` AND a.entity_type = $${paramIndex}`;
      params.push(filters.entityType);
      paramIndex++;
    }

    if (filters.entityId) {
      query += ` AND a.entity_id = $${paramIndex}`;
      params.push(filters.entityId);
      paramIndex++;
    }

    if (filters.userId) {
      query += ` AND a.user_id = $${paramIndex}`;
      params.push(filters.userId);
      paramIndex++;
    }

    if (filters.action) {
      query += ` AND a.action = $${paramIndex}`;
      params.push(filters.action);
      paramIndex++;
    }

    if (filters.fromDate) {
      query += ` AND a.created_at >= $${paramIndex}`;
      params.push(filters.fromDate);
      paramIndex++;
    }

    if (filters.toDate) {
      query += ` AND a.created_at <= $${paramIndex}`;
      params.push(filters.toDate);
      paramIndex++;
    }

    // Get total count
    const countQuery = query.replace(
      'SELECT a.*, u.name as "userName" FROM audit_logs a LEFT JOIN users u ON a.user_id = u.id',
      'SELECT COUNT(*) as total FROM audit_logs a'
    );
    const countResult = await executeQuery<{ total: number }>(countQuery, params.slice(0, paramIndex - 1));

    // Add ordering and pagination
    query += ` ORDER BY a.created_at DESC`;
    
    if (filters.limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(filters.limit);
      paramIndex++;
    }

    if (filters.offset) {
      query += ` OFFSET $${paramIndex}`;
      params.push(filters.offset);
      paramIndex++;
    }

    const data = await executeQuery<AuditLog>(query, params);

    return {
      data,
      total: countResult[0]?.total || 0
    };
  },

  async getAuditSummary(): Promise<any> {
    const rows = await executeQuery(
      `SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT user_id) as uniqueUsers,
        COUNT(DISTINCT entity_type) as entityTypes,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as last24h,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as last7d
      FROM audit_logs`
    );
    return rows[0] || {};
  },

  async getTopActions(limit: number = 10): Promise<any[]> {
    return executeQuery(
      `SELECT 
        action,
        COUNT(*) as count
      FROM audit_logs
      GROUP BY action
      ORDER BY count DESC
      LIMIT $1`,
      [limit]
    );
  }
};