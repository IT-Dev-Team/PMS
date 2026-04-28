// lib/manus-service.ts
import pool from '@/lib/db';
import bcrypt from 'bcryptjs';

// API URLs (will be set dynamically after getting key)
let MANUS_API_URL = 'https://api.manus.ai/v2';
let MANUS_API_KEY: string | null = null;
let cachedApiKeyHash: string | null = null;
let lastKeyCheck = 0;
const KEY_CACHE_TTL = 60000; // Re-check database every 60 seconds

// Helper to get decrypted API key from database
async function getManusApiKey(): Promise<string> {
  const now = Date.now();
  
  // Check if we need to refresh the cached key
  if (!MANUS_API_KEY || !cachedApiKeyHash || (now - lastKeyCheck) > KEY_CACHE_TTL) {
    try {
      const result = await pool.query(
        'SELECT api_key_hash FROM admin_settings WHERE id = 1 LIMIT 1'
      );
      
      const storedHash = result.rows[0]?.api_key_hash;
      
      if (!storedHash) {
        throw new Error('Manus API key not configured. Please set it in admin settings.');
      }
      
      // We cannot "unhash" bcrypt - it's one-way. 
      // The API key should be stored as plain text but encrypted at rest,
      // or we need to store it as plain text in the database.
      // For security, we should use environment variable or proper encryption.
      // This implementation assumes the API key is stored as plain text.
      // If it's hashed with bcrypt, you cannot retrieve the original key.
      // Alternative: Store encrypted with AES-256 instead of bcrypt.
      
      // Check if it looks like a bcrypt hash (starts with $2a$, $2b$, etc.)
      if (storedHash.match(/^\$2[aby]\$\d+\$.+$/)) {
        // This is a bcrypt hash - we cannot unhash it!
        // You need to store the API key in an encrypted format that is reversible.
        throw new Error('API key is stored as bcrypt hash, which cannot be decrypted. Please re-save the API key using encryption.');
      }
      
      // Store the plain text key (but this is not secure for production)
      MANUS_API_KEY = storedHash;
      cachedApiKeyHash = storedHash;
      lastKeyCheck = now;
      
      console.log('[Manus Service] API key loaded from database');
    } catch (error) {
      console.error('[Manus Service] Failed to load API key:', error);
      throw error;
    }
  }
  
  if (!MANUS_API_KEY) {
    throw new Error('Manus API key not configured');
  }
  
  return MANUS_API_KEY;
}

// Helper to update the API_URL if it varies
async function getApiUrl(): Promise<string> {
  // Can be customized based on settings
  return MANUS_API_URL;
}

// Get current API key (for use in other functions)
export async function getApiKey(): Promise<string> {
  return getManusApiKey();
}

// Refresh API key cache
export async function refreshApiKey(): Promise<void> {
  cachedApiKeyHash = null;
  MANUS_API_KEY = null;
  lastKeyCheck = 0;
  await getManusApiKey();
}

// Interface definitions
interface FileUploadResponse {
  ok: boolean;
  request_id: string;
  file: {
    id: string;
    filename: string;
    status: 'pending' | 'uploaded' | 'deleted' | 'error';
    created_at: number;
  };
  upload_url: string;
  upload_expires_at: number;
}

interface CreateTaskResponse {
  ok: boolean;
  request_id: string;
  task_id: string;
  task_title: string;
  task_url: string;
  share_url?: string;
  share_visibility: 'private' | 'team' | 'public';
}

interface TaskDetailResponse {
  ok: boolean;
  request_id: string;
  task: {
    id: string;
    status: 'running' | 'stopped' | 'waiting' | 'error';
    created_at: number;
    updated_at: number;
    task_type: 'standard' | 'project' | 'agent_subtask';
    share_visibility: 'private' | 'team' | 'public';
    title: string;
    credit_usage?: number;
    task_url: string;
  };
}

interface CreateProjectResponse {
  ok: boolean;
  request_id: string;
  project: {
    id: string;
    name: string;
    instruction: string;
    created_at: number;
    updated_at: number;
  };
}

export interface MessageEvent {
  id: string;
  type: 'user_message' | 'assistant_message' | 'error_message' | 'status_update' | 'tool_used' | 'plan_update' | 'new_plan_step' | 'explanation' | 'user_stop';
  timestamp: number;
  status_update?: {
    agent_status: 'running' | 'stopped' | 'waiting' | 'error';
    brief: string;
    description: string;
    status_detail?: {
      waiting_for_event_id: string;
      waiting_for_event_type: string;
      waiting_description: string;
      confirm_input_schema?: any;
    };
  };
  tool_used?: {
    tool: string;
    action_id: string;
    status: 'success' | 'error' | 'rollback';
    brief: string;
    description: string;
    message: {
      action: string;
      param: string;
    };
  };
  explanation?: {
    content: string;
  };
  plan_update?: {
    steps: Array<{
      status: 'todo' | 'doing' | 'done' | 'failed';
      title: string;
      started_at?: number;
      end_at?: number;
    }>;
  };
  new_plan_step?: {
    step_id: string;
    title: string;
  };
  assistant_message?: {
    content: string;
    attachments?: Array<{
      type: string;
      filename: string;
      url: string;
      content_type: string;
    }>;
  };
  user_message?: {
    content: string;
    message_type: 'text' | 'voice';
    attachments?: any[];
  };
  error_message?: {
    error_type: string;
    content: string;
  };
}

// Create a project
export async function createProject(name: string, instruction?: string): Promise<{ projectId: string; name: string }> {
  const apiKey = await getManusApiKey();
  const apiUrl = await getApiUrl();
  
  const response = await fetch(`${apiUrl}/project.create`, {
    method: 'POST',
    headers: {
      'x-manus-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      instruction: instruction || '',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create project: ${error}`);
  }

  const data: CreateProjectResponse = await response.json();
  
  if (!data.ok) {
    throw new Error('Failed to create project');
  }

  return {
    projectId: data.project.id,
    name: data.project.name,
  };
}

// Upload a file to Manus
export async function uploadFile(filename: string, fileContent: Buffer | Blob): Promise<{ fileId: string }> {
  const apiKey = await getManusApiKey();
  const apiUrl = await getApiUrl();
  
  // Step 1: Request presigned URL
  const uploadRequestResponse = await fetch(`${apiUrl}/file.upload`, {
    method: 'POST',
    headers: {
      'x-manus-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ filename }),
  });

  if (!uploadRequestResponse.ok) {
    throw new Error(`Failed to get upload URL: ${await uploadRequestResponse.text()}`);
  }

  const uploadData: FileUploadResponse = await uploadRequestResponse.json();
  
  if (!uploadData.ok) {
    throw new Error('Failed to get upload URL');
  }

  // Step 2: Upload file to presigned URL
  const fileBlob = fileContent instanceof Buffer ? new Blob([fileContent]) : fileContent;
  const uploadResponse = await fetch(uploadData.upload_url, {
    method: 'PUT',
    body: fileBlob,
    headers: {
      'Content-Type': 'application/octet-stream',
    },
  });

  if (!uploadResponse.ok) {
    throw new Error(`Failed to upload file: ${uploadResponse.statusText}`);
  }

  return { fileId: uploadData.file.id };
}

// Create a task
export async function createTask(options: {
  content: string;
  fileIds?: string[];
  interactiveMode?: boolean;
  agentProfile?: 'manus-1.6' | 'manus-1.6-lite' | 'manus-1.6-max';
  locale?: string;
  title?: string;
  shareVisibility?: 'private' | 'team' | 'public';
  hideInTaskList?: boolean;
}): Promise<{ taskId: string; taskTitle: string; taskUrl: string }> {
  const apiKey = await getManusApiKey();
  const apiUrl = await getApiUrl();
  
  const messageContent: any[] = [{ type: 'text', text: options.content }];

  if (options.fileIds && options.fileIds.length > 0) {
    for (const fileId of options.fileIds) {
      messageContent.push({ type: 'file', file_id: fileId });
    }
  }

  const requestBody: any = {
    message: { content: messageContent },
    interactive_mode: options.interactiveMode ?? true,
    agent_profile: options.agentProfile ?? 'manus-1.6',
    locale: options.locale ?? 'en',
    share_visibility: options.shareVisibility ?? 'private',
    hide_in_task_list: options.hideInTaskList ?? false,
  };

  if (options.title) requestBody.title = options.title;

  const response = await fetch(`${apiUrl}/task.create`, {
    method: 'POST',
    headers: {
      'x-manus-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`Failed to create task: ${await response.text()}`);
  }

  const data: CreateTaskResponse = await response.json();
  
  if (!data.ok) {
    throw new Error('Failed to create task');
  }

  return {
    taskId: data.task_id,
    taskTitle: data.task_title,
    taskUrl: data.task_url,
  };
}

// Get task detail
export async function getTaskDetail(taskId: string): Promise<{
  status: 'running' | 'stopped' | 'waiting' | 'error';
  title: string;
  createdAt: number;
  updatedAt: number;
  taskUrl: string;
  creditUsage?: number;
}> {
  const apiKey = await getManusApiKey();
  const apiUrl = await getApiUrl();
  
  const response = await fetch(`${apiUrl}/task.detail?task_id=${taskId}`, {
    headers: { 'x-manus-api-key': apiKey },
  });

  if (!response.ok) {
    throw new Error(`Failed to get task detail: ${await response.text()}`);
  }

  const data: TaskDetailResponse = await response.json();
  
  if (!data.ok) {
    throw new Error('Failed to get task detail');
  }

  return {
    status: data.task.status,
    title: data.task.title,
    createdAt: data.task.created_at,
    updatedAt: data.task.updated_at,
    taskUrl: data.task.task_url,
    creditUsage: data.task.credit_usage,
  };
}

// Get task messages with all event types
export async function getTaskMessages(
  taskId: string, 
  options?: { limit?: number; cursor?: string; order?: 'asc' | 'desc'; verbose?: boolean }
): Promise<{
  messages: MessageEvent[];
  hasMore: boolean;
  nextCursor?: string;
}> {
  const apiKey = await getManusApiKey();
  const apiUrl = await getApiUrl();
  
  const params = new URLSearchParams({
    task_id: taskId,
    order: options?.order || 'asc',
    limit: String(options?.limit || 50),
    verbose: String(options?.verbose ?? true),
  });
  
  if (options?.cursor) params.append('cursor', options.cursor);

  const response = await fetch(`${apiUrl}/task.listMessages?${params.toString()}`, {
    headers: { 'x-manus-api-key': apiKey },
  });

  if (!response.ok) {
    throw new Error(`Failed to get messages: ${await response.text()}`);
  }

  const data = await response.json();
  
  if (!data.ok) {
    throw new Error('Failed to get messages');
  }

  return {
    messages: data.messages,
    hasMore: data.has_more,
    nextCursor: data.next_cursor,
  };
}

// List all tasks
export async function listTasks(options?: {
  limit?: number;
  offset?: number;
  status?: string;
  order?: 'asc' | 'desc';
}): Promise<{
  tasks: any[];
  total: number;
  limit: number;
  offset: number;
}> {
  const apiKey = await getManusApiKey();
  const apiUrl = await getApiUrl();
  
  const params = new URLSearchParams({
    limit: String(options?.limit || 50),
    offset: String(options?.offset || 0),
    order: options?.order || 'desc',
  });

  if (options?.status) {
    params.append('status', options.status);
  }

  const response = await fetch(`${apiUrl}/task.list?${params.toString()}`, {
    headers: { 'x-manus-api-key': apiKey },
  });

  if (!response.ok) {
    throw new Error(`Failed to list tasks: ${await response.text()}`);
  }

  const data = await response.json();

  if (!data.ok) {
    throw new Error('Failed to list tasks');
  }

  return {
    tasks: data.tasks || [],
    total: data.total || 0,
    limit: data.limit || options?.limit || 50,
    offset: data.offset || options?.offset || 0,
  };
}

// Send a message to existing task (for interactive mode)
export async function sendMessageToTask(taskId: string, content: string, fileIds?: string[]): Promise<void> {
  const apiKey = await getManusApiKey();
  const apiUrl = await getApiUrl();
  
  const messageContent: any[] = [{ type: 'text', text: content }];
  
  if (fileIds && fileIds.length > 0) {
    for (const fileId of fileIds) {
      messageContent.push({ type: 'file', file_id: fileId });
    }
  }

  const response = await fetch(`${apiUrl}/task.sendMessage`, {
    method: 'POST',
    headers: {
      'x-manus-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      task_id: taskId,
      message: { content: messageContent },
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to send message: ${await response.text()}`);
  }

  const data = await response.json();
  
  if (!data.ok) {
    throw new Error('Failed to send message');
  }
}

// Confirm an action when task is waiting
export async function confirmAction(taskId: string, eventId: string, input?: any): Promise<void> {
  const apiKey = await getManusApiKey();
  const apiUrl = await getApiUrl();
  
  const response = await fetch(`${apiUrl}/task.confirmAction`, {
    method: 'POST',
    headers: {
      'x-manus-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      task_id: taskId,
      event_id: eventId,
      input: input,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to confirm action: ${await response.text()}`);
  }

  const data = await response.json();
  
  if (!data.ok) {
    throw new Error('Failed to confirm action');
  }
}

/**
 * Polls Manus task status and streams updates to database
 * Continues polling until task is completed, failed, or times out
 */
export async function pollTaskAndSaveToDatabase(
  taskId: string,
  chatId: string,
  messageId: string,
  onStatusUpdate?: (update: any) => void
): Promise<{ success: boolean; finalContent: string; error?: string }> {
  const poolModule = await import('@/lib/db').then(m => m.default);
  let lastEventId = '';
  let finalContent = '';
  let attempts = 0;
  const maxAttempts = 120; // 4 minutes with 2 second interval
  const pollInterval = 2000; // 2 seconds

  try {
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      
      const { messages } = await getTaskMessages(taskId, { 
        order: 'asc', 
        verbose: true,
        limit: 50 
      });

      let client;
      
      for (const message of messages) {
        if (message.id === lastEventId) continue;

        client = await poolModule.connect();

        try {
          // Handle different message types
          if (message.status_update) {
            const status = message.status_update;
            const displayText = status.description || status.brief || `Status: ${status.agent_status}`;
            
            await client.query(
              `UPDATE messages 
               SET content = $1, status_type = $2, agent_status = $3, 
                   status_brief = $4, status_description = $5, updated_at = NOW()
               WHERE id = $6`,
              [displayText, 'processing', status.agent_status, status.brief, status.description, messageId]
            );

            if (onStatusUpdate) {
              onStatusUpdate({
                type: 'status_update',
                content: displayText,
                agentStatus: status.agent_status,
                brief: status.brief,
                description: status.description,
              });
            }
          }
          
          // Tool usage
          else if (message.tool_used) {
            const tool = message.tool_used;
            const displayText = tool.description || tool.brief || `Using ${tool.tool}...`;
            const emoji = { 
              browser: '🌐', 
              code_executor: '💻', 
              file_reader: '📄',
              python_executor: '🐍',
              bash_executor: '⚙️'
            }[tool.tool] || '🔧';
            
            await client.query(
              `UPDATE messages 
               SET content = $1, tool_name = $2, tool_brief = $3, tool_description = $4, 
                   tool_status = $5, updated_at = NOW()
               WHERE id = $6`,
              [`${emoji} ${displayText}`, tool.tool, tool.brief, tool.description, tool.status, messageId]
            );

            if (onStatusUpdate) {
              onStatusUpdate({
                type: 'tool_used',
                tool: tool.tool,
                content: displayText,
                status: tool.status,
              });
            }
          }
          
          // Explanation/thinking
          else if (message.explanation) {
            const shortContent = message.explanation.content.length > 150 
              ? message.explanation.content.substring(0, 150) + '...' 
              : message.explanation.content;
            
            await client.query(
              `UPDATE messages 
               SET content = $1, explanation_content = $2, updated_at = NOW()
               WHERE id = $3`,
              [`💭 ${shortContent}`, message.explanation.content, messageId]
            );

            if (onStatusUpdate) {
              onStatusUpdate({
                type: 'explanation',
                content: message.explanation.content,
              });
            }
          }
          
          // Plan updates
          else if (message.plan_update) {
            const steps = message.plan_update.steps || [];
            const done = steps.filter(s => s.status === 'done').length;
            const doing = steps.filter(s => s.status === 'doing').length;
            const todo = steps.filter(s => s.status === 'todo').length;
            
            await client.query(
              `UPDATE messages 
               SET content = $1, updated_at = NOW()
               WHERE id = $2`,
              [`📋 Plan: ${done} done, ${doing} in progress, ${todo} remaining`, messageId]
            );

            if (onStatusUpdate) {
              onStatusUpdate({
                type: 'plan_update',
                done,
                doing,
                todo,
                steps,
              });
            }
          }
          
          // Final response from assistant
          else if (message.assistant_message) {
            finalContent = message.assistant_message.content;
            
            await client.query(
              `UPDATE messages 
               SET content = $1, status_type = 'completed', agent_status = 'stopped', updated_at = NOW()
               WHERE id = $2`,
              [finalContent, messageId]
            );

            if (onStatusUpdate) {
              onStatusUpdate({
                type: 'assistant_message',
                content: finalContent,
              });
            }
          }
          
          // Error handling
          else if (message.error_message) {
            const errorContent = `❌ Error: ${message.error_message.content}`;
            
            await client.query(
              `UPDATE messages 
               SET content = $1, status_type = 'failed', error_message = $2, updated_at = NOW()
               WHERE id = $3`,
              [errorContent, message.error_message.content, messageId]
            );

            if (onStatusUpdate) {
              onStatusUpdate({
                type: 'error_message',
                content: errorContent,
                errorType: message.error_message.error_type,
              });
            }

            client.release();
            return { 
              success: false, 
              finalContent: errorContent,
              error: message.error_message.content 
            };
          }

        } finally {
          if (client) client.release();
        }
        
        lastEventId = message.id;
      }

      // Check task status
      const taskDetail = await getTaskDetail(taskId);
      
      if (taskDetail.status === 'stopped') {
        // Task completed
        if (!finalContent) {
          const { messages: finalMsgs } = await getTaskMessages(taskId, { 
            order: 'desc', 
            limit: 1 
          });
          
          const lastAssistant = finalMsgs.find(m => m.assistant_message);
          if (lastAssistant?.assistant_message) {
            finalContent = lastAssistant.assistant_message.content;
            
            client = await poolModule.connect();
            await client.query(
              `UPDATE messages 
               SET content = $1, status_type = 'completed', agent_status = 'stopped', updated_at = NOW()
               WHERE id = $2`,
              [finalContent, messageId]
            );
            client.release();
          }
        }

        // Mark chat as not processing
        client = await poolModule.connect();
        await client.query(
          `UPDATE chats SET is_processing = false, updated_at = NOW() WHERE id = $1`,
          [chatId]
        );
        client.release();

        if (onStatusUpdate) {
          onStatusUpdate({
            type: 'task_completed',
            content: finalContent,
          });
        }

        return { success: true, finalContent };
      }
      
      if (taskDetail.status === 'error') {
        const errorMsg = 'Task encountered an error';
        
        client = await poolModule.connect();
        await client.query(
          `UPDATE messages 
           SET content = $1, status_type = 'failed', error_message = $2, updated_at = NOW()
           WHERE id = $3`,
          [errorMsg, 'Task error', messageId]
        );
        await client.query(
          `UPDATE chats SET is_processing = false, updated_at = NOW() WHERE id = $1`,
          [chatId]
        );
        client.release();

        return { success: false, finalContent: errorMsg, error: 'Task error' };
      }
      
      attempts++;
    }

    // Timeout
    const timeoutMsg = 'Task processing timed out (exceeded 4 minutes)';
    
    let client = await poolModule.connect();
    await client.query(
      `UPDATE messages 
       SET content = $1, status_type = 'failed', error_message = $2, updated_at = NOW()
       WHERE id = $3`,
      [timeoutMsg, 'Timeout', messageId]
    );
    await client.query(
      `UPDATE chats SET is_processing = false, updated_at = NOW() WHERE id = $1`,
      [chatId]
    );
    client.release();

    return { success: false, finalContent: timeoutMsg, error: 'Timeout' };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
    
    let client = await poolModule.connect();
    await client.query(
      `UPDATE messages 
       SET content = $1, status_type = 'failed', error_message = $2, updated_at = NOW()
       WHERE id = $3`,
      [`❌ ${errorMsg}`, errorMsg, messageId]
    );
    await client.query(
      `UPDATE chats SET is_processing = false, updated_at = NOW() WHERE id = $1`,
      [chatId]
    );
    client.release();

    if (onStatusUpdate) {
      onStatusUpdate({
        type: 'error',
        content: errorMsg,
      });
    }

    return { 
      success: false, 
      finalContent: errorMsg,
      error: errorMsg 
    };
  }
}