// app/auth/microsoft/callback/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'

export default function MicrosoftCallback() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const errorParam = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    if (errorParam) {
      setStatus('error')
      setError(errorDescription || errorParam)
      
      // Send error to parent window if it exists (popup mode)
      if (window.opener) {
        window.opener.postMessage({
          type: 'OAUTH_CALLBACK',
          error: errorDescription || errorParam
        }, window.location.origin)
        
        // Close popup after 2 seconds
        setTimeout(() => window.close(), 2000)
      } else {
        // Redirect to login page after 2 seconds (direct access)
        setTimeout(() => {
          router.push('/login?error=' + encodeURIComponent(errorDescription || errorParam))
        }, 2000)
      }
      return
    }

    if (code && state) {
      if (window.opener) {
        // Popup mode - send to parent
        window.opener.postMessage({
          type: 'OAUTH_CALLBACK',
          code,
          state
        }, window.location.origin)
        
        setStatus('success')
        setTimeout(() => window.close(), 1000)
      } else {
        // Direct access - redirect to login with error
        setStatus('error')
        setError('No parent window found. Please try logging in again.')
        setTimeout(() => {
          router.push('/login?error=authentication_failed')
        }, 2000)
      }
    } else {
      setStatus('error')
      setError('Missing authentication data. Please try again.')
      setTimeout(() => {
        router.push('/login?error=missing_auth_data')
      }, 2000)
    }
  }, [searchParams, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-primary/5">
      <div className="bg-card rounded-2xl shadow-2xl p-8 border border-border max-w-md w-full text-center">
        {status === 'processing' && (
          <>
            <Loader2 className="w-16 h-16 animate-spin text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">Processing Login</h2>
            <p className="text-muted-foreground">Completing your Microsoft authentication...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">Login Successful!</h2>
            <p className="text-muted-foreground">This window will close automatically...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">Login Failed</h2>
            <p className="text-muted-foreground mb-4">{error || 'Authentication failed'}</p>
            <p className="text-xs text-muted-foreground">Redirecting to login page...</p>
            <button
              onClick={() => {
                if (window.opener) {
                  window.close()
                } else {
                  router.push('/login')
                }
              }}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
            >
              Go to Login
            </button>
          </>
        )}
      </div>
    </div>
  )
}