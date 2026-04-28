'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Sparkles, Shield, Zap, ArrowRight, CheckCircle2 } from 'lucide-react'

export default function Home() {
  const router = useRouter()
  const [status, setStatus] = useState<'checking' | 'redirecting' | 'error'>('checking')
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState('Checking authentication...')

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Simulate progress for better UX
        const progressInterval = setInterval(() => {
          setProgress(prev => Math.min(prev + 10, 90))
        }, 100)

        const res = await fetch('/api/auth/me')
        const data = await res.json()

        clearInterval(progressInterval)
        setProgress(100)

        if (data.user) {
          setMessage('Authentication successful! Redirecting to chat...')
          setStatus('redirecting')
          
          // Add a small delay for smooth transition
          setTimeout(() => {
            router.replace('/chat')
          }, 500)
        } else {
          setMessage('Redirecting to login...')
          setStatus('redirecting')
          
          setTimeout(() => {
            router.replace('/auth/login')
          }, 500)
        }
      } catch (error) {
        console.error('Auth check failed:', error)
        setStatus('error')
        setMessage('Connection error. Redirecting...')
        
        setTimeout(() => {
          router.replace('/chat')
        }, 1500)
      }
    }

    checkAuth()
  }, [router])

  if (status === 'error') {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: 'oklch(0.15 0.03 160)' }}>
        <div className="text-center space-y-6 animate-in fade-in zoom-in duration-500">
          <div className="relative">
            <div className="w-20 h-20 mx-auto bg-red-500/10 rounded-full flex items-center justify-center">
              <Shield className="w-10 h-10 text-red-400" />
            </div>
            <div className="absolute inset-0 animate-ping">
              <div className="w-20 h-20 mx-auto bg-red-500/20 rounded-full"></div>
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-white">Connection Issue</h2>
            <p style={{ color: 'oklch(0.8 0.04 160)' }}>{message}</p>
          </div>
          <div className="flex items-center justify-center gap-2 text-sm" style={{ color: 'oklch(0.7 0.04 160)' }}>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Redirecting you safely...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen relative overflow-hidden" style={{ background: 'oklch(0.15 0.03 160)' }}>
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob" style={{ background: 'oklch(0.28 0.04 160)' }}></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000" style={{ background: 'oklch(0.35 0.05 160)' }}></div>
        <div className="absolute top-40 left-1/2 w-80 h-80 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000" style={{ background: 'oklch(0.22 0.03 160)' }}></div>
      </div>

      {/* Main content */}
      <div className="relative z-10 text-center max-w-md mx-auto px-6">
        {/* Logo/Icon with animation */}
        <div className="mb-8 relative">
          <div className="w-24 h-24 mx-auto rounded-2xl flex items-center justify-center shadow-2xl animate-float" style={{ background: 'oklch(0.28 0.04 160)' }}>
              <img src="/eih.png" alt="Logo" className="w-20 h-20 object-contain" />
          </div>
          <div className="absolute inset-0 animate-pulse-slow">
            <div className="w-24 h-24 mx-auto rounded-2xl opacity-50 blur-xl" style={{ background: 'oklch(0.28 0.04 160)' }}></div>
          </div>
        </div>

        {/* Welcome text */}
        <div className="space-y-3 mb-8 animate-in slide-in-from-bottom-4 duration-700">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white via-white to-white/80 bg-clip-text text-transparent">
            Welcome to EIH AI
          </h1>
          <p style={{ color: 'oklch(0.7 0.04 160)' }} className="text-sm">
            Your intelligent assistant for complex tasks
          </p>
        </div>

        {/* Progress section */}
        <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-700 delay-150">
          {/* Progress bar */}
          <div className="relative w-full h-2 rounded-full overflow-hidden" style={{ background: 'oklch(0.22 0.03 160)' }}>
            <div 
              className="absolute top-0 left-0 h-full rounded-full transition-all duration-300 ease-out"
              style={{ 
                width: `${progress}%`,
                background: 'oklch(0.28 0.04 160)'
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
            </div>
          </div>

          {/* Status message with icon */}
          <div className="flex items-center justify-center gap-2 text-sm">
            {status === 'checking' && (
              <>
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'oklch(0.28 0.04 160)' }} />
                <span style={{ color: 'oklch(0.8 0.04 160)' }}>{message}</span>
              </>
            )}
            {status === 'redirecting' && (
              <>
                <CheckCircle2 className="w-4 h-4 text-green-400 animate-bounce" />
                <span style={{ color: 'oklch(0.8 0.04 160)' }}>{message}</span>
              </>
            )}
          </div>

          {/* Tips carousel */}
          <div className="mt-8 pt-6 border-t" style={{ borderColor: 'oklch(0.22 0.03 160)' }}>
            <div className="flex items-center justify-center gap-2 text-xs" style={{ color: 'oklch(0.6 0.04 160)' }}>
              <Zap className="w-3 h-3" />
              <span className="animate-pulse">Powered by Advanced AI</span>
              <ArrowRight className="w-3 h-3" />
            </div>
            <p className="text-xs mt-2" style={{ color: 'oklch(0.5 0.04 160)' }}>
              Secure • Fast • Intelligent
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
        }
        
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        
        .animate-blob {
          animation: blob 7s infinite;
        }
        
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
        
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.8; }
        }
        
        .animate-pulse-slow {
          animation: pulse-slow 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}