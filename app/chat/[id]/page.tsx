'use client'

import { useState, useEffect, useCallback, useRef, memo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Loader2, Send, Paperclip, FileText, AlertCircle, X, Mic, MicOff,
  CheckCircle, AlertTriangle, ArrowLeft, Download, ExternalLink,
  FileSpreadsheet, Presentation, BarChart2, FileSearch, MessageSquare,
  Sparkles, Zap, Copy, ChevronDown, ChevronUp, Clock,
} from 'lucide-react'
import { toast } from 'sonner'
import { downloadAttachment, convertManusToPptx, type ExportFormat } from '@/lib/download-converter'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SlideFile {
  id: string;
  path: string;
  changed: boolean;
  content: string;
  note: string;
  width: number;
  height: number;
}

export interface SlideOutlineItem {
  id: string;
  title: string;
  summary: string;
}

export interface ManusApiResponse {
  directory: string;
  slide_ids: string[];
  files: SlideFile[];
  outline: SlideOutlineItem[];
  isImageSlides: boolean;
  title: string;
  images: {
    quote_slide?: string;
    [key: string]: string | undefined;
  };
}

interface Attachment { 
  filename: string; 
  url: string; 
  content_type: string; 
  type: string;
  apiResponse?: ManusApiResponse;
}

interface LocalAttachment { 
  id: string; 
  name: string; 
  type: string; 
  size: number; 
  content: string 
}

interface Message {
  id: string; 
  content: string; 
  role: 'user' | 'assistant'; 
  created_at: string
  attachments?: Attachment[]; 
  localAttachments?: LocalAttachment[]
  statusType?: 'running' | 'completed' | 'failed'; 
  manus_task_id?: string; 
  message_type?: string
}

const TERMINAL = new Set(['stopped', 'completed', 'failed', 'error', 'waiting'])

const stripPdfNotice = (content: string): string => {
  const marker = '\n\nIMPORTANT: When generating any file output'
  const idx = content.indexOf(marker)
  return idx !== -1 ? content.slice(0, idx).trimEnd() : content
}

const USE_CASES = [
  { icon: Presentation,  label: 'Prepare slide',     prompt: 'Create a professional presentation about ' },
  { icon: FileSearch,    label: 'Analyze document',   prompt: 'Analyze this document and give key insights: ' },
  { icon: FileText,      label: 'Summarize',          prompt: 'Summarize the following: ' },
  { icon: BarChart2,     label: 'Data analysis',      prompt: 'Perform data analysis on: ' },
  { icon: Sparkles,      label: 'Generate report',    prompt: 'Generate a detailed report about: ' },
]

// ─── Markdown renderer ────────────────────────────────────────────────────────

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n')
  const output: React.ReactNode[] = []
  let listItems: React.ReactNode[] = []

  const flushList = () => {
    if (listItems.length) {
      output.push(<ul key={`ul-${output.length}`} className="my-2 space-y-1 list-none pl-0">{listItems}</ul>)
      listItems = []
    }
  }

  const inline = (s: string, key: string): React.ReactNode => {
    const parts: React.ReactNode[] = []
    let i = 0, last = 0
    const rx = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[(.+?)\]\((.+?)\))/g
    let m: RegExpExecArray | null
    while ((m = rx.exec(s)) !== null) {
      if (m.index > last) parts.push(s.slice(last, m.index))
      if (m[2]) parts.push(<strong key={`b${i++}`} className="font-semibold">{m[2]}</strong>)
      else if (m[3]) parts.push(<em key={`e${i++}`} className="italic">{m[3]}</em>)
      else if (m[4]) parts.push(<code key={`c${i++}`} className="bg-secondary/60 text-violet-600 dark:text-violet-300 px-1 py-0.5 rounded text-[0.85em] font-mono">{m[4]}</code>)
      else if (m[5]) parts.push(<a key={`a${i++}`} href={m[6]} target="_blank" rel="noopener noreferrer" className="text-violet-600 dark:text-violet-300 underline underline-offset-2 hover:no-underline">{m[5]}</a>)
      last = m.index + m[0].length
    }
    if (last < s.length) parts.push(s.slice(last))
    return <>{parts}</>
  }

  lines.forEach((line, idx) => {
    const k = `line-${idx}`
    const hm = line.match(/^(#{1,4})\s+(.+)/)
    if (hm) {
      flushList()
      const lvl = hm[1].length
      const cls = [
        'text-xl font-bold text-foreground mt-5 mb-2 pb-1 border-b border-border/50',
        'text-lg font-semibold text-foreground mt-4 mb-1',
        'text-base font-semibold text-violet-700 dark:text-violet-300 mt-3 mb-1',
        'text-sm font-semibold text-muted-foreground mt-2 mb-0.5 uppercase tracking-wide',
      ][lvl - 1] ?? 'font-semibold mt-2'
      output.push(lvl===1?<h1 key={k} className={cls}>{inline(hm[2],k)}</h1>:lvl===2?<h2 key={k} className={cls}>{inline(hm[2],k)}</h2>:lvl===3?<h3 key={k} className={cls}>{inline(hm[2],k)}</h3>:<h4 key={k} className={cls}>{inline(hm[2],k)}</h4>)
      return
    }
    if (/^---+$/.test(line.trim())) { flushList(); output.push(<hr key={k} className="my-3 border-border/50"/>); return }
    if (line.startsWith('> ')) { flushList(); output.push(<blockquote key={k} className="border-l-4 border-violet-400/50 pl-3 my-2 text-muted-foreground italic text-sm">{inline(line.slice(2),k)}</blockquote>); return }
    if (line.startsWith('```')) { flushList(); return }
    const bm = line.match(/^(\s*)([-*+]|\d+\.)\s+(.+)/)
    if (bm) { listItems.push(<li key={k} className="flex items-start gap-2 text-sm leading-relaxed"><span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-violet-500/70 flex-shrink-0"/><span>{inline(bm[3],k)}</span></li>); return }
    if (!line.trim()) { flushList(); output.push(<div key={k} className="h-2"/>); return }
    flushList(); output.push(<p key={k} className="text-sm leading-relaxed">{inline(line,k)}</p>)
  })
  flushList()
  return output
}

function MarkdownContent({ text }: { text: string }) {
  const segments: { type: 'md'|'code'; lang?: string; content: string }[] = []
  const lines = text.split('\n')
  let inCode=false, lang='', codeBuf: string[]=[], mdBuf: string[]=[]
  for (const line of lines) {
    if (!inCode && line.startsWith('```')) { 
      if (mdBuf.length) {
        segments.push({type:'md', content:mdBuf.join('\n')})
        mdBuf=[]
      } 
      inCode=true
      lang=line.slice(3).trim()
      codeBuf=[] 
    } else if (inCode && line.startsWith('```')) { 
      segments.push({type:'code', lang, content:codeBuf.join('\n')})
      inCode=false
      lang=''
      codeBuf=[] 
    } else if (inCode) {
      codeBuf.push(line)
    } else {
      mdBuf.push(line)
    }
  }
  if (mdBuf.length) segments.push({type:'md', content:mdBuf.join('\n')})
  if (codeBuf.length) segments.push({type:'code', content:codeBuf.join('\n')})
  return <div className="space-y-0.5">
    {segments.map((seg,i)=>seg.type==='code'?<CodeBlock key={i} lang={seg.lang} code={seg.content}/>:<div key={i}>{renderMarkdown(seg.content)}</div>)}
  </div>
}

function CodeBlock({ lang, code }: { lang?: string; code: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="my-3 rounded-xl overflow-hidden border border-border/50 shadow-sm">
      <div className="flex items-center justify-between px-3 py-1.5 bg-secondary/40 border-b border-border/30">
        <span className="text-[11px] font-mono text-muted-foreground">{lang || 'code'}</span>
        <button 
          onClick={()=>{
            navigator.clipboard.writeText(code)
            setCopied(true)
            setTimeout(()=>setCopied(false),1800)
          }} 
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <Copy className="w-3 h-3"/>{copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto bg-secondary/20 text-xs font-mono leading-relaxed text-foreground">{code}</pre>
    </div>
  )
}

// ─── Avatars ──────────────────────────────────────────────────────────────────

const ManusAvatar = memo(function ManusAvatar() {
  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center flex-shrink-0 shadow-md">
      <svg className="w-4 h-4 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
        <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v1h8v-1zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-1a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v1h-3zM4.75 12.094A5.973 5.973 0 004 15v1H1v-1a3 3 0 013.75-2.906z"/>
      </svg>
    </div>
  )
})

const UserAvatar = memo(function UserAvatar() {
  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center flex-shrink-0 shadow-md">
      <svg className="w-4 h-4 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
      </svg>
    </div>
  )
})

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button 
      onClick={()=>{
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(()=>setCopied(false),1500)
        toast.success('Copied')
      }}
      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all duration-200 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 z-10" 
      title="Copy"
    >
      {copied ? <CheckCircle className="w-3.5 h-3.5 text-green-500"/> : <Copy className="w-3.5 h-3.5"/>}
    </button>
  )
}

function LocalFilePreview({ file }: { file: LocalAttachment }) {
  const isImage = file.type.startsWith('image/')
  return (
    <div className="flex items-center gap-2 mt-2 p-2 bg-primary-foreground/10 border border-primary-foreground/20 rounded-xl">
      {isImage
        ? <img src={file.content} alt={file.name} className="w-9 h-9 object-cover rounded-lg flex-shrink-0"/>
        : <div className="w-9 h-9 rounded-lg bg-primary-foreground/20 flex items-center justify-center flex-shrink-0">
            <FileText className="w-4 h-4 text-primary-foreground"/>
          </div>
      }
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-primary-foreground truncate">{file.name}</div>
        <div className="text-[11px] text-primary-foreground/70">{(file.size/1024).toFixed(0)} KB</div>
      </div>
    </div>
  )
}

// ─── Attachment card ──────────────────────────────────────────────────────────

function PdfIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14,2 14,8 20,8"/>
      <path d="M9 15h6M9 11h3"/>
      <text x="8.5" y="19" fontSize="4.5" fontWeight="bold" fill="currentColor" stroke="none">PDF</text>
    </svg>
  )
}

function WordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="none" stroke="currentColor" strokeWidth="1.8"/>
      <polyline points="14,2 14,8 20,8" fill="none" stroke="currentColor" strokeWidth="1.8"/>
      <text x="5.5" y="19" fontSize="5.5" fontWeight="900" fill="currentColor" stroke="none">W</text>
    </svg>
  )
}

function PptIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <line x1="8" y1="21" x2="16" y2="21"/>
      <line x1="12" y1="17" x2="12" y2="21"/>
      <text x="5" y="13" fontSize="5" fontWeight="900" fill="currentColor" stroke="none">PPT</text>
    </svg>
  )
}
function AttachmentCard({ attachment }: { attachment: Attachment ,onUser:boolean}) {
  const [loading, setLoading] = useState<ExportFormat | null>(null)

  const isPdf = true // ALWAYS TRUE because Manus returns PDF only

const handleConvert = async (fmt: ExportFormat) => {
  setLoading(fmt)

  try {
    const res = await fetch('/api/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileUrl: attachment.url,
        target: fmt
      })
    })
    
    if (!res.ok) throw new Error('conversion failed')

    // ✅ get binary
    const blob = await res.blob()

    // ✅ extract filename from headers
    const disposition = res.headers.get('content-disposition')
    const match = disposition?.match(/filename="(.+)"/)

    // fallback filename if header missing
    const fallbackName = fmt === 'pptx' ? 'presentation.pptx' : 'document.docx'
    const filename = match ? match[1] : fallbackName

    // ✅ create download
    const url = window.URL.createObjectURL(blob)
    
    // 🔥 MISSING: Actually trigger the download
    const link = document.createElement('a')
    link.href = url
    link.download = filename  // This forces download instead of opening
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    // ✅ Clean up
    window.URL.revokeObjectURL(url)
    
  } catch (e) {
    console.error(e)
    toast.error('Conversion failed')
    window.open(attachment.url, '_blank')
  } finally {
    setLoading(null)
  }
}

  return (
    <div className="mt-2 rounded-xl border bg-background">
      <div className="flex items-center gap-2 px-3 py-2">
        <FileText className="w-4 h-4 text-red-500" />
        <span className="text-xs font-medium">{attachment.filename}</span>
      </div>

      <div className="flex gap-2 px-3 pb-2">
        <a
          href={attachment.url}
          target="_blank"
          className="text-xs underline"
        ><PdfIcon className="w-5 h-5"/>
          Open PDF
        </a>
        <button
          onClick={() => handleConvert('docx')}
          disabled={loading === 'docx'}
          className="text-xs px-2 py-1 bg-blue-100 rounded"
        ><WordIcon className="w-5 h-5"/>
          {loading === 'docx' ? 'Converting...' : 'Word'}
        </button>

        <button
          onClick={() => handleConvert('pptx')}
          disabled={loading === 'pptx'}
          className="text-xs px-2 py-1 bg-orange-100 rounded"
        ><PptIcon className="w-5 h-5"/>
          {loading === 'pptx' ? 'Converting...' : 'PPT'}
        </button>
      </div>
    </div>
  )

}// ─── TypingBubble ─────────────────────────────────────────────────────────────

function TypingBubble({ agentStatus }: { agentStatus: 'running'|'waiting'|'thinking' }) {
  const isWaiting = agentStatus === 'waiting'
  return (
    <div className="flex items-end gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <ManusAvatar/>
      <div className={`border px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm transition-all ${isWaiting ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800' : 'bg-card border-border/50'}`}>
        <div className="flex items-center gap-2.5">
          {isWaiting ? (
            <><Clock className="w-4 h-4 text-amber-500 animate-pulse flex-shrink-0"/><span className="text-sm font-medium text-amber-700 dark:text-amber-300">Waiting for your input…</span></>
          ) : (
            <><div className="flex items-center gap-1.5">{[0,150,300].map(d => <div key={d} className="w-2 h-2 rounded-full bg-violet-500 animate-bounce" style={{animationDelay: `${d}ms`}}/>)}</div><span className="text-sm font-medium text-muted-foreground">AI is thinking…</span></>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── AssistantBubble ──────────────────────────────────────────────────────────

function AssistantBubble({ content, attachments }: { content: string; attachments: Attachment[] }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = content.length > 1200
  const displayed = isLong && !expanded ? content.slice(0, 1200) + '…' : content
  return (
    <div className="bg-card border border-border/50 rounded-2xl rounded-bl-sm shadow-sm hover:shadow-md transition-shadow relative group">
      <CopyButton text={content}/>
      <div className="px-4 pt-3 pb-2"><MarkdownContent text={displayed}/></div>
      {isLong && (
        <button 
          onClick={() => setExpanded(e => !e)} 
          className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-colors border-t border-border/30"
        >
          {expanded ? <><ChevronUp className="w-3.5 h-3.5"/>Show less</> : <><ChevronDown className="w-3.5 h-3.5"/>Show more</>}
        </button>
      )}
      {attachments.length > 0 && (
        <div className="px-4 pb-3 border-t border-border/30 pt-2">
          {attachments.map((att, i) => <AttachmentCard key={i} attachment={att} onUser={false}/>)}
        </div>
      )}
    </div>
  )
}

// ─── UserBubble ───────────────────────────────────────────────────────────────

function UserBubble({ content, localAtts, remoteAtts, timestamp }: { content: string; localAtts: LocalAttachment[]; remoteAtts: Attachment[]; timestamp: string }) {
  const display = stripPdfNotice(content)
  return (
    <div className="flex flex-col items-end gap-1 animate-in fade-in slide-in-from-right-2 duration-300 group">
      <div className="flex items-end gap-2.5 max-w-[85%]">
        <div className="flex-1 min-w-0 relative">
          <div className="bg-gradient-to-br from-primary to-primary/90 text-primary-foreground px-4 py-3 rounded-2xl rounded-br-sm text-sm leading-relaxed break-words shadow-md">
            <CopyButton text={display}/>
            {display}
            {localAtts.map((f, i) => <LocalFilePreview key={i} file={f}/>)}
            {remoteAtts.map((a, i) => <AttachmentCard key={i} attachment={a} onUser/>)}
          </div>
        </div>
        <UserAvatar/>
      </div>
      <span className="text-[11px] text-muted-foreground pr-10">{new Date(timestamp).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const params = useParams()
  const router = useRouter()
  const chatId = params.id as string

  const [messages, setMessages] = useState<Message[]>([])
  const [chatTitle, setChatTitle] = useState('')
  const [creditUsage, setCreditUsage] = useState<number>(0)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<LocalAttachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isPolling, setIsPolling] = useState(false)
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [agentStatus, setAgentStatus] = useState<'running'|'waiting'|'thinking'>('thinking')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isPollingRef = useRef(false)
  const activeTaskIdRef = useRef<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messageMapRef = useRef<Map<string, Message>>(new Map())
  const finalResponseSaved = useRef(false)
  const [isNewChat, setIsNewChat] = useState(true)

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
    isPollingRef.current = false
    setIsPolling(false)
  }, [])

  const saveFinal = useCallback(async (taskId: string, content: string, atts: Attachment[]) => {
    if (finalResponseSaved.current) return
    try {
      const res = await fetch(`/api/chats/${chatId}/messages/final`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, content, attachments: atts })
      })
      if (res.ok) {
        finalResponseSaved.current = true
        const d = await res.json()
        if (d.creditUsage) setCreditUsage(prev => prev + d.creditUsage)
      }
    } catch (e) {
      console.error('[Save]', e)
    }
  }, [chatId])

  const rebuild = useCallback(() => {
    const all = Array.from(messageMapRef.current.values())
    const status = all.filter(m => m.message_type === 'status_update')
    const real = all.filter(m => m.message_type !== 'status_update')
    const latest = status.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
    const display = [...real]
    if (latest) {
      const newer = real.some(m => m.message_type === 'assistant_message' && new Date(m.created_at).getTime() >= new Date(latest.created_at).getTime())
      if (!newer) display.push(latest)
    }
    display.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    setMessages(display)
  }, [])

  const poll = useCallback(async (taskId: string) => {
    if (!taskId || taskId === 'undefined') {
      stopPolling()
      return
    }
    try {
      const res = await fetch(`/api/tasks/${taskId}/status?t=${Date.now()}`)
      if (!res.ok) return
      const data = await res.json()

      if (!data.isInitializing && data.status !== 'initializing' && data.messages?.length) {
        const sorted = [...data.messages].sort((a: any, b: any) => parseInt(a.timestamp) - parseInt(b.timestamp))
        let finalMsg: any = null
        let changed = false

        for (const msg of sorted) {
          const existing = messageMapRef.current.get(msg.id)
          let nm: Message | null = null

          if (msg.type === 'user_message' && msg.user_message) {
            const c = msg.user_message.content
            const dup = Array.from(messageMapRef.current.values()).some(m => m.role === 'user' && m.content === c && m.message_type === 'user_message')
            if (!dup) {
              nm = {
                id: msg.id,
                content: c,
                role: 'user',
                created_at: new Date(parseInt(msg.timestamp)).toISOString(),
                message_type: 'user_message'
              }
            }
          } else if (msg.type === 'assistant_message' && msg.assistant_message) {
            if (!existing) {
              nm = {
                id: msg.id,
                content: msg.assistant_message.content,
                role: 'assistant',
                created_at: new Date(parseInt(msg.timestamp)).toISOString(),
                attachments: msg.assistant_message.attachments || [],
                statusType: 'completed',
                message_type: 'assistant_message'
              }
              finalMsg = msg.assistant_message
              changed = true
            }
          } else if (msg.type === 'status_update' && msg.status_update) {
            const s = msg.status_update
            let t = ''
            let st: Message['statusType'] = 'running'
            if (s.agent_status === 'stopped') {
              t = s.description || 'Task completed'
              st = 'completed'
            } else if (s.agent_status === 'error') {
              t = `Error: ${s.description || s.brief}`
              st = 'failed'
            } else if (s.agent_status === 'waiting') {
              t = s.description || 'Waiting for input…'
            } else {
              t = s.description || s.brief || 'Processing…'
            }
            if (s.agent_status === 'waiting') setAgentStatus('waiting')
            else if (s.agent_status === 'running') setAgentStatus('running')
            nm = {
              id: msg.id,
              content: t,
              role: 'assistant',
              created_at: new Date(parseInt(msg.timestamp)).toISOString(),
              statusType: st,
              message_type: 'status_update'
            }
          } else if (msg.type === 'tool_used' && msg.tool_used) {
            setAgentStatus('running')
            nm = {
              id: msg.id,
              content: `**${msg.tool_used.tool}**: ${msg.tool_used.description || msg.tool_used.brief || ''}`,
              role: 'assistant',
              created_at: new Date(parseInt(msg.timestamp)).toISOString(),
              statusType: 'running',
              message_type: 'tool_used'
            }
          } else if (msg.type === 'plan_update' && msg.plan_update) {
            const steps = msg.plan_update.steps || []
            const done = steps.filter((s: any) => s.status === 'done').length
            nm = {
              id: msg.id,
              content: `**Progress:** ${done}/${steps.length} steps complete`,
              role: 'assistant',
              created_at: new Date(parseInt(msg.timestamp)).toISOString(),
              statusType: 'running',
              message_type: 'plan_update'
            }
          } else if (msg.type === 'explanation' && msg.explanation) {
            const c = msg.explanation.content
            nm = {
              id: msg.id,
              content: c.length > 180 ? c.slice(0, 180) + '…' : c,
              role: 'assistant',
              created_at: new Date(parseInt(msg.timestamp)).toISOString(),
              statusType: 'running',
              message_type: 'explanation'
            }
          } else if (msg.type === 'error_message' && msg.error_message) {
            nm = {
              id: msg.id,
              content: msg.error_message.content,
              role: 'assistant',
              created_at: new Date(parseInt(msg.timestamp)).toISOString(),
              statusType: 'failed',
              message_type: 'error_message'
            }
          }

          if (nm && (!existing || existing.content !== nm.content)) {
            messageMapRef.current.set(msg.id, nm)
            changed = true
          }
        }

        if (changed) {
          rebuild()
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
        }
        if (TERMINAL.has(data.status) && finalMsg && !finalResponseSaved.current) {
          await saveFinal(taskId, finalMsg.content, finalMsg.attachments || [])
        }
      }

      if (TERMINAL.has(data.status)) {
        stopPolling()
        setActiveTaskId(null)
        activeTaskIdRef.current = null
        data.status === 'error' || data.status === 'failed' ? toast.error('Task failed') : toast.success('Task completed!')
      } else if (isPollingRef.current) {
        pollTimerRef.current = setTimeout(() => poll(taskId), 2000)
      }
    } catch (e) {
      console.error('[Poll]', e)
      if (isPollingRef.current) pollTimerRef.current = setTimeout(() => poll(taskId), 3000)
    }
  }, [stopPolling, saveFinal, rebuild])

  const startPolling = useCallback((taskId: string) => {
    stopPolling()
    isPollingRef.current = true
    setIsPolling(true)
    setAgentStatus('thinking')
    finalResponseSaved.current = false
    poll(taskId)
  }, [stopPolling, poll])

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true)
        messageMapRef.current.clear()
        
        const res = await fetch(`/api/chats/${chatId}/messages`)
        
        if (res.status === 404) {
          setChatTitle('New Conversation')
          setMessages([])
          setIsNewChat(true)
        } else if (!res.ok) {
          throw new Error('Failed to load messages')
        } else {
          const data = await res.json()
          setChatTitle(data.chat.title)
          if (data.chat.credit_usage) setCreditUsage(data.chat.credit_usage)
          
          ;(data.messages || []).forEach((msg: Message) => {
            if (msg.message_type === 'placeholder') return
            if (msg.role === 'assistant' && msg.statusType === 'running' && msg.content?.includes('Manus is working')) return
            messageMapRef.current.set(msg.id, {
              ...msg,
              message_type: msg.message_type || (msg.role === 'assistant' && msg.statusType === 'completed' ? 'assistant_message' : undefined)
            })
          })
          rebuild()
          
          const last = data.messages?.findLast((m: any) => m.role === 'assistant')
          if (last?.manus_task_id && last?.statusType === 'running') {
            setActiveTaskId(last.manus_task_id)
            activeTaskIdRef.current = last.manus_task_id
            startPolling(last.manus_task_id)
          }
        }
      } catch (e) {
        console.error(e)
        toast.error('Failed to load chat')
      } finally {
        setLoading(false)
      }
    }
    
    if (chatId) init()
    return () => {
      stopPolling()
      messageMapRef.current.clear()
    }
  }, [chatId, rebuild, startPolling, stopPolling])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isPolling])

  const handleSend = async (override?: string) => {
    const trimmed = (override ?? input).trim()
    if ((!trimmed && !attachments.length) || sending) return
    
    try {
      setSending(true)
      setError(null)
      
      let currentChatId = chatId
      
      if (isNewChat || !currentChatId) {
        currentChatId = currentChatId || crypto.randomUUID()
        const createRes = await fetch('/api/chats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId: currentChatId,
            title: 'New Conversation',
            useCase: 'general'
          }),
        })
        
        if (!createRes.ok) throw new Error('Failed to create chat')
        await createRes.json()
        
        router.push(`/chat/${currentChatId}`)
        setIsNewChat(false)
      }
      
      const localAtts = [...attachments]
      const uploaded: { fileId: string; filename: string }[] = []
      
      if (localAtts.length) {
        toast.info(`Uploading ${localAtts.length} file(s)…`)
        for (const att of localAtts) {
          try {
            const bytes = Uint8Array.from(atob(att.content.split(',')[1]), c => c.charCodeAt(0))
            const blob = new Blob([bytes], { type: att.type })
            const fd = new FormData()
            fd.append('file', blob, att.name)
            const up = await fetch('/api/upload', { method: 'POST', body: fd })
            if (!up.ok) throw new Error()
            const ud = await up.json()
            uploaded.push({ fileId: ud.fileId, filename: att.name })
          } catch {
            toast.error(`Failed to upload ${att.name}`)
          }
        }
      }
      
      const res = await fetch(`/api/chats/${currentChatId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: trimmed,
          fileIds: uploaded.map(f => f.fileId),
          attachments: uploaded
        })
      })
      
      if (!res.ok) {
        const e = await res.json()
        throw new Error(e.error || 'Failed to send')
      }
      
      const data = await res.json()
      
      if (data.chat?.title && data.chat.title !== chatTitle) {
        setChatTitle(data.chat.title)
      }
      
      if (data.userMessage && !messageMapRef.current.has(data.userMessage.id)) {
        messageMapRef.current.set(data.userMessage.id, {
          ...data.userMessage,
          message_type: 'user_message',
          localAttachments: localAtts
        })
      }
      
      rebuild()
      
      if (data.taskId) {
        setActiveTaskId(data.taskId)
        activeTaskIdRef.current = data.taskId
        finalResponseSaved.current = false
        setTimeout(() => startPolling(data.taskId), 1000)
      }
      
      setInput('')
      setAttachments([])
      
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to send'
      setError(msg)
      toast.error(msg)
    } finally {
      setSending(false)
    }
  }
  
  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    const added: LocalAttachment[] = []
    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} too large`)
        continue
      }
      await new Promise<void>(r => {
        const reader = new FileReader()
        reader.onload = e => {
          added.push({
            id: `${Date.now()}-${Math.random()}`,
            name: file.name,
            type: file.type,
            size: file.size,
            content: e.target?.result as string
          })
          r()
        }
        reader.readAsDataURL(file)
      })
    }
    setAttachments(prev => [...prev, ...added])
    setUploading(false)
    if (added.length) toast.success(`${added.length} file(s) ready`)
  }

  const removeAtt = (id: string) => setAttachments(prev => prev.filter(a => a.id !== id))

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorderRef.current = new MediaRecorder(stream)
      audioChunksRef.current = []
      mediaRecorderRef.current.ondataavailable = e => audioChunksRef.current.push(e.data)
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
        const r = new FileReader()
        r.onload = e => {
          setAttachments(prev => [...prev, {
            id: `${Date.now()}-rec`,
            name: 'voice-input.wav',
            type: 'audio/wav',
            size: blob.size,
            content: e.target?.result as string
          }])
          toast.success('Voice recording added')
        }
        r.readAsDataURL(blob)
        stream.getTracks().forEach(t => t.stop())
      }
      mediaRecorderRef.current.start()
      setIsRecording(true)
      toast.info('Recording… click again to stop')
    } catch {
      toast.error('Could not access microphone')
    }
  }
  
  const stopRec = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  type Group = { kind: 'user'; msgs: Message[] } | { kind: 'assistant'; msgs: Message[] } | { kind: 'status'; msg: Message }
  const groups: Group[] = []
  for (const msg of messages) {
    if (msg.message_type === 'status_update') {
      if (msg.statusType === 'completed' || msg.statusType === 'failed') groups.push({ kind: 'status', msg })
      continue
    }
    if (msg.role === 'user') {
      const last = groups[groups.length - 1]
      if (last?.kind === 'user') last.msgs.push(msg)
      else groups.push({ kind: 'user', msgs: [msg] })
    } else {
      const last = groups[groups.length - 1]
      if (last?.kind === 'assistant') last.msgs.push(msg)
      else groups.push({ kind: 'assistant', msgs: [msg] })
    }
  }
  
  const isEmpty = messages.length === 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center animate-in fade-in zoom-in-95 duration-500">
          <p className="text-muted-foreground font-medium">Loading conversation…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-background via-background to-secondary/5">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-md border-b border-border/50">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => router.push('/')} className="p-1.5 hover:bg-secondary rounded-lg transition-all duration-200 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5"/>
          </button>
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center flex-shrink-0 shadow-md">
              <svg className="w-4 h-4 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v1h8v-1zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-1a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v1h-3zM4.75 12.094A5.973 5.973 0 004 15v1H1v-1a3 3 0 013.75-2.906z"/>
              </svg>
            </div>
            <h1 className="font-semibold text-foreground truncate text-sm">{chatTitle || 'New Conversation'}</h1>
          </div>
          {creditUsage > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-violet-50 dark:bg-violet-950 border border-violet-200 dark:border-violet-800 text-[11px] font-medium text-violet-700 dark:text-violet-300 flex-shrink-0 shadow-sm">
              <Zap className="w-3 h-3"/>{creditUsage.toFixed(2)} credits
            </div>
          )}
          {isPolling && (
            <div className="flex items-center gap-1.5 text-[11px] flex-shrink-0">
              {agentStatus === 'waiting'
                ? <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400"><Clock className="w-3 h-3 animate-pulse"/>Waiting</span>
                : <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"/>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"/>
                    </span>
                    Live
                  </span>
              }
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center animate-in fade-in zoom-in-95 duration-500">
              <img src="/eih.png" alt="Logo" className="w-20 h-20 object-contain mb-4" />
              <h2 className="font-bold mb-2 bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text">
                What can I help you with?
              </h2>
              <p className="text-muted-foreground text-sm max-w-xs">Select a template below or type your request</p>
            </div>
          ) : (
            <>
              {groups.map((group) => {
                if (group.kind === 'status') {
                  return (
                    <div key={group.msg.id} className="flex justify-center animate-in fade-in duration-300">
                      <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border shadow-sm ${
                        group.msg.statusType === 'completed'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400'
                          : 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-400'
                      }`}>
                        {group.msg.statusType === 'completed' ? <CheckCircle className="w-3 h-3"/> : <AlertTriangle className="w-3 h-3"/>}
                        {group.msg.content}
                      </div>
                    </div>
                  )
                }
                
                if (group.kind === 'user') {
                  const { msgs } = group
                  return (
                    <UserBubble 
                      key={msgs[0].id} 
                      content={msgs.map(m => m.content).filter(Boolean).join('\n')} 
                      localAtts={msgs.flatMap(m => m.localAttachments || [])} 
                      remoteAtts={msgs.flatMap(m => m.attachments || [])} 
                      timestamp={msgs[msgs.length - 1].created_at}
                    />
                  )
                }
                
                const { msgs } = group
                return (
                  <div key={msgs[0].id} className="flex flex-col items-start gap-1 animate-in fade-in slide-in-from-left-2 duration-300">
                    <div className="flex items-end gap-2.5 max-w-[92%] w-full">
                      <ManusAvatar/>
                      <div className="flex-1 min-w-0">
                        <AssistantBubble 
                          content={msgs.filter(m => m.content?.trim()).map(m => m.content.trim()).join('\n\n')} 
                          attachments={msgs.flatMap(m => m.attachments || [])}
                        />
                      </div>
                    </div>
                    <span className="text-[11px] text-muted-foreground pl-10">
                      {new Date(msgs[msgs.length - 1].created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )
              })}
              {isPolling && <TypingBubble agentStatus={agentStatus} />}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="max-w-3xl mx-auto w-full px-4 mb-2">
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-sm">
            <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0"/>
            <span className="text-destructive flex-1">{error}</span>
            <button onClick={() => setError(null)} className="text-destructive/60 hover:text-destructive">
              <X className="w-4 h-4"/>
            </button>
          </div>
        </div>
      )}

      {attachments.length > 0 && (
        <div className="max-w-3xl mx-auto w-full px-4 mb-2 flex gap-2 flex-wrap">
          {attachments.map(att => (
            <div key={att.id} className="flex items-center gap-2 pl-2 pr-1 py-1 bg-secondary border border-border/50 rounded-lg max-w-[220px]">
              {att.type.startsWith('image/')
                ? <img src={att.content} alt={att.name} className="w-6 h-6 object-cover rounded flex-shrink-0"/>
                : <FileText className="w-4 h-4 flex-shrink-0 text-muted-foreground"/>
              }
              <span className="text-xs truncate flex-1">{att.name}</span>
              <button onClick={() => removeAtt(att.id)} className="hover:text-destructive transition-colors p-0.5 flex-shrink-0">
                <X className="w-3 h-3"/>
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-border/50 bg-background/95 backdrop-blur-md p-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-2 items-end p-2 bg-background border border-input rounded-2xl focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-400/20 transition-all duration-200">
            <textarea 
              value={input} 
              onChange={e => setInput(e.target.value)} 
              onKeyDown={handleKey}
              placeholder="Type your message… (Shift+Enter for new line)"
              rows={Math.min(5, Math.max(1, input.split('\n').length))}
              className="flex-1 bg-transparent text-foreground placeholder-muted-foreground text-sm resize-none outline-none px-2 py-1.5 leading-relaxed" 
              disabled={sending}
            />
            <div className="flex items-end gap-1.5 pb-1 flex-shrink-0">
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => handleFiles(e.target.files)}/>
              <button 
                onClick={() => fileInputRef.current?.click()} 
                disabled={sending || uploading} 
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-all duration-200 disabled:opacity-40" 
                title="Attach"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Paperclip className="w-4 h-4"/>}
              </button>
              {typeof window !== 'undefined' && 'MediaRecorder' in window && (
                <button 
                  onClick={isRecording ? stopRec : startRec} 
                  className={`p-2 rounded-xl transition-all duration-200 ${
                    isRecording 
                      ? 'text-red-500 bg-red-50 dark:bg-red-950/40 animate-pulse' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  }`} 
                  title={isRecording ? 'Stop' : 'Voice'}
                >
                  {isRecording ? <MicOff className="w-4 h-4"/> : <Mic className="w-4 h-4"/>}
                </button>
              )}
              <button 
                onClick={() => handleSend()} 
                disabled={sending || (!input.trim() && !attachments.length)}
                className="p-2 rounded-xl bg-primary hover:from-violet-700 hover:to-indigo-700 disabled:opacity-40 text-white transition-all duration-200 disabled:cursor-not-allowed hover:shadow-lg" 
                title="Send"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>}
              </button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5 justify-center">
            {USE_CASES.map(({ icon: Icon, label, prompt }) => (
              <button 
                key={label} 
                onClick={() => setInput(prompt)} 
                className="group flex items-center gap-1.5 px-3 py-1.5 text-xs bg-secondary hover:bg-secondary/70 border border-border/50 rounded-full transition-all duration-200 text-foreground hover:border-violet-300 dark:hover:border-violet-700 hover:text-violet-700 dark:hover:text-violet-300 hover:shadow-sm"
              >
                <Icon className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform"/>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}