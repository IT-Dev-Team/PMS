// components/projects/ProjectPlan.tsx
// Plan tab for ProjectDetail: 4 fixed phases -> main tasks -> sub tasks, weighted progress,
// cost vs budget and timeline columns, Tree / Gantt / Calendar views, and a Manage Plan modal
// where status changes carry a reason and remarks.
'use client'

import { useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import {
  AlertTriangle, CalendarDays, ChevronDown, ChevronRight, Edit, GanttChart, LayoutList,
  Loader2, Plus, Save, Scale, Search, Trash2, X,
} from 'lucide-react'
import toast from 'react-hot-toast'

/* ============================ TYPES + CONSTANTS ============================ */
export const PHASES = ['Initiation', 'Planning', 'Execution', 'monitoring/Controling' ,  'handover/closing'] as const
export type Status = 'Not started' | 'In progress' | 'Blocked' | 'On hold' | 'Completed'
export type Kind = 'phase' | 'main' | 'sub'
export type Tone = 'ok' | 'late' | 'early' | 'blocked' | 'pending'

export type PlanItem = {
  id: string; projectId: string; parentId: string | null; name: string; isPhase: boolean; kind: Kind
  status: Status; startDate: string; endDate: string; owner: string; budget: number; weight: number
  reasonCode?: string | null; reasonNotes?: string | null; actualStartDate?: string | null; actualEndDate?: string | null
  percent?: number | null            // explicit task completion 0-100, when the API provides one
  children: string[]; level: number
}

const STATUSES: Status[] = ['Not started', 'In progress', 'Blocked', 'On hold', 'Completed']
const REASON_REQUIRED: Status[] = ['Blocked', 'On hold']
const REASON_CODES = [
  { code: 'SC-001', label: 'Supply chain delay' }, { code: 'RES-002', label: 'Resource shortage' },
  { code: 'SCH-003', label: 'Schedule conflict' }, { code: 'REG-004', label: 'Regulatory / permit hold' },
  { code: 'TCH-005', label: 'Technical issue' }, { code: 'OTH-006', label: 'Other' },
]
const KIND_LABEL: Record<Kind, string> = { phase: 'Phase', main: 'Main task', sub: 'Sub task' }

/**
 * Progress counts COMPLETED plan items only. These two switches exist in case you ever want partial credit:
 *  IN_PROGRESS_CREDIT  - % of a task that counts while it is In progress (0 = only Completed counts)
 *  USE_TASK_PERCENT    - use a task's own percentComplete / progress column when the API provides one
 */
export const IN_PROGRESS_CREDIT = 0
export const USE_TASK_PERCENT = false

/* ============================ PURE HELPERS ============================ */
const num = (v: any, d = 0) => { const n = typeof v === 'number' ? v : parseFloat(v); return isNaN(n) ? d : n }
const todayISO = () => new Date().toISOString().slice(0, 10)
const money = (n: number | null | undefined) =>
  n == null || isNaN(Number(n)) ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(n))
const fmtDate = (v?: string | null) => (v ? new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—')

/** Cost in USD. exchangeRate = USD per 1 unit of the cost's currency (USD costs ignore it). */
export const toUsd = (c: any) => {
  const amt = num(c.amount)
  if (String(c.currency || 'USD').toUpperCase() === 'USD') return amt
  const r = num(c.exchangeRate, 1)
  return amt * (r > 0 ? r : 1)
}

export const normalizeStatus = (v: any): Status => {
  const s = String(v || '').trim().toUpperCase().replace(/[\s_-]+/g, ' ')
  if (['COMPLETED', 'COMPLETE', 'DONE', 'FINISHED', 'CLOSED'].includes(s)) return 'Completed'
  if (['IN PROGRESS', 'INPROGRESS', 'ACTIVE', 'STARTED', 'ONGOING', 'WIP', 'EXECUTING'].includes(s)) return 'In progress'
  if (s === 'BLOCKED') return 'Blocked'
  if (['ON HOLD', 'HOLD', 'PAUSED'].includes(s)) return 'On hold'
  return 'Not started'
}

/** Raw API items -> ordered tree. Depth decides the kind: phase > main task > sub task. */
export function buildPlan(rawItems: any[] | undefined | null, projectId: string): PlanItem[] {
  // Accept camelCase or snake_case field names so a differently-shaped API response still builds a plan.
  const pick = (o: any, ...keys: string[]) => { for (const k of keys) if (o?.[k] != null && o[k] !== '') return o[k]; return undefined }
  const raw = (rawItems || [])
    .filter(i => String(pick(i, 'projectId', 'project_id') ?? projectId) === String(projectId))
    .map(i => {
      const w = num(pick(i, 'weight'), 1)
      const pct = pick(i, 'percentComplete', 'percent_complete', 'progress')
      const parent = pick(i, 'parentId', 'parent_id')
      return {
        id: String(i.id), projectId: String(projectId), parentId: parent == null ? null : String(parent),
        name: String(pick(i, 'name', 'title') || ''), isPhase: String(pick(i, 'itemType', 'item_type', 'type') || '').toLowerCase() === 'phase',
        status: normalizeStatus(i.status), startDate: pick(i, 'startDate', 'start_date') || '', endDate: pick(i, 'endDate', 'end_date') || '',
        owner: pick(i, 'owner', 'assignee', 'assigneeName', 'assignee_name') || '',
        budget: num(pick(i, 'budget')), weight: w > 0 ? w : 1,
        reasonCode: pick(i, 'reasonCode', 'reason_code') ?? null, reasonNotes: pick(i, 'reasonNotes', 'reason_notes') ?? null,
        actualStartDate: pick(i, 'actualStartDate', 'actual_start_date') ?? null, actualEndDate: pick(i, 'actualEndDate', 'actual_end_date') ?? null,
        percent: pct == null || isNaN(num(pct, NaN)) ? null : Math.max(0, Math.min(100, num(pct))),
      }
    })
  const ids = new Set(raw.map(r => r.id))
  const byRaw = new Map(raw.map(r => [r.id, r]))
  const kids = new Map<string, string[]>()
  raw.forEach(r => { if (r.parentId && ids.has(r.parentId)) kids.set(r.parentId, [...(kids.get(r.parentId) || []), r.id]) })
  const t = (d: string) => { const x = new Date(d).getTime(); return isNaN(x) ? Number.MAX_SAFE_INTEGER : x }
  const phaseIdx = (n: string) => { const i = PHASES.findIndex(p => p.toLowerCase() === n.trim().toLowerCase()); return i < 0 ? 99 : i }
  const out: PlanItem[] = []
  const visit = (parentId: string | null, level: number) => {
    raw.filter(r => (r.parentId && ids.has(r.parentId) ? r.parentId : null) === parentId)
      .sort((a, b) => (level === 0 ? (a.isPhase === b.isPhase ? phaseIdx(a.name) - phaseIdx(b.name) : a.isPhase ? -1 : 1) : 0) || t(a.startDate) - t(b.startDate))
      .forEach(r => {
        const parent = r.parentId ? byRaw.get(r.parentId) : undefined
        const kind: Kind = r.isPhase ? 'phase' : parent && !parent.isPhase ? 'sub' : 'main'
        out.push({ ...r, kind, children: kids.get(r.id) || [], level })
        visit(r.id, level + 1)
      })
  }
  visit(null, 0)
  return out
}

const wOf = (i: PlanItem) => (i.weight > 0 ? i.weight : 1)
const kidsOf = (i: PlanItem, byId: Map<string, PlanItem>) => i.children.map(id => byId.get(id)).filter(Boolean) as PlanItem[]

/** One task's completion, 0-100: Completed = 100, everything else 0 (see the switches above). */
function leafProgress(item: PlanItem): number {
  if (item.status === 'Completed') return 100
  if (USE_TASK_PERCENT && item.percent != null) return item.percent
  return item.status === 'In progress' ? IN_PROGRESS_CREDIT : 0
}
/** Weighted progress, unrounded: a leaf is 100 when Completed (partial credit while In progress); a parent is the weighted average of its children. */
export function progressRaw(item: PlanItem, byId: Map<string, PlanItem>): number {
  const kids = kidsOf(item, byId)
  if (!kids.length) return leafProgress(item)
  const total = kids.reduce((s, k) => s + wOf(k), 0)
  return kids.reduce((s, k) => s + progressRaw(k, byId) * wOf(k), 0) / total
}
export const progressOf = (item: PlanItem, byId: Map<string, PlanItem>): number => Math.round(progressRaw(item, byId))
export function overallProgress(items: PlanItem[], byId: Map<string, PlanItem>): number {
  const roots = items.filter(i => i.level === 0)
  if (!roots.length) return 0
  const total = roots.reduce((s, r) => s + wOf(r), 0)
  return Math.round(roots.reduce((s, r) => s + progressRaw(r, byId) * wOf(r), 0) / total)
}
/** Where the item SHOULD be today, 0-100: time elapsed per task, rolled up with the same weights as progress. */
export function plannedOf(item: PlanItem, byId: Map<string, PlanItem>, now = Date.now()): number {
  const kids = kidsOf(item, byId)
  if (!kids.length) {
    const s = new Date(item.startDate).getTime(), e = new Date(item.endDate).getTime() + 864e5
    if (isNaN(s) || isNaN(e)) return 0
    return now >= e ? 100 : now <= s ? 0 : ((now - s) / (e - s)) * 100
  }
  const total = kids.reduce((a, k) => a + wOf(k), 0)
  return kids.reduce((a, k) => a + plannedOf(k, byId, now) * wOf(k), 0) / total
}
export function overallPlanned(items: PlanItem[], byId: Map<string, PlanItem>): number {
  const roots = items.filter(i => i.level === 0)
  if (!roots.length) return 0
  const total = roots.reduce((s, r) => s + wOf(r), 0)
  return roots.reduce((s, r) => s + plannedOf(r, byId) * wOf(r), 0) / total
}
/** Weighted average of a per-task fraction (0..1) over a subtree. */
function weightedFrac(item: PlanItem, byId: Map<string, PlanItem>, frac: (t: PlanItem) => number): number {
  const kids = kidsOf(item, byId)
  if (!kids.length) return frac(item)
  const total = kids.reduce((s, k) => s + wOf(k), 0)
  return kids.reduce((s, k) => s + weightedFrac(k, byId, frac) * wOf(k), 0) / total
}
/**
 * Turns a per-task fraction into money. A task with a budget contributes budget x fraction; a parent scales what its
 * children achieved to its own budget; when nothing below has a budget the parent's budget is spread by task weight.
 *   frac = completion  -> earned value (sum of the budgets of COMPLETED plan items)
 *   frac = scheduled   -> planned value to date
 */
function rollValue(item: PlanItem, byId: Map<string, PlanItem>, budget: Map<string, number>, frac: (t: PlanItem) => number): number {
  const B = budget.get(item.id) || 0
  const kids = kidsOf(item, byId)
  if (!kids.length) return B * frac(item)
  const kidsB = kids.reduce((s, k) => s + (budget.get(k.id) || 0), 0)
  if (kidsB > 0) return B * (kids.reduce((s, k) => s + rollValue(k, byId, budget, frac), 0) / kidsB)
  return B * weightedFrac(item, byId, frac)
}
const leavesOf = (item: PlanItem, byId: Map<string, PlanItem>): PlanItem[] =>
  !item.children.length ? [item] : kidsOf(item, byId).flatMap(c => leavesOf(c, byId))

/** Parents never set their own status: it follows the work underneath them. */
export function effectiveStatus(item: PlanItem, byId: Map<string, PlanItem>): Status {
  if (!item.children.length) return item.status
  const ls = leavesOf(item, byId)
  if (ls.every(l => l.status === 'Completed')) return 'Completed'
  if (ls.some(l => l.status === 'Blocked')) return 'Blocked'
  if (ls.some(l => l.status === 'On hold')) return 'On hold'
  if (ls.some(l => l.status === 'In progress' || l.status === 'Completed')) return 'In progress'
  return 'Not started'
}

/** Timeline health: overdue / on track / early / late, from planned end date and status. */
export function getDelay(item: PlanItem, status: Status): { label: string; tone: Tone } {
  if (status === 'Blocked' || status === 'On hold') return { label: status, tone: 'blocked' }
  const end = new Date(item.endDate)
  if (isNaN(end.getTime())) return { label: 'No dates', tone: 'pending' }
  const day = 864e5
  if (status === 'Completed') {
    const actual = item.actualEndDate ? new Date(item.actualEndDate) : end
    const diff = Math.round((actual.getTime() - end.getTime()) / day)
    return diff > 0 ? { label: `${diff}d late`, tone: 'late' } : diff < 0 ? { label: `${-diff}d early`, tone: 'early' } : { label: 'On time', tone: 'ok' }
  }
  // the planned end date counts through its last day
  const late = Math.ceil((Date.now() - (end.getTime() + day)) / day)
  return late > 0 ? { label: `${late}d overdue`, tone: 'late' } : { label: 'On track', tone: 'ok' }
}

/** Actual cost and budget rolled up from sub tasks to main tasks to phases (USD, all logged costs included). */
export function costMaps(items: PlanItem[], byId: Map<string, PlanItem>, costs: any[]) {
  const own = new Map<string, number>()
  costs.forEach(c => { const k = String(c.planId); own.set(k, (own.get(k) || 0) + toUsd(c)) })
  const actual = new Map<string, number>(), budget = new Map<string, number>()
  const calc = (it: PlanItem) => {
    if (actual.has(it.id)) return
    let a = own.get(it.id) || 0, b = 0
    kidsOf(it, byId).forEach(c => { calc(c); a += actual.get(c.id) || 0; b += budget.get(c.id) || 0 })
    actual.set(it.id, a); budget.set(it.id, it.budget > 0 ? it.budget : b)
  }
  items.forEach(calc)
  return { actual, budget }
}
export function costState(budget: number, actual: number): { tone: 'over' | 'near' | 'under' | 'none'; label: string } {
  if (budget <= 0) return { tone: 'none', label: actual > 0 ? 'No budget set' : '—' }
  if (actual > budget) return { tone: 'over', label: `Over by ${money(actual - budget)}` }
  if (actual === 0) return { tone: 'none', label: 'No spend yet' }
  if (actual >= budget * 0.9) return { tone: 'near', label: `Near limit · ${money(budget - actual)} left` }
  return { tone: 'under', label: `Under by ${money(budget - actual)}` }
}

/** Everything ProjectDetail and the CEO dashboard need from the plan, derived in one place (pure). */
export function computePlanModel(planning: any, fallbackItems: any[] | null | undefined, projectId: string, costs: any[]) {
  const src = planning?.items?.length ? planning.items : fallbackItems || []
  const items = buildPlan(src, projectId)
  const byId = new Map(items.map(i => [i.id, i]))
  const leafTasks = items.filter(i => !i.isPhase && !i.children.length)
  const { actual, budget } = costMaps(items, byId, costs)
  const roots = items.filter(i => i.level === 0)
  // PV is the sum of every budgeted plan item. EV is the sum of budgets for completed items.
  // Use leaf items when the plan is hierarchical so parent rollups are not double-counted.
  const valueItems = leafTasks.length ? leafTasks : items.filter(i => !i.isPhase)
  const planBudget = valueItems.reduce((s, item) => s + Math.max(0, item.budget), 0)
  const completedBudget = valueItems.reduce((s, item) => s + (effectiveStatus(item, byId) === 'Completed' ? Math.max(0, item.budget) : 0), 0)
  const hasBudgets = items.length > 0 && planBudget > 0
  const pv = hasBudgets ? planBudget : null
  const ev = hasBudgets ? completedBudget : null
  const pvToDate = hasBudgets ? planBudget : null
  // Actual cost is every logged cost on the project, converted to USD.
  const costsTotal = costs.reduce((s, c) => s + toUsd(c), 0)
  const valid = (d: string) => !isNaN(new Date(d).getTime())
  // Why a figure is zero: counts the page can show when something looks wrong.
  const diag = {
    items: items.length, leaves: leafTasks.length,
    datedLeaves: leafTasks.filter(t => valid(t.startDate) && valid(t.endDate)).length,
    startedLeaves: leafTasks.filter(t => plannedOf(t, byId) > 0).length,
    inProgressLeaves: leafTasks.filter(t => t.status === 'In progress').length,
    completedLeaves: leafTasks.filter(t => t.status === 'Completed').length,
    budgetedItems: items.filter(i => i.budget > 0).length,
  }
  return {
    items, byId, leafTasks, actual, budget, pv, pvToDate, ev, costsTotal, diag,
    progress: items.length ? overallProgress(items, byId) : (null as number | null),
    planned: items.length ? overallPlanned(items, byId) : (null as number | null),
    completedTasks: leafTasks.filter(t => t.status === 'Completed').length,
    overdue: leafTasks.filter(t => t.status !== 'Completed' && getDelay(t, t.status).tone === 'late').length,
    overBudget: items.filter(i => costState(budget.get(i.id) || 0, actual.get(i.id) || 0).tone === 'over' && !i.children.length).length,
    totalBudget: planBudget,
    totalActual: roots.reduce((s, r) => s + (actual.get(r.id) || 0), 0),
  }
}
export function usePlanModel(planning: any, fallbackItems: any[] | null | undefined, projectId: string, costs: any[]) {
  return useMemo(() => computePlanModel(planning, fallbackItems, projectId, costs), [planning, fallbackItems, projectId, costs])
}

/* ============================ SMALL UI ============================ */
const field = 'w-full rounded-lg border border-eih-line bg-card px-3 py-2 text-sm text-eih-ink placeholder:text-eih-ink/40 outline-none transition focus:border-eih-gold focus:ring-2 focus:ring-eih-gold/20 disabled:bg-eih-cream/50'
const lab = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-eih-muted'
const btnGold = 'inline-flex items-center gap-1.5 rounded-lg bg-eih-green px-3 py-2 text-xs font-semibold text-white transition hover:bg-eih-green-light disabled:opacity-60'
const btnLine = 'inline-flex items-center gap-1.5 rounded-lg border border-eih-line bg-card px-3 py-2 text-xs font-semibold text-eih-ink transition hover:bg-eih-cream disabled:opacity-50'

const STATUS_CLS: Record<Status, string> = {
  'Not started': 'bg-eih-cream text-eih-ink ring-eih-line', 'In progress': 'bg-eih-warn-soft text-eih-warn-ink ring-eih-gold/30',
  Blocked: 'bg-eih-danger-soft text-eih-danger-ink ring-eih-danger/20', 'On hold': 'bg-eih-violet-soft text-eih-violet-ink ring-eih-violet/20', Completed: 'bg-eih-success-soft text-eih-success-ink ring-eih-success/20',
}
const TONE_CLS: Record<Tone, string> = {
  ok: 'bg-eih-success-soft text-eih-success-ink', early: 'bg-eih-success-soft text-eih-success-ink', late: 'bg-eih-danger-soft text-eih-danger-ink',
  blocked: 'bg-eih-violet-soft text-eih-violet-ink', pending: 'bg-eih-neutral-soft text-eih-muted',
}
const COST_CLS = { over: 'bg-eih-danger-soft text-eih-danger-ink', near: 'bg-eih-warn-soft text-eih-warn-ink', under: 'bg-eih-success-soft text-eih-success-ink', none: 'bg-eih-neutral-soft text-eih-muted' }
const pctColor = (v: number) => (v >= 70 ? 'bg-eih-success' : v >= 30 ? 'bg-eih-gold-light' : 'bg-eih-danger')

const StatusPill = ({ s }: { s: Status }) => <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${STATUS_CLS[s]}`}>{s}</span>
const Bar = ({ v, color }: { v: number; color?: string }) => (
  <div className="h-2 w-full overflow-hidden rounded-full bg-eih-line/60"><div className={`h-full rounded-full transition-all duration-700 ${color || pctColor(v)}`} style={{ width: `${Math.max(0, Math.min(100, v))}%` }} /></div>
)
const KindBadge = ({ kind }: { kind: Kind }) => (
  <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${kind === 'phase' ? 'bg-eih-green text-eih-on-green' : kind === 'main' ? 'bg-eih-cream text-eih-ink' : 'border border-eih-line bg-card text-eih-muted'}`}>{KIND_LABEL[kind]}</span>
)
const Stat = ({ label, value, sub, tone = '' }: { label: string; value: string; sub?: string; tone?: string }) => (
  <div className="rounded-xl border border-eih-line/70 bg-card p-4">
    <p className="text-[11px] font-semibold uppercase tracking-wide text-eih-muted">{label}</p>
    <p className={`mt-1 font-serif text-2xl leading-tight ${tone || 'text-eih-ink'}`}>{value}</p>
    {sub && <p className="mt-0.5 text-xs text-eih-muted">{sub}</p>}
  </div>
)

function Shell({ title, subtitle, onClose, children, footer, wide }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', esc); document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', esc); document.body.style.overflow = '' }
  }, [onClose])
  return (
    <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }} className="fixed inset-0 z-[60] flex items-center justify-center bg-eih-green-dark/60 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="management-modal-title" className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-2xl border border-eih-line/70 bg-card shadow-2xl ${wide ? 'max-w-6xl' : 'max-w-lg'}`}>
        <div className="h-1 w-full bg-gradient-to-r from-eih-green via-eih-gold to-eih-green" />
        <div className="flex items-start justify-between gap-4 border-b border-eih-line/60 bg-eih-cream-soft/60 p-5">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-eih-gold">Management workspace</p><h2 id="management-modal-title" className="mt-1 font-serif text-lg text-eih-ink">{title}</h2>{subtitle && <p className="mt-1 max-w-2xl text-xs leading-5 text-eih-muted">{subtitle}</p>}</div>
          <button onClick={onClose} aria-label="Close management workspace" className="rounded-lg p-1.5 text-eih-ink/60 transition hover:bg-eih-cream hover:text-eih-ink"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-eih-line/60 bg-eih-cream-soft px-5 py-4">{footer}</div>}
      </div>
    </div>
  )
}

const fetcher = async (u: string) => { const r = await fetch(u); if (!r.ok) throw new Error('Unable to load data'); return r.json() }
async function send(method: string, url: string, body?: any) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'Request failed')
  return json
}

/* ============================ STATUS DIALOG (inline change) ============================ */
function StatusDialog({ item, target, onClose, onConfirm }: { item: PlanItem; target: Status; onClose: () => void; onConfirm: (p: { date: string; reasonCode?: string; remarks?: string }) => Promise<void> }) {
  const [date, setDate] = useState(todayISO())
  const [code, setCode] = useState(REASON_CODES[0].code)
  const [remarks, setRemarks] = useState('')
  const [busy, setBusy] = useState(false)
  const need = REASON_REQUIRED.includes(target)
  const save = async () => {
    if (need && !remarks.trim()) return
    setBusy(true)
    try { await onConfirm({ date, reasonCode: need ? code : undefined, remarks: remarks.trim() || undefined }); onClose() } finally { setBusy(false) }
  }
  return (
    <Shell title={`Mark “${item.name}” as ${target}`} subtitle={`Planned end: ${fmtDate(item.endDate)}`} onClose={onClose}
      footer={<><button onClick={onClose} className={btnLine}>Cancel</button><button onClick={save} disabled={busy || (need && !remarks.trim())} className={btnGold}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Confirm</button></>}>
      <div className="space-y-3">
        <div><label className={lab}>{target === 'Completed' ? 'Actual completion date' : 'Date this happened'}</label><input type="date" className={field} value={date} onChange={e => setDate(e.target.value)} /></div>
        {need && <div><label className={lab}>Reason *</label><select className={field} value={code} onChange={e => setCode(e.target.value)}>{REASON_CODES.map(r => <option key={r.code} value={r.code}>{r.code} · {r.label}</option>)}</select></div>}
        <div><label className={lab}>Remarks {need ? '*' : '(optional)'}</label><textarea rows={3} className={field} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="What is the state of the work and what happens next?" /></div>
        {need && !remarks.trim() && <p className="text-xs text-eih-danger">A short explanation is required for this status.</p>}
      </div>
    </Shell>
  )
}

/* ============================ MANAGE PLAN MODAL ============================ */
type Draft = {
  mode: 'create' | 'edit'; kind: Kind; id: string; phaseName: string; parentId: string; name: string; owner: string
  startDate: string; endDate: string; budget: string; weight: string; status: Status; origStatus: Status
  reasonCode: string; remarks: string; actualDate: string; hasChildren: boolean
}

const isoDate = (v: any): string => {
  if (!v) return ''
  if (typeof v === 'string') {
    const m = v.match(/^\d{4}-\d{2}-\d{2}/)
    if (m) return m[0]
  }
  const d = v instanceof Date ? v : new Date(v)
  if (isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function PlanManager({ project, items, byId, mutate, onClose, startEditId }: {
  project: any; items: PlanItem[]; byId: Map<string, PlanItem>; mutate: () => Promise<any>; onClose: () => void; startEditId?: string
}) {
  const pStart = isoDate(project.startDate)
  const pEnd = isoDate(project.endDate)
  const pBudget = num(project.budget)
  const phaseItem = (name: string) => items.find(i => i.isPhase && i.name.trim().toLowerCase() === name.toLowerCase())
  const mains = items.filter(i => i.kind === 'main')

  const [draft, setDraft] = useState<Draft | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const blank = (kind: Kind, phaseName: string = PHASES[1]): Draft => ({
    mode: 'create', kind, id: '', phaseName, parentId: '', name: '', owner: project.managerName || '', startDate: pStart && pStart > todayISO() ? pStart : todayISO(),
    endDate: todayISO(), budget: '', weight: '1', status: 'Not started', origStatus: 'Not started', reasonCode: REASON_CODES[0].code, remarks: '', actualDate: todayISO(), hasChildren: false,
  })
  const fromItem = (it: PlanItem): Draft => {
    const phase = it.kind === 'phase' ? it : items.find(p => p.isPhase && (p.id === it.parentId || byId.get(it.parentId || '')?.parentId === p.id))
    return {
      mode: 'edit', kind: it.kind, id: it.id, phaseName: phase?.name || PHASES[1], parentId: it.kind === 'sub' ? it.parentId || '' : '', name: it.name, owner: it.owner,
      startDate: isoDate(it.startDate), endDate: isoDate(it.endDate), budget: it.budget ? String(it.budget) : '', weight: String(it.weight),
      status: it.status, origStatus: it.status, reasonCode: it.reasonCode || REASON_CODES[0].code, remarks: '', actualDate: todayISO(), hasChildren: it.children.length > 0,
    }
  }
  const phaseDraft = (name: string): Draft => {
    const ex = phaseItem(name)
    if (ex) return fromItem(ex)
    return { ...blank('phase', name), name, startDate: pStart || todayISO(), endDate: pEnd || todayISO() }
  }
  useEffect(() => { if (startEditId && byId.get(startEditId)) setDraft(fromItem(byId.get(startEditId)!)) }, [startEditId]) // eslint-disable-line

  const set = (k: keyof Draft, v: any) => setDraft(d => (d ? { ...d, [k]: v } : d))

  const validate = (d: Draft) => {
    const e: Record<string, string> = {}
    if (d.kind !== 'phase' && !d.name.trim()) e.name = 'Name is required'
    if (!d.owner.trim()) e.owner = 'Owner is required'
    if (!d.startDate) e.startDate = 'Start date is required'
    if (!d.endDate) e.endDate = 'End date is required'
    if (d.startDate && d.endDate && d.endDate < d.startDate) e.endDate = 'End date must be after the start date'
    if (pStart && d.startDate && d.startDate < pStart) e.startDate = `Cannot start before the project (${fmtDate(pStart)})`
    if (pEnd && d.endDate && d.endDate > pEnd) e.endDate = `Cannot end after the project (${fmtDate(pEnd)})`
    if (!(num(d.weight, 0) > 0)) e.weight = 'Weight must be above 0'
    const b = num(d.budget)
    if (b < 0) e.budget = 'Budget cannot be negative'
    if (d.kind === 'sub' && !d.parentId) e.parentId = 'Choose the main task this belongs to'
    if (b > 0) {
      if (d.kind === 'phase') {
        const others = items.filter(i => i.isPhase && i.id !== d.id).reduce((s, i) => s + i.budget, 0)
        if (pBudget && others + b > pBudget) e.budget = `Phase budgets (${money(others + b)}) exceed the project budget (${money(pBudget)})`
      } else {
        const parent = d.kind === 'sub' ? byId.get(d.parentId) : phaseItem(d.phaseName)
        if (parent && parent.budget > 0) {
          const sib = kidsOf(parent, byId).filter(c => c.id !== d.id).reduce((s, c) => s + c.budget, 0)
          if (sib + b > parent.budget) e.budget = `Exceeds the ${parent.name} budget (${money(parent.budget)})`
        }
      }
    }
    if (d.mode === 'edit' && !d.hasChildren) {
      if (REASON_REQUIRED.includes(d.status) && !d.remarks.trim()) e.remarks = 'A reason is required for Blocked and On hold'
    }
    setErrors(e)
    return !Object.keys(e).length
  }

  const ensurePhase = async (name: string): Promise<string> => {
    const ex = phaseItem(name)
    if (ex) return ex.id
    const res = await send('POST', '/api/planning', { resource: 'item', projectId: project.id, name, owner: project.managerName || '', startDate: pStart || todayISO(), endDate: pEnd || todayISO(), itemType: 'phase', parentId: null, budget: 0, weight: 1 })
    const id = res?.id ?? res?.item?.id ?? res?.data?.id
    if (id) return String(id)
    const fresh: any = await mutate()
    const found = buildPlan(fresh?.items, project.id).find(i => i.isPhase && i.name.toLowerCase() === name.toLowerCase())
    if (!found) throw new Error('The phase could not be created')
    return found.id
  }

  const submit = async () => {
    if (!draft || !validate(draft)) return
    setBusy(true)
    try {
      const fields = { title: draft.name, assignee_id: draft.owner, start_date: draft.startDate, end_date: draft.endDate, budget: num(draft.budget), weight: num(draft.weight, 1) }
      if (draft.mode === 'create') {
        const parentId = draft.kind === 'phase' ? null : draft.kind === 'sub' ? draft.parentId : await ensurePhase(draft.phaseName)
        await send('POST', '/api/planning', {
          resource: 'item', projectId: project.id, name: draft.kind === 'phase' ? draft.phaseName : draft.name, owner: draft.owner, startDate: draft.startDate, endDate: draft.endDate,
          itemType: draft.kind === 'phase' ? 'phase' : 'task', parentId, budget: num(draft.budget), weight: num(draft.weight, 1),
        })
        toast.success(draft.kind === 'phase' ? `${draft.phaseName} set up` : 'Added to the plan')
      } else {
        const body: any = { id: draft.id, ...fields }
        if (draft.kind === 'phase') body.title = draft.name
        const changed = !draft.hasChildren && draft.status !== draft.origStatus
        if (changed) {
          body.status = draft.status; body.statusChangedAt = draft.actualDate
          if (draft.status === 'Completed') body.actualEndDate = draft.actualDate
          if (draft.status === 'In progress') body.actualStartDate = draft.actualDate
          if (REASON_REQUIRED.includes(draft.status)) body.reasonCode = draft.reasonCode
          if (draft.remarks.trim()) body.reasonNotes = draft.remarks.trim()
        } else if (draft.remarks.trim()) body.notes = draft.remarks.trim()
        await send('PATCH', '/api/planning', body)
        toast.success(changed ? `Status changed to ${draft.status}` : 'Plan item updated')
      }
      await mutate(); setDraft(null); setErrors({})
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Save failed') } finally { setBusy(false) }
  }

  const remove = async (it: PlanItem) => {
    if (!confirm(`Delete “${it.name}”${it.children.length ? ' and everything under it' : ''}?`)) return
    try { await send('DELETE', `/api/planning?id=${it.id}`); await mutate(); toast.success('Deleted') } catch (err) { toast.error(err instanceof Error ? err.message : 'Delete failed') }
  }

  const err = (k: string) => errors[k] && <p className="mt-1 text-xs text-eih-danger">{errors[k]}</p>
  const bd = (k: string) => (errors[k] ? 'border-eih-danger' : '')
  const showStatusFields = draft && draft.mode === 'edit'
  const statusChanged = !!draft && !draft.hasChildren && draft.status !== draft.origStatus
  const needReason = !!draft && !draft.hasChildren && REASON_REQUIRED.includes(draft.status)
  const totalW = (list: PlanItem[]) => list.reduce((s, i) => s + wOf(i), 0)
  const roots = items.filter(i => i.level === 0)

  return (
    <Shell wide title="Manage plan" subtitle="Four fixed phases, each with main tasks and sub tasks. Weights decide how much each item counts toward progress." onClose={onClose}
      footer={<>
        <button onClick={() => { setErrors({}); setDraft(blank('main')) }} className={btnGold}><Plus className="h-4 w-4" /> Add main task</button>
        <button onClick={() => { setErrors({}); setDraft(blank('sub')) }} disabled={!mains.length} title={mains.length ? '' : 'Add a main task first'} className={btnLine}><Plus className="h-4 w-4" /> Add sub task</button>
        <button onClick={onClose} className={btnLine}>Done</button>
      </>}>
      <div className="mb-5 grid gap-3 md:grid-cols-4">
        {PHASES.map(name => {
          const it = phaseItem(name)
          const prog = it ? progressOf(it, byId) : 0
          const st = it ? effectiveStatus(it, byId) : 'Not started'
          const share = it && roots.length ? Math.round((wOf(it) / totalW(roots)) * 100) : null
          return (
            <div key={name} className="rounded-xl border border-eih-line/70 bg-eih-cream-soft p-3">
              <div className="flex items-center justify-between"><b className="text-sm text-eih-ink">{name}</b><StatusPill s={st} /></div>
              <div className="mt-2"><Bar v={prog} /></div>
              <div className="mt-1.5 flex items-center justify-between text-xs text-eih-muted">
                <span>{prog}% done</span>
                <span className="inline-flex items-center gap-1"><Scale className="h-3 w-3" />{it ? `${it.weight}${share != null ? ` · ${share}%` : ''}` : 'not set up'}</span>
              </div>
              <button onClick={() => { setErrors({}); setDraft(phaseDraft(name)) }} className="mt-2 text-xs font-semibold text-eih-ink underline">{it ? 'Edit phase' : 'Set up phase'}</button>
            </div>
          )
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="overflow-hidden rounded-xl border border-eih-line/70">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-eih-cream/60 text-[11px] font-semibold uppercase tracking-wider text-eih-muted"><tr><th className="px-3 py-2.5">Item</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5 text-right">Weight</th><th className="px-3 py-2.5 text-right">Budget</th><th className="px-3 py-2.5 text-right">Done</th><th /></tr></thead>
              <tbody className="divide-y divide-eih-line/40">
                {items.map(it => (
                  <tr key={it.id} className={`hover:bg-eih-cream-soft ${draft?.id === it.id ? 'bg-eih-cream/50' : ''}`}>
                    <td className="px-3 py-2" style={{ paddingLeft: 12 + it.level * 18 }}><div className="flex items-center gap-2"><KindBadge kind={it.kind} /><span className="truncate font-medium text-eih-ink">{it.name}</span></div></td>
                    <td className="px-3 py-2"><StatusPill s={effectiveStatus(it, byId)} /></td>
                    <td className="px-3 py-2 text-right tabular-nums">{it.weight}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{money(it.budget)}</td>
                    <td className="px-3 py-2 text-right text-xs font-semibold">{progressOf(it, byId)}%</td>
                    <td className="px-3 py-2"><div className="flex justify-end gap-1">
                      <button onClick={() => { setErrors({}); setDraft(fromItem(it)) }} className="rounded-lg p-1.5 hover:bg-eih-cream" title="Edit"><Edit className="h-3.5 w-3.5 text-eih-ink/60" /></button>
                      {!it.isPhase && <button onClick={() => remove(it)} className="rounded-lg p-1.5 hover:bg-eih-danger-soft" title="Delete"><Trash2 className="h-3.5 w-3.5 text-eih-danger/70" /></button>}
                    </div></td>
                  </tr>
                ))}
                {!items.length && <tr><td colSpan={6} className="p-8 text-center text-sm text-eih-muted">Nothing planned yet. Add a main task under one of the four phases.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="rounded-xl border border-eih-line/70 bg-eih-cream-soft p-4">
          {!draft ? <p className="text-sm text-eih-muted">Choose an item to edit, or add a main task or sub task.</p> : (
            <div className="space-y-3">
              <h3 className="font-serif text-base text-eih-ink">{draft.mode === 'edit' ? 'Edit' : 'New'} {KIND_LABEL[draft.kind].toLowerCase()}{draft.kind === 'phase' ? `: ${draft.phaseName}` : ''}</h3>

              {draft.kind !== 'phase' && (
                <div><label className={lab}>Phase *</label>
                  <select className={field} value={draft.phaseName} disabled={draft.mode === 'edit'} onChange={e => setDraft(d => (d ? { ...d, phaseName: e.target.value, parentId: '' } : d))}>
                    {PHASES.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
              )}
              {draft.kind === 'sub' && (
                <div><label className={lab}>Main task *</label>
                  <select className={`${field} ${bd('parentId')}`} value={draft.parentId} onChange={e => set('parentId', e.target.value)}>
                    <option value="">Select…</option>
                    {mains.filter(m => phaseItem(draft.phaseName)?.id === m.parentId).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>{err('parentId')}
                </div>
              )}
              {draft.kind !== 'phase' && <div><label className={lab}>Name *</label><input className={`${field} ${bd('name')}`} value={draft.name} onChange={e => set('name', e.target.value)} />{err('name')}</div>}
              <div><label className={lab}>Owner *</label><input className={`${field} ${bd('owner')}`} value={draft.owner} onChange={e => set('owner', e.target.value)} />{err('owner')}</div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={lab}>Start *</label><input type="date" className={`${field} ${bd('startDate')}`} value={draft.startDate} onChange={e => set('startDate', e.target.value)} />{err('startDate')}</div>
                <div><label className={lab}>End *</label><input type="date" className={`${field} ${bd('endDate')}`} value={draft.endDate} min={draft.startDate || undefined} onChange={e => set('endDate', e.target.value)} />{err('endDate')}</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={lab}>Budget (USD)</label><input type="number" min="0" className={`${field} ${bd('budget')}`} value={draft.budget} onChange={e => set('budget', e.target.value)} />{err('budget')}</div>
                <div><label className={lab}>Weight</label><input type="number" min="0.1" step="0.1" className={`${field} ${bd('weight')}`} value={draft.weight} onChange={e => set('weight', e.target.value)} />{err('weight')}</div>
              </div>
              <p className="text-[11px] text-eih-muted">Weight is relative to its siblings: a weight of 2 counts twice as much as 1 when progress is rolled up.</p>

              {showStatusFields && (
                <div className="space-y-3 rounded-lg border border-eih-line bg-card p-3">
                  <div><label className={lab}>Status</label>
                    {draft.hasChildren
                      ? <div className="text-sm text-eih-muted"><StatusPill s={draft.status} /> <span className="ml-1">Follows the work underneath it.</span></div>
                      : <select className={field} value={draft.status} onChange={e => set('status', e.target.value as Status)}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select>}
                  </div>
                  {statusChanged && <div><label className={lab}>{draft.status === 'Completed' ? 'Actual completion date' : 'Date of change'}</label><input type="date" className={field} value={draft.actualDate} onChange={e => set('actualDate', e.target.value)} /></div>}
                  {needReason && <div><label className={lab}>Reason *</label><select className={field} value={draft.reasonCode} onChange={e => set('reasonCode', e.target.value)}>{REASON_CODES.map(r => <option key={r.code} value={r.code}>{r.code} · {r.label}</option>)}</select></div>}
                  <div><label className={lab}>Remarks {needReason ? '*' : '(optional)'}</label><textarea rows={3} className={`${field} ${bd('remarks')}`} value={draft.remarks} onChange={e => set('remarks', e.target.value)} placeholder="Add a reason or note for this update" />{err('remarks')}</div>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={submit} disabled={busy} className={`${btnGold} flex-1 justify-center`}>{busy ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : <><Save className="h-4 w-4" />{draft.mode === 'edit' ? 'Update' : draft.kind === 'phase' ? 'Set up phase' : 'Add'}</>}</button>
                <button onClick={() => { setDraft(null); setErrors({}) }} className={btnLine}>Cancel</button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </Shell>
  )
}

/* ============================ GANTT + CALENDAR ============================ */
function Timeline({ rows, byId, gantt }: { rows: PlanItem[]; byId: Map<string, PlanItem>; gantt: boolean }) {
  const valid = rows.filter(r => !isNaN(new Date(r.startDate).getTime()) && !isNaN(new Date(r.endDate).getTime()))
  if (!valid.length) return <p className="p-10 text-center text-sm text-eih-muted">No items with valid dates to draw.</p>
  const lo = Math.min(...valid.map(r => new Date(r.startDate).getTime())) - 864e5
  const hi = Math.max(...valid.map(r => new Date(r.endDate).getTime())) + 864e5
  const span = Math.max(hi - lo, 1)
  const pos = (t: number) => ((t - lo) / span) * 100
  const todayPos = pos(Date.now())
  const barColor = (s: Status, tone: Tone) => (s === 'Completed' ? 'bg-eih-success' : s === 'Blocked' || s === 'On hold' || tone === 'late' ? 'bg-eih-danger' : s === 'In progress' ? 'bg-eih-gold-light' : 'bg-eih-gray')

  return (
    <div className="overflow-x-auto p-4">
      <div className="min-w-[900px] space-y-1.5">
        {valid.map(it => {
          const st = effectiveStatus(it, byId), d = getDelay(it, st), pr = progressOf(it, byId)
          const left = pos(new Date(it.startDate).getTime()), width = Math.max(pos(new Date(it.endDate).getTime()) - left, 1.5)
          return (
            <div key={it.id} className="grid grid-cols-[260px_1fr_96px] items-center gap-3">
              <span className="flex items-center gap-1.5 truncate text-xs" style={{ paddingLeft: it.level * 14 }}>
                <KindBadge kind={it.kind} /><span className={`truncate ${it.kind === 'phase' ? 'font-bold' : 'font-medium'} text-eih-ink`}>{it.name}</span>
              </span>
              <div className="relative h-6 rounded bg-eih-line/40" title={`${it.name} · ${fmtDate(it.startDate)} to ${fmtDate(it.endDate)} · ${pr}%`}>
                {gantt ? (
                  <>
                    <div className={`absolute h-full overflow-hidden rounded ${barColor(st, d.tone)}`} style={{ left: `${left}%`, width: `${width}%` }}>
                      <div className="h-full bg-black/20" style={{ width: `${pr}%` }} />
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-white">{pr}%</span>
                    </div>
                    {todayPos > 0 && todayPos < 100 && <div className="absolute inset-y-0 w-px bg-eih-green" style={{ left: `${todayPos}%` }} />}
                  </>
                ) : (
                  <div className={`flex h-full items-center rounded px-2 text-[10px] font-semibold text-white ${barColor(st, d.tone)}`} style={{ width: `${Math.max(8, pr)}%` }}>{pr}%</div>
                )}
              </div>
              <span className={`inline-flex justify-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${TONE_CLS[d.tone]}`}>{d.label}</span>
            </div>
          )
        })}
        {gantt && <p className="pt-2 text-[11px] text-eih-muted">The dark line marks today. Darker fill inside a bar shows progress.</p>}
      </div>
    </div>
  )
}

/* ============================ PLAN TAB ============================ */
export function ProjectPlan({ project, planningData, fallbackItems, costs, canManage, onStatusChanged }: {
  project: any; planningData?: any; fallbackItems?: any[] | null; costs: any[]; canManage: boolean
  onStatusChanged?: (item: PlanItem, target: Status, remarks?: string) => void
}) {
  const { data, mutate } = useSWR<any>(`/api/planning?projectId=${project.id}`, fetcher, { fallbackData: planningData || undefined, revalidateOnFocus: false })
  const m = usePlanModel(data, fallbackItems, project.id, costs)
  const [view, setView] = useState<'Tree' | 'Gantt' | 'Calendar'>('Tree')
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [manager, setManager] = useState<{ open: boolean; editId?: string }>({ open: false })
  const [prompt, setPrompt] = useState<{ item: PlanItem; target: Status } | null>(null)

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    let list = m.items
    if (needle) {
      const keep = new Set<string>()
      m.items.filter(i => i.name.toLowerCase().includes(needle)).forEach(i => { let c: PlanItem | undefined = i; while (c) { keep.add(c.id); c = c.parentId ? m.byId.get(c.parentId) : undefined } })
      list = m.items.filter(i => keep.has(i.id))
    }
    return list.filter(i => { let p = i.parentId ? m.byId.get(i.parentId) : undefined; while (p) { if (expanded[p.id] === false) return false; p = p.parentId ? m.byId.get(p.parentId) : undefined } return true })
  }, [m.items, m.byId, query, expanded])

  const share = (it: PlanItem) => {
    const sibs = it.parentId && m.byId.get(it.parentId) ? kidsOf(m.byId.get(it.parentId)!, m.byId) : m.items.filter(i => i.level === 0)
    const t = sibs.reduce((s, x) => s + wOf(x), 0)
    return t ? Math.round((wOf(it) / t) * 100) : 0
  }

  const applyStatus = async (it: PlanItem, target: Status, p: { date: string; reasonCode?: string; remarks?: string }) => {
    const body: any = { id: it.id, status: target, statusChangedAt: p.date }
    if (target === 'Completed') body.actualEndDate = p.date
    if (target === 'In progress' && !it.actualStartDate) body.actualStartDate = p.date
    if (p.reasonCode) body.reasonCode = p.reasonCode
    if (p.remarks) body.reasonNotes = p.remarks
    try {
      await send('PATCH', '/api/planning', body); await mutate()
      toast.success(`Marked ${target}`)
      onStatusChanged?.(it, target, p.remarks)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Update failed'); throw e }
  }

  const th = 'whitespace-nowrap px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-eih-muted'
  const overBudget = m.totalBudget > 0 && m.totalActual > m.totalBudget

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div><h2 className="font-serif text-lg text-eih-ink">Plan and schedule</h2><p className="text-sm text-eih-muted">Initiation, Planning, Executing and Closure, with main tasks and sub tasks under each.</p></div>
        <div className="flex flex-wrap items-center gap-2">
          {canManage && <button onClick={() => setManager({ open: true })} className={btnGold}><Plus className="h-4 w-4" /> Manage plan</button>}
          <div className="flex rounded-lg border border-eih-line bg-card p-0.5">
            {([['Tree', LayoutList], ['Gantt', GanttChart], ['Calendar', CalendarDays]] as const).map(([v, Icon]) => (
              <button key={v} onClick={() => setView(v)} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${view === v ? 'bg-eih-green text-eih-on-green' : 'text-eih-muted hover:text-eih-ink'}`}><Icon className="h-3.5 w-3.5" />{v}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Overall progress" value={m.progress == null ? '—' : `${m.progress}%`} sub="weighted by phase and task weight" tone={m.progress == null ? '' : m.progress >= 70 ? 'text-eih-success' : m.progress >= 30 ? 'text-eih-warn-ink' : 'text-eih-danger'} />
        <Stat label="Tasks complete" value={`${m.completedTasks}/${m.leafTasks.length}`} sub="lowest-level tasks" />
        <Stat label="Overdue" value={String(m.overdue)} sub="past planned end, not complete" tone={m.overdue ? 'text-eih-danger' : 'text-eih-success'} />
        <Stat label="Over budget" value={String(m.overBudget)} sub="tasks spending above budget" tone={m.overBudget ? 'text-eih-danger' : 'text-eih-success'} />
        <Stat label="Budget vs actual" value={money(m.totalActual)} sub={`of ${money(m.totalBudget)} planned`} tone={overBudget ? 'text-eih-danger' : ''} />
      </div>

      <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-eih-ink/40" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search plan items…" className={`${field} pl-9`} /></div>

      <div className="overflow-hidden rounded-xl border border-eih-line/70 bg-card">
        {view === 'Tree' ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1480px] text-left text-sm">
              <thead className="bg-eih-cream-soft"><tr>
                <th className={th}>Plan</th><th className={th}>Planned</th><th className={th}>Owner</th><th className={th}>Status</th><th className={th}>Timeline</th>
                <th className={`${th} text-right`}>Budget</th><th className={`${th} text-right`}>Actual cost</th><th className={th}>Cost status</th>
                <th className={`${th} text-right`}>Weight</th><th className={th}>Progress</th>{canManage && <th className={th} />}
              </tr></thead>
              <tbody className="divide-y divide-eih-line/40">
                {visible.map(it => {
                  const st = effectiveStatus(it, m.byId), d = getDelay(it, st), pr = progressOf(it, m.byId)
                  const b = m.budget.get(it.id) || 0, a = m.actual.get(it.id) || 0, cs = costState(b, a)
                  const leaf = !it.children.length && !it.isPhase
                  return (
                    <tr key={it.id} className="transition hover:bg-eih-cream-soft">
                      <td className="px-3 py-3" style={{ paddingLeft: 12 + it.level * 22 }}>
                        <div className="flex items-center gap-2">
                          {it.children.length ? <button onClick={() => setExpanded(p => ({ ...p, [it.id]: p[it.id] === false }))} className="text-eih-ink/50 hover:text-eih-ink">{expanded[it.id] === false ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button> : <span className="w-4" />}
                          <KindBadge kind={it.kind} /><span className={`${it.kind === 'phase' ? 'font-bold' : 'font-semibold'} text-eih-ink`}>{it.name}</span>
                        </div>
                        {it.reasonNotes && (st === 'Blocked' || st === 'On hold') && !it.children.length && <p className="ml-6 mt-1 text-[11px] text-eih-warn-ink">{it.reasonNotes}</p>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-eih-muted">{fmtDate(it.startDate)} → {fmtDate(it.endDate)}</td>
                      <td className="px-3 py-3 text-eih-muted">{it.owner || '—'}</td>
                      <td className="px-3 py-3">
                        {leaf && canManage ? (
                          <select value={it.status} onChange={e => e.target.value !== it.status && setPrompt({ item: it, target: e.target.value as Status })} aria-label={`Status of ${it.name}`}
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold outline-none ring-1 ${STATUS_CLS[it.status]}`}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select>
                        ) : <StatusPill s={st} />}
                      </td>
                      <td className="px-3 py-3"><span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${TONE_CLS[d.tone]}`}>{d.label}</span></td>
                      <td className="px-3 py-3 text-right font-mono text-xs">{b ? money(b) : '—'}</td>
                      <td className="px-3 py-3 text-right font-mono text-xs font-semibold">{a ? money(a) : '—'}</td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${COST_CLS[cs.tone]}`}>{cs.label}</span>
                        {b > 0 && <div className="mt-1 w-28"><Bar v={(a / b) * 100} color={cs.tone === 'over' ? 'bg-eih-danger' : cs.tone === 'near' ? 'bg-eih-gold-light' : 'bg-eih-success'} /></div>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right text-xs tabular-nums text-eih-ink"><span className="inline-flex items-center gap-1"><Scale className="h-3 w-3 text-eih-muted" />{it.weight} <span className="text-eih-muted">· {share(it)}%</span></span></td>
                      <td className="w-44 px-3 py-3"><div className="flex items-center gap-2"><Bar v={pr} /><span className="text-xs font-semibold text-eih-ink">{pr}%</span></div></td>
                      {canManage && <td className="px-3 py-3"><button onClick={() => setManager({ open: true, editId: it.id })} className="rounded-lg p-1.5 hover:bg-eih-cream" title="Edit"><Edit className="h-4 w-4 text-eih-ink/60" /></button></td>}
                    </tr>
                  )
                })}
                {!visible.length && <tr><td colSpan={canManage ? 11 : 10} className="p-12 text-center text-sm text-eih-muted"><AlertTriangle className="mx-auto mb-2 h-6 w-6 text-eih-gold" />No plan items yet. {canManage ? 'Use Manage plan to add main tasks under the four phases.' : ''}</td></tr>}
              </tbody>
            </table>
          </div>
        ) : <Timeline rows={visible} byId={m.byId} gantt={view === 'Gantt'} />}
      </div>

      {manager.open && <PlanManager project={project} items={m.items} byId={m.byId} mutate={() => mutate()} onClose={() => setManager({ open: false })} startEditId={manager.editId} />}
      {prompt && <StatusDialog item={prompt.item} target={prompt.target} onClose={() => setPrompt(null)} onConfirm={p => applyStatus(prompt.item, prompt.target, p)} />}
    </div>
  )
}

export default ProjectPlan
