'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, MessageSquare, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

export default function ChatIndexPage() {
  const router = useRouter()
  const [isCreating, setIsCreating] = useState(false)

  const createNewChat = async () => {
    if (isCreating) return
    
    setIsCreating(true)
    
    try {
      // Generate a UUID for the chat
      const chatId = crypto.randomUUID()
      
      // Create the chat with initial message
      const response = await fetch('/api/chats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId: chatId,
          title: 'New Conversation',
          useCase: 'general'
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create chat')
      }

      // Redirect to the new chat
      router.push(`/chat/${chatId}`)
      toast.success('New conversation started')
      
    } catch (error) {
      console.error('Error creating chat:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create chat')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-background via-background to-primary/5">
      <div className="text-center max-w-2xl mx-auto px-4">
        <div className="inline-flex items-center justify-center ">
           <img src="/eih.png" alt="Logo" className="w-10 h-10 object-contain" />
        </div>
        
        <h1 className="text-4xl font-bold text-foreground mb-4">
          Welcome to EIH AI
        </h1>
        
        <p className="text-lg text-muted-foreground mb-8">
          Your intelligent assistant for summarization, analysis, presentations, and database queries
        </p>
        
        <button
          onClick={createNewChat}
          disabled={isCreating}
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isCreating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <MessageSquare className="w-5 h-5" />
              Start New Conversation
            </>
          )}
        </button>
        
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
          <div className="p-4 bg-card rounded-lg border border-border">
            <h3 className="font-semibold text-foreground mb-2">✨ Smart Summarization</h3>
            <p className="text-sm text-muted-foreground">
              Upload documents and get concise, accurate summaries
            </p>
          </div>
          <div className="p-4 bg-card rounded-lg border border-border">
            <h3 className="font-semibold text-foreground mb-2">📊 Data Analysis</h3>
            <p className="text-sm text-muted-foreground">
              Analyze CSV, Excel files and get actionable insights
            </p>
          </div>
          <div className="p-4 bg-card rounded-lg border border-border">
            <h3 className="font-semibold text-foreground mb-2">📊 Presentation</h3>
            <p className="text-sm text-muted-foreground">
              Create professional presentations from your content
            </p>
          </div>
          <div className="p-4 bg-card rounded-lg border border-border">
            <h3 className="font-semibold text-foreground mb-2">🗄️ Database Query</h3>
            <p className="text-sm text-muted-foreground">
              Natural language queries for your database
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}