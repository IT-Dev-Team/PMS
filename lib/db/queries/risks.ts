// lib/db/queries/risks.ts
import { executeQuery } from '@/lib/db';
import { Risk, RiskLevel, RiskStatus, RiskCategory, RiskCreateInput, RiskUpdateInput } from '@/types/risk';

export const RiskQueries = {
  async create(data: RiskCreateInput): Promise<Risk> {
    const riskScore = data.probability * data.impact;
    const riskLevel = this.calculateRiskLevel(riskScore);

    const rows = await executeQuery<Risk>(
      `INSERT INTO risks (
        project_id, title, description, probability, impact,
        risk_score, risk_level, category, mitigation_plan, contingency_plan,
        owner_id, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING 
        id, project_id as "projectId", title, description,
        probability, impact, risk_score as "riskScore",
        risk_level as "riskLevel", category,
        mitigation_plan as "mitigationPlan",
        contingency_plan as "contingencyPlan",
        owner_id as "ownerId", status,
        created_at as "createdAt", updated_at as "updatedAt"`,
      [
        data.projectId,
        data.title,
        data.description,
        data.probability,
        data.impact,
        riskScore,
        riskLevel,
        data.category,
        data.mitigationPlan || null,
        data.contingencyPlan || null,
        data.ownerId || null,
        data.status || 'IDENTIFIED'
      ]
    );
    return rows[0];
  },

  calculateRiskLevel(score: number): String {
    if (score >= 20) return 'CRITICAL';
    if (score >= 15) return 'HIGH';
    if (score >= 8) return 'MEDIUM';
    return 'LOW';
  },

  async findById(id: string): Promise<Risk | null> {
    const rows = await executeQuery<Risk>(
      `SELECT 
        r.*,
        u.name as "ownerName"
      FROM risks r
      LEFT JOIN users u ON r.owner_id = u.id
      WHERE r.id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  async findByProject(projectId: string): Promise<Risk[]> {
    
    return executeQuery<Risk>(
      `SELECT 
        r.*
      FROM risks r
    
      WHERE r.project_id = $1::uuid
      ORDER BY r.risk_score DESC, r.created_at DESC`,
      [projectId]
    );
  },

  async findAll(filters?: {
    projectId?: string;
    status?: RiskStatus;
    category?: RiskCategory;
    riskLevel?: RiskLevel;
    ownerId?: string;
  }): Promise<Risk[]> {
    let query = `
      SELECT 
        r.*,
        u.name as "ownerName"
      FROM risks r
      LEFT JOIN users u ON r.owner_id::uuid = u.id::uuid
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.projectId) {
      query += ` AND r.project_id = $${paramIndex}`;
      params.push(filters.projectId);
      paramIndex++;
    }

    if (filters?.status) {
      query += ` AND r.status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    if (filters?.category) {
      query += ` AND r.category = $${paramIndex}`;
      params.push(filters.category);
      paramIndex++;
    }

    if (filters?.riskLevel) {
      query += ` AND r.risk_level = $${paramIndex}`;
      params.push(filters.riskLevel);
      paramIndex++;
    }

    if (filters?.ownerId) {
      query += ` AND r.owner_id = $${paramIndex}`;
      params.push(filters.ownerId);
      paramIndex++;
    }

    query += ` ORDER BY r.risk_score DESC, r.created_at DESC`;

    return executeQuery<Risk>(query, params);
  },

  async update(id: string, data: RiskUpdateInput): Promise<Risk> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const fieldMap: Record<string, string> = {
      projectId: 'project_id',
      mitigationPlan: 'mitigation_plan',
      contingencyPlan: 'contingency_plan',
      ownerId: 'owner_id',
      riskScore: 'risk_score',
      riskLevel: 'risk_level',
    };

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        const dbField = fieldMap[key] || key;
        fields.push(`${dbField} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    });

    // Update risk score if probability or impact changed
    if (data.probability !== undefined || data.impact !== undefined) {
      const current = await this.findById(id);
      if (current) {
        const probability = data.probability ?? current.probability;
        const impact = data.impact ?? current.impact;
        const riskScore = probability * impact;
        const riskLevel = this.calculateRiskLevel(riskScore);
        
        fields.push(`risk_score = $${paramIndex}`);
        values.push(riskScore);
        paramIndex++;
        fields.push(`risk_level = $${paramIndex}`);
        values.push(riskLevel);
        paramIndex++;
      }
    }

    values.push(id);
    const query = `
      UPDATE risks 
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING 
        id, project_id as "projectId", title, description,
        probability, impact, risk_score as "riskScore",
        risk_level as "riskLevel", category,
        mitigation_plan as "mitigationPlan",
        contingency_plan as "contingencyPlan",
        owner_id as "ownerId", status,
        created_at as "createdAt", updated_at as "updatedAt"
    `;

    const rows = await executeQuery<Risk>(query, values);
    return rows[0];
  },

  async updateStatus(id: string, status: RiskStatus): Promise<Risk> {
    const rows = await executeQuery<Risk>(
      `UPDATE risks 
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING 
        id, project_id as "projectId", title, description,
        probability, impact, risk_score as "riskScore",
        risk_level as "riskLevel", category,
        mitigation_plan as "mitigationPlan",
        contingency_plan as "contingencyPlan",
        owner_id as "ownerId", status,
        created_at as "createdAt", updated_at as "updatedAt"`,
      [status, id]
    );
    return rows[0];
  },

  async delete(id: string): Promise<void> {
    await executeQuery(
      `DELETE FROM risks WHERE id = $1`,
      [id]
    );
  },

  async getHeatMapData(projectId?: string): Promise<any[]> {
    let query = `
      SELECT 
        probability,
        impact,
        COUNT(*) as count,
        ARRAY_AGG(title) as "riskTitles"
      FROM risks
      WHERE status != 'CLOSED'
    `;
    const params: any[] = [];
    
    if (projectId) {
      query += ` AND project_id = $1`;
      params.push(projectId);
    }
    
    query += ` GROUP BY probability, impact ORDER BY probability DESC, impact DESC`;
    
    return executeQuery(query, params);
  },

  async getPortfolioRiskExposure(): Promise<any> {
    const rows = await executeQuery(
      `SELECT 
        COUNT(*) as "totalRisks",
        COUNT(CASE WHEN risk_level = 'CRITICAL' THEN 1 END) as critical,
        COUNT(CASE WHEN risk_level = 'HIGH' THEN 1 END) as high,
        COUNT(CASE WHEN risk_level = 'MEDIUM' THEN 1 END) as medium,
        COUNT(CASE WHEN risk_level = 'LOW' THEN 1 END) as low,
        AVG(risk_score) as "avgRiskScore",
        SUM(CASE 
          WHEN risk_level = 'CRITICAL' THEN 1000000
          WHEN risk_level = 'HIGH' THEN 100000
          WHEN risk_level = 'MEDIUM' THEN 10000
          ELSE 1000
        END) as "totalExposure"
      FROM risks
      WHERE status != 'CLOSED'`
    );
    return rows[0] || {};
  },

  async getRiskStats(projectId: string): Promise<any> {
    const rows = await executeQuery(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'IDENTIFIED' THEN 1 END) as identified,
        COUNT(CASE WHEN status = 'ASSESSED' THEN 1 END) as assessed,
        COUNT(CASE WHEN status = 'MITIGATING' THEN 1 END) as mitigating,
        COUNT(CASE WHEN status = 'ACCEPTED' THEN 1 END) as accepted,
        COUNT(CASE WHEN status = 'AVOIDED' THEN 1 END) as avoided,
        COUNT(CASE WHEN status = 'TRANSFERRED' THEN 1 END) as transferred,
        COUNT(CASE WHEN status = 'CLOSED' THEN 1 END) as closed,
        AVG(risk_score) as "avgRiskScore"
      FROM risks
      WHERE project_id = $1`,
      [projectId]
    );
    return rows[0] || {};
  },
  async getPortfolioRisks(portfolioId?: string) {
    let query = `
      SELECT 
        r.id,
        r.title,
        r.description,
        r.risk_level as "level",
        r.risk_score as "score",
        r.status,
        p.name as "projectName"
      FROM risks r
      LEFT JOIN projects p ON r.project_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];
    
    if (portfolioId) {
      query += ` AND p.portfolio_id = $1`;
      params.push(portfolioId);
    }
    
    query += ` ORDER BY r.risk_score DESC LIMIT 10`;
    
    return executeQuery(query, params);
  }
};