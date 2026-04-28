// lib/db.ts
import { Pool } from 'pg';
import 'server-only';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'deepseek_chat',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('connect', () => {
  console.log('✅ Database connected');
});

pool.on('error', (err) => {
  console.error('❌ Database pool error:', err.message);
});

export default pool;

// Admin Settings Queries
export const AdminSettingsQueries = {
  async getSettings() {
    const result = await pool.query(
      'SELECT * FROM admin_settings WHERE id = 1 LIMIT 1'
    );
    return result.rows[0] || null;
  },

  async updateApiKey(apiKeyHash: string) {
    const result = await pool.query(
      `INSERT INTO admin_settings (id, api_key_hash, updated_at) 
       VALUES (1, $1, NOW())
       ON CONFLICT (id) DO UPDATE 
       SET api_key_hash = EXCLUDED.api_key_hash, 
           updated_at = NOW()
       RETURNING *`,
      [apiKeyHash]
    );
    return result.rows[0];
  },

  async deleteApiKey() {
    const result = await pool.query(
      `UPDATE admin_settings 
       SET api_key_hash = '', updated_at = NOW() 
       WHERE id = 1 
       RETURNING *`
    );
    return result.rows[0];
  },

  async updateMonthlyResetDay(resetDay: number) {
    const result = await pool.query(
      `INSERT INTO admin_settings (id, monthly_reset_day, updated_at) 
       VALUES (1, $1, NOW())
       ON CONFLICT (id) DO UPDATE 
       SET monthly_reset_day = EXCLUDED.monthly_reset_day,
           updated_at = NOW()
       RETURNING *`,
      [resetDay]
    );
    return result.rows[0];
  },

  async updateTotalCredits(totalCredits: number) {
    const result = await pool.query(
      `INSERT INTO admin_settings (id, total_credits, updated_at) 
       VALUES (1, $1, NOW())
       ON CONFLICT (id) DO UPDATE 
       SET total_credits = EXCLUDED.total_credits,
           updated_at = NOW()
       RETURNING *`,
      [totalCredits]
    );
    return result.rows[0];
  },

  async recordReset(resetDate: Date, totalCredits: number, usersAffected: number, resetType: string = 'automatic', createdBy?: string) {
    const result = await pool.query(
      `INSERT INTO credit_reset_history (reset_date, total_credits, users_affected, reset_type, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [resetDate, totalCredits, usersAffected, resetType, createdBy || null]
    );
    return result.rows[0];
  }
};

// User Credits Queries
export const UserCreditsQueries = {
  async getUserCredit(userId: string) {
    const result = await pool.query(
      'SELECT * FROM user_credits WHERE user_id = $1',
      [userId]
    );
    return result.rows[0] || null;
  },

  async createOrUpdateUserCredit(userId: string, creditPercentage: number) {
    const result = await pool.query(
      `INSERT INTO user_credits (user_id, credit_percentage, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE 
       SET credit_percentage = EXCLUDED.credit_percentage,
           updated_at = NOW()
       RETURNING *`,
      [userId, creditPercentage]
    );
    return result.rows[0];
  },

  async allocateCredits(userId: string, creditsToAdd: number) {
    const result = await pool.query(
      `UPDATE user_credits 
       SET current_credits = current_credits + $2,
           total_allocated = total_allocated + $2,
           updated_at = NOW()
       WHERE user_id = $1
       RETURNING *`,
      [userId, creditsToAdd]
    );
    return result.rows[0];
  },

  async deductCredits(userId: string, creditsToDeduct: number) {
    const result = await pool.query(
      `UPDATE user_credits 
       SET current_credits = current_credits - $2,
           updated_at = NOW()
       WHERE user_id = $1 AND current_credits >= $2
       RETURNING *`,
      [userId, creditsToDeduct]
    );
    return result.rows[0];
  },

  async getAllUserCredits() {
    const result = await pool.query(
      'SELECT * FROM user_credits ORDER BY created_at DESC'
    );
    return result.rows;
  },

  async resetAllUserCredits(totalCredits: number) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Reset all users' current_credits to 0
      const result = await client.query(
        'UPDATE user_credits SET current_credits = 0, updated_at = NOW() RETURNING user_id'
      );
      
      // Calculate new allocations based on percentages
      const users = await client.query('SELECT user_id, credit_percentage FROM user_credits');
      
      for (const user of users.rows) {
        const allocatedCredits = Math.floor(totalCredits * (user.credit_percentage / 100));
        await client.query(
          `UPDATE user_credits 
           SET current_credits = $2, 
               total_allocated = $2,
               updated_at = NOW()
           WHERE user_id = $1`,
          [user.user_id, allocatedCredits]
        );
      }
      
      await client.query('COMMIT');
      return { usersAffected: result.rowCount, allocations: users.rows };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
};


// Add these to your existing lib/db.ts file

// Additional Credit Usage Queries
export const CreditUsageQueries = {
  // ... existing queries ...

  async getUsageAnalytics(days: number = 30) {
    const result = await pool.query(`
      SELECT 
        DATE(usage_date) as date,
        COUNT(DISTINCT user_id) as active_users,
        SUM(credits_used) as total_credits,
        SUM(api_calls) as total_api_calls,
        COUNT(*) as total_requests,
        AVG(credits_used) as avg_credits_per_request
      FROM credit_usage_log 
      WHERE usage_date >= NOW() - INTERVAL '${days} days'
      GROUP BY DATE(usage_date)
      ORDER BY date DESC
    `);
    return result.rows;
  },

  async getUserUsageSummary(userId: string) {
    const result = await pool.query(`
      SELECT 
        COALESCE(SUM(credits_used), 0) as total_credits_used,
        COALESCE(SUM(api_calls), 0) as total_api_calls,
        COUNT(*) as total_requests,
        MIN(usage_date) as first_usage,
        MAX(usage_date) as last_usage,
        AVG(credits_used) as avg_credits_per_request
      FROM credit_usage_log 
      WHERE user_id = $1
    `, [userId]);
    return result.rows[0];
  },

  async getTopUsersByUsage(limit: number = 10, days: number = 30) {
    const result = await pool.query(`
      SELECT 
        user_id,
        SUM(credits_used) as total_credits_used,
        SUM(api_calls) as total_api_calls,
        COUNT(*) as total_requests,
        MAX(usage_date) as last_active
      FROM credit_usage_log 
      WHERE usage_date >= NOW() - INTERVAL '${days} days'
      GROUP BY user_id
      ORDER BY total_credits_used DESC
      LIMIT $1
    `, [limit]);
    return result.rows;
  }
};