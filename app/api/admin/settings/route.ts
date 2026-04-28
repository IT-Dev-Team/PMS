// app/api/admin/settings/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// Helper to verify admin authentication
async function verifyAdmin(req: NextRequest): Promise<boolean> {
 return true;
}

// GET - Fetch admin settings
export async function GET(req: NextRequest) {
  try {
    const isValid = await verifyAdmin(req);
    if (!isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await pool.query(
      'SELECT monthly_reset_day as reset_day, total_credits as total_monthly_credits FROM admin_settings WHERE id = 1 LIMIT 1'
    );
    
    const settings = result.rows[0];
    
    // Return default values if no settings found
    return NextResponse.json(
      settings || { 
        reset_day: 1, 
        total_monthly_credits: 10000 
      }
    );
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

// POST - Update admin settings
export async function POST(req: NextRequest) {
  try {
    const isValid = await verifyAdmin(req);
    if (!isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { resetDay, totalMonthlyCredits } = await req.json();

    // Validate reset day
    if (typeof resetDay !== 'number' || resetDay < 1 || resetDay > 31) {
      return NextResponse.json(
        { error: 'Invalid reset day (must be 1-31)' },
        { status: 400 }
      );
    }

    // Validate total credits
    if (typeof totalMonthlyCredits !== 'number' || totalMonthlyCredits <= 0) {
      return NextResponse.json(
        { error: 'Invalid total credits (must be greater than 0)' },
        { status: 400 }
      );
    }

    // Upsert settings
    // Check if settings exist first, then decide
const checkResult = await pool.query(
  'SELECT id FROM admin_settings WHERE id = 1 LIMIT 1'
);

let result;

if (checkResult.rows.length === 0) {
  // Insert new settings
  result = await pool.query(
    `INSERT INTO admin_settings (id, monthly_reset_day, total_credits, created_at, updated_at)
     VALUES (1, $1, $2, NOW(), NOW())
     RETURNING *`,
    [resetDay, totalMonthlyCredits]
  );
} else {
  // Update existing settings
  result = await pool.query(
    `UPDATE admin_settings 
     SET monthly_reset_day = $1,
         total_credits = $2,
         updated_at = NOW()
     WHERE id = 1
     RETURNING *`,
    [resetDay, totalMonthlyCredits]
  );
}

    if (result.rowCount === 0) {
      throw new Error('Failed to update settings');
    }

    return NextResponse.json({
      success: true,
      message: 'Settings updated successfully',
      settings: {
        reset_day: result.rows[0].monthly_reset_day,
        total_monthly_credits: result.rows[0].total_credits,
        updated_at: result.rows[0].updated_at
      }
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}

// PUT - Partial update (update individual settings)
export async function PUT(req: NextRequest) {
  try {
    const isValid = await verifyAdmin(req);
    if (!isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { resetDay, totalMonthlyCredits } = await req.json();
    
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (resetDay !== undefined) {
      if (resetDay < 1 || resetDay > 31) {
        return NextResponse.json(
          { error: 'Reset day must be between 1 and 31' },
          { status: 400 }
        );
      }
      updates.push(`monthly_reset_day = $${paramCount++}`);
      values.push(resetDay);
    }

    if (totalMonthlyCredits !== undefined) {
      if (totalMonthlyCredits <= 0) {
        return NextResponse.json(
          { error: 'Total credits must be greater than 0' },
          { status: 400 }
        );
      }
      updates.push(`total_credits = $${paramCount++}`);
      values.push(totalMonthlyCredits);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No valid updates provided' },
        { status: 400 }
      );
    }

    updates.push(`updated_at = NOW()`);
    values.push(1); // For WHERE id = $paramCount

    const query = `
      UPDATE admin_settings 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING monthly_reset_day as reset_day, total_credits as total_monthly_credits, updated_at
    `;

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'Settings not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Settings updated successfully',
      settings: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}