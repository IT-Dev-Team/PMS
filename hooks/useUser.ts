// hooks/useUser.ts
import { useEffect, useState } from 'react'

interface User {
  id: string
  email: string
  name: string
  avatar_url?: string
  created_at: string
  manusProjectId?: string
}

export function useUser() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchUser()
  }, [])

  const fetchUser = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/auth/me')
      
      if (!response.ok) {
        if (response.status === 401) {
          setUser(null)
          return
        }
        throw new Error('Failed to fetch user')
      }
      
      const userData = await response.json()
      setUser(userData)
    } catch (err) {
      console.error('Error fetching user:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return { user, loading, error, refetch: fetchUser }
}