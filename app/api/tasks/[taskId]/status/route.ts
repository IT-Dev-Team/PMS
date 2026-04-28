import { NextRequest, NextResponse } from 'next/server'
import { getTaskMessages, getTaskDetail } from '@/lib/manus-service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params

    if (!taskId || taskId === 'undefined' || taskId === 'null') {
      return NextResponse.json({
        success: true,
        taskId,
        status: 'idle',
        messages: []
      })
    }

    let messages: any[] = []

    // FIX 1: Fetch messages and task detail in parallel — halves latency
    const [messagesResult, detailResult] = await Promise.allSettled([
      getTaskMessages(taskId, { limit: 100, order: 'asc', verbose: true }),
      getTaskDetail(taskId),
    ])

    if (messagesResult.status === 'rejected') {
      const err = messagesResult.reason
      if (err?.message?.includes('not found')) {
        return NextResponse.json({
          success: true,
          taskId,
          status: 'initializing',
          messages: []
        })
      }
      // Other errors: return empty so client retries
      return NextResponse.json({
        success: true,
        taskId,
        status: 'running',
        messages: []
      })
    }

    const res = messagesResult.value

    messages = (res.messages || [])
      .map((msg: any) => {
        // FIX 2: Pass through the raw nested fields so the client can access
        // msg.assistant_message.content, msg.status_update.agent_status, etc.
        // Previously the route was flattening too early, losing agent_status.
        return {
          // Stable dedup key: prefer msg.id, fallback to type+timestamp
          id: msg.id ?? `${msg.type}__${msg.timestamp}`,
          type: msg.type,
          timestamp: msg.timestamp,
          // Raw nested payloads — client already knows how to read these
          assistant_message: msg.assistant_message,
          user_message: msg.user_message,
          status_update: msg.status_update,
          explanation: msg.explanation,
          error_message: msg.error_message,
        }
      })

    // Always sort chronologically
    messages.sort((a: any, b: any) => Number(a.timestamp) - Number(b.timestamp))

    const status = detailResult.status === 'fulfilled'
      ? detailResult.value.status
      : 'running'

    return NextResponse.json({
      success: true,
      taskId,
      status,
      messages
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      taskId: null,
      status: 'running',
      messages: []
    })
  }
}