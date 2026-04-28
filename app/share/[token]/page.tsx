'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Lock, Calendar, Eye, AlertCircle, ArrowLeft, MessageSquare, User, Bot,
  Download, FileText, File, Presentation, FileSpreadsheet, CheckCircle,
  Clock, Shield, ExternalLink, Copy, ChevronDown, ChevronUp, Loader2,
  Sparkles, Zap, BookOpen, GraduationCap, Briefcase, FileJson
} from 'lucide-react'
import { toast } from 'sonner'
import { downloadAttachment, type ExportFormat } from '@/lib/download-converter'

interface Attachment {
  id: string
  filename: string
  url: string
  content_type: string
  type: string
  size: number
}

interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
  created_at: string
  message_type: string
  statusType?: string
  attachments?: Attachment[]
}

interface SharedChatData {
  chat: {
    id: string
    title: string
    createdAt: string
    updatedAt: string
  }
  messages: Message[]
  requiresPassword: boolean
  metadata: {
    viewCount: number
    maxViews: number | null
    remainingViews: number | null
    expiresAt: string
    remainingDays: number
    sharedAt: string
  }
  messageCount: number
  userMessageCount: number
  assistantMessageCount: number
}

// Markdown renderer with syntax highlighting
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
      else if (m[4]) parts.push(<code key={`c${i++}`} className="bg-gray-100 dark:bg-gray-800 text-purple-600 dark:text-purple-400 px-1 py-0.5 rounded text-[0.85em] font-mono">{m[4]}</code>)
      else if (m[5]) parts.push(<a key={`a${i++}`} href={m[6]} target="_blank" rel="noopener noreferrer" className="text-purple-600 dark:text-purple-400 underline underline-offset-2 hover:no-underline">{m[5]}</a>)
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
        'text-2xl font-bold text-gray-900 dark:text-white mt-6 mb-3 pb-2 border-b border-gray-200 dark:border-gray-700',
        'text-xl font-semibold text-gray-800 dark:text-gray-200 mt-5 mb-2',
        'text-lg font-semibold text-purple-700 dark:text-purple-400 mt-4 mb-2',
        'text-base font-semibold text-gray-600 dark:text-gray-400 mt-3 mb-1 uppercase tracking-wide',
      ][lvl - 1] ?? 'font-semibold mt-2'
      output.push(
        lvl === 1 ? <h1 key={k} className={cls}>{inline(hm[2], k)}</h1>
        : lvl === 2 ? <h2 key={k} className={cls}>{inline(hm[2], k)}</h2>
        : lvl === 3 ? <h3 key={k} className={cls}>{inline(hm[2], k)}</h3>
        : <h4 key={k} className={cls}>{inline(hm[2], k)}</h4>
      )
      return
    }
    if (/^---+$/.test(line.trim())) { flushList(); output.push(<hr key={k} className="my-4 border-gray-200 dark:border-gray-700"/>); return }
    if (line.startsWith('> ')) {
      flushList()
      output.push(<blockquote key={k} className="border-l-4 border-purple-400 pl-4 my-3 text-gray-600 dark:text-gray-400 italic text-sm">{inline(line.slice(2), k)}</blockquote>)
      return
    }
    if (line.startsWith('```')) { flushList(); return }
    const bm = line.match(/^(\s*)([-*+]|\d+\.)\s+(.+)/)
    if (bm) {
      listItems.push(
        <li key={k} className="flex items-start gap-2 text-sm leading-relaxed">
          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0"/>
          <span>{inline(bm[3], k)}</span>
        </li>
      )
      return
    }
    if (!line.trim()) { flushList(); output.push(<div key={k} className="h-2"/>); return }
    flushList()
    output.push(<p key={k} className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">{inline(line, k)}</p>)
  })
  flushList()
  return output
}

// Enhanced Attachment Card with format preservation
function AttachmentCard({ attachment }: { attachment: Attachment }) {
  const [loading, setLoading] = useState<ExportFormat | null>(null)
  const [expanded, setExpanded] = useState(false)

  const isPdf = attachment.content_type === 'application/pdf' || attachment.filename?.endsWith('.pdf')
  const isJson = attachment.filename?.endsWith('.json')
  const isWord = attachment.filename?.match(/\.docx?$/)
  const isPpt = attachment.filename?.endsWith('.pptx')

  const getFileIcon = () => {
    if (isPdf) return <FileText className="w-5 h-5 text-red-500" />
    if (isJson) return <FileJson className="w-5 h-5 text-yellow-500" />
    if (isWord) return <FileText className="w-5 h-5 text-blue-500" />
    if (isPpt) return <Presentation className="w-5 h-5 text-orange-500" />
    return <File className="w-5 h-5 text-gray-500" />
  }

  const getFileColor = () => {
    if (isPdf) return 'from-red-50 to-red-100 dark:from-red-950/20 dark:to-red-900/20 border-red-200 dark:border-red-800'
    if (isJson) return 'from-yellow-50 to-yellow-100 dark:from-yellow-950/20 dark:to-yellow-900/20 border-yellow-200 dark:border-yellow-800'
    if (isWord) return 'from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/20 border-blue-200 dark:border-blue-800'
    if (isPpt) return 'from-orange-50 to-orange-100 dark:from-orange-950/20 dark:to-orange-900/20 border-orange-200 dark:border-orange-800'
    return 'from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 border-gray-200 dark:border-gray-700'
  }

  const handleDownload = async (format: ExportFormat) => {
    setLoading(format)
    try {
      await downloadAttachment(
        attachment.url,
        attachment.filename,
        format,
        (msg) => toast.info(msg, { duration: 2000 })
      )
      toast.success(`Successfully converted to ${format.toUpperCase()}`)
    } catch (error) {
      console.error('Download failed:', error)
      toast.error('Conversion failed. Opening original file...')
      window.open(attachment.url, '_blank')
    } finally {
      setLoading(null)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className={`mt-3 rounded-xl border bg-gradient-to-br ${getFileColor()} transition-all duration-200 hover:shadow-md`}>
      <div className="p-3">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            {getFileIcon()}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {attachment.filename}
              </h4>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                ({formatFileSize(attachment.size || 0)})
              </span>
            </div>
            
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-gray-600 dark:text-gray-400">
                {isPdf ? 'PDF Document' : isJson ? 'JSON Data' : isWord ? 'Word Document' : isPpt ? 'PowerPoint' : 'File'}
              </span>
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
              >
                {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {expanded ? 'Less' : 'Details'}
              </button>
            </div>
            
            {expanded && (
              <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500">Type:</span>
                    <span className="ml-2 text-gray-700 dark:text-gray-300">{attachment.content_type || 'Unknown'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">ID:</span>
                    <span className="ml-2 text-gray-700 dark:text-gray-300 font-mono text-xs">{attachment.id.slice(0, 8)}...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <a
            href={attachment.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            title="Open original"
          >
            <ExternalLink className="w-4 h-4 text-gray-500" />
          </a>
        </div>
        
        {/* Download format buttons */}
        <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Download as:</span>
            
            <button
              onClick={() => handleDownload('pdf')}
              disabled={loading !== null}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition-all text-xs font-medium disabled:opacity-50"
            >
              {loading === 'pdf' ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
              PDF
            </button>
            
            <button
              onClick={() => handleDownload('docx')}
              disabled={loading !== null}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all text-xs font-medium disabled:opacity-50"
            >
              {loading === 'docx' ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
              Word
            </button>
            
            <button
              onClick={() => handleDownload('pptx')}
              disabled={loading !== null}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/50 transition-all text-xs font-medium disabled:opacity-50"
            >
              {loading === 'pptx' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Presentation className="w-3 h-3" />}
              PowerPoint
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Message bubble component
function MessageBubble({ message, isUser }: { message: Message; isUser: boolean }) {
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(false)
  
  const isLong = message.content.length > 1000
  const displayContent = isLong && !expanded ? message.content.slice(0, 1000) + '...' : message.content

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Copied to clipboard')
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
      <div className={`max-w-[85%] ${isUser ? 'order-2' : 'order-1'}`}>
        <div className={`relative group rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-gradient-to-br from-purple-600 to-purple-500 text-white shadow-lg'
            : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm'
        }`}>
          {/* Copy button */}
          <button
            onClick={handleCopy}
            className={`absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all duration-200 p-1 rounded-lg ${
              isUser
                ? 'hover:bg-white/20 text-white'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500'
            }`}
          >
            {copied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          
          {/* Message content */}
          <div className={`text-sm leading-relaxed ${isUser ? 'text-white' : 'text-gray-700 dark:text-gray-300'}`}>
            {isUser ? (
              <div className="whitespace-pre-wrap break-words">{displayContent}</div>
            ) : (
              <div>{renderMarkdown(displayContent)}</div>
            )}
          </div>
          
          {/* Expand button for long messages */}
          {isLong && (
            <button
              onClick={() => setExpanded(!expanded)}
              className={`mt-2 text-xs font-medium flex items-center gap-1 ${
                isUser ? 'text-white/80 hover:text-white' : 'text-purple-600 dark:text-purple-400 hover:text-purple-700'
              }`}
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
          
          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-3 space-y-2">
              {message.attachments.map((att) => (
                <AttachmentCard key={att.id} attachment={att} />
              ))}
            </div>
          )}
        </div>
        
        {/* Timestamp */}
        <div className={`text-xs text-gray-500 dark:text-gray-400 mt-1 ${isUser ? 'text-right' : 'text-left'}`}>
          {new Date(message.created_at).toLocaleString()}
        </div>
      </div>
    </div>
  )
}

export default function SharedChatPage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [chatData, setChatData] = useState<SharedChatData | null>(null)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [password, setPassword] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [exporting, setExporting] = useState<ExportFormat | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const loadSharedChat = async (pwd?: string) => {
    try {
      setLoading(true)
      setError(null)
      
      let url = `/api/share/${token}`
      if (pwd) {
        url += `?password=${encodeURIComponent(pwd)}`
      }
      
      const response = await fetch(url)
      const data = await response.json()
      
      if (!response.ok) {
        if (response.status === 401 && data.requiresPassword) {
          setShowPasswordDialog(true)
          setLoading(false)
          return
        }
        throw new Error(data.error || 'Failed to load shared chat')
      }
      
      setChatData(data)
      setShowPasswordDialog(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load chat')
      toast.error('Failed to load shared chat')
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim()) {
      toast.error('Please enter a password')
      return
    }
    
    setVerifying(true)
    await loadSharedChat(password)
    setVerifying(false)
  }

  const exportAllMessages = async (format: ExportFormat) => {
    if (!chatData) return
    
    setExporting(format)
    try {
      // Combine all messages into a single document
      const content = chatData.messages.map(msg => {
        const role = msg.role === 'user' ? 'User' : 'Assistant'
        const date = new Date(msg.created_at).toLocaleString()
        return `[${role} - ${date}]\n${msg.content}\n\n---\n\n`
      }).join('')
      
      // Create a temporary blob and convert
      const blob = new Blob([content], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      
      // Use the download converter
      await downloadAttachment(url, `${chatData.chat.title}_export.txt`, format)
      URL.revokeObjectURL(url)
      
      toast.success(`Exported all messages as ${format.toUpperCase()}`)
    } catch (error) {
      console.error('Export failed:', error)
      toast.error('Failed to export messages')
    } finally {
      setExporting(null)
    }
  }

  useEffect(() => {
    if (token) {
      loadSharedChat()
    }
  }, [token])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatData?.messages])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
        <div className="text-center">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5 animate-pulse shadow-xl"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Loading shared conversation</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Please wait...</p>
        </div>
      </div>
    )
  }

  if (showPasswordDialog) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-purple-600 to-purple-500 px-6 py-4">
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-white" />
              <h2 className="text-lg font-semibold text-white">Password Protected</h2>
            </div>
          </div>
          
          <div className="p-6">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              This shared conversation is password protected. Please enter the password to view it.
            </p>
            
            <form onSubmit={handlePasswordSubmit}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4"
                autoFocus
              />
              <button
                type="submit"
                disabled={verifying}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-purple-500 text-white font-medium hover:from-purple-700 hover:to-purple-600 transition-all disabled:opacity-50"
              >
                {verifying ? 'Verifying...' : 'View Conversation'}
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  if (error || !chatData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden text-center">
          <div className="p-6">
            <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">Unable to Load Chat</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{error || 'Chat not found'}</p>
            <button
              onClick={() => router.push('/')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Go Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/')}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              
              <div>
                <h1 className="font-semibold text-gray-900 dark:text-white">{chatData.chat.title}</h1>
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    Shared conversation
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Expires in {chatData.metadata.remainingDays} days
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Export dropdown */}
              <div className="relative group">
                <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors text-sm font-medium">
                  <Download className="w-4 h-4" />
                  Export
                  <ChevronDown className="w-3 h-3" />
                </button>
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-20">
                  <button
                    onClick={() => exportAllMessages('pdf')}
                    disabled={exporting !== null}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 first:rounded-t-lg"
                  >
                    {exporting === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                    Export as PDF
                  </button>
                  <button
                    onClick={() => exportAllMessages('docx')}
                    disabled={exporting !== null}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    {exporting === 'docx' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                    Export as Word
                  </button>
                  <button
                    onClick={() => exportAllMessages('pptx')}
                    disabled={exporting !== null}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 last:rounded-b-lg"
                  >
                    {exporting === 'pptx' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Presentation className="w-4 h-4" />}
                    Export as PowerPoint
                  </button>
                </div>
              </div>
              
              {/* Stats */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-xs">
                <Eye className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-gray-700 dark:text-gray-300">{chatData.metadata.viewCount} views</span>
              </div>
            </div>
          </div>
          
          {/* Stats bar */}
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white">{chatData.messageCount}</div>
                <div className="text-xs text-gray-500">Messages</div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white">{chatData.userMessageCount}</div>
                <div className="text-xs text-gray-500">User</div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Bot className="w-4 h-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white">{chatData.assistantMessageCount}</div>
                <div className="text-xs text-gray-500">Assistant</div>
              </div>
            </div>
            
            {chatData.metadata.remainingViews !== null && (
              <div className="flex items-center gap-2 ml-auto">
                <Clock className="w-4 h-4 text-yellow-500" />
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {chatData.metadata.remainingViews} views remaining
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="space-y-4">
          {chatData.messages.map((message, index) => (
            <MessageBubble
              key={message.id}
              message={message}
              isUser={message.role === 'user'}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Footer */}
        <div className="mt-8 pt-6 text-center border-t border-gray-200 dark:border-gray-800">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Shared via Manus • {new Date(chatData.metadata.sharedAt).toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  )
}