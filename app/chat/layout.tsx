'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/chat/sidebar'
import { TopBar } from '@/components/chat/top-bar'

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [user, setUser] = useState<any>(null)
  const router = useRouter()

  // Optional: Try to get user but don't redirect
  useEffect(() => {
    const getUser = async () => {
      try {
        const response = await fetch('/api/auth/me', {
          credentials: 'include',
        })

        if (response.ok) {
          const data = await response.json()
          setUser(data.user)
        }
        // Don't redirect - just continue without user
      } catch (error) {
        console.error('Auth check error:', error)
        // Continue without user
      }
    }

    getUser()
  }, [])

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })

      if (response.ok) {
        router.push('/auth/login')
        router.refresh()
      }
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  // Remove loading state or make it very fast
  if (isLoading) {
    return (
      <div className="flex h-screen bg-background items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-primary mb-4">
            <svg
              className="w-6 h-6 text-primary-foreground animate-pulse"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onLogout={handleLogout}
        user={user}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          user={user}
        />
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  )
}