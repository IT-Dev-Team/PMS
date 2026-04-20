'use client'

import { useState } from 'react'
import { FileText, X, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import ReactMarkdown from 'react-markdown'

interface Document {
  id: string
  filename: string
  content: string
}

interface DocumentComparisonProps {
  isOpen: boolean
  onClose: () => void
  documents: Document[]
}

export function DocumentComparison({ isOpen, onClose, documents }: DocumentComparisonProps) {
  const [selectedDocs, setSelectedDocs] = useState<string[]>([])
  const [focusAreas, setFocusAreas] = useState<string>('')
  const [comparison, setComparison] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const toggleDocumentSelection = (docId: string) => {
    setSelectedDocs((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    )
  }

  const handleCompare = async () => {
    if (selectedDocs.length < 2) {
      toast.error('Please select at least 2 documents to compare')
      return
    }

    try {
      setLoading(true)
      const docsToCompare = documents.filter((d) => selectedDocs.includes(d.id))

      const response = await fetch('/api/documents/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentIds: selectedDocs,
          documentTexts: docsToCompare.map((d) => d.content),
          focusAreas: focusAreas
            .split(',')
            .map((area) => area.trim())
            .filter((area) => area.length > 0),
        }),
      })

      if (!response.ok) throw new Error('Failed to compare documents')

      const data = await response.json()
      setComparison(data.comparison)
      toast.success('Documents compared!')
    } catch (error) {
      console.error('Error comparing documents:', error)
      toast.error('Failed to compare documents')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl max-h-screen overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Compare Documents</DialogTitle>
          <DialogDescription className="text-slate-400">
            Select multiple documents and focus areas to compare
          </DialogDescription>
        </DialogHeader>

        {!comparison ? (
          <div className="space-y-6">
            {/* Document Selection */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Select Documents ({selectedDocs.length} selected)</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {documents.length === 0 ? (
                  <p className="text-slate-400 text-sm">No documents available</p>
                ) : (
                  documents.map((doc) => (
                    <label
                      key={doc.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-700 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedDocs.includes(doc.id)}
                        onChange={() => toggleDocumentSelection(doc.id)}
                        className="rounded"
                      />
                      <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      <span className="text-sm truncate">{doc.filename}</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            {/* Focus Areas */}
            <div>
              <label className="block text-sm font-semibold mb-2">Focus Areas (optional)</label>
              <textarea
                value={focusAreas}
                onChange={(e) => setFocusAreas(e.target.value)}
                placeholder="E.g., pricing, terms, compliance (comma-separated)"
                className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm resize-none h-24"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={handleCompare}
                disabled={selectedDocs.length < 2 || loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Comparing...
                  </>
                ) : (
                  'Compare Documents'
                )}
              </Button>
              <Button
                onClick={onClose}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Comparison Result */}
            <div className="bg-slate-700 rounded-lg p-4">
              <div className="prose prose-invert max-w-none text-sm">
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="mb-2">{children}</p>,
                    h1: ({ children }) => <h1 className="text-xl font-bold mb-3 mt-4">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-lg font-bold mb-2 mt-3">{children}</h2>,
                    ul: ({ children }) => <ul className="list-disc list-inside mb-2">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-inside mb-2">{children}</ol>,
                    code: ({ children }) => (
                      <code className="bg-slate-600 px-2 py-1 rounded text-sm">{children}</code>
                    ),
                  }}
                >
                  {comparison}
                </ReactMarkdown>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setComparison(null)
                  setSelectedDocs([])
                  setFocusAreas('')
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                Compare Again
              </Button>
              <Button
                onClick={onClose}
                variant="outline"
                className="flex-1"
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
