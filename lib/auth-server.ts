import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import pool from './db'

export interface User {
  id: string
  email: string
  name: string
  avatar_url: string | null
}

export async function getCurrentUser(): Promise<User | null> {
  let client;
  
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    
    if (!sessionToken) {
      return null
    }
    
    client = await pool.connect()
    
    const result = await client.query(
      `SELECT u.id, u.email, u.name, u.avatar_url
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token = $1 AND s.expires_at > NOW()`,
      [sessionToken]
    )
    
    if (result.rows.length === 0) {
      return null
    }
    
    // Update last activity
    await client.query(
      `UPDATE sessions SET last_activity_at = NOW() WHERE token = $1`,
      [sessionToken]
    )
    
    return result.rows[0]
  } catch (error) {
    console.error('Get current user error:', error)
    return null
  } finally {
    if (client) client.release()
  }
}

export async function requireAuth() {
  const user = await getCurrentUser()
  
  if (!user) {
    redirect('/auth/login')
  }
  
  return user
}