// app/auth/microsoft/callback/page.tsx
'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'

type StatusType = 'processing' | 'success' | 'error'

// Separate component that uses useSearchParams
function CallbackContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<StatusType>('processing')
  const [error, setError] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(3)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [])

  const cleanupAndClose = (delayMs: number = 1000) => {
    timeoutRef.current = setTimeout(() => {
      if (window.opener && !window.opener.closed) {
        window.close()
      } else if (!window.opener) {
        router.push('/login')
      }
    }, delayMs)
  }

  const startCountdown = (seconds: number, onComplete: () => void) => {
    setCountdown(seconds)
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current)
          onComplete()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  useEffect(() => {
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const errorParam = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    // Handle OAuth errors from Microsoft
    if (errorParam) {
      setStatus('error')
      
      let userErrorMessage = 'Authentication failed. Please try again.'
      if (errorParam === 'access_denied') {
        userErrorMessage = 'You denied the authentication request. Please try again if you wish to sign in.'
      } else if (errorParam === 'invalid_request') {
        userErrorMessage = 'Invalid authentication request. Please try again.'
      }
      
      setError(userErrorMessage)
      
      if (window.opener && !window.opener.closed) {
        try {
          window.opener.postMessage({
            type: 'OAUTH_CALLBACK',
            error: errorParam === 'access_denied' ? 'access_denied' : 'authentication_failed'
          }, window.location.origin)
        } catch (err) {
          console.error('Failed to send error to parent:', err)
        }
        
        startCountdown(3, () => cleanupAndClose(0))
      } else {
        startCountdown(3, () => {
          router.push('/login?error=auth_failed')
        })
      }
      return
    }

    // Validate required parameters
    if (!code || !state) {
      setStatus('error')
      setError('Missing authentication information. Please try again.')
      
      if (window.opener && !window.opener.closed) {
        try {
          window.opener.postMessage({
            type: 'OAUTH_CALLBACK',
            error: 'missing_parameters'
          }, window.location.origin)
        } catch (err) {
          console.error('Failed to send error to parent:', err)
        }
        startCountdown(3, () => cleanupAndClose(0))
      } else {
        startCountdown(3, () => {
          router.push('/login?error=missing_auth_data')
        })
      }
      return
    }

    // Validate state has proper format (basic check)
    if (state.length < 32) {
      setStatus('error')
      setError('Invalid state parameter. Possible security issue.')
      
      if (window.opener && !window.opener.closed) {
        try {
          window.opener.postMessage({
            type: 'OAUTH_CALLBACK',
            error: 'invalid_state'
          }, window.location.origin)
        } catch (err) {
          console.error('Failed to send error to parent:', err)
        }
        startCountdown(3, () => cleanupAndClose(0))
      } else {
        startCountdown(3, () => {
          router.push('/login?error=invalid_state')
        })
      }
      return
    }

    // Successful authentication
    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage({
          type: 'OAUTH_CALLBACK',
          code,
          state
        }, window.location.origin)
        
        setStatus('success')
        
        startCountdown(2, () => cleanupAndClose(0))
      } catch (err) {
        console.error('Failed to send auth data to parent:', err)
        setStatus('error')
        setError('Failed to communicate with the main window. Please try again.')
        startCountdown(3, () => {
          if (window.opener) {
            window.close()
          } else {
            router.push('/login')
          }
        })
      }
    } else {
      setStatus('error')
      setError('This authentication window was opened incorrectly. Please return to the main page and try again.')
      
      startCountdown(5, () => {
        router.push('/login?error=no_parent_window')
      })
    }
  }, [searchParams, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-primary/5">
      <div className="bg-card rounded-2xl shadow-2xl p-8 border border-border max-w-md w-full text-center">
        {status === 'processing' && (
          <>
            <div className="relative w-16 h-16 mx-auto mb-4">
              <div className="absolute inset-0 rounded-full border-4 border-primary/20"></div>
              <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Completing Sign In</h2>
            <p className="text-muted-foreground">
              Verifying your Microsoft account...
            </p>
            <p className="text-xs text-muted-foreground mt-4">
              Please wait while we securely authenticate you
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 mx-auto mb-4 relative">
              <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping"></div>
              <CheckCircle className="w-16 h-16 text-green-500 relative z-10" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">
              Welcome Back!
            </h2>
            <p className="text-muted-foreground mb-2">
              You have been successfully authenticated
            </p>
            <p className="text-sm text-muted-foreground">
              This window will close in {countdown} second{countdown !== 1 ? 's' : ''}...
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 mx-auto mb-4 relative">
              <div className="absolute inset-0 bg-destructive/20 rounded-full animate-pulse"></div>
              <AlertCircle className="w-16 h-16 text-destructive relative z-10" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">
              Authentication Failed
            </h2>
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 mb-4">
              <p className="text-destructive text-sm">{error}</p>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              {window.opener && !window.opener.closed 
                ? 'This window will close automatically...'
                : `Redirecting to login page in ${countdown} seconds...`
              }
            </p>
            <button
              onClick={() => {
                if (timeoutRef.current) clearTimeout(timeoutRef.current)
                if (countdownRef.current) clearInterval(countdownRef.current)
                if (window.opener && !window.opener.closed) {
                  window.close()
                } else {
                  router.push('/login')
                }
              }}
              className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            >
              Return to Login
            </button>
          </>
        )}

        {process.env.NODE_ENV === 'development' && (
          <div className="mt-6 pt-4 border-t border-border text-xs text-muted-foreground">
            <p>🔒 Secure authentication flow active</p>
          </div>
        )}
      </div>
    </div>
  )
}

// Main page component with Suspense boundary
export default function MicrosoftCallback() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-primary/5">
        <div className="bg-card rounded-2xl shadow-2xl p-8 border border-border max-w-md w-full text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-primary/20"></div>
            <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Loading...</h2>
          <p className="text-muted-foreground">Preparing authentication</p>
        </div>
      </div>
    }>
      <CallbackContent />
    </Suspense>
 
)
}