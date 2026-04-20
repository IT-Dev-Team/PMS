import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import pool from '@/lib/db'

export async function POST(request: NextRequest) {
  let client;
  
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    
    if (sessionToken) {
      client = await pool.connect()
      
      // Delete session from database
      await client.query(
        'DELETE FROM sessions WHERE token = $1',
        [sessionToken]
      )
    }
    
    // Clear cookies
    cookieStore.delete('session')
    cookieStore.delete('user')
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { error: 'Failed to logout' },
      { status: 500 }
    )
  } finally {
    if (client) {
      client.release()
    }
  }
}