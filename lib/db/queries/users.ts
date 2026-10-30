// lib/db/queries/users.ts
import { executeQuery } from '@/lib/db';
import { User, UserRole } from '@/types/common';

export interface UserCreateInput {
  email: string;
  name: string;
  role: UserRole;
  passwordHash: string;
  departmentId?: string;
}

export interface UserUpdateInput {
  name?: string;
  role?: UserRole;
  departmentId?: string;
  email?: string;
}

export const UserQueries = {
  async create(data: UserCreateInput): Promise<User> {
    const rows = await executeQuery<User>(
      `INSERT INTO users (email, name, role, password_hash, department_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, name, role, department_id as "departmentId", created_at as "createdAt", updated_at as "updatedAt"`,
      [data.email, data.name, data.role, data.passwordHash, data.departmentId]
    );
    return rows[0];
  },

  async findById(id: string): Promise<User | null> {
    const rows = await executeQuery<User>(
      `SELECT id, email, name, role, department_id as "departmentId", 
              created_at as "createdAt", updated_at as "updatedAt"
       FROM users WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  async findByEmail(email: string): Promise<User | null> {
    const rows = await executeQuery<User>(
      `SELECT id, email, name, role, password_hash, department_id as "departmentId",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM users WHERE email = $1`,
      [email]
    );
    return rows[0] || null;
  },

  async findAll(role?: UserRole): Promise<User[]> {
    let query = `
      SELECT id, email, name, role, department_id as "departmentId",
             created_at as "createdAt", updated_at as "updatedAt"
      FROM users
      WHERE 1=1
    `;
    const params: any[] = [];
    
    if (role) {
      query += ` AND role = $1`;
      params.push(role);
    }
    
    query += ` ORDER BY name ASC`;
    
    return executeQuery<User>(query, params);
  },

  async findByDepartment(departmentId: string): Promise<User[]> {
    return executeQuery<User>(
      `SELECT id, email, name, role, department_id as "departmentId",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM users WHERE department_id = $1 ORDER BY name ASC`,
      [departmentId]
    );
  },

  async update(id: string, data: UserUpdateInput): Promise<User> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      fields.push(`name = $${paramIndex}`);
      values.push(data.name);
      paramIndex++;
    }
    if (data.role !== undefined) {
      fields.push(`role = $${paramIndex}`);
      values.push(data.role);
      paramIndex++;
    }
    if (data.departmentId !== undefined) {
      fields.push(`department_id = $${paramIndex}`);
      values.push(data.departmentId);
      paramIndex++;
    }
    if (data.email !== undefined) {
      fields.push(`email = $${paramIndex}`);
      values.push(data.email);
      paramIndex++;
    }

    values.push(id);
    const query = `
      UPDATE users 
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING id, email, name, role, department_id as "departmentId",
                created_at as "createdAt", updated_at as "updatedAt"
    `;

    const rows = await executeQuery<User>(query, values);
    return rows[0];
  },

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await executeQuery(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [passwordHash, id]
    );
  },

  async delete(id: string): Promise<void> {
    await executeQuery(
      `DELETE FROM users WHERE id = $1`,
      [id]
    );
  },

  async getUsersByRole(role: UserRole): Promise<User[]> {
    return executeQuery<User>(
      `SELECT id, email, name, role, department_id as "departmentId",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM users WHERE role = $1 ORDER BY name ASC`,
      [role]
    );
  },

  async getProjectManagers(): Promise<User[]> {
    return executeQuery<User>(
      `SELECT id, email, name, role, department_id as "departmentId",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM users WHERE role = 'PROJECT_MANAGER' ORDER BY name ASC`
    );
  },

  async getBoardMembers(): Promise<User[]> {
    return executeQuery<User>(
      `SELECT id, email, name, role, department_id as "departmentId",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM users WHERE role = 'BOARD_MEMBER' ORDER BY name ASC`
    );
  }
};