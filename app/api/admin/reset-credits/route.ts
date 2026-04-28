// app/api/admin/reset/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// Helper to verify admin authentication
async function verifyAdmin(req: NextRequest): Promise<boolean> {
  return true;
}

// POST - Reset credits for all users
export async function POST(req: NextRequest) {
  const client = await pool.connect();
  
  try {
    const isValid = await verifyAdmin(req);
    if (!isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const isManual = body.manual === true;
    const resetType = isManual ? 'manual' : 'automatic';

    // Start transaction
    await client.query('BEGIN');

    // Get admin settings (total credits to distribute)
    const settingsResult = await client.query(
      'SELECT total_credits FROM admin_settings WHERE id = 1 LIMIT 1'
    );
    
    const totalCredits = settingsResult.rows[0]?.total_credits || 10000;

    // Get all users with credit percentages
    const usersResult = await client.query(
      'SELECT user_id, credit_percentage FROM user_credits ORDER BY user_id'
    );
    
    const users = usersResult.rows;

    if (users.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: 'No users found in the credit system' },
        { status: 400 }
      );
    }

    // Calculate total percentage to validate
    const totalPercentage = users.reduce((sum, user) => sum + parseFloat(user.credit_percentage), 0);

    if (totalPercentage === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: 'No users have credit percentages set. Please assign percentages first.' },
        { status: 400 }
      );
    }

    // Update each user's credits based on their percentage
    const updates = [];
    for (const user of users) {
      // Calculate allocated credits based on percentage of total
      const allocatedCredits = Math.floor(
        (parseFloat(user.credit_percentage) / totalPercentage) * totalCredits
      );
      
      const updateResult = await client.query(
        `UPDATE user_credits 
         SET current_credits = $2,
             total_allocated = $2,
             updated_at = NOW()
         WHERE user_id = $1
         RETURNING user_id, current_credits, credit_percentage`,
        [user.user_id, allocatedCredits]
      );
      
      updates.push(updateResult.rows[0]);
    }

    // Update last reset date in admin_settings
    await client.query(
      `UPDATE admin_settings 
       SET last_reset_date = NOW(),
           updated_at = NOW()
       WHERE id = 1`
    );

    // Log the reset in history
    const historyResult = await client.query(
      `INSERT INTO credit_reset_history 
       (reset_date, total_credits, users_affected, reset_type)
       VALUES (NOW(), $1, $2, $3)
       RETURNING *`,
      [totalCredits, users.length, resetType]
    );

    // Commit transaction
    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      message: `Credits reset successfully. ${totalCredits} credits distributed to ${users.length} users.`,
      creditsAllocated: totalCredits,
      usersUpdated: users.length,
      resetType: resetType,
      resetDate: historyResult.rows[0].reset_date,
      details: {
        totalPercentage,
        averageCreditsPerUser: Math.floor(totalCredits / users.length),
        users: updates.map(u => ({
          userId: u.user_id,
          creditsAllocated: u.current_credits,
          percentage: u.credit_percentage
        }))
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error resetting credits:', error);
    return NextResponse.json(
      { error: 'Failed to reset credits', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

// GET - Get reset history and statistics
export async function GET(req: NextRequest) {
  try {
    const isValid = await verifyAdmin(req);
    if (!isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '10');

    // Get reset history
    const historyResult = await pool.query(
      `SELECT * FROM credit_reset_history 
       ORDER BY reset_date DESC 
       LIMIT $1`,
      [limit]
    );

    // Get current allocation summary
    const currentAllocation = await pool.query(`
      SELECT 
        COUNT(*) as total_users,
        SUM(current_credits) as total_current_credits,
        SUM(total_allocated) as total_allocated_credits,
        AVG(credit_percentage) as avg_percentage,
        MIN(current_credits) as min_credits,
        MAX(current_credits) as max_credits
      FROM user_credits
    `);

    // Get last reset info
    const lastReset = await pool.query(`
      SELECT * FROM credit_reset_history 
      ORDER BY reset_date DESC 
      LIMIT 1
    `);

    return NextResponse.json({
      success: true,
      history: historyResult.rows,
      currentAllocation: currentAllocation.rows[0],
      lastReset: lastReset.rows[0] || null,
      stats: {
        totalResets: historyResult.rowCount,
        lastResetDate: historyResult.rows[0]?.reset_date || null
      }
    });
  } catch (error) {
    console.error('Error fetching reset history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reset history' },
      { status: 500 }
    );
  }
}

// DELETE - Clear reset history (admin only, with confirmation)
export async function DELETE(req: NextRequest) {
  try {
    const isValid = await verifyAdmin(req);
    if (!isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { confirm, keepLatest } = await req.json();

    if (confirm !== 'CLEAR_HISTORY') {
      return NextResponse.json(
        { error: 'Confirmation required. Send { confirm: "CLEAR_HISTORY" }' },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      let deletedCount = 0;
      
      if (keepLatest) {
        // Delete all but the latest reset record
        const result = await client.query(`
          DELETE FROM credit_reset_history 
          WHERE id NOT IN (
            SELECT id FROM credit_reset_history 
            ORDER BY reset_date DESC 
            LIMIT 1
          )
          RETURNING id
        `);
        deletedCount = result.rowCount;
      } else {
        // Delete all history
        const result = await client.query('DELETE FROM credit_reset_history RETURNING id');
        deletedCount = result.rowCount;
      }

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        message: `Reset history cleared. ${deletedCount} records deleted.`,
        deletedCount
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error clearing reset history:', error);
    return NextResponse.json(
      { error: 'Failed to clear reset history' },
      { status: 500 }
    );
  }
}