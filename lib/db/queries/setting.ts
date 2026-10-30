import { executeQuery } from '@/lib/db';
import { ReasonCode, ReasonCategory, CustomField, FieldType, EntityType } from '@/types/settings';

export const SettingsQueries = {
  // Reason Code Queries
  async createReasonCode(data: { code: string; category: ReasonCategory; description: string }): Promise<ReasonCode> {
    const rows = await executeQuery<ReasonCode>(
      `INSERT INTO reason_codes (code, category, description, is_active)
       VALUES ($1, $2, $3, true)
       RETURNING 
        id, code, category, description,
        is_active as "isActive",
        created_at as "createdAt", updated_at as "updatedAt"`,
      [data.code, data.category, data.description]
    );
    return rows[0];
  },

  async findAllReasonCodes(activeOnly: boolean = false): Promise<ReasonCode[]> {
    let query = `
      SELECT 
        id, code, category, description,
        is_active as "isActive",
        created_at as "createdAt", updated_at as "updatedAt"
      FROM reason_codes
    `;
    
    if (activeOnly) {
      query += ` WHERE is_active = true`;
    }
    
    query += ` ORDER BY category, code`;

    return executeQuery<ReasonCode>(query);
  },

  async findReasonCodeById(id: string): Promise<ReasonCode | null> {
    const rows = await executeQuery<ReasonCode>(
      `SELECT 
        id, code, category, description,
        is_active as "isActive",
        created_at as "createdAt", updated_at as "updatedAt"
      FROM reason_codes WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  async findReasonCodeByCode(code: string): Promise<ReasonCode | null> {
    const rows = await executeQuery<ReasonCode>(
      `SELECT 
        id, code, category, description,
        is_active as "isActive",
        created_at as "createdAt", updated_at as "updatedAt"
      FROM reason_codes WHERE code = $1`,
      [code]
    );
    return rows[0] || null;
  },

  async updateReasonCode(id: string, data: Partial<{ code: string; category: ReasonCategory; description: string; isActive: boolean }>): Promise<ReasonCode> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.code !== undefined) {
      fields.push(`code = $${paramIndex}`);
      values.push(data.code);
      paramIndex++;
    }
    if (data.category !== undefined) {
      fields.push(`category = $${paramIndex}`);
      values.push(data.category);
      paramIndex++;
    }
    if (data.description !== undefined) {
      fields.push(`description = $${paramIndex}`);
      values.push(data.description);
      paramIndex++;
    }
    if (data.isActive !== undefined) {
      fields.push(`is_active = $${paramIndex}`);
      values.push(data.isActive);
      paramIndex++;
    }

    values.push(id);
    const query = `
      UPDATE reason_codes 
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING 
        id, code, category, description,
        is_active as "isActive",
        created_at as "createdAt", updated_at as "updatedAt"
    `;

    const rows = await executeQuery<ReasonCode>(query, values);
    return rows[0];
  },

  async deleteReasonCode(id: string): Promise<void> {
    await executeQuery(
      `DELETE FROM reason_codes WHERE id = $1`,
      [id]
    );
  },

  // Custom Field Queries
  async createCustomField(data: {
    name: string;
    type: FieldType;
    entityType: EntityType;
    isRequired?: boolean;
    options?: any;
    defaultValue?: string;
  }): Promise<CustomField> {
    const rows = await executeQuery<CustomField>(
      `INSERT INTO custom_fields (
        name, type, entity_type, is_required, options, default_value, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, true)
      RETURNING 
        id, name, type, entity_type as "entityType",
        is_required as "isRequired", options,
        default_value as "defaultValue", is_active as "isActive",
        created_at as "createdAt", updated_at as "updatedAt"`,
      [
        data.name,
        data.type,
        data.entityType,
        data.isRequired || false,
        data.options || null,
        data.defaultValue || null
      ]
    );
    return rows[0];
  },

  async findAllCustomFields(entityType?: EntityType): Promise<CustomField[]> {
    let query = `
      SELECT 
        id, name, type, entity_type as "entityType",
        is_required as "isRequired", options,
        default_value as "defaultValue", is_active as "isActive",
        created_at as "createdAt", updated_at as "updatedAt"
      FROM custom_fields
      WHERE is_active = true
    `;
    const params: any[] = [];

    if (entityType) {
      query += ` AND entity_type = $1`;
      params.push(entityType);
    }

    query += ` ORDER BY entity_type, name`;

    return executeQuery<CustomField>(query, params);
  },

  async findCustomFieldById(id: string): Promise<CustomField | null> {
    const rows = await executeQuery<CustomField>(
      `SELECT 
        id, name, type, entity_type as "entityType",
        is_required as "isRequired", options,
        default_value as "defaultValue", is_active as "isActive",
        created_at as "createdAt", updated_at as "updatedAt"
      FROM custom_fields WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  async updateCustomField(id: string, data: Partial<{
    name: string;
    type: FieldType;
    entityType: EntityType;
    isRequired: boolean;
    options: any;
    defaultValue: string;
    isActive: boolean;
  }>): Promise<CustomField> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const fieldMap: Record<string, string> = {
      entityType: 'entity_type',
      isRequired: 'is_required',
      defaultValue: 'default_value',
      isActive: 'is_active',
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
      UPDATE custom_fields 
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING 
        id, name, type, entity_type as "entityType",
        is_required as "isRequired", options,
        default_value as "defaultValue", is_active as "isActive",
        created_at as "createdAt", updated_at as "updatedAt"
    `;

    const rows = await executeQuery<CustomField>(query, values);
    return rows[0];
  },

  async deleteCustomField(id: string): Promise<void> {
    await executeQuery(
      `DELETE FROM custom_fields WHERE id = $1`,
      [id]
    );
  }
};