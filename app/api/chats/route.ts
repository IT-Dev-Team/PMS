// app/api/chats/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import pool from '@/lib/db'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-minimum-32-characters'

// GET /api/chats - Fetch all chats for user
export async function GET(request: NextRequest) {
  let client;
  
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized - No token' },
        { status: 401 }
      )
    }
    
    let decoded
    try {
      decoded = jwt.verify(token, JWT_SECRET)
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      )
    }
    
    const userId = decoded.userId || decoded.id
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid token payload' },
        { status: 401 }
      )
    }
    
    client = await pool.connect()
    
    // Get all chats with additional fields
    const result = await client.query(
      `SELECT 
        id, 
        title, 
        summarized_title,
        created_at, 
        updated_at,
        is_starred,
        is_archived,
        (SELECT COUNT(*) FROM messages WHERE chat_id = chats.id) as message_count
       FROM chats
       WHERE user_id = $1 AND is_archived = false
       ORDER BY is_starred DESC, updated_at DESC
       LIMIT 100`,
      [userId]
    )
    
    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Get chats error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch chats' },
      { status: 500 }
    )
  } finally {
    if (client) client.release()
  }
}

// POST /api/chats - Create new chat (returns ID without saving to DB)
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized - No token' },
        { status: 401 }
      )
    }
    
    let decoded
    try {
      decoded = jwt.verify(token, JWT_SECRET)
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      )
    }
    
    const userId = decoded.userId || decoded.id
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid token payload' },
        { status: 401 }
      )
    }
    
    const body = await request.json()
    const { title = 'New Chat' } = body
    
    // Generate a UUID for the chat but DON'T save to database yet
    // The chat will be saved when the first message is sent
    const chatId = crypto.randomUUID()
    
    // Return the chat ID without creating a database record
    // This allows the frontend to navigate to the chat immediately
    return NextResponse.json({
      id: chatId,
      title: title,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_temp: true // Flag to indicate this is a temporary chat
    })
  } catch (error) {
    console.error('Create chat error:', error)
    return NextResponse.json(
      { error: 'Failed to create chat: ' + (error as Error).message },
      { status: 500 }
    )
  }
}