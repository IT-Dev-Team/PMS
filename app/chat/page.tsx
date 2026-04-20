'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Sparkles, AlertCircle, RefreshCw, ArrowRight } from 'lucide-react'

export default function ChatIndexPage() {
  const router = useRouter()
  const [isCreating, setIsCreating] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [statusMessage, setStatusMessage] = useState('Initializing...')

  useEffect(() => {
    const createNewChat = async () => {
      try {
        // Progress simulation for better UX
        const progressInterval = setInterval(() => {
          setProgress(prev => {
            if (prev >= 90) return prev
            return prev + 10
          })
        }, 200)

        // Step 1: Check authentication
        setStatusMessage('Checking authentication...')
        setProgress(10)
        
        const authRes = await fetch('/api/auth/me')
        
        if (!authRes.ok) {
          clearInterval(progressInterval)
          router.replace('/auth/login?redirect=/chat')
          return
        }
        
        const { user } = await authRes.json()
        
        if (!user) {
          clearInterval(progressInterval)
          router.replace('/auth/login?redirect=/chat')
          return
        }

        // Step 2: Create new chat
        setStatusMessage('Creating new conversation...')
        setProgress(40)
        
        const response = await fetch('/api/chats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'New Chat' }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to create chat')
        }

        // Step 3: Get chat ID and redirect
        setStatusMessage('Setting up your workspace...')
        setProgress(80)
        
        const { id } = await response.json()
        
        clearInterval(progressInterval)
        setProgress(100)
        setStatusMessage('Ready!')
        
        // Small delay to show completion
        setTimeout(() => {
          router.replace(`/chat/${id}`)
        }, 300)
        
      } catch (error) {
        console.error('Error creating chat:', error)
        setError(error instanceof Error ? error.message : 'Failed to create chat')
        setIsCreating(false)
      }
    }

    createNewChat()
  }, [router])

  const handleRetry = () => {
    setError(null)
    setIsCreating(true)
    setProgress(0)
    setStatusMessage('Initializing...')
    
    // Trigger recreation
    window.location.reload()
  }

  const handleGoHome = () => {
    router.push('/')
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
        <div className="text-center max-w-md p-8 animate-in fade-in zoom-in duration-300">
          <div className="relative">
            <div className="absolute inset-0 bg-destructive/20 rounded-full blur-xl animate-pulse" />
            <div className="relative w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6 border border-destructive/20">
              <AlertCircle className="w-10 h-10 text-destructive animate-bounce" />
            </div>
          </div>
          
          <h3 className="text-2xl font-bold text-foreground mb-2">Oops! Something went wrong</h3>
          <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
            {error}
          </p>
          
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleRetry}
              className="group bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2.5 rounded-xl transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl"
            >
              <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
              Try Again
            </button>
            <button
              onClick={handleGoHome}
              className="bg-secondary hover:bg-secondary/80 text-secondary-foreground px-6 py-2.5 rounded-xl transition-all duration-200"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="text-center max-w-md p-8">
        {/* Animated gradient orb */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl animate-pulse" />
          <div className="relative mx-auto w-24 h-24">
            <div className="absolute inset-0 rounded-full bg-gradient-to-t from-primary to-primary/40 animate-spin-slow" />
            <div className="absolute inset-1 rounded-full bg-background flex items-center justify-center">
              <img src="/eih.png" alt="Logo" className="w-10 h-10 object-contain" />
            </div>
          </div>
        </div>

        {/* Status message */}
        <h2 className="text-2xl font-bold text-foreground mb-2 animate-in slide-in-from-bottom-4 duration-300">
          {statusMessage}
        </h2>
        <p className="text-muted-foreground text-sm mb-8 animate-in slide-in-from-bottom-4 duration-300 delay-100">
          Setting up your AI workspace
        </p>

        {/* Progress bar */}
        <div className="w-full bg-secondary rounded-full h-2 mb-4 overflow-hidden">
          <div 
            className="bg-gradient-to-r from-primary to-primary/60 h-full rounded-full transition-all duration-300 ease-out relative"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
          </div>
        </div>

        {/* Progress percentage */}
        <div className="flex justify-between items-center text-xs text-muted-foreground mb-6">
          <span>Initializing</span>
          <span className="font-mono">{progress}%</span>
          <span>Ready</span>
        </div>

        {/* Loading tips carousel */}
        <div className="mt-8 p-4 bg-secondary/30 rounded-xl border border-primary/10">
          <div className="text-xs text-muted-foreground mb-2 flex items-center gap-2 justify-center">
            <Sparkles className="w-3 h-3 text-primary" />
            <span>Did you know?</span>
          </div>
          <p className="text-sm text-foreground/80 animate-pulse">
            {progress < 30 && "You can start a new chat anytime from the sidebar"}
            {progress >= 30 && progress < 70 && "Your conversations are automatically saved"}
            {progress >= 70 && "You'll be redirected to your new chat in a moment"}
          </p>
        </div>

        {/* Loading spinner alternative */}
        <div className="mt-6 flex justify-center">
          <div className="flex gap-1">
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0s' }} />
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.2s' }} />
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.4s' }} />
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </div>
  )
}