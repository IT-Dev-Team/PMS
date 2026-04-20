'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { 
  Menu, 
  Share2, 
  Download, 
  MoreVertical, 
  Copy, 
  Check, 
  Star, 
  StarOff,
  Archive,
  Trash2,
  Edit2,
  Loader2,
  FileText,
  Users,
  Settings,
  Bell,
  Moon,
  Sun,
  Sparkles
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import useSWR, { useSWRConfig } from 'swr'

interface TopBarProps {
  onToggleSidebar: () => void
  user?: {
    id: string
    email: string
    name?: string
    avatar_url?: string | null
  } | null
  chatTitle?: string
  onChatUpdate?: () => void
}

interface Chat {
  id: string
  title: string
  summarized_title?: string
  is_starred: boolean
  is_archived: boolean
  created_at: string
  updated_at: string
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function TopBar({ onToggleSidebar, user, chatTitle, onChatUpdate }: TopBarProps) {
  const params = useParams()
  const router = useRouter()
  const chatId = params.id as string
  const { mutate } = useSWRConfig()
  
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [shareUrl, setShareUrl] = useState('')
  const [requirePassword, setRequirePassword] = useState(false)
  const [password, setPassword] = useState('')
  const [expiresIn, setExpiresIn] = useState(7)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [renameLoading, setRenameLoading] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [archiveLoading, setArchiveLoading] = useState(false)
  const [starLoading, setStarLoading] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)

  // Fetch chat details
  const { data: chat, mutate: mutateChat } = useSWR<Chat>(
    chatId ? `/api/chats/${chatId}` : undefined,
    fetcher,
    { fallbackData: { id: '', is_starred: false, is_archived: false, title: chatTitle || 'Chat', created_at: '', updated_at: '' } }
  )

  useEffect(() => {
    // Check dark mode preference
    const isDark = document.documentElement.classList.contains('dark')
    setIsDarkMode(isDark)
  }, [])

  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode
    setIsDarkMode(newDarkMode)
    if (newDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('theme', newDarkMode ? 'dark' : 'light')
    toast.success(`${newDarkMode ? 'Dark' : 'Light'} mode enabled`)
  }

  const handleShare = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/chats/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId,
          expiresIn,
          requirePassword,
          password: requirePassword ? password : null,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create share link')
      }

      const data = await response.json()
      setShareUrl(`${window.location.origin}/share/${data.shareId}`)
      toast.success('Share link created successfully!')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create share link')
    } finally {
      setLoading(false)
    }
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Link copied to clipboard!')
  }

  const handleExport = async (format: 'markdown' | 'json' | 'html' | 'pdf') => {
    try {
      toast.loading(`Exporting as ${format.toUpperCase()}...`)
      
      const response = await fetch('/api/export/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, format }),
      })

      if (!response.ok) throw new Error('Failed to export')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const extensions = {
        markdown: 'md',
        json: 'json',
        html: 'html',
        pdf: 'pdf'
      }
      a.download = `chat-export-${new Date().toISOString().slice(0,19)}.${extensions[format]}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      toast.dismiss()
      toast.success('Chat exported successfully!')
    } catch (error) {
      toast.dismiss()
      toast.error('Failed to export chat')
    }
  }

  const handleRename = async () => {
    if (!newTitle.trim()) return
    
    try {
      setRenameLoading(true)
      const response = await fetch(`/api/chats/${chatId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim() }),
      })

      if (!response.ok) throw new Error('Failed to rename chat')

      await mutate(`/api/chats/${chatId}`)
      await mutate('/api/chats')
      await mutate('/api/chats/recent')
      
      toast.success('Chat renamed successfully!')
      setRenameDialogOpen(false)
      onChatUpdate?.()
    } catch (error) {
      toast.error('Failed to rename chat')
    } finally {
      setRenameLoading(false)
    }
  }

  const handleToggleStar = async () => {
    try {
      setStarLoading(true)
      const response = await fetch(`/api/chats/${chatId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_starred: !chat?.is_starred }),
      })

      if (!response.ok) throw new Error('Failed to update star')

      await mutate(`/api/chats/${chatId}`)
      await mutate('/api/chats')
      await mutate('/api/chats/recent')
      
      toast.success(chat?.is_starred ? 'Removed from favorites' : 'Added to favorites')
    } catch (error) {
      toast.error('Failed to update favorite')
    } finally {
      setStarLoading(false)
    }
  }

  const handleToggleArchive = async () => {
    try {
      setArchiveLoading(true)
      const response = await fetch(`/api/chats/${chatId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_archived: !chat?.is_archived }),
      })

      if (!response.ok) throw new Error('Failed to archive chat')

      await mutate(`/api/chats/${chatId}`)
      await mutate('/api/chats')
      await mutate('/api/chats/recent')
      
      toast.success(chat?.is_archived ? 'Chat unarchived' : 'Chat archived')
      
      // Redirect to new chat if current chat is archived
      if (!chat?.is_archived) {
        setTimeout(() => {
          router.push('/chat')
        }, 1500)
      }
    } catch (error) {
      toast.error('Failed to archive chat')
    } finally {
      setArchiveLoading(false)
    }
  }

  const handleDelete = async () => {
    try {
      setDeleteLoading(true)
      const response = await fetch(`/api/chats/${chatId}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete chat')

      await mutate('/api/chats')
      await mutate('/api/chats/recent')
      
      toast.success('Chat deleted successfully')
      setDeleteDialogOpen(false)
      
      // Redirect to new chat
      router.push('/chat')
    } catch (error) {
      toast.error('Failed to delete chat')
    } finally {
      setDeleteLoading(false)
    }
  }

  const getDisplayTitle = () => {
    if (chat?.summarized_title && chat.summarized_title !== chat.title) {
      return chat.summarized_title
    }
    return chat?.title || chatTitle || 'Chat'
  }

  const getUserInitial = () => {
    if (user?.name) return user.name.charAt(0).toUpperCase()
    if (user?.email) return user.email.charAt(0).toUpperCase()
    return 'U'
  }

  return (
    <>
      <div className="flex items-center justify-between bg-card border-b border-border h-16 px-4 sticky top-0 z-10 backdrop-blur-sm bg-card/95">
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            className="p-2 hover:bg-accent rounded-lg transition-all duration-200 hover:scale-105"
            aria-label="Toggle sidebar"
          >
               <img src="/eih.png" alt="Logo" className="w-10 h-10 object-contain" />
          </button>
          
          {/* Chat Title */}
          <div className="hidden md:flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">
              {getDisplayTitle()}
            </h2>
            {chat?.summarized_title && chat.summarized_title !== chat.title && (
              <Sparkles className="w-4 h-4 text-primary animate-pulse" />
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Star Button */}
          <Button
            onClick={handleToggleStar}
            variant="ghost"
            size="sm"
            disabled={starLoading}
            className="text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            {starLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : chat?.is_starred ? (
              <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
            ) : (
              <Star className="w-4 h-4" />
            )}
          </Button>

          {/* User Info */}
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="hidden md:flex items-center gap-2 ml-2 px-2 py-1 rounded-lg hover:bg-accent transition-colors">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                    <span className="text-xs font-medium text-primary-foreground">
                      {getUserInitial()}
                    </span>
                  </div>
                  <span className="text-sm text-foreground truncate max-w-[120px]">
                    {user.name || user.email?.split('@')[0]}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-popover border-border">
                <DropdownMenuLabel className="text-foreground">
                  {user.name || user.email}
                </DropdownMenuLabel>
                <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                  {user.email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-foreground cursor-pointer hover:bg-accent">
                  <Users className="w-4 h-4 mr-2" />
                  Profile Settings
                </DropdownMenuItem>
                <DropdownMenuItem className="text-foreground cursor-pointer hover:bg-accent">
                  <Bell className="w-4 h-4 mr-2" />
                  Notifications
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={toggleDarkMode}
                  className="text-foreground cursor-pointer hover:bg-accent"
                >
                  {isDarkMode ? (
                    <Sun className="w-4 h-4 mr-2" />
                  ) : (
                    <Moon className="w-4 h-4 mr-2" />
                  )}
                  {isDarkMode ? 'Light Mode' : 'Dark Mode'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Share Button */}
          <Button
            onClick={() => setShareDialogOpen(true)}
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            <Share2 className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Share</span>
          </Button>

          {/* Export Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground hover:bg-accent"
              >
                <Download className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Export</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover border-border min-w-[180px]">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Export Format
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleExport('markdown')}
                className="text-foreground cursor-pointer hover:bg-accent"
              >
                <FileText className="w-4 h-4 mr-2" />
                Markdown (.md)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleExport('json')}
                className="text-foreground cursor-pointer hover:bg-accent"
              >
                <FileText className="w-4 h-4 mr-2" />
                JSON (.json)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleExport('html')}
                className="text-foreground cursor-pointer hover:bg-accent"
              >
                <FileText className="w-4 h-4 mr-2" />
                HTML (.html)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleExport('pdf')}
                className="text-foreground cursor-pointer hover:bg-accent"
              >
                <FileText className="w-4 h-4 mr-2" />
                PDF (.pdf)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* More Options Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground hover:bg-accent"
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover border-border min-w-[200px]">
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onClick={() => {
                    setNewTitle(chat?.title || '')
                    setRenameDialogOpen(true)
                  }}
                  className="text-foreground cursor-pointer hover:bg-accent"
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  Rename Chat
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleToggleArchive}
                  disabled={archiveLoading}
                  className="text-foreground cursor-pointer hover:bg-accent"
                >
                  {archiveLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Archive className="w-4 h-4 mr-2" />
                  )}
                  {chat?.is_archived ? 'Unarchive Chat' : 'Archive Chat'}
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setDeleteDialogOpen(true)}
                className="text-destructive cursor-pointer hover:bg-destructive/10"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Chat
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Share Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle>Share Conversation</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Create a secure shareable link to this chat
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!shareUrl ? (
              <>
                <div className="space-y-2">
                  <Label>Link expires in (days)</Label>
                  <select
                    value={expiresIn}
                    onChange={(e) => setExpiresIn(Number(e.target.value))}
                    className="w-full bg-background text-foreground rounded-lg px-3 py-2 border border-input focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value={1}>1 day</option>
                    <option value={7}>7 days</option>
                    <option value={30}>30 days</option>
                    <option value={90}>90 days</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="password-protect">Password protect</Label>
                  <Switch
                    id="password-protect"
                    checked={requirePassword}
                    onCheckedChange={setRequirePassword}
                  />
                </div>

                {requirePassword && (
                  <Input
                    type="password"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-background text-foreground border-input"
                  />
                )}

                <Button
                  onClick={handleShare}
                  disabled={loading || (requirePassword && !password)}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Share Link'
                  )}
                </Button>
              </>
            ) : (
              <div className="space-y-3">
                <div className="bg-muted rounded-lg p-3 break-all">
                  <p className="text-sm text-foreground font-mono">{shareUrl}</p>
                </div>
                <Button
                  onClick={handleCopyLink}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy Link
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => {
                    setShareUrl('')
                    setPassword('')
                    setRequirePassword(false)
                    setExpiresIn(7)
                  }}
                  variant="outline"
                  className="w-full border-border text-foreground hover:bg-accent"
                >
                  Create Another Link
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Chat</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Give your conversation a meaningful name
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Enter new chat name"
            className="bg-background text-foreground border-input"
            autoFocus
            onKeyPress={(e) => e.key === 'Enter' && handleRename()}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRenameDialogOpen(false)}
              className="border-border text-foreground hover:bg-accent"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRename}
              disabled={renameLoading || !newTitle.trim()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {renameLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Save'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Chat</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Are you sure you want to delete this conversation? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="border-border text-foreground hover:bg-accent"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleteLoading}
              variant="destructive"
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}