import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import pool from '@/lib/db'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-minimum-32-characters'

// POST /api/chats - Create a new chat
export async function POST(request: NextRequest) {
  let client
  
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
    
    const userId = decoded.userId || decoded.id
    
    const body = await request.json()
    const { chatId, title, useCase = 'general' } = body
    
    if (!chatId) {
      return NextResponse.json({ error: 'Chat ID is required' }, { status: 400 })
    }
    
    client = await pool.connect()
    
    // Check if chat already exists
    const existingChat = await client.query(
      'SELECT id FROM chats WHERE id = $1 AND user_id = $2',
      [chatId, userId]
    )
    
    if (existingChat.rows.length > 0) {
      client.release()
      return NextResponse.json({ chatId, message: 'Chat already exists' })
    }
    
    // Use provided title or default, but will be updated with first message
    const chatTitle = title || 'New Conversation'
    await client.query(
      `INSERT INTO chats (id, user_id, title, use_case, created_at, updated_at, is_starred, is_archived, is_processing)
       VALUES ($1, $2, $3, $4, NOW(), NOW(), false, false, false)`,
      [chatId, userId, chatTitle, useCase]
    )
    
    client.release()
    
    return NextResponse.json({ 
      success: true, 
      chatId,
      title: chatTitle,
      message: 'Chat created successfully'
    })
    
  } catch (error) {
    console.error('Error creating chat:', error)
    if (client) client.release()
    return NextResponse.json({ error: 'Failed to create chat' }, { status: 500 })
  }
}

// GET /api/chats - Fetch user's chats
export async function GET(request: NextRequest) {
  let client
  
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
    
    const userId = decoded.userId || decoded.id
    
    client = await pool.connect()
    
    const result = await client.query(
      `SELECT id, title, use_case, is_starred, is_archived, is_processing, created_at, updated_at
       FROM chats 
       WHERE user_id = $1 AND is_archived = false
       ORDER BY updated_at DESC
       LIMIT 50`,
      [userId]
    )
    
    client.release()
    
    return NextResponse.json(result.rows)
    
  } catch (error) {
    console.error('Error fetching chats:', error)
    if (client) client.release()
    return NextResponse.json({ error: 'Failed to fetch chats' }, { status: 500 })
  }
}

// PUT /api/chats - Update chat title
export async function PUT(request: NextRequest) {
  let client
  
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
    
    const userId = decoded.userId || decoded.id
    const body = await request.json()
    const { chatId, title } = body
    
    if (!chatId || !title) {
      return NextResponse.json({ error: 'Chat ID and title are required' }, { status: 400 })
    }
    
    client = await pool.connect()
    
    const result = await client.query(
      `UPDATE chats 
       SET title = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING id, title`,
      [title, chatId, userId]
    )
    
    client.release()
    
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
    }
    
    return NextResponse.json({ success: true, chat: result.rows[0] })
    
  } catch (error) {
    console.error('Error updating chat:', error)
    if (client) client.release()
    return NextResponse.json({ error: 'Failed to update chat' }, { status: 500 })
  }
}