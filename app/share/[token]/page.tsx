'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Lock, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ChatMessages } from '@/components/chat/chat-messages'

interface SharedChat {
  id: string
  title: string
  requires_password: boolean
}

interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
  created_at: string
  attachments?: Array<{ id: string; filename: string; url: string }>
}

export default function SharedChatPage() {
  const params = useParams()
  const token = params.token as string
  const [chat, setChat] = useState<SharedChat | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [authenticated, setAuthenticated] = useState(false)

  useEffect(() => {
    const loadSharedChat = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/share/${token}`)

        if (!response.ok) {
          if (response.status === 401) {
            setError('This chat requires a password or is not accessible')
            setChat({
              id: '',
              title: 'Protected Chat',
              requires_password: true,
            })
          } else {
            setError('Chat not found or has expired')
          }
          return
        }

        const data = await response.json()
        setChat(data.chat)
        setMessages(data.messages || [])
        setAuthenticated(!data.chat.requires_password)
      } catch (err) {
        console.error('Error loading shared chat:', err)
        setError('Failed to load chat')
      } finally {
        setLoading(false)
      }
    }

    loadSharedChat()
  }, [token])

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch(`/api/share/${token}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (!response.ok) {
        setError('Incorrect password')
        return
      }

      const data = await response.json()
      setMessages(data.messages || [])
      setAuthenticated(true)
      setError(null)
    } catch (err) {
      console.error('Error verifying password:', err)
      setError('Failed to verify password')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading chat...</p>
        </div>
      </div>
    )
  }

  if (error && !chat?.requires_password) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Error</h1>
          <p className="text-slate-400">{error}</p>
        </div>
      </div>
    )
  }

  if (!authenticated) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <div className="w-full max-w-md bg-slate-800 rounded-lg p-8 border border-slate-700">
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 rounded-full bg-blue-600/20 flex items-center justify-center">
              <Lock className="w-6 h-6 text-blue-400" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white text-center mb-2">Protected Chat</h1>
          <p className="text-slate-400 text-center mb-6">This chat is password protected. Please enter the password to view.</p>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-900/20 border border-red-700 rounded-lg p-3">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full bg-slate-700 text-white rounded-lg px-4 py-2 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
              autoFocus
            />
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
              Unlock Chat
            </Button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-slate-900">
      {/* Header */}
      <div className="h-16 px-6 bg-slate-800 border-b border-slate-700 flex items-center">
        <div>
          <h1 className="text-xl font-bold text-white">{chat?.title}</h1>
          <p className="text-sm text-slate-400">Shared chat view</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-slate-400">No messages in this chat yet</p>
          </div>
        ) : (
          <ChatMessages messages={messages} />
        )}
      </div>

      {/* Footer */}
      <div className="h-16 px-6 bg-slate-800 border-t border-slate-700 flex items-center">
        <p className="text-sm text-slate-500">This is a read-only shared view of the chat</p>
      </div>
    </div>
  )
}
