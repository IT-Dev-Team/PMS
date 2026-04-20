// app/api/chats/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import pool from '@/lib/db'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-minimum-32-characters'

// GET /api/chats/:id - Get specific chat details
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const chatId = params.id
    
    client = await pool.connect()
    
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
       WHERE id = $1 AND user_id = $2`,
      [chatId, userId]
    )
    
    if (result.rows.length === 0) {
      // Return empty chat object instead of 404 for new chats
      return NextResponse.json({
        id: chatId,
        title: 'New Chat',
        summarized_title: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_starred: false,
        is_archived: false,
        message_count: 0,
        is_new: true // Flag to indicate this is a new/empty chat
      })
    }
    
    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Get chat error:', error)
    return NextResponse.json({ error: 'Failed to fetch chat' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}

// PATCH /api/chats/:id - Update chat (rename, star, archive)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const chatId = params.id
    const { title, is_starred, is_archived } = await req.json()
    
    client = await pool.connect()
    
    // First verify ownership
    const ownershipCheck = await client.query(
      'SELECT id FROM chats WHERE id = $1 AND user_id = $2',
      [chatId, userId]
    )
    
    // If chat doesn't exist, create it first
    if (ownershipCheck.rows.length === 0) {
      console.log('Chat not found, creating new chat:', chatId)
      
      // Create new chat with default values
      const newTitle = title || 'New Chat'
      const insertResult = await client.query(
        `INSERT INTO chats (id, user_id, title, summarized_title, created_at, updated_at, is_starred, is_archived)
         VALUES ($1, $2, $3, $4, NOW(), NOW(), $5, $6)
         RETURNING id, title, summarized_title, is_starred, is_archived, updated_at`,
        [chatId, userId, newTitle, newTitle, is_starred || false, is_archived || false]
      )
      
      return NextResponse.json(insertResult.rows[0])
    }
    
    // Build dynamic update query for existing chat
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1
    
    if (title !== undefined) {
      updates.push(`title = $${paramIndex++}`)
      values.push(title)
      
      // Generate summarized title if title is being updated
      const summary = await generateChatSummary(chatId, title, client)
      updates.push(`summarized_title = $${paramIndex++}`)
      values.push(summary)
    }
    
    if (typeof is_starred === 'boolean') {
      updates.push(`is_starred = $${paramIndex++}`)
      values.push(is_starred)
    }
    
    if (typeof is_archived === 'boolean') {
      updates.push(`is_archived = $${paramIndex++}`)
      values.push(is_archived)
    }
    
    updates.push(`updated_at = NOW()`)
    
    if (updates.length === 1) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }
    
    const query = `
      UPDATE chats 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
      RETURNING id, title, summarized_title, is_starred, is_archived, updated_at
    `
    
    values.push(chatId, userId)
    
    const result = await client.query(query, values)
    
    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Update chat error:', error)
    return NextResponse.json({ error: 'Failed to update chat' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}

// DELETE /api/chats/:id - Delete chat
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const chatId = params.id
    
    client = await pool.connect()
    
    // Check if chat exists
    const chatCheck = await client.query(
      'SELECT id FROM chats WHERE id = $1 AND user_id = $2',
      [chatId, userId]
    )
    
    if (chatCheck.rows.length === 0) {
      // Return success even if chat doesn't exist (idempotent)
      return NextResponse.json({ 
        success: true, 
        id: chatId, 
        message: 'Chat already deleted or does not exist' 
      })
    }
    
    // Delete messages first (due to foreign key constraint)
    await client.query('DELETE FROM messages WHERE chat_id = $1', [chatId])
    
    // Delete chat
    await client.query(
      'DELETE FROM chats WHERE id = $1 AND user_id = $2',
      [chatId, userId]
    )
    
    return NextResponse.json({ success: true, id: chatId, message: 'Chat deleted successfully' })
  } catch (error) {
    console.error('Delete chat error:', error)
    return NextResponse.json({ error: 'Failed to delete chat' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}

// Helper function to generate chat summary
async function generateChatSummary(chatId: string, currentTitle: string, client: any): Promise<string> {
  try {
    // Fetch first few messages to generate a meaningful summary
    const messagesResult = await client.query(
      `SELECT content, role 
       FROM messages 
       WHERE chat_id = $1 
       ORDER BY created_at ASC 
       LIMIT 5`,
      [chatId]
    )
    
    const messages = messagesResult.rows
    
    if (messages.length === 0) {
      // If no messages, summarize the title
      return currentTitle.length > 30 ? currentTitle.substring(0, 27) + '...' : currentTitle
    }
    
    // Get first user message
    const firstUserMessage = messages.find((m: any) => m.role === 'user')?.content || ''
    
    if (!firstUserMessage) {
      return currentTitle.length > 30 ? currentTitle.substring(0, 27) + '...' : currentTitle
    }
    
    // Generate a short summary (max 30 characters)
    let summary = firstUserMessage.substring(0, 27)
    if (firstUserMessage.length > 27) summary += '...'
    
    return summary
  } catch (error) {
    console.error('Error generating summary:', error)
    return currentTitle.length > 30 ? currentTitle.substring(0, 27) + '...' : currentTitle
  }
}