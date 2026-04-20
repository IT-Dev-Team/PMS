import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import pool from '@/lib/db'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-minimum-32-characters'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let client;
  
  try {
    const { id: chatId } = await params
    console.log('=== MESSAGES API ===')
    console.log('Chat ID:', chatId)
    
    // Try to get token from multiple sources
    let token: string | undefined
    
    // 1. Try cookies
    const cookieStore = await cookies()
    token = cookieStore.get('token')?.value
    
    // 2. Try Authorization header
    if (!token) {
      const authHeader = request.headers.get('authorization')
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7)
        console.log('Token from Authorization header')
      }
    }
    
    console.log('Token exists:', !!token)
    
    if (!token) {
      console.log('No token found - returning empty array')
      return NextResponse.json([], { status: 200 })
    }
    
    // Verify token
    let decoded
    try {
      decoded = jwt.verify(token, JWT_SECRET)
      console.log('Token verified - User:', decoded.email)
      console.log('User ID:', decoded.userId)
    } catch (error) {
      console.error('Token verification failed:', error.message)
      return NextResponse.json([], { status: 200 })
    }
    
    const userId = decoded.userId
    
    if (!userId) {
      console.log('No userId in token')
      return NextResponse.json([], { status: 200 })
    }
    
    client = await pool.connect()
    
    // Verify user owns this chat
    const chatResult = await client.query(
      'SELECT id, title FROM chats WHERE id = $1 AND user_id = $2',
      [chatId, userId]
    )
    
    console.log('Chat found:', chatResult.rows.length > 0)
    
    if (chatResult.rows.length === 0) {
      console.log('Chat not found or user does not own it')
      return NextResponse.json([], { status: 200 })
    }
    
    // Get messages
    const messagesResult = await client.query(
      `SELECT 
        m.id,
        m.content,
        m.role,
        m.created_at,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', a.id,
                'filename', a.filename,
                'file_url', a.file_url
              )
            )
            FROM attachments a
            WHERE a.message_id = m.id
          ),
          '[]'::json
        ) as attachments
      FROM messages m
      WHERE m.chat_id = $1
      ORDER BY m.created_at ASC`,
      [chatId]
    )
    
    console.log(`Found ${messagesResult.rows.length} messages`)
    
    return NextResponse.json(messagesResult.rows || [])
  } catch (error) {
    console.error('Error fetching messages:', error)
    return NextResponse.json([], { status: 200 })
  } finally {
    if (client) client.release()
  }
}