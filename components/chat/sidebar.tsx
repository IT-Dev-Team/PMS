// components/chat/sidebar.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Plus, Search, Trash2, MoreHorizontal, Edit2, Loader2, X,
  ChevronDown, ChevronRight, BarChart2, FileText, Presentation,
  FileSearch, TrendingUp, Users, ShieldCheck, Globe, Building2,
  ClipboardList, Sparkles, PieChart, Target, Briefcase, Layers,
  MessageSquare,
} from 'lucide-react'
import { toast } from 'sonner'

// ──────────────────────────────────────────────────────────────────────────────
// Logo Component
// ──────────────────────────────────────────────────────────────────────────────

function ManusLogo({ size = 20 }: { size?: number }) {
  return (
     <img src="/eih.png" alt="Logo" className="w-10 h-10 object-contain" />
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Task Templates Configuration
// ──────────────────────────────────────────────────────────────────────────────

const TASK_CATEGORIES = [
  {
    label: 'Strategy & Planning',
    icon: Target,
    tasks: [
      { icon: ClipboardList, label: 'Annual Plan Review', prompt: 'Review and analyze our annual plan, identify gaps, risks, and recommendations for: ' },
      { icon: TrendingUp, label: 'KPI Dashboard Slide', prompt: 'Create a KPI dashboard presentation with charts and analysis for: ' },
      { icon: BarChart2, label: 'Subsidiary Performance', prompt: 'Analyze subsidiary performance including financials, KPIs, and strategic alignment for: ' },
      { icon: PieChart, label: 'Budget Analysis', prompt: 'Prepare a detailed budget analysis with variance report and recommendations for: ' },
    ],
  },
  {
    label: 'Reporting',
    icon: Briefcase,
    tasks: [
      { icon: Presentation, label: 'Board Report', prompt: 'Prepare a comprehensive board of directors report covering financials, strategy, and outlook for: ' },
      { icon: Users, label: 'CEO Report', prompt: 'Prepare an executive summary report for the CEO covering key metrics, risks, and decisions needed for: ' },
      { icon: FileText, label: 'Shareholder Update', prompt: 'Create a shareholder update report with financial highlights and strategic progress for: ' },
      { icon: Layers, label: 'Management Report', prompt: 'Generate a management report with operational performance and recommendations for: ' },
    ],
  },
  {
    label: 'Compliance & Research',
    icon: ShieldCheck,
    tasks: [
      { icon: ShieldCheck, label: 'KYC Review', prompt: 'Conduct a KYC due diligence review and compliance check for: ' },
      { icon: Globe, label: 'Fact Checking', prompt: 'Perform thorough fact-checking and source verification for: ' },
      { icon: Building2, label: 'Company Due Diligence', prompt: 'Conduct comprehensive due diligence including financial, legal, and operational review of: ' },
      { icon: FileSearch, label: 'Market Research', prompt: 'Research and analyze market size, trends, competitors, and opportunities for: ' },
    ],
  },
  {
    label: 'Documents',
    icon: FileText,
    tasks: [
      { icon: FileText, label: 'Summarize Document', prompt: 'Summarize the following document highlighting key points, decisions, and action items: ' },
      { icon: Sparkles, label: 'Generate Report', prompt: 'Generate a professional report with analysis, insights, and recommendations about: ' },
      { icon: BarChart2, label: 'Data Analysis', prompt: 'Perform a detailed data analysis with visualizations and insights on: ' },
      { icon: Presentation, label: 'Slide Presentation', prompt: 'Create a professional slide presentation with charts and visuals about: ' },
    ],
  },
]

// ──────────────────────────────────────────────────────────────────────────────
// Type Definitions
// ──────────────────────────────────────────────────────────────────────────────

interface Chat {
  id: string
  title: string
  summarized_title?: string
  is_archived?: boolean
  created_at: string
  updated_at: string
}

interface SidebarProps {
  isOpen: boolean
  onToggle: () => void
}

// ──────────────────────────────────────────────────────────────────────────────
// Date Formatting Helpers
// ──────────────────────────────────────────────────────────────────────────────

function getDateLabel(date: Date): string {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.floor((today.getTime() - targetDate.getTime()) / 86400000)

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return 'Previous 7 Days'
  if (diffDays < 30) return 'This Month'
  return 'Older'
}

function groupChatsByDate(chats: Chat[]): [string, Chat[]][] {
  const groups = new Map<string, Chat[]>()
  const order = ['Today', 'Yesterday', 'Previous 7 Days', 'This Month', 'Older']
  
  chats.forEach(chat => {
    const label = getDateLabel(new Date(chat.updated_at))
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label)!.push(chat)
  })
  
  return order.filter(label => groups.has(label)).map(label => [label, groups.get(label)!])
}

// ──────────────────────────────────────────────────────────────────────────────
// Chat Item Component
// ──────────────────────────────────────────────────────────────────────────────

function ChatItem({
  chat,
  isActive,
  expanded,
  onRename,
  onDelete,
}: {
  chat: Chat
  isActive: boolean
  expanded: boolean
  onRename: (chat: Chat) => void
  onDelete: (id: string) => void
}) {
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    if (showMenu) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMenu])

  const displayTitle = chat.summarized_title || chat.title

  return (
    <div className="relative group">
      <Link
        href={`/chat/${chat.id}`}
        className={`
          flex items-center gap-2.5 px-3 py-2 mx-1 rounded-lg transition-all duration-150
          ${isActive
            ? 'bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400'
            : 'hover:bg-gray-100 dark:hover:bg-gray-800/60 text-gray-700 dark:text-gray-300'
          }
        `}
      >
        <MessageSquare className="w-4 h-4 flex-shrink-0 opacity-70" />
        {expanded && <span className="text-sm truncate flex-1">{displayTitle}</span>}
      </Link>

      {expanded && (
        <div ref={menuRef} className="absolute right-2 top-1/2 -translate-y-1/2">
          <button
            onClick={(e) => {
              e.preventDefault()
              setShowMenu(!showMenu)
            }}
            className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
          >
            <MoreHorizontal className="w-3.5 h-3.5 text-gray-500" />
          </button>
          
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 z-50 w-36 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-1 overflow-hidden">
              <button
                onClick={() => {
                  onRename(chat)
                  setShowMenu(false)
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Rename
              </button>
              <button
                onClick={() => {
                  onDelete(chat.id)
                  setShowMenu(false)
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Task Panel Component
// ──────────────────────────────────────────────────────────────────────────────

function TaskPanel() {
  const [search, setSearch] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(TASK_CATEGORIES.map(category => category.label))
  )
  const router = useRouter()

  const filteredCategories = TASK_CATEGORIES
    .map(category => ({
      ...category,
      tasks: category.tasks.filter(task =>
        task.label.toLowerCase().includes(search.toLowerCase())
      )
    }))
    .filter(category => category.tasks.length > 0)

  const toggleCategory = (label: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(label)) {
      newExpanded.delete(label)
    } else {
      newExpanded.add(label)
    }
    setExpandedCategories(newExpanded)
  }

  const createChatWithPrompt = async (prompt: string) => {
    try {
      const chatId = crypto.randomUUID()
      const response = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId,
          title: 'New Conversation',
          useCase: 'general'
        }),
      })
      
      if (!response.ok) throw new Error()
      router.push(`/chat/${chatId}?prompt=${encodeURIComponent(prompt)}`)
    } catch {
      toast.error('Failed to create conversation')
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Search Input */}
      <div className="px-3 pt-2 pb-2 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks…"
            className="w-full pl-8 pr-7 py-1.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2"
            >
              <X className="w-3 h-3 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>
      </div>

      {/* Task Categories List */}
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {filteredCategories.map((category) => {
          const CategoryIcon = category.icon
          const isExpanded = expandedCategories.has(category.label) || search.length > 0
          
          return (
            <div key={category.label} className="mb-2">
              <button
                onClick={() => toggleCategory(category.label)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <CategoryIcon className="w-4 h-4 text-purple-600 flex-shrink-0" />
                <span className="flex-1 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {category.label}
                </span>
                {!search && (
                  isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                  )
                )}
              </button>
              
              {isExpanded && (
                <div className="ml-6 mt-1 space-y-0.5">
                  {category.tasks.map((task) => {
                    const TaskIcon = task.icon
                    return (
                      <button
                        key={task.label}
                        onClick={() => createChatWithPrompt(task.prompt)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-colors group text-left"
                      >
                        <TaskIcon className="w-3.5 h-3.5 text-gray-400 group-hover:text-purple-600 flex-shrink-0" />
                        <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-purple-700 dark:group-hover:text-purple-400 truncate">
                          {task.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
        
        {filteredCategories.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-8">
            No tasks match "{search}"
          </p>
        )}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Sidebar Navigation Rail Component (Collapsed State)
// ──────────────────────────────────────────────────────────────────────────────

function NavRailItem({
  icon,
  label,
  isActive,
  onClick,
  isOpen,
}: {
  icon: React.ReactNode
  label: string
  isActive?: boolean
  onClick: () => void
  isOpen: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`
        relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-150 group
        ${isActive
          ? 'bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-400'
          : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200'
        }
      `}
    >
      {icon}
      
      {/* Tooltip for collapsed state */}
      {!isOpen && (
        <span className="absolute left-full ml-2 px-2 py-1 text-xs font-medium bg-gray-900 text-white rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity z-50 shadow-lg">
          {label}
        </span>
      )}
    </button>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Main Sidebar Component
// ──────────────────────────────────────────────────────────────────────────────

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()

  // State Management
  const [chats, setChats] = useState<Chat[]>([])
  const [isLoadingChats, setIsLoadingChats] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'chats' | 'tasks'>('chats')
  const [isCreatingChat, setIsCreatingChat] = useState(false)

  // Rename Modal State
  const [chatToRename, setChatToRename] = useState<Chat | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [isRenaming, setIsRenaming] = useState(false)

  // Delete Modal State
  const [chatToDelete, setChatToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // ────────────────────────────────────────────────────────────────────────────
  // Data Fetching
  // ────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchChats()
    const interval = setInterval(fetchChats, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchChats = async () => {
    try {
      const response = await fetch('/api/chats')
      if (response.ok) {
        const data = await response.json()
        setChats(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Failed to fetch chats:', error)
    } finally {
      setIsLoadingChats(false)
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Chat Operations
  // ────────────────────────────────────────────────────────────────────────────

  const filteredChats = chats
    .filter(chat => !chat.is_archived)
    .filter(chat =>
      (chat.summarized_title || chat.title)
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())

  const groupedChats = groupChatsByDate(filteredChats)
  const currentChatId = pathname?.split('/chat/')[1]

  const createNewChat = async () => {
    setIsCreatingChat(true)
    try {
      const chatId = crypto.randomUUID()
      
      setChats(prev => [
        {
          id: chatId,
          title: 'New Conversation',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        ...prev,
      ])
      
      router.push(`/chat/${chatId}`)
      if (window.innerWidth < 768) onToggle()
    } catch {
      toast.error('Failed to create conversation')
    } finally {
      setIsCreatingChat(false)
    }
  }

  const handleRename = async () => {
    if (!chatToRename || !newTitle.trim()) return

    setIsRenaming(true)
    try {
      const response = await fetch(`/api/chats/${chatToRename.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim() }),
      })
      
      if (!response.ok) throw new Error()
      
      setChats(prev =>
        prev.map(chat =>
          chat.id === chatToRename.id
            ? { ...chat, title: newTitle.trim() }
            : chat
        )
      )
      
      toast.success('Conversation renamed')
      setChatToRename(null)
      setNewTitle('')
    } catch {
      toast.error('Failed to rename conversation')
    } finally {
      setIsRenaming(false)
    }
  }

  const handleDelete = async () => {
    if (!chatToDelete) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/chats/${chatToDelete}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) throw new Error()
      
      setChats(prev => prev.filter(chat => chat.id !== chatToDelete))
      toast.success('Conversation deleted')
      setChatToDelete(null)
      
      if (pathname === `/chat/${chatToDelete}`) {
        router.push('/chat')
      }
    } catch {
      toast.error('Failed to delete conversation')
    } finally {
      setIsDeleting(false)
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden transition-opacity duration-300"
          onClick={onToggle}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`
          fixed md:relative z-30 h-full flex
          bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800
          transition-all duration-300 ease-in-out overflow-hidden
          ${isOpen ? 'w-80 shadow-xl md:shadow-none' : 'w-16'}
        `}
      >
        {/* Left Navigation Rail - Always Visible */}
        <div className="flex flex-col items-center w-16 flex-shrink-0 py-3 gap-2 border-r border-gray-100 dark:border-gray-800">
          {/* Logo / Toggle Button */}
          <button
            onClick={onToggle}
            title={isOpen ? 'Collapse' : 'Expand'}
            className="w-10 h-10 rounded-xl flex items-center justify-center mb-2 hover:scale-105 transition-transform shadow-sm"
          >
            <ManusLogo size={18} />
          </button>

          {/* New Chat Button */}
          <NavRailItem
            icon={isCreatingChat ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
            label="New Chat"
            onClick={createNewChat}
            isOpen={isOpen}
          />

          {/* Chats Tab */}
          <NavRailItem
            icon={<MessageSquare className="w-5 h-5" />}
            label="Chats"
            isActive={activeTab === 'chats' && isOpen}
            onClick={() => {
              setActiveTab('chats')
              if (!isOpen) onToggle()
            }}
            isOpen={isOpen}
          />

          {/* Tasks Tab */}
          <NavRailItem
            icon={<ClipboardList className="w-5 h-5" />}
            label="Tasks"
            isActive={activeTab === 'tasks' && isOpen}
            onClick={() => {
              setActiveTab('tasks')
              if (!isOpen) onToggle()
            }}
            isOpen={isOpen}
          />

          {/* Search Button */}
          <NavRailItem
            icon={<Search className="w-5 h-5" />}
            label="Search"
            onClick={() => {
              setActiveTab('chats')
              if (!isOpen) onToggle()
              setTimeout(() => document.getElementById('sidebar-search')?.focus(), 300)
            }}
            isOpen={isOpen}
          />
        </div>

        {/* Expanded Panel Content */}
        {isOpen && (
          <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
            {/* Tab Switcher */}
            <div className="flex gap-1 mx-3 mt-3 mb-2 p-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg flex-shrink-0">
              <button
                onClick={() => setActiveTab('chats')}
                className={`
                  flex-1 flex items-center justify-center gap-1.5 py-1.5 text-sm font-medium rounded-md transition-all
                  ${activeTab === 'chats'
                    ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                    : 'bg-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300'
                  }
                `}
              >
                <MessageSquare className="w-4 h-4" />
                Chats
              </button>

              <button
                onClick={() => setActiveTab('tasks')}
                className={`
                  flex-1 flex items-center justify-center gap-1.5 py-1.5 text-sm font-medium rounded-md transition-all
                  ${activeTab === 'tasks'
                    ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                    : 'bg-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300'
                  }
                `}
              >
                <ClipboardList className="w-4 h-4" />
                Tasks
              </button>
            </div>

            {/* Chats Panel */}
            {activeTab === 'chats' && (
              <div className="flex flex-col flex-1 min-h-0">
                {/* Search Input */}
                <div className="px-3 pb-2 flex-shrink-0">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      id="sidebar-search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search conversations…"
                      className="w-full pl-9 pr-8 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2"
                      >
                        <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Chat List */}
                <div className="flex-1 overflow-y-auto pb-3">
                  {isLoadingChats ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                  ) : groupedChats.length === 0 ? (
                    <div className="text-center py-12 px-4">
                      <MessageSquare className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
                      <p className="text-sm text-gray-500">
                        {searchQuery ? 'No matching conversations' : 'No conversations yet'}
                      </p>
                      {!searchQuery && (
                        <button
                          onClick={createNewChat}
                          className="mt-3 text-sm text-purple-600 hover:text-purple-700 font-medium"
                        >
                          Start a new chat →
                        </button>
                      )}
                    </div>
                  ) : (
                    groupedChats.map(([label, chats]) => (
                      <div key={label} className="mb-4">
                        <div className="px-4 pt-3 pb-1">
                          <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                            {label}
                          </h3>
                        </div>
                        {chats.map(chat => (
                          <ChatItem
                            key={chat.id}
                            chat={chat}
                            isActive={currentChatId === chat.id}
                            expanded={true}
                            onRename={(chat) => {
                              setChatToRename(chat)
                              setNewTitle(chat.title)
                            }}
                            onDelete={(id) => setChatToDelete(id)}
                          />
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Tasks Panel */}
            {activeTab === 'tasks' && <TaskPanel />}

            {/* Footer - New Chat Button */}
            <div className="px-3 py-3 border-t border-gray-100 dark:border-gray-800 flex-shrink-0">
              <button
                onClick={createNewChat}
                disabled={isCreatingChat}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold disabled:cursor-not-allowed shadow-sm transition-colors"
              >
                {isCreatingChat ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                New Chat
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Rename Modal */}
      {chatToRename && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-96 p-5">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              Rename Conversation
            </h3>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename()
                if (e.key === 'Escape') setChatToRename(null)
              }}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleRename}
                disabled={isRenaming || !newTitle.trim()}
                className="flex-1 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 font-medium"
              >
                {isRenaming ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Save'}
              </button>
              <button
                onClick={() => setChatToRename(null)}
                className="flex-1 py-2 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {chatToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-96 p-5">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Delete Conversation?
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              This action cannot be undone. The conversation will be permanently deleted.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 font-medium"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Delete'}
              </button>
              <button
                onClick={() => setChatToDelete(null)}
                className="flex-1 py-2 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}