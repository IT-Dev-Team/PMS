// components/projects/shared.tsx
// Types, formatters and small UI parts shared by ProjectDetail and its modals.
'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'

/* ============================ TYPES ============================ */
export type Tab = 'overview' | 'plan' | 'procurement' | 'reports' | 'issues' | 'financial' | 'governance' | 'documents' | 'risks'
export type ReportReviewStatus = 'PENDING_REVIEW' | 'REVIEWED' | 'NEEDS_REVISION'

export type Issue = {
  id: string; projectId: string; title: string; description: string | null
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
  reportedBy: string; assignedTo?: string | null
  createdAt: string; updatedAt?: string; resolvedAt?: string | null; resolution?: string | null
  needsCeoAttention?: boolean
}
export type PlanningReport = {
  id: string; projectId: string; reportDate: string; summary: string
  blockers: string | null; nextSteps: string | null
  attachmentUrl?: string | null; attachmentName?: string | null; attachmentType?: string | null
  submittedToCEO?: boolean
  reviewStatus?: ReportReviewStatus
  reviewedBy?: string | null; reviewedByName?: string | null; reviewedAt?: string | null; reviewNotes?: string | null
}
export type PlanningData = { projects?: any[]; items: any[]; reports: PlanningReport[]; selectedProjectId?: string | null; selectedProject?: any | null }
export type ProcurementPackage = {
  id: string; title: string; code: string; projectId: string; projectName?: string
  vendorId: string; vendorName?: string; totalContractValue?: number; currency?: string
  contractValue?: number; status: string; totalMilestones?: number; completedMilestones?: number
  overdueMilestones?: number; startDate?: string; endDate?: string
}
export type FinancialCost = {
  id: string; projectId: string; planId: string; planName?: string; amount: number
  period: string; costType: string; description: string | null; vendorName?: string
  poNumber?: string; status: string; currency: string
  referenceNumber?: string | null; vendorId?: string | null; invoiceNumber?: string | null
  exchangeRate?: number
}
export type Decision = {
  id: string; projectId: string; title: string; description?: string | null
  decisionDate?: string; status: 'PROPOSED' | 'APPROVED' | 'REJECTED' | 'DEFERRED' | 'CLOSED'
  category?: string | null; owner?: string | null; dueDate?: string | null
  boardReference?: string | null; attachmentUrl?: string | null; attachmentName?: string | null
}
export type Doc = {
  id: string; name: string; version?: string | null; createdAt: string
  fileUrl?: string | null; type?: string | null; size?: number | null; uploadedBy?: string | null
}
export type Vendor = {
  id: string; name: string; code: string; category?: string; type?: string
  contactName?: string; email?: string; phone?: string; country?: string
  rating?: number; status?: string
}

/* ============================ HELPERS ============================ */
export const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Unable to load data')
  return res.json()
}
/** List endpoints may return [...] or { data | issues | risks | decisions | documents }. */
export const listFetcher = async (url: string) => {
  const j = await fetcher(url)
  return Array.isArray(j) ? j : j?.data ?? j?.issues ?? j?.risks ?? j?.decisions ?? j?.documents ?? []
}
/** Accepts camelCase or snake_case attachment fields so a report's file shows however the API names it. */
export const normalizeReport = (r: any): PlanningReport => ({
  ...r,
  attachmentUrl: r?.attachmentUrl ?? r?.attachment_url ?? r?.fileUrl ?? r?.file_url ?? null,
  attachmentName: r?.attachmentName ?? r?.attachment_name ?? r?.fileName ?? r?.file_name ?? null,
  attachmentType: r?.attachmentType ?? r?.attachment_type ?? r?.mimeType ?? r?.mime_type ?? null,
})
export const safeArray = <T,>(v: any): T[] => (Array.isArray(v) ? v.filter(Boolean) : [])
export const formatCurrency = (v: number | null | undefined, currency = 'USD') =>
  v == null || isNaN(Number(v)) ? '—'
  : new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(v))
export const formatDate = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
export const todayISO = () => new Date().toISOString().slice(0, 10)
export const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error ?? new Error('read failed'))
    r.readAsDataURL(file)
  })

export const statusClass = (v?: string) => {
  const s = String(v || '').toUpperCase()
  if (['COMPLETED', 'RESOLVED', 'CLOSED', 'APPROVED', 'ACTIVE', 'REVIEWED'].includes(s)) return 'bg-eih-success-soft text-eih-success-ink ring-1 ring-eih-success/20'
  if (['BLOCKED', 'CRITICAL', 'OVERDUE', 'REJECTED', 'CANCELLED', 'BLACKLISTED', 'NEEDS_REVISION'].includes(s)) return 'bg-eih-danger-soft text-eih-danger-ink ring-1 ring-eih-danger/20'
  if (['IN_PROGRESS', 'ORDERED', 'RELEASED', 'AWARDED', 'SUBMITTED', 'OPEN', 'IN PROGRESS', 'MITIGATING', 'ANALYZING', 'PROPOSED', 'DEFERRED', 'DRAFT', 'PENDING_REVIEW', 'PENDING'].includes(s))
    return 'bg-eih-warn-soft text-eih-warn-ink ring-1 ring-eih-gold/30'
  return 'bg-eih-cream text-eih-ink ring-1 ring-eih-line'
}

/* ============================ UI PARTS ============================ */
export const field = 'w-full rounded-lg border border-eih-line bg-card px-3 py-2 text-sm text-eih-ink placeholder:text-eih-ink/40 outline-none transition focus:border-eih-gold focus:ring-2 focus:ring-eih-gold/20'
export const label = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-eih-muted'

export const Badge = ({ children }: { children: React.ReactNode }) => (
  <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass(String(children))}`}>{children}</span>
)
export const Progress = ({ value, tone = 'bg-eih-green' }: { value: number; tone?: string }) => (
  <div className="h-2 w-full overflow-hidden rounded-full bg-eih-line/60">
    <div className={`h-full rounded-full transition-all duration-700 ${tone}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
  </div>
)
export const ErrorBanner = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-3 flex items-center gap-2 rounded-lg border border-eih-danger/30 bg-eih-danger-soft p-3 text-sm text-eih-danger-ink">{children}</div>
)

export function ModalShell({
  title, subtitle, onClose, children, footer, wide,
}: {
  title: string; subtitle?: string; onClose: () => void
  children: React.ReactNode; footer?: React.ReactNode; wide?: boolean
}) {
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onEsc)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onEsc); document.body.style.overflow = '' }
  }, [onClose])
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-eih-green-dark/60 p-4 backdrop-blur-sm">
      <div className={`pop-in flex max-h-[92vh] w-full flex-col overflow-hidden rounded-2xl border border-eih-line/70 bg-card shadow-2xl ${wide ? 'max-w-5xl' : 'max-w-2xl'}`}>
        <div className="h-1 w-full bg-gradient-to-r from-eih-green via-eih-gold to-eih-green" />
        <div className="flex items-start justify-between gap-4 border-b border-eih-line/60 p-5">
          <div>
            <h2 className="font-serif text-lg text-eih-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-eih-muted">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-eih-ink/60 transition hover:bg-eih-cream hover:text-eih-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="custom-scrollbar flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-eih-line/60 bg-eih-cream-soft px-5 py-4">{footer}</div>}
      </div>
    </div>
  )
}

export const Metric = ({ label: l, value, sub, tone = 'text-eih-ink', icon: Icon }: { label: string; value: string; sub?: string; tone?: string; icon?: any }) => (
  <div className="group relative overflow-hidden rounded-xl border border-eih-line/70 bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-eih-green/5">
    <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-eih-gold to-eih-gold-light opacity-70" />
    <div className="flex items-start justify-between">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-eih-muted">{l}</p>
        <p className={`mt-1 font-serif text-2xl leading-tight ${tone}`}>{value}</p>
        {sub && <p className="mt-0.5 text-xs text-eih-muted">{sub}</p>}
      </div>
      {Icon && <div className="rounded-lg bg-eih-cream p-2"><Icon className="h-4 w-4 text-eih-ink" /></div>}
    </div>
  </div>
)

export const TableShell = ({ children }: { children: React.ReactNode }) => (
  <div className="overflow-hidden rounded-xl border border-eih-line/70 bg-card">
    <div className="overflow-x-auto">{children}</div>
  </div>
)
export const TH = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <th className={`whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-eih-muted ${right ? 'text-right' : 'text-left'}`}>{children}</th>
)
export const TD = ({ children, right, className = '' }: { children: React.ReactNode; right?: boolean; className?: string }) => (
  <td className={`px-4 py-3 text-sm text-eih-ink ${right ? 'text-right' : ''} ${className}`}>{children}</td>
)
export const EmptyRow = ({ colSpan, icon: Icon, label: l }: { colSpan: number; icon: any; label: string }) => (
  <tr>
    <td colSpan={colSpan} className="p-10 text-center">
      <Icon className="mx-auto mb-3 h-8 w-8 text-eih-gold" />
      <p className="text-sm text-eih-muted">{l}</p>
    </td>
  </tr>
)