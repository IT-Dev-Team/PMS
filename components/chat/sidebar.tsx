'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { 
  ChevronLeft, 
  Plus, 
  MessageSquare, 
  Clock, 
  LogOut, 
  Search, 
  Trash2, 
  Edit2, 
  MoreHorizontal,
  Star,
  StarOff,
  Archive,
  Settings,
  Loader2,
  Sparkles
} from 'lucide-react'
import useSWR, { useSWRConfig } from 'swr'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Chat {
  id: string
  title: string
  summarized_title?: string
  created_at: string
  updated_at: string
  is_starred?: boolean
  is_archived?: boolean
  message_count?: number
}

interface SidebarProps {
  isOpen: boolean
  onToggle: () => void
  onLogout: () => void
  user?: {
    id: string
    email: string
    name?: string
    avatar_url?: string | null
  } | null
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function Sidebar({ isOpen, onToggle, onLogout, user }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { mutate } = useSWRConfig()
  const [searchQuery, setSearchQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [loadingChatId, setLoadingChatId] = useState<string | null>(null)
  const [contextMenuChat, setContextMenuChat] = useState<Chat | null>(null)

  const { data: chats = [], isLoading: chatsLoading } = useSWR('/api/chats', fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  })
  const { data: recentChats = [], isLoading: recentLoading } = useSWR('/api/chats/recent', fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  })

  // Filter chats based on search and archive status
  const filteredChats = (chats || []).filter((chat: Chat) => {
    const matchesSearch = searchQuery === '' || 
      chat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (chat.summarized_title || '').toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesArchive = showArchived ? chat.is_archived : !chat.is_archived
    return matchesSearch && matchesArchive
  })

  const filteredRecentChats = (recentChats || []).filter((chat: Chat) => {
    const matchesSearch = searchQuery === '' || 
      chat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (chat.summarized_title || '').toLowerCase().includes(searchQuery.toLowerCase())
    return matchesSearch && !chat.is_archived
  })

  const handleNewChat = async () => {
    try {
      setLoadingChatId('new')
      const res = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Chat' }),
      })
      const { id } = await res.json()
      await mutate('/api/chats')
      await mutate('/api/chats/recent')
      router.push(`/chat/${id}`)
    } catch (error) {
      console.error('Error creating new chat:', error)
    } finally {
      setLoadingChatId(null)
    }
  }

  const handleDeleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!confirm('Are you sure you want to delete this chat? This action cannot be undone.')) return

    try {
      const response = await fetch(`/api/chats/${chatId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await mutate('/api/chats')
        await mutate('/api/chats/recent')
        
        // If we're on the deleted chat, redirect to new chat
        if (pathname === `/chat/${chatId}`) {
          handleNewChat()
        }
      }
    } catch (error) {
      console.error('Error deleting chat:', error)
    }
  }

  const handleToggleStar = async (chatId: string, isStarred: boolean, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    try {
      const response = await fetch(`/api/chats/${chatId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_starred: !isStarred }),
      })

      if (response.ok) {
        await mutate('/api/chats')
        await mutate('/api/chats/recent')
      }
    } catch (error) {
      console.error('Error toggling star:', error)
    }
  }

  const handleArchiveChat = async (chatId: string, isArchived: boolean, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    try {
      const response = await fetch(`/api/chats/${chatId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_archived: !isArchived }),
      })

      if (response.ok) {
        await mutate('/api/chats')
        await mutate('/api/chats/recent')
      }
    } catch (error) {
      console.error('Error archiving chat:', error)
    }
  }

  const handleRenameChat = async (chatId: string, currentTitle: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    const newTitle = prompt('Enter new chat title:', currentTitle)
    if (!newTitle || newTitle === currentTitle) return

    try {
      const response = await fetch(`/api/chats/${chatId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      })

      if (response.ok) {
        await mutate('/api/chats')
        await mutate('/api/chats/recent')
      }
    } catch (error) {
      console.error('Error renaming chat:', error)
    }
  }

  const getDisplayTitle = (chat: Chat) => {
    // Use summarized title if available, otherwise use regular title
    if (chat.summarized_title && chat.summarized_title !== chat.title) {
      return chat.summarized_title
    }
    // Truncate long titles
    if (chat.title.length > 30) {
      return chat.title.substring(0, 27) + '...'
    }
    return chat.title
  }

  const getTimeAgo = (date: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000)
    
    const intervals = {
      year: 31536000,
      month: 2592000,
      week: 604800,
      day: 86400,
      hour: 3600,
      minute: 60
    }

    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
      const interval = Math.floor(seconds / secondsInUnit)
      if (interval >= 1) {
        return `${interval} ${unit}${interval === 1 ? '' : 's'} ago`
      }
    }
    return 'Just now'
  }

  const getUserName = () => {
    if (user?.name) return user.name
    if (user?.email) return user.email.split('@')[0]
    return 'Guest'
  }

  const getUserInitial = () => {
    if (user?.name) return user.name.charAt(0).toUpperCase()
    if (user?.email) return user.email.charAt(0).toUpperCase()
    return 'G'
  }

  const ChatItem = ({ chat, isRecent = false }: { chat: Chat; isRecent?: boolean }) => {
    const isActive = pathname === `/chat/${chat.id}`
    const displayTitle = getDisplayTitle(chat)
    const hasSummarized = chat.summarized_title && chat.summarized_title !== chat.title

    return (
      <div className="group relative">
        <Link
          href={`/chat/${chat.id}`}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 text-sm group',
            isActive 
              ? 'bg-primary/10 text-primary hover:bg-primary/15' 
              : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent'
          )}
        >
          {isRecent ? (
            <MessageSquare className="w-4 h-4 flex-shrink-0" />
          ) : (
            <Clock className="w-4 h-4 flex-shrink-0" />
          )}
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className="truncate font-medium">
                {displayTitle}
              </span>
              {hasSummarized && (
                <Sparkles className="w-3 h-3 text-primary flex-shrink-0" />
              )}
              {chat.is_starred && (
                <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 flex-shrink-0" />
              )}
            </div>
            {!isRecent && (
              <div className="text-xs text-sidebar-foreground/50 mt-0.5">
                {getTimeAgo(chat.updated_at)}
                {chat.message_count && chat.message_count > 0 && (
                  <span className="ml-2">• {chat.message_count} messages</span>
                )}
              </div>
            )}
          </div>

          {/* Context menu button */}
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setContextMenuChat(contextMenuChat?.id === chat.id ? null : chat)
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-sidebar-accent"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
        </Link>

        {/* Context menu */}
        {contextMenuChat?.id === chat.id && (
          <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-popover rounded-lg shadow-lg border border-border py-1 animate-in fade-in zoom-in-95">
            <button
              onClick={(e) => handleToggleStar(chat.id, chat.is_starred || false, e)}
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent flex items-center gap-2"
            >
              {chat.is_starred ? (
                <>
                  <StarOff className="w-4 h-4" />
                  Unstar
                </>
              ) : (
                <>
                  <Star className="w-4 h-4" />
                  Star
                </>
              )}
            </button>
            <button
              onClick={(e) => handleRenameChat(chat.id, chat.title, e)}
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent flex items-center gap-2"
            >
              <Edit2 className="w-4 h-4" />
              Rename
            </button>
            <button
              onClick={(e) => handleArchiveChat(chat.id, chat.is_archived || false, e)}
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent flex items-center gap-2"
            >
              <Archive className="w-4 h-4" />
              {chat.is_archived ? 'Unarchive' : 'Archive'}
            </button>
            <div className="h-px bg-border my-1" />
            <button
              onClick={(e) => handleDeleteChat(chat.id, e)}
              className="w-full px-3 py-1.5 text-left text-sm text-destructive hover:bg-destructive/10 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        )}
      </div>
    )
  }

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setContextMenuChat(null)
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  return (
    <>
      <div
        className={cn(
          'flex flex-col h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out overflow-hidden z-20',
          isOpen ? 'w-80' : 'w-0'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
          <div className={cn('flex items-center gap-2', !isOpen && 'hidden')}>
            <Sparkles className="w-5 h-5 text-primary" />
            <h1 className="font-bold text-sidebar-foreground text-lg">EIH Chat</h1>
          </div>
          <button
            onClick={onToggle}
            className="p-1 hover:bg-sidebar-accent rounded-lg transition-colors"
            aria-label="Toggle sidebar"
          >
            <ChevronLeft className="w-5 h-5 text-sidebar-foreground/70" />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="p-4">
          <Button
            onClick={handleNewChat}
            disabled={loadingChatId === 'new'}
            className={cn('w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold', !isOpen && 'hidden')}
          >
            {loadingChatId === 'new' ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            New Chat
          </Button>
        </div>

        {/* Search Bar */}
        {isOpen && (
          <div className="px-4 pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        )}

        {/* Archive Toggle */}
        {isOpen && (
          <div className="px-4 pb-2">
            <button
              onClick={() => setShowArchived(!showArchived)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              <Archive className="w-3 h-3" />
              {showArchived ? 'Hide Archived' : 'Show Archived'}
            </button>
          </div>
        )}

        {/* Divider */}
        <div className="px-4">
          <div className="h-px bg-sidebar-border"></div>
        </div>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto">
          {/* Recent Chats */}
          {!showArchived && filteredRecentChats.length > 0 && (
            <div className="p-4">
              <h3 className={cn('text-xs font-semibold text-sidebar-foreground/70 uppercase tracking-wider mb-3', !isOpen && 'hidden')}>
                Recent
              </h3>
              <div className="space-y-1">
                {filteredRecentChats.slice(0, 5).map((chat: Chat) => (
                  <ChatItem key={chat.id} chat={chat} isRecent={true} />
                ))}
              </div>
            </div>
          )}

          {/* All Chats */}
          {filteredChats.length > 0 && (
            <div className="p-4">
              <h3 className={cn('text-xs font-semibold text-sidebar-foreground/70 uppercase tracking-wider mb-3', !isOpen && 'hidden')}>
                {showArchived ? 'Archived Chats' : 'All Chats'}
              </h3>
              <div className="space-y-2 max-h-[calc(100vh-400px)] overflow-y-auto">
                {(showArchived ? filteredChats : filteredChats.slice(5)).map((chat: Chat) => (
                  <ChatItem key={chat.id} chat={chat} isRecent={false} />
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {filteredChats.length === 0 && !chatsLoading && (
            <div className="p-8 text-center">
              <MessageSquare className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {searchQuery ? 'No chats found' : 'No chats yet'}
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-primary hover:underline mt-2"
                >
                  Clear search
                </button>
              )}
            </div>
          )}

          {chatsLoading && (
            <div className="p-8 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground mx-auto" />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-sidebar-border space-y-2">
          {user && (
            <div className={cn('flex items-center gap-2 px-3 py-2 rounded-lg bg-sidebar-accent/30', !isOpen && 'hidden')}>
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-medium text-primary-foreground">{getUserInitial()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">{getUserName()}</p>
                <p className="text-xs text-sidebar-foreground/60 truncate">{user.email}</p>
              </div>
              <button
                onClick={() => router.push('/settings')}
                className="p-1 hover:bg-sidebar-accent rounded transition-colors"
              >
                <Settings className="w-4 h-4 text-sidebar-foreground/60" />
              </button>
            </div>
          )}
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-sidebar-accent transition-colors text-sidebar-foreground/70 hover:text-sidebar-foreground text-sm group"
          >
            <LogOut className="w-4 h-4 group-hover:text-destructive transition-colors" />
            <span className={cn('', !isOpen && 'hidden')}>Logout</span>
          </button>
        </div>
      </div>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-10 lg:hidden"
          onClick={onToggle}
        />
      )}
    </>
  )
}