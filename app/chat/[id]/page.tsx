'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChatMessages } from '@/components/chat/chat-messages'
import { 
  Loader2, 
  Send, 
  Paperclip, 
  FileText, 
  Sparkles, 
  Brain, 
  Presentation, 
  Database,
  X,
  AlertCircle,
  Mic,
  MicOff
} from 'lucide-react'

interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
  created_at: string
  attachments?: Attachment[]
  useCase?: UseCaseType
}

interface Attachment {
  id: string
  name: string
  type: string
  size: number
  url?: string
  content?: string
}

type UseCaseType = 'general' | 'summarization' | 'analysis' | 'presentation' | 'database'

interface UseCase {
  id: UseCaseType
  name: string
  description: string
  icon: React.ReactNode
  placeholder: string
  requiresDocument: boolean
}

const useCases: UseCase[] = [
  {
    id: 'general',
    name: 'General Chat',
    description: 'Have a natural conversation with AI',
    icon: <Sparkles className="w-5 h-5" />,
    placeholder: 'Type your message...',
    requiresDocument: false
  },
  {
    id: 'summarization',
    name: 'Text Summarization',
    description: 'Summarize long documents, articles, or transcripts',
    icon: <FileText className="w-5 h-5" />,
    placeholder: 'Upload a document to summarize or paste text...',
    requiresDocument: true
  },
  {
    id: 'analysis',
    name: 'Data Analysis',
    description: 'Analyze data, find patterns, and generate insights',
    icon: <Brain className="w-5 h-5" />,
    placeholder: 'Upload CSV/Excel file or describe what you want to analyze...',
    requiresDocument: true
  },
  {
    id: 'presentation',
    name: 'Slide Generation',
    description: 'Create professional presentations from your content',
    icon: <Presentation className="w-5 h-5" />,
    placeholder: 'Upload document or describe your presentation topic...',
    requiresDocument: true
  },
  {
    id: 'database',
    name: 'Database Query',
    description: 'Query and analyze your database naturally',
    icon: <Database className="w-5 h-5" />,
    placeholder: 'Ask questions about your data...',
    requiresDocument: false
  }
]

export default function ChatPage() {
  const params = useParams()
  const router = useRouter()
  const chatId = params.id as string
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedUseCase, setSelectedUseCase] = useState<UseCaseType>('general')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  
  const initialFetchDoneRef = useRef(false)

  const currentUseCase = useCases.find(u => u.id === selectedUseCase) || useCases[0]

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    if (!chatId) return

    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`/api/chats/messages?chatId=${chatId}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch messages')
      }
      
      const data = await response.json()
      setMessages(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching messages:', error)
      setError(error instanceof Error ? error.message : 'Failed to load messages')
    } finally {
      setLoading(false)
    }
  }, [chatId])

  // Initial fetch - only once when chatId changes
  useEffect(() => {
    if (chatId && !initialFetchDoneRef.current) {
      initialFetchDoneRef.current = true
      fetchMessages()
    }

    // Reset when chatId changes
    return () => {
      initialFetchDoneRef.current = false
    }
  }, [chatId, fetchMessages])

  // Handle file upload
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    setUploading(true)
    const newAttachments: Attachment[] = []

    for (const file of Array.from(files)) {
      try {
        if (file.size > 10 * 1024 * 1024) {
          setError(`File ${file.name} is too large. Maximum size is 10MB`)
          continue
        }

        const content = await readFileContent(file)
        
        const attachment: Attachment = {
          id: `${Date.now()}-${Math.random()}`,
          name: file.name,
          type: file.type,
          size: file.size,
          content: content
        }

        const formData = new FormData()
        formData.append('file', file)
        formData.append('chatId', chatId)

        const uploadResponse = await fetch('/api/chats/upload', {
          method: 'POST',
          body: formData
        })

        if (uploadResponse.ok) {
          const { url } = await uploadResponse.json()
          attachment.url = url
        }

        newAttachments.push(attachment)
      } catch (error) {
        console.error('Error uploading file:', error)
        setError(`Failed to upload ${file.name}`)
      }
    }

    setAttachments(prev => [...prev, ...newAttachments])
    setUploading(false)
  }

  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target?.result as string)
      reader.onerror = (e) => reject(e)
      
      if (file.type === 'application/pdf') {
        reader.readAsText(file)
      } else if (file.type.includes('text') || file.type === 'application/json') {
        reader.readAsText(file)
      } else if (file.type.includes('image')) {
        reader.readAsDataURL(file)
      } else {
        reader.readAsText(file)
      }
    })
  }

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(att => att.id !== id))
  }

  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorderRef.current = new MediaRecorder(stream)
      audioChunksRef.current = []

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data)
      }

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
        await transcribeAudio(audioBlob)
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorderRef.current.start()
      setIsRecording(true)
    } catch (error) {
      console.error('Error accessing microphone:', error)
      setError('Could not access microphone. Please check permissions.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      const formData = new FormData()
      formData.append('audio', audioBlob)

      const response = await fetch('/api/chats/transcribe', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const { text } = await response.json()
        setInput(prev => prev + (prev ? ' ' : '') + text)
      }
    } catch (error) {
      console.error('Error transcribing audio:', error)
      setError('Failed to transcribe audio')
    }
  }

  // Send message
  const handleSendMessage = async () => {
    const trimmedInput = input.trim()
    if ((!trimmedInput && attachments.length === 0) || sending) return

    try {
      setSending(true)
      setError(null)
      
      const requestBody = {
        chatId: chatId,
        content: trimmedInput,
        useCase: selectedUseCase,
        attachments: attachments.map(att => ({
          name: att.name,
          type: att.type,
          content: att.content,
          url: att.url
        }))
      }
      
      const response = await fetch('/api/chats/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || 'Failed to send message')
      }

      setInput('')
      setAttachments([])
      
      // Refresh messages
      await fetchMessages()
    } catch (error) {
      console.error('Error sending message:', error)
      setError(error instanceof Error ? error.message : 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gradient-to-br from-background via-background to-primary/5">
        <div className="text-center">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl animate-pulse" />
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4 relative" />
          </div>
          <p className="text-muted-foreground animate-pulse">Loading conversation...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-background via-background to-secondary/5">
      {/* Use Case Selector */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex gap-2 overflow-x-auto hide-scrollbar">
            {useCases.map((useCase) => (
              <button
                key={useCase.id}
                onClick={() => setSelectedUseCase(useCase.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200 whitespace-nowrap ${
                  selectedUseCase === useCase.id
                    ? 'bg-primary text-primary-foreground shadow-lg scale-105'
                    : 'bg-secondary/50 hover:bg-secondary text-secondary-foreground'
                }`}
              >
                {useCase.icon}
                <span className="text-sm font-medium">{useCase.name}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {currentUseCase.description}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-2xl mx-auto px-4">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <img src="/eih.png" alt="Logo" className="w-10 h-10 object-contain" />
              </div>
              <h2 className="text-3xl font-bold text-foreground mb-3">
                How can I help you today?
              </h2>
              <p className="text-muted-foreground mb-8">
                {currentUseCase.description}
              </p>
             
            </div>
          </div>
        ) : (
          <ChatMessages 
            chatId={chatId} 
            initialMessages={messages} 
          />
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="mx-4 mb-2 animate-in slide-in-from-bottom-2">
          <div className="p-3 bg-destructive/10 border border-destructive/50 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-destructive" />
            <p className="text-destructive text-sm flex-1">{error}</p>
            <button onClick={() => setError(null)} className="text-destructive/70 hover:text-destructive">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Attachments */}
      {attachments.length > 0 && (
        <div className="mx-4 mb-2 flex gap-2 flex-wrap">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-lg text-sm"
            >
              <FileText className="w-4 h-4" />
              <span className="max-w-[200px] truncate">{attachment.name}</span>
              <button
                onClick={() => removeAttachment(attachment.id)}
                className="hover:text-destructive transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-border bg-card/50 backdrop-blur-sm p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={currentUseCase.placeholder}
                rows={Math.min(3, input.split('\n').length)}
                className="w-full px-4 py-2 bg-background border border-input rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent resize-none"
                disabled={sending}
              />
            </div>
            
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".txt,.pdf,.doc,.docx,.csv,.xlsx,.json,.md,.jpg,.png"
                onChange={(e) => handleFileUpload(e.target.files)}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={sending || uploading}
                className="p-2 bg-secondary hover:bg-secondary/80 rounded-xl transition-all duration-200 disabled:opacity-50"
                title="Upload file"
              >
                {uploading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Paperclip className="w-5 h-5" />
                )}
              </button>

              {typeof window !== 'undefined' && 'MediaRecorder' in window && (
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`p-2 rounded-xl transition-all duration-200 ${
                    isRecording 
                      ? 'bg-destructive text-destructive-foreground animate-pulse' 
                      : 'bg-secondary hover:bg-secondary/80'
                  }`}
                  title={isRecording ? 'Stop recording' : 'Start voice input'}
                >
                  {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>
              )}

              <button
                onClick={handleSendMessage}
                disabled={sending || (!input.trim() && attachments.length === 0)}
                className="p-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground rounded-xl transition-all duration-200"
              >
                {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </div>
          </div>
          
          <div className="mt-2 text-xs text-muted-foreground flex gap-4">
            <span>✨ {currentUseCase.requiresDocument ? 'Upload a document to get started' : 'Ask anything'}</span>
            <span>🔒 Encrypted & secure</span>
            <span>⚡ Fast responses</span>
          </div>
        </div>
      </div>
    </div>
  )
}