import { NextRequest, NextResponse } from 'next/server'
import { 
  createTask,
  sendMessageToTask,
  getTaskMessages
} from '@/lib/manus-service'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const chatId = url.searchParams.get('chatId')
    
    if (!chatId) {
      return NextResponse.json({ error: 'Chat ID is required' }, { status: 400 })
    }

    // Return mock messages for now - in real implementation, fetch from database
    return NextResponse.json([])
  } catch (error) {
    console.error('Error fetching messages:', error)
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { chatId, content, attachments = [] } = body

    if (!chatId || !content?.trim()) {
      return NextResponse.json({ error: 'Chat ID and message content are required' }, { status: 400 })
    }

    // Create or use existing task
    let taskId: string
    
    try {
      // Create a new Manus task
      const task = await createTask({
        content: content,
        interactiveMode: true,
        agentProfile: 'manus-1.6',
        locale: 'en',
        shareVisibility: 'private',
        hideInTaskList: false
      })
      
      taskId = task.taskId
    } catch (taskError) {
      console.error('Failed to create task:', taskError)
      throw new Error(`Failed to create Manus task: ${taskError instanceof Error ? taskError.message : 'Unknown error'}`)
    }

    // Start polling in the background and return taskId immediately
    if (taskId) {
      // Run polling in background without blocking response
      startBackgroundPolling(taskId, chatId, content)
    }

    return NextResponse.json({
      success: true,
      taskId,
      message: 'Message sent successfully. Task processing started.'
    })
  } catch (error) {
    console.error('Error in POST /api/chats/messages:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to send message'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

/**
 * Background polling function that doesn't block the response
 * This function polls the Manus API and updates messages in a separate flow
 */
async function startBackgroundPolling(taskId: string, chatId: string, userMessage: string) {
  const POLL_INTERVAL = 2000 // 2 seconds
  const MAX_ATTEMPTS = 120 // 4 minutes total
  
  let attempt = 0
  let lastEventId = ''
  let hasInitialMessage = false
  
  try {
    while (attempt < MAX_ATTEMPTS) {
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL))
      
      try {
        const response = await getTaskMessages(taskId, {
          limit: 50,
          order: 'asc',
          verbose: true
        })
        
        const messages = response.messages || []
        
        // Process each new message
        for (const message of messages) {
          if (message.id === lastEventId) continue
          
          // Handle status updates
          if (message.type === 'status_update' && message.status_update) {
            const status = message.status_update
            const displayText = `[${status.agent_status.toUpperCase()}] ${status.description || status.brief || 'Processing...'}`
            
            console.log(`[Polling] Status update: ${displayText}`)
            
            // Check if task is completed
            if (status.agent_status === 'stopped') {
              console.log(`[Polling] Task completed for ${taskId}`)
              return
            }
            
            if (status.agent_status === 'error') {
              console.error(`[Polling] Task error: ${status.description}`)
              return
            }
          }
          
          // Handle assistant messages
          if (message.type === 'assistant_message' && message.assistant_message) {
            const content = message.assistant_message.content
            console.log(`[Polling] Assistant response received: ${content.substring(0, 100)}...`)
            
            // Task is done - we have the final response
            return
          }
          
          // Handle tool usage
          if (message.type === 'tool_used' && message.tool_used) {
            const tool = message.tool_used
            const displayText = `[TOOL] Using ${tool.tool}: ${tool.description}`
            console.log(`[Polling] ${displayText}`)
          }
          
          // Handle errors
          if (message.type === 'error_message' && message.error_message) {
            console.error(`[Polling] Error: ${message.error_message.content}`)
            return
          }
          
          // Handle plan updates
          if (message.type === 'plan_update' && message.plan_update) {
            const steps = message.plan_update.steps || []
            const done = steps.filter(s => s.status === 'done').length
            const total = steps.length
            console.log(`[Polling] Plan update: ${done}/${total} steps completed`)
          }
          
          lastEventId = message.id
        }
      } catch (pollError) {
        console.error(`[Polling] Error polling messages for task ${taskId}:`, pollError)
      }
      
      attempt++
    }
    
    console.log(`[Polling] Max polling attempts reached for task ${taskId}`)
  } catch (error) {
    console.error(`[Polling] Background polling failed for task ${taskId}:`, error)
  }
}
