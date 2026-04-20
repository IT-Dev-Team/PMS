'use client'

import { useState } from 'react'
import { Database, X, Send, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface WarehouseQueryProps {
  isOpen: boolean
  onClose: () => void
  chatId: string
  onQueryExecuted: (result: any) => void
}

export function WarehouseQuery({
  isOpen,
  onClose,
  chatId,
  onQueryExecuted,
}: WarehouseQueryProps) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const handleExecuteQuery = async () => {
    if (!query.trim()) {
      toast.error('Please enter a query')
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/warehouse/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          chatId,
        }),
      })

      if (!response.ok) throw new Error('Failed to execute query')

      const data = await response.json()
      setResult(data)
      onQueryExecuted(data)
      toast.success(`Query executed! ${data.rowCount} rows returned`)
    } catch (error) {
      console.error('Error executing query:', error)
      toast.error('Failed to execute warehouse query')
    } finally {
      setLoading(false)
    }
  }

  const handleInsertResult = () => {
    if (result) {
      onQueryExecuted(result)
      onClose()
      setQuery('')
      setResult(null)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-3xl max-h-screen overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Data Warehouse Query
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Execute SQL queries against your Snowflake warehouse
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            {/* Query Input */}
            <div>
              <label className="block text-sm font-semibold mb-2">SQL Query</label>
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Example:\nSELECT * FROM sales\nWHERE date >= '2024-01-01'\nLIMIT 100`}
                className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm resize-none font-mono h-32"
              />
            </div>

            {/* Query Tips */}
            <div className="bg-slate-700/50 rounded-lg p-3 text-sm text-slate-300">
              <p className="font-semibold mb-1">Available Tables:</p>
              <p>sales, customers, inventory, products, orders</p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={handleExecuteQuery}
                disabled={!query.trim() || loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Executing...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Execute Query
                  </>
                )}
              </Button>
              <Button onClick={onClose} variant="outline" className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Result Summary */}
            <div className="bg-slate-700 rounded-lg p-3 text-sm">
              <p className="text-slate-300">
                <span className="font-semibold">Execution Time:</span> {result.executionTime}ms •{' '}
                <span className="font-semibold">Rows:</span> {result.rowCount}
              </p>
            </div>

            {/* Results Table */}
            {result.data && result.data.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-700">
                      {Object.keys(result.data[0]).map((key) => (
                        <th
                          key={key}
                          className="px-3 py-2 text-left font-semibold text-slate-300 border border-slate-600"
                        >
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.slice(0, 10).map((row: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-700/50">
                        {Object.values(row).map((value: any, i: number) => (
                          <td
                            key={i}
                            className="px-3 py-2 text-slate-300 border border-slate-600 truncate"
                          >
                            {String(value)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {result.data.length > 10 && (
                  <p className="text-xs text-slate-500 mt-2">
                    Showing 10 of {result.rowCount} rows
                  </p>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={handleInsertResult}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                Insert Result to Chat
              </Button>
              <Button
                onClick={() => {
                  setResult(null)
                  setQuery('')
                }}
                variant="outline"
                className="flex-1"
              >
                New Query
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
