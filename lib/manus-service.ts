// lib/manus-service.ts
import pool from '@/lib/db';

// API URLs (will be set dynamically after getting key)
let MANUS_API_URL = 'https://api.manus.ai/v2';
let MANUS_API_KEY: string | null = null;
let cachedApiKeyHash: string | null = null;
let lastKeyCheck = 0;
const KEY_CACHE_TTL = 60000; // Re-check database every 60 seconds

// ---------------------------------------------------------------------------
// Content classification
// ---------------------------------------------------------------------------

/**
 * Response modes:
 *  - 'text'         → plain conversational answer, no file output
 *  - 'document'     → rich document deliverable (pdf / docx / pptx / md)
 *  - 'auto'         → let detectOutputNeed() decide (default)
 */
export type ResponseMode = 'text' | 'document' | 'auto';
export type DocumentFormat = 'pdf' | 'docx' | 'pptx' | 'md';

/**
 * Heuristics that indicate the user wants a file deliverable.
 * Keep the list conservative – false-positives (unnecessary PDFs) are worse
 * than false-negatives (a text reply when a doc would also have been fine).
 */
const DOCUMENT_TRIGGER_PATTERNS: RegExp[] = [
  // Explicit document keywords
  /\b(report|document|proposal|brief|write[\s-]up|whitepaper|white paper|memo|summary report)\b/i,
  // Presentation
  /\b(slide(?:s|deck)|presentation|pitch deck|powerpoint|pptx)\b/i,
  // Format-specific requests
  /\b(pdf|docx|\.pdf|\.docx|\.pptx|\.md)\b/i,
  // Action + structured output
  /\b(generate|create|produce|draft|write)\b.{0,40}\b(document|report|file|analysis|plan|guide|manual|tutorial|essay)\b/i,
  // Multi-section documents
  /\b(table of contents|executive summary|conclusion section|appendix)\b/i,
];

const TEXT_OVERRIDE_PATTERNS: RegExp[] = [
  // Conversational / lookup intents that should never produce a file
  /^(what|who|when|where|why|how|is|are|can|do|does|did|will|would|could|should)\b/i,
  /\b(explain|tell me|summarize|list|give me|show me|find|search|look up|check|compare)\b/i,
  /\b(translate|convert|calculate|compute|count|evaluate)\b/i,
  /\b(simple|quick|brief|short)\b.{0,20}\b(answer|response|reply|summary)\b/i,
];

/**
 * Automatically decide whether content should produce a document or plain text.
 * Returns 'document' only when the intent is clearly deliverable-oriented.
 */
function detectOutputNeed(content: string): 'text' | 'document' {
  const trimmed = content.trim();

  // Very short prompts are almost always conversational
  if (trimmed.length < 80) return 'text';

  // Explicit document triggers win unless overridden
  const wantsDoc = DOCUMENT_TRIGGER_PATTERNS.some(p => p.test(trimmed));
  if (!wantsDoc) return 'text';

  // Check for strong conversational override signals near the start
  const firstSentence = trimmed.split(/[.!?]/)[0];
  const isConversational = TEXT_OVERRIDE_PATTERNS.some(p => p.test(firstSentence));
  if (isConversational) return 'text';

  return 'document';
}

/**
 * Derive the most suitable document format from the prompt content.
 * Only called when outputNeed === 'document' and no explicit format was provided.
 */
function inferDocumentFormat(content: string): DocumentFormat {
  if (/\b(slide(?:s|deck)|presentation|pitch deck|powerpoint|pptx)\b/i.test(content)) return 'pptx';
  if (/\b(word|docx|\.docx)\b/i.test(content)) return 'docx';
  if (/\b(markdown|\.md)\b/i.test(content)) return 'md';
  return 'pdf'; // safest rich-document default
}

// ---------------------------------------------------------------------------
// Format instruction strings appended to prompts when a document IS needed
// ---------------------------------------------------------------------------

const FORMAT_INSTRUCTIONS: Record<DocumentFormat, string> = {
  pdf:  '\n\n[OUTPUT REQUIREMENT: Deliver the final result as a single PDF file (.pdf). Do not return plain text as the primary response; the PDF is the deliverable.]',
  docx: '\n\n[OUTPUT REQUIREMENT: Deliver the final result as a single Word document (.docx). Do not create PDF or other formats; the DOCX is the deliverable.]',
  pptx: '\n\n[OUTPUT REQUIREMENT: Deliver the final result as a single PowerPoint presentation (.pptx). Do not create PDF or other formats; the PPTX is the deliverable.]',
  md:   '\n\n[OUTPUT REQUIREMENT: Deliver the final result as a single Markdown file (.md). Do not create PDF or other formats.]',
};

// ---------------------------------------------------------------------------
// Database / key management (unchanged)
// ---------------------------------------------------------------------------

async function getManusApiKey(): Promise<string> {
  const now = Date.now();

  if (!MANUS_API_KEY || !cachedApiKeyHash || (now - lastKeyCheck) > KEY_CACHE_TTL) {
    try {
      const result = await pool.query(
        'SELECT api_key_hash FROM admin_settings WHERE id = 1 LIMIT 1'
      );

      const storedHash = result.rows[0]?.api_key_hash;

      if (!storedHash) {
        throw new Error('Manus API key not configured. Please set it in admin settings.');
      }

      if (storedHash.match(/^\$2[aby]\$\d+\$.+$/)) {
        throw new Error(
          'API key is stored as bcrypt hash, which cannot be decrypted. ' +
          'Please re-save the API key using reversible encryption.'
        );
      }

      MANUS_API_KEY = storedHash;
      cachedApiKeyHash = storedHash;
      lastKeyCheck = now;

      console.log('[Manus Service] API key loaded from database');
    } catch (error) {
      console.error('[Manus Service] Failed to load API key:', error);
      throw error;
    }
  }

  if (!MANUS_API_KEY) throw new Error('Manus API key not configured');
  return MANUS_API_KEY;
}

async function getApiUrl(): Promise<string> {
  return MANUS_API_URL;
}

export async function getApiKey(): Promise<string> {
  return getManusApiKey();
}

export async function refreshApiKey(): Promise<void> {
  cachedApiKeyHash = null;
  MANUS_API_KEY = null;
  lastKeyCheck = 0;
  await getManusApiKey();
}

// ---------------------------------------------------------------------------
// Interface definitions (unchanged)
// ---------------------------------------------------------------------------

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
  type:
    | 'user_message'
    | 'assistant_message'
    | 'error_message'
    | 'status_update'
    | 'tool_used'
    | 'plan_update'
    | 'new_plan_step'
    | 'explanation'
    | 'user_stop';
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

// ---------------------------------------------------------------------------
// Project / file helpers (unchanged)
// ---------------------------------------------------------------------------

export async function createProject(
  name: string,
  instruction?: string
): Promise<{ projectId: string; name: string }> {
  const apiKey = await getManusApiKey();
  const apiUrl = await getApiUrl();

  const response = await fetch(`${apiUrl}/project.create`, {
    method: 'POST',
    headers: { 'x-manus-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, instruction: instruction || '' }),
  });

  if (!response.ok) throw new Error(`Failed to create project: ${await response.text()}`);

  const data: CreateProjectResponse = await response.json();
  if (!data.ok) throw new Error('Failed to create project');

  return { projectId: data.project.id, name: data.project.name };
}

export async function uploadFile(
  filename: string,
  fileContent: Buffer | Blob
): Promise<{ fileId: string }> {
  const apiKey = await getManusApiKey();
  const apiUrl = await getApiUrl();

  const uploadRequestResponse = await fetch(`${apiUrl}/file.upload`, {
    method: 'POST',
    headers: { 'x-manus-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename }),
  });

  if (!uploadRequestResponse.ok)
    throw new Error(`Failed to get upload URL: ${await uploadRequestResponse.text()}`);

  const uploadData: FileUploadResponse = await uploadRequestResponse.json();
  if (!uploadData.ok) throw new Error('Failed to get upload URL');

  const fileBlob = fileContent instanceof Buffer ? new Blob([fileContent]) : fileContent;
  const uploadResponse = await fetch(uploadData.upload_url, {
    method: 'PUT',
    body: fileBlob,
    headers: { 'Content-Type': 'application/octet-stream' },
  });

  if (!uploadResponse.ok)
    throw new Error(`Failed to upload file: ${uploadResponse.statusText}`);

  return { fileId: uploadData.file.id };
}

// ---------------------------------------------------------------------------
// createTask — the main change
// ---------------------------------------------------------------------------

export async function createTask(options: {
  content: string;
  fileIds?: string[];
  manusProjectId?: string;
  interactiveMode?: boolean;
  agentProfile?: 'manus-1.6' | 'manus-1.6-lite' | 'manus-1.6-max';
  locale?: string;
  title?: string;
  shareVisibility?: 'private' | 'team' | 'public';
  hideInTaskList?: boolean;

  /**
   * Controls whether a document file is produced:
   *  - 'text'     → never produce a file; always reply in plain text
   *  - 'document' → always produce a file (format chosen by outputFormat or inferred)
   *  - 'auto'     → (default) heuristically decide based on the prompt content
   */
  responseMode?: ResponseMode;

  /**
   * Desired document format when a file IS produced.
   * Ignored when responseMode === 'text'.
   * When omitted and responseMode === 'document' or 'auto' (and auto decides document),
   * the format is inferred from the prompt.
   */
  outputFormat?: DocumentFormat;

  enableSkills?: string[];
  forceSkills?: string[];
  connectors?: string[];
}): Promise<{ taskId: string; taskTitle: string; taskUrl: string }> {
  const apiKey = await getManusApiKey();
  const apiUrl = await getApiUrl();

  // ── Decide whether to request a file output ────────────────────────────
  const mode = options.responseMode ?? 'auto';

  let finalContent = options.content;

  if (mode !== 'text') {
    const outputNeed =
      mode === 'document' ? 'document' : detectOutputNeed(options.content);

    if (outputNeed === 'document') {
      const format = options.outputFormat ?? inferDocumentFormat(options.content);
      finalContent = options.content + FORMAT_INSTRUCTIONS[format];

      console.log(`[Manus] Requesting document output — format: ${format}, mode: ${mode}`);
    } else {
      console.log(`[Manus] Text response selected — no file output requested (mode: ${mode})`);
    }
  } else {
    console.log('[Manus] responseMode=text — skipping document format instructions');
  }
  // ──────────────────────────────────────────────────────────────────────

  const messageContent: any[] = [{ type: 'text', text: finalContent }];

  if (options.fileIds?.length) {
    for (const fileId of options.fileIds) {
      messageContent.push({ type: 'file', file_id: fileId });
    }
  }

  const messageObj: any = { content: messageContent };

  if (options.connectors?.length)   messageObj.connectors     = options.connectors;
  if (options.enableSkills?.length) messageObj.enable_skills  = options.enableSkills;
  if (options.forceSkills?.length)  messageObj.force_skills   = options.forceSkills;
   const result = await pool.query(
        'SELECT manus_project_id FROM admin_settings WHERE id = 1 LIMIT 1'
      );
const projectId = result.rows.length>0 ? result.rows[0]?.manus_project_id : null;
  const requestBody: any = {
    message: messageObj,
    interactive_mode:  options.interactiveMode  ?? true,
    agent_profile:     options.agentProfile     ?? 'manus-1.6',
    locale:            options.locale           ?? 'en',
    share_visibility:  options.shareVisibility  ?? 'private',
    hide_in_task_list: options.hideInTaskList   ?? false,
    project_id:        projectId   ?? null,
  };
console.log(`[Manus] Using project ID for new task: ${projectId}`);
  if (options.title) requestBody.title = options.title;

  if (options.enableSkills?.length || options.forceSkills?.length) {
    console.log('[Manus] Creating task with skills:', {
      enableSkills: options.enableSkills,
      forceSkills:  options.forceSkills,
      connectors:   options.connectors,
    });
  }

  const response = await fetch(`${apiUrl}/task.create`, {
    method: 'POST',
    headers: { 'x-manus-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Manus] Create task error:', errorText);
    throw new Error(`Failed to create task: ${errorText}`);
  }

  const data: CreateTaskResponse = await response.json();
  if (!data.ok) throw new Error('Failed to create task');

  return {
    taskId:    data.task_id,
    taskTitle: data.task_title,
    taskUrl:   data.task_url,
  };
}

// ---------------------------------------------------------------------------
// getTaskDetail (unchanged)
// ---------------------------------------------------------------------------

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

  if (!response.ok) throw new Error(`Failed to get task detail: ${await response.text()}`);

  const data: TaskDetailResponse = await response.json();
  if (!data.ok) throw new Error('Failed to get task detail');

  return {
    status:      data.task.status,
    title:       data.task.title,
    createdAt:   data.task.created_at,
    updatedAt:   data.task.updated_at,
    taskUrl:     data.task.task_url,
    creditUsage: data.task.credit_usage,
  };
}

// ---------------------------------------------------------------------------
// getTaskMessages (unchanged)
// ---------------------------------------------------------------------------

export async function getTaskMessages(
  taskId: string,
  options?: { limit?: number; cursor?: string; order?: 'desc' | 'asc'; verbose?: boolean,slides_format?:'pptx' }
): Promise<{
  messages: MessageEvent[];
  hasMore: boolean;
  nextCursor?: string;
}> {
  const apiKey = await getManusApiKey();
  const apiUrl = await getApiUrl();
console.log(`[Manus] Fetching messages for task ${taskId} with options:`, options);
  const params = new URLSearchParams({
    task_id: taskId,
    order:   options?.order   || 'desc',
    limit:   String(options?.limit  || 50),
    verbose: String(options?.verbose ?? true),
    slides_format:'pptx'
  });

  if (options?.cursor) params.append('cursor', options.cursor);

  console.log(`[Manus] Fetching messages for task ${taskId}`);

  const response = await fetch(`${apiUrl}/task.listMessages?${params.toString()}`, {
    headers: { 'x-manus-api-key': apiKey },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Manus] Failed to get messages:', errorText);
    throw new Error(`Failed to get messages: ${errorText}`);
  }

  const data = await response.json();
  console.log(`[Manus] Received ${data.messages?.length || 0} messages`);

  if (!data.ok) {
    console.error('[Manus] API returned not ok:', data);
    throw new Error('Failed to get messages');
  }

  return {
    messages:   data.messages || [],
    hasMore:    data.has_more  || false,
    nextCursor: data.next_cursor,
  };
}

// ---------------------------------------------------------------------------
// listTasks (unchanged)
// ---------------------------------------------------------------------------

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
    limit:  String(options?.limit  || 50),
    offset: String(options?.offset || 0),
    order:  options?.order         || 'desc',
  });

  if (options?.status) params.append('status', options.status);

  const response = await fetch(`${apiUrl}/task.list?${params.toString()}`, {
    headers: { 'x-manus-api-key': apiKey },
  });

  if (!response.ok) throw new Error(`Failed to list tasks: ${await response.text()}`);

  const data = await response.json();
  if (!data.ok) throw new Error('Failed to list tasks');

  return {
    tasks:  data.tasks  || [],
    total:  data.total  || 0,
    limit:  data.limit  || options?.limit  || 50,
    offset: data.offset || options?.offset || 0,
  };
}

// ---------------------------------------------------------------------------
// sendMessageToTask (unchanged)
// ---------------------------------------------------------------------------

export async function sendMessageToTask(
  taskId: string,
  content: string,
  fileIds?: string[],
  options?: {
    enableSkills?: string[];
    forceSkills?: string[];
    connectors?: string[];
    agentProfile?: string;
    structuredOutputSchema?: Record<string, any>;
  }
): Promise<void> {
  const apiKey = await getManusApiKey();
  const apiUrl = await getApiUrl();

  const messageContent: any[] = [{ type: 'text', text: content }];
console.log(`[Manus] Sending message to task ${taskId}:`, { content, fileIds, options });
  if (fileIds?.length) {
    for (const fileId of fileIds) {
      messageContent.push({ type: 'file', file_id: fileId });
    }
  }

  const messageObj: any = { content: messageContent };

  if (options?.connectors?.length)   messageObj.connectors    = options.connectors;
  if (options?.enableSkills?.length) messageObj.enable_skills = options.enableSkills;
  if (options?.forceSkills?.length)  messageObj.force_skills  = options.forceSkills;

  const requestBody: any = { task_id: taskId, message: messageObj };

  if (options?.agentProfile)            requestBody.agent_profile          = options.agentProfile;
  if (options?.structuredOutputSchema)  requestBody.structured_output_schema = options.structuredOutputSchema;

  const response = await fetch(`${apiUrl}/task.sendMessage`, {
    method: 'POST',
    headers: { 'x-manus-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) throw new Error(`Failed to send message: ${await response.text()}`);

  const data = await response.json();
  if (!data.ok) throw new Error('Failed to send message');
}

// ---------------------------------------------------------------------------
// pollTaskAndSaveToDatabase (unchanged logic, minor cleanup)
// ---------------------------------------------------------------------------

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
  const maxAttempts = 120; // 4 minutes at 2 s interval
  const pollInterval = 2000;

  try {
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));

      const { messages } = await getTaskMessages(taskId, {
        order: 'asc',
        verbose: true,
        limit: 50,
      });

      for (const message of messages) {
        if (message.id === lastEventId) continue;

        const client = await poolModule.connect();

        try {
          if (message.status_update) {
            const status = message.status_update;
            const displayText =
              status.description || status.brief || `Status: ${status.agent_status}`;

            await client.query(
              `UPDATE messages
               SET content = $1, status_type = $2, agent_status = $3,
                   status_brief = $4, status_description = $5, updated_at = NOW()
               WHERE id = $6`,
              [displayText, 'processing', status.agent_status, status.brief, status.description, messageId]
            );

            onStatusUpdate?.({
              type: 'status_update',
              content: displayText,
              agentStatus: status.agent_status,
              brief: status.brief,
              description: status.description,
            });
          } else if (message.tool_used) {
            const tool = message.tool_used;
            const emoji: Record<string, string> = {
              browser: '🌐', code_executor: '💻', file_reader: '📄',
              python_executor: '🐍', bash_executor: '⚙️',
            };
            const displayText = tool.description || tool.brief || `Using ${tool.tool}...`;

            await client.query(
              `UPDATE messages
               SET content = $1, tool_name = $2, tool_brief = $3, tool_description = $4,
                   tool_status = $5, updated_at = NOW()
               WHERE id = $6`,
              [`${emoji[tool.tool] ?? '🔧'} ${displayText}`, tool.tool, tool.brief, tool.description, tool.status, messageId]
            );

            onStatusUpdate?.({ type: 'tool_used', tool: tool.tool, content: displayText, status: tool.status });
          } else if (message.explanation) {
            const shortContent =
              message.explanation.content.length > 150
                ? message.explanation.content.substring(0, 150) + '...'
                : message.explanation.content;

            await client.query(
              `UPDATE messages SET content = $1, explanation_content = $2, updated_at = NOW() WHERE id = $3`,
              [`💭 ${shortContent}`, message.explanation.content, messageId]
            );

            onStatusUpdate?.({ type: 'explanation', content: message.explanation.content });
          } else if (message.plan_update) {
            const steps = message.plan_update.steps || [];
            const done   = steps.filter(s => s.status === 'done').length;
            const doing  = steps.filter(s => s.status === 'doing').length;
            const todo   = steps.filter(s => s.status === 'todo').length;

            await client.query(
              `UPDATE messages SET content = $1, updated_at = NOW() WHERE id = $2`,
              [`📋 Plan: ${done} done, ${doing} in progress, ${todo} remaining`, messageId]
            );

            onStatusUpdate?.({ type: 'plan_update', done, doing, todo, steps });
          } else if (message.assistant_message) {
            finalContent = message.assistant_message.content;

            await client.query(
              `UPDATE messages
               SET content = $1, status_type = 'completed', agent_status = 'stopped', updated_at = NOW()
               WHERE id = $2`,
              [finalContent, messageId]
            );

            onStatusUpdate?.({ type: 'assistant_message', content: finalContent });
          } else if (message.error_message) {
            const errorContent = `❌ Error: ${message.error_message.content}`;

            await client.query(
              `UPDATE messages
               SET content = $1, status_type = 'failed', error_message = $2, updated_at = NOW()
               WHERE id = $3`,
              [errorContent, message.error_message.content, messageId]
            );

            onStatusUpdate?.({
              type: 'error_message',
              content: errorContent,
              errorType: message.error_message.error_type,
            });

            client.release();
            return { success: false, finalContent: errorContent, error: message.error_message.content };
          }
        } finally {
          client.release();
        }

        lastEventId = message.id;
      }

      // Check overall task status
      const taskDetail = await getTaskDetail(taskId);

      if (taskDetail.status === 'stopped') {
        if (!finalContent) {
          const { messages: finalMsgs } = await getTaskMessages(taskId, { order: 'desc', limit: 1 });
          const lastAssistant = finalMsgs.find(m => m.assistant_message);

          if (lastAssistant?.assistant_message) {
            finalContent = lastAssistant.assistant_message.content;

            const client = await poolModule.connect();
            await client.query(
              `UPDATE messages
               SET content = $1, status_type = 'completed', agent_status = 'stopped', updated_at = NOW()
               WHERE id = $2`,
              [finalContent, messageId]
            );
            client.release();
          }
        }

        const client = await poolModule.connect();
        await client.query(
          `UPDATE chats SET is_processing = false, updated_at = NOW() WHERE id = $1`,
          [chatId]
        );
        client.release();

        onStatusUpdate?.({ type: 'task_completed', content: finalContent });
        return { success: true, finalContent };
      }

      if (taskDetail.status === 'error') {
        const errorMsg = 'Task encountered an error';

        const client = await poolModule.connect();
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

    const client = await poolModule.connect();
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

    const client = await poolModule.connect();
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

    onStatusUpdate?.({ type: 'error', content: errorMsg });
    return { success: false, finalContent: errorMsg, error: errorMsg };
  }
}