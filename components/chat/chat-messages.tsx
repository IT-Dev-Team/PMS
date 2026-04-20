'use client'

import { useState, useEffect } from 'react'
import { MessageCircle, FileText, Download, Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'


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
interface ChatMessagesProps {
  chatId: string
  initialMessages?: Message[]
}

export function ChatMessages({ chatId, initialMessages = [] }: ChatMessagesProps) {
  const [messages, setMessages] = useState<Message[]>(Array.isArray(initialMessages) ? initialMessages : [])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        setLoading(true)
        setError(null)
        
        console.log('Fetching messages for chat:', chatId)
        
        const response = await fetch(`/api/chats/${chatId}/messages`)
        
        console.log('Response status:', response.status)
        
        let data
        try {
          data = await response.json()
          console.log('Received data type:', typeof data)
          console.log('Is array:', Array.isArray(data))
        } catch (e) {
          console.error('Failed to parse JSON:', e)
          data = []
        }
        
        // Ensure data is an array
        let messagesArray: Message[] = []
        if (Array.isArray(data)) {
          messagesArray = data
        } else if (data && typeof data === 'object') {
          // If it's an object, try to extract messages array
          messagesArray = data.messages || data.data || []
          if (!Array.isArray(messagesArray)) {
            messagesArray = []
          }
        }
        
        console.log('Setting messages:', messagesArray.length)
        setMessages(messagesArray)
      } catch (error) {
        console.error('Error fetching messages:', error)
        setError(error instanceof Error ? error.message : 'Failed to load messages')
        setMessages([])
      } finally {
        setLoading(false)
      }
    }

    if (chatId) {
      fetchMessages()
    }
  }, [chatId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-400">Loading messages...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-red-900/20 flex items-center justify-center mx-auto mb-4">
            <MessageCircle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Unable to Load Messages</h2>
          <p className="text-slate-400 max-w-sm mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (!messages || messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <MessageCircle className="w-8 h-8 text-slate-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Start a Conversation</h2>
          <p className="text-slate-400 max-w-sm">
            Upload documents, ask questions, and get AI-powered insights. Your chat history will appear here.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-6">
      {messages.map((message) => {
        const isUser = message.role === 'user'

        return (
          <div
            key={message.id}
            className={cn('flex gap-4', isUser ? 'justify-end' : 'justify-start')}
          >
            {!isUser && (
              <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-white text-sm font-bold">AI</span>
              </div>
            )}

            <div
              className={cn(
                'max-w-2xl rounded-lg p-4',
                isUser
                  ? 'bg-primary text-white'
                  : 'bg-transparent text-primary'
              )}
            >
              <div className="prose prose-invert max-w-none text-sm">
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="mb-2">{children}</p>,
                    ul: ({ children }) => <ul className="list-disc list-inside mb-2">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-inside mb-2">{children}</ol>,
                    code: ({ children }) => (
                      <code className="bg-secondary px-2 py-1 rounded text-sm">{children}</code>
                    ),
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              </div>

              {message.attachments && message.attachments.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-700/50">
                  <p className="text-xs font-semibold mb-2 opacity-75">Attachments:</p>
                  <div className="space-y-2">
                    {message.attachments.map((attachment) => (
                      <a
                        key={attachment.id}
                        href={attachment.url || attachment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs hover:opacity-80 transition-opacity"
                      >
                        <FileText className="w-3 h-3" />
                        <span className="truncate">{attachment.name}</span>
                        <Download className="w-3 h-3 ml-auto" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs opacity-60 mt-2">
                {format(new Date(message.created_at), 'HH:mm')}
              </p>
            </div>

            {isUser && (
              <div className="w-8 h-8 rounded-full bg-primary/700 flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-slate-300 text-sm font-bold">U</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}