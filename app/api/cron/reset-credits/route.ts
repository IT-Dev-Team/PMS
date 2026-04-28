import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Cron job to reset credits automatically on the configured reset day
 * This should be called by a cron service (Vercel Crons, AWS EventBridge, etc.)
 * 
 * Add this to your vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/reset-credits",
 *     "schedule": "0 0 * * *"
 *   }]
 * }
 */
export async function POST(req: NextRequest) {
  try {
    // Verify the request is from a trusted source (Vercel, etc.)
    const authHeader = req.headers.get('Authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get settings
    const { data: settings, error: settingsError } = await supabase
      .from('admin_settings')
      .select('reset_day, total_monthly_credits')
      .single();

    if (settingsError) throw settingsError;

    const resetDay = settings?.reset_day || 1;
    const today = new Date();
    const currentDay = today.getDate();

    // Only reset if today is the reset day
    if (currentDay !== resetDay) {
      return NextResponse.json({
        skipped: true,
        message: `Reset day is ${resetDay}, today is ${currentDay}. Skipping.`
      });
    }

    // Check if we already reset today (to avoid duplicate resets)
    const { data: lastReset } = await supabase
      .from('credit_reset_history')
      .select('created_at')
      .eq('reset_type', 'automatic')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (lastReset) {
      const lastResetDate = new Date(lastReset.created_at);
      const lastResetDay = lastResetDate.getDate();
      const lastResetMonth = lastResetDate.getMonth();
      const currentMonth = today.getMonth();

      // If we already reset this month, skip
      if (lastResetDay === currentDay && lastResetMonth === currentMonth) {
        return NextResponse.json({
          skipped: true,
          message: 'Credits already reset today'
        });
      }
    }

    const totalCredits = settings?.total_monthly_credits || 1000;

    // Get all users with credit percentages
    const { data: users, error: usersError } = await supabase
      .from('user_credits')
      .select('user_id, credit_percentage');

    if (usersError) throw usersError;

    const totalPercentage = users?.reduce((sum, u) => sum + (u.credit_percentage || 0), 0) || 0;

    if (totalPercentage === 0) {
      return NextResponse.json({
        error: 'No users with credit allocation',
        status: 400
      });
    }

    // Update each user's credits
    const updates = users?.map(user => {
      const allocatedCredits = Math.floor((user.credit_percentage / totalPercentage) * totalCredits);
      return supabase
        .from('user_credits')
        .update({
          credits_remaining: allocatedCredits,
          credits_used: 0,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.user_id);
    }) || [];

    await Promise.all(updates);

    // Log the reset
    const { error: historyError } = await supabase
      .from('credit_reset_history')
      .insert({
        total_credits_allocated: totalCredits,
        number_of_users: users?.length || 0,
        reset_type: 'automatic'
      });

    if (historyError) throw historyError;

    return NextResponse.json({
      success: true,
      message: `Automatic credits reset completed. ${totalCredits} credits distributed to ${users?.length || 0} users.`,
      creditsAllocated: totalCredits,
      usersUpdated: users?.length || 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      { 
        error: 'Cron job failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
