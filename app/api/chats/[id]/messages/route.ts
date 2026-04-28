import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import pool from '@/lib/db'
import { createTask, sendMessageToTask, getTaskDetail } from '@/lib/manus-service'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-minimum-32-characters'

function generateTitle(content: string): string {
  const clean = content.trim().replace(/\s+/g, ' ')
  return clean.length <= 50 ? clean : clean.slice(0, 50) + '…'
}

/**
 * Appends a PDF-output instruction to the user's prompt unless the user
 * explicitly asked for HTML. This ensures Manus always returns a downloadable
 * PDF that the converter can then re-export to DOCX / PPTX on demand.
 */
function injectPdfInstruction(content: string): string {
  const lower = content.toLowerCase()
  // User explicitly wants HTML → leave alone
  if (lower.includes('html') || lower.includes('web page') || lower.includes('webpage')) {
    return content
  }
  // Already asked for a specific file format → leave alone
  if (/\.(pdf|docx?|xlsx?|pptx?|csv|json|xml)\b/.test(lower)) {
    return content
  }
  // Append PDF instruction
  return (
    content.trimEnd() +
    '\n\nIMPORTANT: When generating any file output (report, document, summary, presentation, etc.), ' +
    'always save and attach it as a PDF file. Do not use markdown files or plain text files as the primary output.'
  )
}

// In the POST /api/chats/[id]/messages route, modify the placeholder and message handling:

// ─── POST /api/chats/[id]/messages ───────────────────────────────────────────
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
    const { content, fileIds = [], attachments = [] } = await request.json()

    if (!content?.trim() && !fileIds.length && !attachments.length) {
      return NextResponse.json({ error: 'Message content or attachments required' }, { status: 400 })
    }

    client = await pool.connect()

    // Fetch chat — includes manus_task_id if task already exists
    const chatRes = await client.query(
      'SELECT id, title, manus_task_id FROM chats WHERE id = $1 AND user_id = $2',
      [chatId, userId]
    )
    if (!chatRes.rows.length) { client.release(); return NextResponse.json({ error: 'Chat not found' }, { status: 404 }) }

    const chat            = chatRes.rows[0]
    const existingTaskId  = chat.manus_task_id as string | null
    const isFirstMessage  = chat.title === 'New Conversation'
    const rawPrompt       = content?.trim() || 'Please process the attached files'
    const augmentedPrompt = injectPdfInstruction(rawPrompt)

    // Save user message (store original — no need to show the PDF instruction to user)
    const userMsgRes = await client.query(
      `INSERT INTO messages (chat_id, role, content, attachments, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, chat_id, role, content, created_at, attachments`,
      [chatId, 'user', rawPrompt, JSON.stringify(attachments)]
    )

    // Update chat title on first message
    let updatedChat = { ...chat }
    if (isFirstMessage && content) {
      const title = generateTitle(rawPrompt)
      await client.query('UPDATE chats SET title=$1, updated_at=NOW() WHERE id=$2', [title, chatId])
      updatedChat.title = title
    }

    // DO NOT create a placeholder message here - it will be overwritten
    // Instead, let the polling create actual assistant messages

    let taskId: string | null = null
    let creditUsage: number | undefined

    try {
      if (existingTaskId) {
        // ── Follow-up: send to the same task (Manus keeps context) ──────
        console.log(`[API] Reusing task ${existingTaskId}`)
        await sendMessageToTask(existingTaskId, rawPrompt, fileIds.length ? fileIds : undefined)
        taskId = existingTaskId

        // Fetch latest credit usage
        try {
          const detail = await getTaskDetail(taskId)
          creditUsage  = detail.creditUsage
        } catch { /* non-fatal */ }

      } else {
        // ── First message: create new task ───────────────────────────────
        const chatTitle = isFirstMessage ? generateTitle(rawPrompt) : chat.title
        const res = await createTask({
          content:         augmentedPrompt,
          fileIds:         fileIds.length ? fileIds : undefined,
          interactiveMode: true,
          agentProfile:    'manus-1.6',
          locale:          'en',
          title:           chatTitle,
          shareVisibility: 'private',
          hideInTaskList:  false,
        })
        taskId = res.taskId
        if (!taskId) throw new Error('No task ID from Manus')

        // Persist task ID on chat for all future messages
        await client.query(
          'UPDATE chats SET manus_task_id=$1, updated_at=NOW() WHERE id=$2',
          [taskId, chatId]
        )
        console.log(`[API] Created task ${taskId}`)
      }

      // Update chat processing status
      await client.query(
        'UPDATE chats SET is_processing=true, updated_at=NOW() WHERE id=$1',
        [chatId]
      )

      // Save credit usage to chat if we have it
      if (creditUsage !== undefined) {
        await client.query(
          'UPDATE chats SET credit_usage=COALESCE(credit_usage,0)+$1, updated_at=NOW() WHERE id=$2',
          [creditUsage, chatId]
        )
      }

      client.release()
      return NextResponse.json({
        success: true, taskId,
        chat:             updatedChat,
        userMessage:      userMsgRes.rows[0],
      }, { status: 201 })

    } catch (err) {
      console.error('[API] Manus error:', err)
      
      // Only create error message if there's an actual error
      const errorMsgRes = await client.query(
        `INSERT INTO messages (chat_id, role, content, status_type, message_type, created_at)
         VALUES ($1, 'assistant', $2, 'failed', 'error_message', NOW())
         RETURNING id, chat_id, role, content, status_type, message_type, created_at`,
        [chatId, `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,]
      )
      
      await client.query('UPDATE chats SET is_processing=false, updated_at=NOW() WHERE id=$1', [chatId])
      client.release()
      return NextResponse.json({
        success: false, error: 'Failed to process message',
        chat: updatedChat,
        userMessage: userMsgRes.rows[0],
        assistantMessage: errorMsgRes.rows[0],
      }, { status: 500 })
    }
  } catch (e) {
    console.error('POST /messages error:', e)
    if (client) client.release()
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── GET /api/chats/[id]/messages ────────────────────────────────────────────
export async function GET(
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

    client = await pool.connect()
    const chatRes = await client.query(
      'SELECT id, title FROM chats WHERE id=$1 AND user_id=$2',
      [chatId, userId]
    )
    if (!chatRes.rows.length) { client.release(); return NextResponse.json({ error: 'Chat not found' }, { status: 404 }) }

    const msgRes = await client.query(
      `SELECT id, chat_id, role, content, created_at, attachments, manus_task_id, status_type, message_type
       FROM messages WHERE chat_id=$1 ORDER BY created_at ASC`,
      [chatId]
    )
    client.release()
    return NextResponse.json({ chat: chatRes.rows[0], messages: msgRes.rows })
  } catch (e) {
    console.error('GET /messages error:', e)
    if (client) client.release()
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── DB migration ─────────────────────────────────────────────────────────────
// ALTER TABLE chats ADD COLUMN IF NOT EXISTS manus_task_id TEXT;
// ALTER TABLE chats ADD COLUMN IF NOT EXISTS credit_usage  NUMERIC DEFAULT 0;