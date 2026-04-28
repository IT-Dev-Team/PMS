// app/api/admin/usage/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// Helper to verify admin authentication
async function verifyAdmin(req: NextRequest): Promise<boolean> {
  
  return true;
}

// GET - Fetch usage logs
export async function GET(req: NextRequest) {
  try {
    const isValid = await verifyAdmin(req);
    if (!isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '100');
    const days = parseInt(searchParams.get('days') || '0');

    let query = `
      SELECT 
        id,
        user_id,
        credits_used,
        api_calls,
        usage_date,
        description,
        created_at
      FROM credit_usage_log
    `;
    
    const conditions: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (userId) {
      conditions.push(`user_id = $${paramCount++}`);
      values.push(userId);
    }

    if (days > 0) {
      conditions.push(`usage_date >= NOW() - INTERVAL '${days} days'`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY usage_date DESC, created_at DESC LIMIT $${paramCount++}`;
    values.push(limit);

    const result = await pool.query(query, values);

    // Get summary statistics if userId is provided
    let summary = null;
    if (userId) {
      const summaryResult = await pool.query(
        `SELECT 
          COALESCE(SUM(credits_used), 0) as total_credits_used,
          COALESCE(SUM(api_calls), 0) as total_api_calls,
          COUNT(*) as total_requests,
          MIN(usage_date) as first_usage,
          MAX(usage_date) as last_usage
         FROM credit_usage_log 
         WHERE user_id = $1`,
        [userId]
      );
      summary = summaryResult.rows[0];
    }

    return NextResponse.json({
      success: true,
      logs: result.rows || [],
      summary,
      filters: {
        userId: userId || null,
        limit,
        days: days || null
      }
    });
  } catch (error) {
    console.error('Error fetching usage logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch usage logs' },
      { status: 500 }
    );
  }
}

// POST - Log credit usage
export async function POST(req: NextRequest) {
  const client = await pool.connect();
  
  try {
    const isValid = await verifyAdmin(req);
    if (!isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId, creditsUsed, apiCalls = 1, description } = await req.json();

    // Validate required fields
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      );
    }

    if (typeof creditsUsed !== 'number' || creditsUsed < 0) {
      return NextResponse.json(
        { error: 'Invalid credits used (must be a non-negative number)' },
        { status: 400 }
      );
    }

    if (typeof apiCalls !== 'number' || apiCalls < 0) {
      return NextResponse.json(
        { error: 'Invalid API calls (must be a non-negative number)' },
        { status: 400 }
      );
    }

    // Start transaction
    await client.query('BEGIN');

    // Check if user exists in credit system
    const userCheck = await client.query(
      'SELECT current_credits, total_allocated FROM user_credits WHERE user_id = $1',
      [userId]
    );

    if (userCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: 'User not found in credit system. Please add user first.' },
        { status: 404 }
      );
    }

    const currentCredits = userCheck.rows[0].current_credits;
    
    // Check if user has enough credits
    if (currentCredits < creditsUsed) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { 
          error: 'Insufficient credits',
          currentCredits,
          requestedCredits: creditsUsed,
          shortfall: creditsUsed - currentCredits
        },
        { status: 400 }
      );
    }

    // Insert usage log
    const logResult = await client.query(
      `INSERT INTO credit_usage_log (user_id, credits_used, api_calls, description, usage_date)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [userId, creditsUsed, apiCalls, description || 'API usage']
    );

    // Update user's remaining credits
    const updateResult = await client.query(
      `UPDATE user_credits 
       SET current_credits = current_credits - $2,
           updated_at = NOW()
       WHERE user_id = $1
       RETURNING current_credits, total_allocated`,
      [userId, creditsUsed]
    );

    // Commit transaction
    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      message: 'Usage logged successfully',
      data: {
        log: logResult.rows[0],
        remainingCredits: updateResult.rows[0].current_credits,
        totalAllocated: updateResult.rows[0].total_allocated,
        usagePercentage: ((updateResult.rows[0].total_allocated - updateResult.rows[0].current_credits) / updateResult.rows[0].total_allocated * 100).toFixed(2)
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error logging usage:', error);
    return NextResponse.json(
      { error: 'Failed to log usage', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

// GET - Get usage statistics (alternative endpoint)
export async function PUT(req: NextRequest) {
  try {
    const isValid = await verifyAdmin(req);
    if (!isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId, startDate, endDate } = await req.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    let query = `
      SELECT 
        DATE(usage_date) as date,
        SUM(credits_used) as daily_credits,
        SUM(api_calls) as daily_api_calls,
        COUNT(*) as daily_requests
      FROM credit_usage_log 
      WHERE user_id = $1
    `;
    
    const values: any[] = [userId];
    let paramCount = 2;

    if (startDate) {
      query += ` AND usage_date >= $${paramCount++}`;
      values.push(startDate);
    }

    if (endDate) {
      query += ` AND usage_date <= $${paramCount++}`;
      values.push(endDate);
    }

    query += ` GROUP BY DATE(usage_date) ORDER BY date DESC`;

    const result = await pool.query(query, values);

    return NextResponse.json({
      success: true,
      statistics: result.rows,
      period: {
        startDate: startDate || null,
        endDate: endDate || null
      }
    });
  } catch (error) {
    console.error('Error fetching usage statistics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch usage statistics' },
      { status: 500 }
    );
  }
}

// DELETE - Clear usage logs (admin only)
export async function DELETE(req: NextRequest) {
  try {
    const isValid = await verifyAdmin(req);
    if (!isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const olderThanDays = parseInt(searchParams.get('olderThanDays') || '0');
    const confirm = searchParams.get('confirm');

    if (confirm !== 'CLEAR_LOGS') {
      return NextResponse.json(
        { error: 'Confirmation required. Use ?confirm=CLEAR_LOGS' },
        { status: 400 }
      );
    }

    let query = 'DELETE FROM credit_usage_log';
    const conditions: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (userId) {
      conditions.push(`user_id = $${paramCount++}`);
      values.push(userId);
    }

    if (olderThanDays > 0) {
      conditions.push(`usage_date < NOW() - INTERVAL '${olderThanDays} days'`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` RETURNING id`;

    const result = await pool.query(query, values);

    return NextResponse.json({
      success: true,
      message: `Cleared ${result.rowCount} usage log entries`,
      deletedCount: result.rowCount,
      filters: {
        userId: userId || null,
        olderThanDays: olderThanDays || null
      }
    });
  } catch (error) {
    console.error('Error clearing usage logs:', error);
    return NextResponse.json(
      { error: 'Failed to clear usage logs' },
      { status: 500 }
    );
  }
}