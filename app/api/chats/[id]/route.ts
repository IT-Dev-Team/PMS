import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import pool from '@/lib/db'
import { createTask, uploadFile } from '@/lib/manus-service'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-minimum-32-characters'

function generateTitleFromMessage(content: string): string {
  const cleanContent = content.trim().replace(/\s+/g, ' ')
  if (cleanContent.length <= 30) {
    return cleanContent
  }
  return cleanContent.substring(0, 30) + '...'
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id: chatId } = await params
    const body = await request.json()
    const { content, fileIds = [], attachments = [] } = body

    if (!content?.trim() && fileIds.length === 0 && attachments.length === 0) {
      return NextResponse.json(
        { error: 'Message content or attachments are required' },
        { status: 400 }
      )
    }

    client = await pool.connect()

    const chatResult = await client.query(
      'SELECT id, title, created_at FROM chats WHERE id = $1 AND user_id = $2',
      [chatId, userId]
    )

    if (chatResult.rows.length === 0) {
      client.release()
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
    }

    const chat = chatResult.rows[0]
    const isFirstMessage = chat.title === 'New Conversation'

    const userMessageResult = await client.query(
      `INSERT INTO messages (chat_id, role, content, attachments, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, chat_id, role, content, created_at, attachments`,
      [chatId, 'user', content || '[File attachment]', JSON.stringify(attachments)]
    )

    let updatedChat = chat
    if (isFirstMessage && content) {
      const newTitle = generateTitleFromMessage(content)
      await client.query(
        'UPDATE chats SET title = $1, updated_at = NOW() WHERE id = $2',
        [newTitle, chatId]
      )
      updatedChat.title = newTitle
    }

    // FIX: Mark the placeholder with message_type = 'placeholder' so the
    // client can skip it when loading DB messages. It exists only for DB
    // tracking (manus_task_id linkage) — never shown in the UI.
    const assistantMessageResult = await client.query(
      `INSERT INTO messages (chat_id, role, content, status_type, message_type, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id, chat_id, role, content, status_type, message_type, created_at`,
      [chatId, 'assistant', '🔄 Manus is working on your request...', 'running', 'placeholder']
    )

    let taskId: string | null = null
    
    try {
      const fullPrompt = content || 'Please process the attached files'
      const chatTitle = isFirstMessage && content ? generateTitleFromMessage(content) : chat.title
      
      console.log('[API] Creating Manus task with:', {
        contentLength: fullPrompt.length,
        fileCount: fileIds.length,
        title: chatTitle
      })
      
      const manusResponse = await createTask({
        content: fullPrompt,
        fileIds: fileIds.length > 0 ? fileIds : undefined,
        interactiveMode: true,
        agentProfile: 'manus-1.6',
        locale: 'en',
        title: chatTitle,
        shareVisibility: 'private',
        hideInTaskList: false
      })
      
      taskId = manusResponse.taskId
      
      if (!taskId) {
        throw new Error('No task ID returned from Manus API')
      }
      
      console.log(`[API] ✅ Created Manus task: ${taskId}`)
      
      await client.query(
        `UPDATE messages 
         SET manus_task_id = $1, updated_at = NOW()
         WHERE id = $2`,
        [taskId, assistantMessageResult.rows[0].id]
      )
      
      await client.query(
        'UPDATE chats SET updated_at = NOW(), is_processing = true WHERE id = $1',
        [chatId]
      )
      
      client.release()
      
      return NextResponse.json({
        success: true,
        taskId,
        chat: updatedChat,
        userMessage: userMessageResult.rows[0],
        // Return the placeholder row so client has the manus_task_id,
        // but the client will NOT render it (guarded by message_type check)
        assistantMessage: {
          ...assistantMessageResult.rows[0],
          manus_task_id: taskId
        }
      }, { status: 201 })
      
    } catch (taskError) {
      console.error('[API] ❌ Failed to create Manus task:', taskError)
      
      await client.query(
        `UPDATE messages 
         SET content = $1, status_type = 'failed', message_type = 'error_message', updated_at = NOW()
         WHERE id = $2`,
        [`❌ Error: Unable to process request. ${taskError instanceof Error ? taskError.message : 'Please try again.'}`, 
         assistantMessageResult.rows[0].id]
      )
      
      await client.query(
        'UPDATE chats SET updated_at = NOW(), is_processing = false WHERE id = $1',
        [chatId]
      )
      
      client.release()
      
      return NextResponse.json({
        success: false,
        error: 'Failed to create Manus task',
        chat: updatedChat,
        userMessage: userMessageResult.rows[0],
        assistantMessage: {
          ...assistantMessageResult.rows[0],
          content: `❌ Error: ${taskError instanceof Error ? taskError.message : 'Unknown error'}`,
          message_type: 'error_message'
        }
      }, { status: 500 })
    }
    
  } catch (error) {
    console.error('Error creating message:', error)
    if (client) client.release()
    return NextResponse.json({ error: 'Failed to create message' }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id: chatId } = await params

    client = await pool.connect()

    const chatResult = await client.query(
      'SELECT id, title FROM chats WHERE id = $1 AND user_id = $2',
      [chatId, userId]
    )

    if (chatResult.rows.length === 0) {
      client.release()
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
    }

    const messagesResult = await client.query(
      `SELECT id, chat_id, role, content, created_at, attachments, manus_task_id, status_type, message_type
       FROM messages 
       WHERE chat_id = $1
       ORDER BY created_at ASC`,
      [chatId]
    )

    client.release()
    return NextResponse.json({
      chat: chatResult.rows[0],
      messages: messagesResult.rows
    })

  } catch (error) {
    console.error('Error fetching messages:', error)
    if (client) client.release()
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
  }
}