// lib/credit-manager.ts
import pool from '@/lib/db'

export interface CreditInfo {
  current: number
  allocated: number
  used: number
  percentage: number
}

export class CreditManager {
  static async getUserCredits(userId: string): Promise<CreditInfo | null> {
    const result = await pool.query(
      `SELECT 
        current_credits,
        total_allocated,
        (total_allocated - current_credits) as credits_used,
        credit_percentage
       FROM user_credits 
       WHERE user_id = $1`,
      [userId]
    )

    if (result.rows.length === 0) return null

    const row = result.rows[0]
    return {
      current: parseFloat(row.current_credits),
      allocated: parseFloat(row.total_allocated),
      used: parseFloat(row.credits_used),
      percentage: parseFloat(row.credit_percentage)
    }
  }

  static async checkSufficientCredits(
    userId: string, 
    requiredCredits: number
  ): Promise<{ hasCredits: boolean; currentCredits: number; shortfall?: number }> {
    const credits = await this.getUserCredits(userId)
    
    if (!credits) {
      return { hasCredits: false, currentCredits: 0, shortfall: requiredCredits }
    }

    return {
      hasCredits: credits.current >= requiredCredits,
      currentCredits: credits.current,
      shortfall: credits.current < requiredCredits ? requiredCredits - credits.current : undefined
    }
  }

  static async deductCredits(
    client: any,
    userId: string, 
    amount: number,
    description: string = 'Credit deduction'
  ): Promise<{ success: boolean; remainingCredits: number; message?: string }> {
    const creditCheck = await this.checkSufficientCredits(userId, amount)
    
    if (!creditCheck.hasCredits) {
      return {
        success: false,
        remainingCredits: creditCheck.currentCredits,
        message: `Insufficient credits. Need ${amount}, have ${creditCheck.currentCredits}`
      }
    }

    const result = await client.query(
      `UPDATE user_credits 
       SET current_credits = current_credits - $2,
           updated_at = NOW()
       WHERE user_id = $1
       RETURNING current_credits`,
      [userId, amount]
    )

    // Log the deduction
    await client.query(
      `INSERT INTO credit_usage_log (user_id, credits_used, api_calls, description)
       VALUES ($1, $2, $3, $4)`,
      [userId, amount, 1, description]
    )

    return {
      success: true,
      remainingCredits: result.rows[0].current_credits
    }
  }

  static async refundCredits(
    client: any,
    userId: string, 
    amount: number,
    description: string = 'Credit refund'
  ): Promise<{ success: boolean; newBalance: number }> {
    const result = await client.query(
      `UPDATE user_credits 
       SET current_credits = current_credits + $2,
           updated_at = NOW()
       WHERE user_id = $1
       RETURNING current_credits`,
      [userId, amount]
    )

    // Log the refund as negative usage
    await client.query(
      `INSERT INTO credit_usage_log (user_id, credits_used, api_calls, description)
       VALUES ($1, $2, $3, $4)`,
      [userId, -amount, 0, description]
    )

    return {
      success: true,
      newBalance: result.rows[0].current_credits
    }
  }

  static async getCreditSummary(userId: string): Promise<{
    current: number
    allocated: number
    used: number
    remainingPercentage: number
    totalTasksPossible: number
  } | null> {
    const credits = await this.getUserCredits(userId)
    
    if (!credits) return null

    const TASK_COST = 1 // Configure as needed
    
    return {
      current: credits.current,
      allocated: credits.allocated,
      used: credits.used,
      remainingPercentage: (credits.current / credits.allocated) * 100,
      totalTasksPossible: Math.floor(credits.current / TASK_COST)
    }
  }
}