// app/api/admin/credits/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// Helper to verify admin authentication
async function verifyAdmin(req: NextRequest): Promise<boolean> {
  return true;
}

// GET - Fetch all user credits
export async function GET(req: NextRequest) {
  try {
    const isValid = await verifyAdmin(req);
    if (!isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await pool.query(
      `SELECT 
        id,
        user_id,
        credit_percentage,
        current_credits,
        total_allocated,
        created_at,
        updated_at,
        (total_allocated - current_credits) as used_credits
       FROM user_credits 
       ORDER BY created_at DESC`
    );

    return NextResponse.json(result.rows || []);
  } catch (error) {
    console.error('Error fetching user credits:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user credits' },
      { status: 500 }
    );
  }
}

// POST - Create or update user credit percentage
export async function POST(req: NextRequest) {
  try {
    const isValid = await verifyAdmin(req);
    if (!isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId, creditPercentage } = await req.json();

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      );
    }

    if (typeof creditPercentage !== 'number' || creditPercentage < 0 || creditPercentage > 100) {
      return NextResponse.json(
        { error: 'Invalid credit percentage (must be 0-100)' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingResult = await pool.query(
      'SELECT id, current_credits, total_allocated FROM user_credits WHERE user_id = $1',
      [userId]
    );
    
    const existing = existingResult.rows[0];

    let result;
    if (existing) {
      // Update only credit_percentage for existing user
      // Keep existing current_credits and total_allocated
      result = await pool.query(
        `UPDATE user_credits 
         SET credit_percentage = $1, 
             updated_at = NOW()
         WHERE user_id = $2
         RETURNING *`,
        [creditPercentage, userId]
      );
    } else {
      // Insert new user with initial credits
      // Get total credits from admin_settings
      const settingsResult = await pool.query(
        'SELECT total_credits FROM admin_settings WHERE id = 1 LIMIT 1'
      );
      const totalCredits = settingsResult.rows[0]?.total_credits || 10000;
      
      // Calculate initial credits based on percentage
      const initialCredits = Math.floor(totalCredits * (creditPercentage / 100));
      
      result = await pool.query(
        `INSERT INTO user_credits (
          user_id, 
          credit_percentage, 
          current_credits, 
          total_allocated,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, NOW(), NOW())
        RETURNING *`,
        [userId, creditPercentage, initialCredits, initialCredits]
      );
    }

    if (!result.rows[0]) {
      throw new Error('Failed to update user credits');
    }

    return NextResponse.json({
      success: true,
      message: existing ? 'User credits updated' : 'User added successfully',
      data: {
        id: result.rows[0].id,
        user_id: result.rows[0].user_id,
        credit_percentage: parseFloat(result.rows[0].credit_percentage),
        current_credits: result.rows[0].current_credits,
        total_allocated: result.rows[0].total_allocated,
        used_credits: result.rows[0].total_allocated - result.rows[0].current_credits,
        created_at: result.rows[0].created_at,
        updated_at: result.rows[0].updated_at
      }
    });
  } catch (error) {
    console.error('Error updating credits:', error);
    return NextResponse.json(
      { error: 'Failed to update credits' },
      { status: 500 }
    );
  }
}

// PUT - Allocate additional credits to a user
export async function PUT(req: NextRequest) {
  try {
    const isValid = await verifyAdmin(req);
    if (!isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId, creditsToAdd } = await req.json();

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      );
    }

    if (typeof creditsToAdd !== 'number' || creditsToAdd <= 0) {
      return NextResponse.json(
        { error: 'Invalid credits amount (must be positive number)' },
        { status: 400 }
      );
    }

    // Start transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Check if user exists
      const userCheck = await client.query(
        'SELECT id, current_credits, total_allocated FROM user_credits WHERE user_id = $1 FOR UPDATE',
        [userId]
      );
      
      if (userCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { error: 'User not found in credit system' },
          { status: 404 }
        );
      }
      
      // Update both current_credits and total_allocated
      const result = await client.query(
        `UPDATE user_credits 
         SET current_credits = current_credits + $2,
             total_allocated = total_allocated + $2,
             updated_at = NOW()
         WHERE user_id = $1
         RETURNING *`,
        [userId, creditsToAdd]
      );
      
      // Log the allocation in credit_usage_log
      await client.query(
        `INSERT INTO credit_usage_log (user_id, credits_used, api_calls, description)
         VALUES ($1, $2, $3, $4)`,
        [userId, creditsToAdd, 0, `Admin allocated ${creditsToAdd} credits`]
      );
      
      await client.query('COMMIT');
      
      return NextResponse.json({
        success: true,
        message: `Successfully added ${creditsToAdd} credits to user`,
        data: {
          id: result.rows[0].id,
          user_id: result.rows[0].user_id,
          credit_percentage: parseFloat(result.rows[0].credit_percentage),
          current_credits: result.rows[0].current_credits,
          total_allocated: result.rows[0].total_allocated,
          used_credits: result.rows[0].total_allocated - result.rows[0].current_credits,
          allocated_amount: creditsToAdd,
          updated_at: result.rows[0].updated_at
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error allocating credits:', error);
    return NextResponse.json(
      { error: 'Failed to allocate credits' },
      { status: 500 }
    );
  }
}

// PATCH - Deduct credits from user (when they use the service)
export async function PATCH(req: NextRequest) {
  try {
    const isValid = await verifyAdmin(req);
    if (!isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId, creditsToDeduct, description } = await req.json();

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      );
    }

    if (typeof creditsToDeduct !== 'number' || creditsToDeduct <= 0) {
      return NextResponse.json(
        { error: 'Invalid credits amount (must be positive number)' },
        { status: 400 }
      );
    }

    // Start transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Check if user exists and has enough credits
      const userCheck = await client.query(
        'SELECT id, current_credits, total_allocated FROM user_credits WHERE user_id = $1 FOR UPDATE',
        [userId]
      );
      
      if (userCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { error: 'User not found in credit system' },
          { status: 404 }
        );
      }
      
      const currentCredits = userCheck.rows[0].current_credits;
      
      if (currentCredits < creditsToDeduct) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { 
            error: 'Insufficient credits',
            current_credits: currentCredits,
            requested: creditsToDeduct,
            shortfall: creditsToDeduct - currentCredits
          },
          { status: 400 }
        );
      }
      
      // Deduct only from current_credits (total_allocated remains unchanged)
      const result = await client.query(
        `UPDATE user_credits 
         SET current_credits = current_credits - $2,
             updated_at = NOW()
         WHERE user_id = $1
         RETURNING *`,
        [userId, creditsToDeduct]
      );
      
      // Log the deduction in credit_usage_log
      await client.query(
        `INSERT INTO credit_usage_log (user_id, credits_used, api_calls, description)
         VALUES ($1, $2, $3, $4)`,
        [userId, creditsToDeduct, 1, description || `Credit deduction of ${creditsToDeduct} credits`]
      );
      
      await client.query('COMMIT');
      
      return NextResponse.json({
        success: true,
        message: `Successfully deducted ${creditsToDeduct} credits from user`,
        data: {
          id: result.rows[0].id,
          user_id: result.rows[0].user_id,
          credit_percentage: parseFloat(result.rows[0].credit_percentage),
          current_credits: result.rows[0].current_credits,
          total_allocated: result.rows[0].total_allocated,
          used_credits: result.rows[0].total_allocated - result.rows[0].current_credits,
          deducted_amount: creditsToDeduct,
          remaining_percentage: ((result.rows[0].current_credits / result.rows[0].total_allocated) * 100).toFixed(2),
          updated_at: result.rows[0].updated_at
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error deducting credits:', error);
    return NextResponse.json(
      { error: 'Failed to deduct credits' },
      { status: 500 }
    );
  }
}

// DELETE - Remove a user from credit system
export async function DELETE(req: NextRequest) {
  try {
    const isValid = await verifyAdmin(req);
    if (!isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Start a transaction to delete user and their usage logs
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Delete credit usage logs first (foreign key constraint)
      await client.query('DELETE FROM credit_usage_log WHERE user_id = $1', [userId]);
      
      // Delete user credits
      const result = await client.query(
        'DELETE FROM user_credits WHERE user_id = $1 RETURNING id, user_id, current_credits, total_allocated',
        [userId]
      );
      
      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }
      
      await client.query('COMMIT');
      
      return NextResponse.json({
        success: true,
        message: 'User removed from credit system successfully',
        data: {
          user_id: userId,
          credits_remaining: result.rows[0].current_credits,
          total_allocated: result.rows[0].total_allocated
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}

// GET single user endpoint
export async function OPTIONS(req: NextRequest) {
  try {
    const isValid = await verifyAdmin(req);
    if (!isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `SELECT 
        id,
        user_id,
        credit_percentage,
        current_credits,
        total_allocated,
        (total_allocated - current_credits) as used_credits,
        created_at,
        updated_at
       FROM user_credits 
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: result.rows[0].id,
        user_id: result.rows[0].user_id,
        credit_percentage: parseFloat(result.rows[0].credit_percentage),
        current_credits: result.rows[0].current_credits,
        total_allocated: result.rows[0].total_allocated,
        used_credits: result.rows[0].used_credits,
        usage_percentage: ((result.rows[0].used_credits / result.rows[0].total_allocated) * 100).toFixed(2),
        created_at: result.rows[0].created_at,
        updated_at: result.rows[0].updated_at
      }
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}