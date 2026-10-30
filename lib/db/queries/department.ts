// lib/db/queries/departments.ts
import { executeQuery } from '@/lib/db';
import { Department } from '@/types/common';

export interface DepartmentCreateInput {
  code: string;
  name: string;
  parentId?: string;
}

export interface DepartmentUpdateInput {
  name?: string;
  code?: string;
  parentId?: string;
}

export const DepartmentQueries = {
  async create(data: DepartmentCreateInput): Promise<Department> {
    const rows = await executeQuery<Department>(
      `INSERT INTO departments (code, name, parent_id)
       VALUES ($1, $2, $3)
       RETURNING id, code, name, parent_id as "parentId", 
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [data.code, data.name, data.parentId || null]
    );
    return rows[0];
  },

  async findById(id: string): Promise<Department | null> {
    const rows = await executeQuery<Department>(
      `SELECT id, code, name, parent_id as "parentId",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM departments WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  async findAll(): Promise<Department[]> {
    return executeQuery<Department>(
      `SELECT id, code, name, parent_id as "parentId",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM departments ORDER BY code ASC`
    );
  },

  async findWithChildren(): Promise<Department[]> {
    return executeQuery<Department>(
      `WITH RECURSIVE dept_tree AS (
         SELECT id, code, name, parent_id, created_at, updated_at
         FROM departments WHERE parent_id IS NULL
         UNION ALL
         SELECT d.id, d.code, d.name, d.parent_id, d.created_at, d.updated_at
         FROM departments d
         INNER JOIN dept_tree dt ON dt.id = d.parent_id
       )
       SELECT id, code, name, parent_id as "parentId",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM dept_tree
       ORDER BY code ASC`
    );
  },

  async update(id: string, data: DepartmentUpdateInput): Promise<Department> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      fields.push(`name = $${paramIndex}`);
      values.push(data.name);
      paramIndex++;
    }
    if (data.code !== undefined) {
      fields.push(`code = $${paramIndex}`);
      values.push(data.code);
      paramIndex++;
    }
    if (data.parentId !== undefined) {
      fields.push(`parent_id = $${paramIndex}`);
      values.push(data.parentId);
      paramIndex++;
    }

    values.push(id);
    const query = `
      UPDATE departments 
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING id, code, name, parent_id as "parentId",
                created_at as "createdAt", updated_at as "updatedAt"
    `;

    const rows = await executeQuery<Department>(query, values);
    return rows[0];
  },

  async delete(id: string): Promise<void> {
    // Check if department has children
    const children = await executeQuery(
      `SELECT id FROM departments WHERE parent_id = $1`,
      [id]
    );
    
    if (children.length > 0) {
      throw new Error('Cannot delete department with child departments');
    }

    // Check if department has users
    const users = await executeQuery(
      `SELECT id FROM users WHERE department_id = $1`,
      [id]
    );
    
    if (users.length > 0) {
      throw new Error('Cannot delete department with assigned users');
    }

    await executeQuery(
      `DELETE FROM departments WHERE id = $1`,
      [id]
    );
  },

  async getDepartmentHierarchy(): Promise<any[]> {
    return executeQuery(
      `WITH RECURSIVE dept_tree AS (
         SELECT id, code, name, parent_id, 0 as level,
                ARRAY[id] as path
         FROM departments WHERE parent_id IS NULL
         UNION ALL
         SELECT d.id, d.code, d.name, d.parent_id, dt.level + 1,
                dt.path || d.id
         FROM departments d
         INNER JOIN dept_tree dt ON dt.id = d.parent_id
       )
       SELECT id, code, name, parent_id as "parentId", level, path
       FROM dept_tree
       ORDER BY path`
    );
  }
};