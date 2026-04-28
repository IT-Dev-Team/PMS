// app/api/admin/migrate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// SQL schema for admin dashboard
const SCHEMA_SQL = `
-- Admin Settings table
CREATE TABLE IF NOT EXISTS admin_settings (
  id BIGSERIAL PRIMARY KEY,
  api_key_hash VARCHAR(255),
  monthly_reset_day INT NOT NULL DEFAULT 1 CHECK (monthly_reset_day >= 1 AND monthly_reset_day <= 31),
  total_credits INT NOT NULL DEFAULT 10000,
  last_reset_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Credits table
CREATE TABLE IF NOT EXISTS user_credits (
  id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  credit_percentage NUMERIC(5, 2) NOT NULL CHECK (credit_percentage >= 0 AND credit_percentage <= 100),
  current_credits INT NOT NULL DEFAULT 0,
  total_allocated INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Credit Usage Log table
CREATE TABLE IF NOT EXISTS credit_usage_log (
  id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  credits_used INT NOT NULL,
  api_calls INT NOT NULL,
  usage_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Credit Reset History table
CREATE TABLE IF NOT EXISTS credit_reset_history (
  id BIGSERIAL PRIMARY KEY,
  reset_date TIMESTAMP WITH TIME ZONE NOT NULL,
  total_credits INT NOT NULL,
  users_affected INT NOT NULL,
  reset_type VARCHAR(50) NOT NULL DEFAULT 'automatic',
  created_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON user_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_usage_log_user_id ON credit_usage_log(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_usage_log_date ON credit_usage_log(usage_date);
CREATE INDEX IF NOT EXISTS idx_credit_reset_history_date ON credit_reset_history(reset_date);

-- Create unique constraint for user_id if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_credits_user_id_key'
    ) THEN
        ALTER TABLE user_credits ADD CONSTRAINT user_credits_user_id_key UNIQUE (user_id);
    END IF;
END $$;

-- Insert default admin settings if not exists
INSERT INTO admin_settings (id, api_key_hash, monthly_reset_day, total_credits, created_at, updated_at)
SELECT 1, NULL, 1, 10000, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM admin_settings WHERE id = 1);
`;

async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return false;
  }
  
  const token = authHeader.substring(7);
  const adminToken = process.env.ADMIN_API_TOKEN;
  return token === adminToken;
}

// POST - Initialize database schema
export async function POST(request: NextRequest) {
  try {
    // Verify admin access
    const isValid = await verifyAdmin(request);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const statements = SCHEMA_SQL.split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    let executedStatements = 0;
    const errors: string[] = [];

    // Execute each statement individually for better error handling
    for (const statement of statements) {
      try {
        await pool.query(statement);
        executedStatements++;
      } catch (error: any) {
        // Ignore "already exists" errors
        if (!error.message?.includes('already exists') &&
            !error.message?.includes('duplicate key') &&
            !error.message?.includes('already defined')) {
          errors.push(`Statement ${executedStatements + 1}: ${error.message}`);
          console.error('Migration error:', error.message);
        }
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'Schema migration completed with some errors',
          executedStatements,
          errors
        },
        { status: 207 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Database schema created/updated successfully',
      executedStatements
    });
  } catch (error) {
    console.error('[Migration Error]:', error);
    return NextResponse.json(
      { error: 'Migration failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET - Check migration status
export async function GET(request: NextRequest) {
  try {
    const isValid = await verifyAdmin(request);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check which tables exist
    const tables = ['admin_settings', 'user_credits', 'credit_usage_log', 'credit_reset_history'];
    const status: Record<string, boolean> = {};

    for (const table of tables) {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = $1
        ) as exists
      `, [table]);
      status[table] = result.rows[0]?.exists || false;
    }

    const allExist = Object.values(status).every(v => v === true);

    return NextResponse.json({
      success: true,
      allTablesExist: allExist,
      tables: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Migration Status Error]:', error);
    return NextResponse.json(
      { error: 'Failed to check migration status' },
      { status: 500 }
    );
  }
}

// DELETE - Reset database (warning: drops all tables)
export async function DELETE(request: NextRequest) {
  try {
    const isValid = await verifyAdmin(request);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { confirm } = await request.json();
    
    if (confirm !== 'RESET_DATABASE') {
      return NextResponse.json(
        { error: 'Confirmation required. Send { confirm: "RESET_DATABASE" }' },
        { status: 400 }
      );
    }

    const dropTablesSQL = `
      DROP TABLE IF EXISTS credit_usage_log CASCADE;
      DROP TABLE IF EXISTS credit_reset_history CASCADE;
      DROP TABLE IF EXISTS user_credits CASCADE;
      DROP TABLE IF EXISTS admin_settings CASCADE;
    `;

    await pool.query(dropTablesSQL);

    // Recreate schema
    await pool.query(SCHEMA_SQL);

    return NextResponse.json({
      success: true,
      message: 'Database reset and reinitialized successfully'
    });
  } catch (error) {
    console.error('[Database Reset Error]:', error);
    return NextResponse.json(
      { error: 'Failed to reset database' },
      { status: 500 }
    );
  }
}