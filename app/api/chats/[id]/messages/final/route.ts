import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import pool from '@/lib/db'
import { getTaskDetail } from '@/lib/manus-service'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-minimum-32-characters'

// POST /api/chats/[id]/messages/final
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let client
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let decoded: any
    try { decoded = jwt.verify(token, JWT_SECRET) }
    catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

    const userId         = decoded.userId || decoded.id
    const { id: chatId } = await params
    const body           = await request.json()
    const { taskId, content, attachments } = body

    if (!taskId || !content) {
      return NextResponse.json({ error: 'taskId and content are required' }, { status: 400 })
    }

    client = await pool.connect()

    // Verify chat ownership
    const chatRes = await client.query(
      'SELECT id FROM chats WHERE id=$1 AND user_id=$2',
      [chatId, userId]
    )
    if (!chatRes.rows.length) {
      client.release()
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
    }

    // Check if a completed assistant message for this task already exists in THIS chat
    // (scope to chatId to avoid cross-chat false positives)
    const existing = await client.query(
      `SELECT id FROM messages
       WHERE chat_id=$1 AND manus_task_id=$2
         AND role='assistant' AND message_type='assistant_message'`,
      [chatId, taskId]
    )

    
      // Insert fresh final assistant message
      await client.query(
        `INSERT INTO messages
           (chat_id, role, content, attachments, status_type, message_type, manus_task_id, created_at)
         VALUES ($1, 'assistant', $2, $3, 'completed', 'assistant_message', $4, NOW())`,
        [chatId, content, JSON.stringify(attachments || []), taskId]
      )
    

    // Also update any placeholder row so it no longer shows as 'running'
    await client.query(
      `UPDATE messages
       SET status_type='completed', updated_at=NOW()
       WHERE chat_id=$1 AND manus_task_id=$2 AND message_type='placeholder'`,
      [chatId, taskId]
    )

    // Fetch credit usage from Manus
    let creditUsage: number | undefined
    try {
      const detail = await getTaskDetail(taskId)
      creditUsage  = detail.creditUsage
    } catch { /* non-fatal */ }

    // Update chat: mark done + accumulate credit_usage
    const updateQuery = creditUsage !== undefined
      ? `UPDATE chats SET is_processing=false, updated_at=NOW(),
           credit_usage=COALESCE(credit_usage,0)+$2
         WHERE id=$1`
      : `UPDATE chats SET is_processing=false, updated_at=NOW() WHERE id=$1`

    await client.query(updateQuery, creditUsage !== undefined ? [chatId, creditUsage] : [chatId])

    client.release()
    return NextResponse.json({ success: true, creditUsage })

  } catch (e) {
    console.error('POST /messages/final error:', e)
    if (client) client.release()
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}