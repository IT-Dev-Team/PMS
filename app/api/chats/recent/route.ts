// app/api/chats/recent/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import pool from '@/lib/db'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-minimum-32-characters'

export async function GET(request: NextRequest) {
  let client;
  
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    let decoded
    try {
      decoded = jwt.verify(token, JWT_SECRET)
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
    
    const userId = decoded.userId
    
    if (!userId) {
      return NextResponse.json({ error: 'Invalid token payload' }, { status: 401 })
    }
    
    client = await pool.connect()
    
    // Get recent chats (last 7 days, not archived)
    const result = await client.query(
      `SELECT 
        id, 
        title, 
        summarized_title,
        created_at, 
        updated_at,
        is_starred,
        (SELECT COUNT(*) FROM messages WHERE chat_id = chats.id) as message_count
       FROM chats
       WHERE user_id = $1 
         AND is_archived = false
         AND updated_at > NOW() - INTERVAL '7 days'
       ORDER BY updated_at DESC
       LIMIT 10`,
      [userId]
    )
    
    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Get recent chats error:', error)
    return NextResponse.json({ error: 'Failed to fetch recent chats' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}