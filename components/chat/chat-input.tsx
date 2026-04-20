'use client'

import { useState, useRef } from 'react'
import { Send, Paperclip, X, Database, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { WarehouseQuery } from './warehouse-query'
import { DocumentComparison } from './document-comparison'

interface ChatInputProps {
  onSendMessage: (content: string, attachments: File[]) => void
  isLoading: boolean
  chatId?: string
}

const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
]

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

export function ChatInput({ onSendMessage, isLoading, chatId = '' }: ChatInputProps) {
  const [message, setMessage] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])
  const [warehouseQueryOpen, setWarehouseQueryOpen] = useState(false)
  const [comparisonOpen, setComparisonOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = () => {
    if (!message.trim() && attachments.length === 0) return

    onSendMessage(message, attachments)
    setMessage('')
    setAttachments([])

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])

    const validFiles = files.filter((file) => {
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        console.error(`File type not allowed: ${file.type}`)
        return false
      }
      if (file.size > MAX_FILE_SIZE) {
        console.error(`File too large: ${file.name}`)
        return false
      }
      return true
    })

    setAttachments((prev) => [...prev, ...validFiles])

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  const handleWarehouseResult = (result: any) => {
    const resultText = `Data Warehouse Query Result:\n\n${JSON.stringify(result.data, null, 2)}`
    setMessage((prev) => prev + (prev ? '\n\n' : '') + resultText)
  }

  const handleComparisonResult = (result: any) => {
    const comparisonText = `Document Comparison:\n\n${result}`
    setMessage((prev) => prev + (prev ? '\n\n' : '') + comparisonText)
  }

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value)
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
    }
  }

  return (
    <div className="space-y-3">
      {/* Attachments Preview */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-2 bg-slate-700 rounded-lg px-3 py-2 text-sm"
            >
              <Paperclip className="w-4 h-4 text-slate-400" />
              <span className="text-slate-300 max-w-xs truncate">{file.name}</span>
              <button
                onClick={() => removeAttachment(index)}
                className="ml-2 p-0.5 hover:bg-slate-600 rounded transition-colors"
                aria-label="Remove file"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input Area */}
      <div className="flex gap-3 items-end">
        {/* File Input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileChange}
          className="hidden"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
        />

        {/* Toolbar Buttons */}
        <div className="flex gap-1">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white flex-shrink-0"
            aria-label="Attach file"
            title="Attach document"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          <button
            onClick={() => setWarehouseQueryOpen(true)}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white flex-shrink-0"
            aria-label="Query warehouse"
            title="Query data warehouse"
          >
            <Database className="w-5 h-5" />
          </button>

          <button
            onClick={() => setComparisonOpen(true)}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white flex-shrink-0"
            aria-label="Compare documents"
            title="Compare documents"
          >
            <FileText className="w-5 h-5" />
          </button>
        </div>

        {/* Text Input */}
        <textarea
          ref={textareaRef}
          value={message}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask me anything or type a message... (Ctrl+Enter to send)"
          className={cn(
            'flex-1 bg-slate-700 text-white rounded-lg px-4 py-3 resize-none max-h-48',
            'placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600',
            'border border-slate-600'
          )}
          rows={1}
          disabled={isLoading}
        />

        {/* Send Button */}
        <Button
          onClick={handleSend}
          disabled={isLoading || (!message.trim() && attachments.length === 0)}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white flex-shrink-0"
          size="lg"
        >
          <Send className="w-5 h-5" />
        </Button>
      </div>

      {/* Helper Text */}
      <p className="text-xs text-slate-500 text-center">
        Supported formats: PDF, Word, Excel, Text • Max 50MB per file
      </p>

      {/* Modals */}
      <WarehouseQuery
        isOpen={warehouseQueryOpen}
        onClose={() => setWarehouseQueryOpen(false)}
        chatId={chatId}
        onQueryExecuted={handleWarehouseResult}
      />
      <DocumentComparison
        isOpen={comparisonOpen}
        onClose={() => setComparisonOpen(false)}
        documents={attachments.map((f, i) => ({
          id: `attachment-${i}`,
          filename: f.name,
          content: `[Document: ${f.name}]`,
        }))}
      />
    </div>
  )
}
