// app/auth/login/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { 
  Mail, 
  Lock, 
  Sparkles, 
  FileText, 
  Database, 
  TrendingUp,
  Shield,
  ArrowRight,
  Loader2,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle
} from 'lucide-react'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [showPasswordLogin, setShowPasswordLogin] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [popupWindow, setPopupWindow] = useState<Window | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/chat'

  // Check for saved email
  useEffect(() => {
    const savedEmail = localStorage.getItem('remembered_email')
    if (savedEmail) {
      setEmail(savedEmail)
      setRememberMe(true)
    }
  }, [])

  // Handle OAuth callback message
  useEffect(() => {
    const handleOAuthMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      
      const { type, code, error: oauthError, state } = event.data
      
      if (type === 'OAUTH_CALLBACK') {
        if (oauthError) {
          setError(oauthError)
          setLoading(false)
          return
        }
        
        if (code && state) {
          try {
            setLoading(true)
            
            const response = await fetch('/api/auth/microsoft/callback', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ code, state }),
            })
            
            const data = await response.json()
            
            if (!response.ok) {
              throw new Error(data.error || 'Authentication failed')
            }
            
            if (popupWindow && !popupWindow.closed) {
              popupWindow.close()
            }
            
            router.push('/chat')
            router.refresh()
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Authentication failed'
            setError(message)
            setLoading(false)
          }
        }
      }
    }
    
    window.addEventListener('message', handleOAuthMessage)
    return () => window.removeEventListener('message', handleOAuthMessage)
  }, [popupWindow, router])

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!email) return 'Email is required'
    if (!emailRegex.test(email)) return 'Please enter a valid email address'
    return ''
  }

  const validatePassword = (password: string) => {
    if (!password) return 'Password is required'
    if (password.length < 6) return 'Password must be at least 6 characters'
    return ''
  }

  const handleMicrosoftLogin = async () => {
    try {
      setLoading(true)
      setError(null)

      const state = generateRandomString(32)
      localStorage.setItem('oauth_state', state)

      const clientId = process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID
      const redirectUri = `${window.location.origin}/api/auth/callback`
      const scope = 'openid profile email User.Read'

      if (!clientId) {
        throw new Error('Microsoft OAuth client ID not configured')
      }

      const authUrl = new URL(`https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_MICROSOFT_TENANT_ID || "common"}/oauth2/v2.0/authorize`)
      authUrl.searchParams.append('client_id', clientId)
      authUrl.searchParams.append('response_type', 'code')
      authUrl.searchParams.append('redirect_uri', redirectUri)
      authUrl.searchParams.append('scope', scope)
      authUrl.searchParams.append('state', state)

      // Open popup
      const width = 600
      const height = 700
      const left = window.screenX + (window.outerWidth - width) / 2
      const top = window.screenY + (window.outerHeight - height) / 2
      
      const popup = window.open(
        authUrl.toString(),
        'microsoft-login',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
      )
      
      if (!popup) {
        throw new Error('Popup blocked. Please allow popups for this site.')
      }
      
      setPopupWindow(popup)
      
      const popupInterval = setInterval(() => {
        if (popup.closed) {
          clearInterval(popupInterval)
          setLoading(false)
          setPopupWindow(null)
        }
      }, 500)
      
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred'
      setError(message)
      console.error('Login error:', err)
      setLoading(false)
    }
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const emailValidationError = validateEmail(email)
    const passwordValidationError = validatePassword(password)
    
    setEmailError(emailValidationError)
    setPasswordError(passwordValidationError)
    
    if (emailValidationError || passwordValidationError) {
      return
    }

    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Login failed')
      }

      if (rememberMe) {
        localStorage.setItem('remembered_email', email)
      } else {
        localStorage.removeItem('remembered_email')
      }

      router.push(redirect)
      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred'
      setError(message)
      console.error('Login error:', err)
    } finally {
      setLoading(false)
    }
  }

  function generateRandomString(length: number): string {
    const array = new Uint8Array(length)
    crypto.getRandomValues(array)
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md mx-auto">
        <div className="bg-card rounded-2xl shadow-2xl p-8 border border-border animate-in fade-in zoom-in duration-300">
          {/* Logo/Title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center ">
              <img src="/eih.png" alt="Logo" className="w-20 h-20 object-contain" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Sign In</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Access your AI assistant dashboard
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-destructive/10 border border-destructive/50 rounded-lg p-3 mb-6 animate-in slide-in-from-top-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                <p className="text-destructive text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Login Options */}
          <div className="space-y-3 mb-6">
            {/* Microsoft Login Button */}
            <button
              onClick={handleMicrosoftLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-[#2E2E2E] hover:bg-[#3E3E3E] text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 disabled:opacity-50 group"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z" />
              </svg>
              {loading ? 'Signing in...' : 'Continue with Microsoft'}
            </button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-card text-muted-foreground">or</span>
              </div>
            </div>

            {/* Email Login Toggle */}
            {!showPasswordLogin ? (
              <button
                onClick={() => setShowPasswordLogin(true)}
                className="w-full flex items-center justify-center gap-3 bg-secondary hover:bg-secondary/80 text-secondary-foreground font-semibold py-3 px-4 rounded-xl transition-all duration-200"
              >
                <Mail className="w-5 h-5" />
                Sign in with Email
              </button>
            ) : (
              <form onSubmit={handleEmailLogin} className="space-y-4 animate-in slide-in-from-bottom-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="email"
                      id="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value)
                        setEmailError('')
                      }}
                      className={`w-full pl-10 pr-4 py-2.5 bg-background border ${
                        emailError ? 'border-destructive' : 'border-input'
                      } rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all`}
                      placeholder="you@example.com"
                      disabled={loading}
                    />
                  </div>
                  {emailError && (
                    <p className="text-xs text-destructive mt-1">{emailError}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value)
                        setPasswordError('')
                      }}
                      className={`w-full pl-10 pr-12 py-2.5 bg-background border ${
                        passwordError ? 'border-destructive' : 'border-input'
                      } rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all`}
                      placeholder="••••••••"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {passwordError && (
                    <p className="text-xs text-destructive mt-1">{passwordError}</p>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded bg-background border-border text-primary focus:ring-ring"
                    />
                    <span className="text-sm text-muted-foreground">Remember me</span>
                  </label>
                  <Link
                    href="/auth/forgot-password"
                    className="text-sm text-primary hover:text-primary/80 transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-semibold py-3 px-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 group"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Sign In
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowPasswordLogin(false)}
                  className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  ← Back to all sign in options
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}