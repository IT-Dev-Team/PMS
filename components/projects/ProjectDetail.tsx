// components/projects/ProjectDetail.tsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import {
  AlertTriangle, ArrowLeft, BarChart3, CalendarDays, CheckCircle, ChevronDown, ChevronUp, CircleDollarSign, DollarSign,
  Download, Edit, Eye, FileBarChart2, FileText, FileWarning, GanttChart, Gavel, Package, Paperclip,
  Plus, PlusCircle, Receipt, RefreshCw, Search, Shield, ShieldAlert, Sparkles, Star, Trash2,
  TriangleAlert, Upload, UserPlus, Users, Wrench, X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { ProjectPlan, usePlanModel, toUsd } from './ProjectPlan'
import {
  Badge, Decision, Doc, EmptyRow, FinancialCost, Issue, Metric, PlanningData, PlanningReport,
  ProcurementPackage, Progress, TD, TH, TableShell, Tab, Vendor, field, fetcher, formatCurrency,
  formatDate, listFetcher, normalizeReport, safeArray, statusClass,
} from './shared'
import {
  DECISION_STATUSES, DecisionEntryModal, DocumentUploadModal, FinancialEntryModal, IssueModal,
  IssueViewModal, ResolveModal, RiskEntryModal,
} from './FormModals'
import { ReportModal, ReportReviewModal, ReportViewModal } from './ReportModals'
import { PackageRegistrationModal, VendorRegistrationModal } from './ProcurementModals'
import { canModifyProject, canResolveIssues, canViewProject, explainAccess, isCEO, managerIdOf } from '@/lib/projects/access'
import { computeEvm } from '@/lib/projects/metrics'
import { notify } from '@/lib/notifications/events'

type ProjectDetailProps = {
  project: any
  planningData?: PlanningData | null
  procurementData?: { packages: ProcurementPackage[]; portfolios: any[]; vendors: any[] } | null
  financialData?: { projectFinancials?: any[]; recentCosts?: FinancialCost[] } | null
  tasks?: any[] | null
  planningItems?: any[] | null
  actualCosts?: FinancialCost[] | null
  risks?: any[] | null
  financials?: any
  decisions?: Decision[] | null
  documents?: Doc[] | null
  procurement?: ProcurementPackage[] | null
  reports?: PlanningReport[] | null
  issues?: Issue[] | null
  vendors?: any[] | null
  portfolios?: any[] | null
  projectsList?: any[] | null
  user: { role?: string; id?: string; name?: string }

  /* notification navigation */
  activeTab?: Tab | null
  highlightItemId?: string | null
  onClearHighlight?: () => void
  onNavigateToDashboard?: () => void

  /* notification creation (bubbled to the parent, which already posts these two) */
  onReportSubmittedToCeo?: (report: { id: string; projectId: string }, project: { id: string; name: string }) => void
  onIssueEscalated?: (
    issue: { id: string; projectId: string; title: string; severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' },
    project: { id: string; name: string },
  ) => void
}

const SEVERITY_CLS: Record<string, string> = {
  CRITICAL: 'bg-eih-danger-soft text-eih-danger-ink', HIGH: 'bg-eih-high-soft text-eih-high-ink',
  MEDIUM: 'bg-eih-warn-soft text-eih-warn-ink', LOW: 'bg-eih-low-soft text-eih-low-ink',
}
const idxTone = (v: number | null) => (v == null ? 'text-eih-muted' : v >= 1 ? 'text-eih-success' : 'text-eih-danger')

export function ProjectDetail({
  project, planningData: initialPlanningData, procurementData: initialProcurementData,
  financialData: initialFinancialData, tasks, planningItems, actualCosts, risks, financials,
  decisions, documents, procurement, reports, issues: initialIssues, vendors, portfolios, projectsList, user,
  activeTab: initialActiveTab, highlightItemId, onClearHighlight, onNavigateToDashboard,
  onReportSubmittedToCeo, onIssueEscalated,
}: ProjectDetailProps) {
  /* ---------- access: nobody fetches or sees a project they may not open ---------- */
  const allowed = canViewProject(user, project)
  const key = (u: string) => (allowed ? u : null)
  const viewerIsCEO = isCEO(user)
  const canManage = canModifyProject(user, project)   // CEO = false: no add / edit / delete anywhere
  const canResolve = canResolveIssues(user, project)  // only this project's own manager

  /* ---------- data ---------- */
  const { data: planningData, mutate: refreshPlanning } = useSWR<PlanningData>(
    key(`/api/planning?projectId=${project.id}`), fetcher,
    { fallbackData: initialPlanningData || undefined, revalidateOnFocus: false })
  const { data: procurementData, mutate: refreshProcurement } = useSWR<{ packages: ProcurementPackage[]; portfolios: any[]; vendors: any[] }>(
    key(`/api/procurement?projectId=${project.id}`), fetcher,
    { fallbackData: initialProcurementData || { packages: procurement || [], portfolios: [], vendors: [] }, revalidateOnFocus: false })
  const { data: financialData, mutate: refreshFinancial } = useSWR<{ projectFinancials?: any[]; recentCosts?: FinancialCost[] }>(
    key(`/api/financial?projectId=${project.id}`), fetcher,
    { fallbackData: initialFinancialData || { recentCosts: actualCosts || [] }, revalidateOnFocus: false })
  const { data: issuesData, mutate: refreshIssues } = useSWR<Issue[]>(
    key(`/api/issues?projectId=${project.id}`), listFetcher, { fallbackData: initialIssues || [], revalidateOnFocus: false })
  const { data: risksData, mutate: refreshRisks } = useSWR<any[]>(
    key(`/api/risks?projectId=${project.id}`), listFetcher, { fallbackData: risks || [], revalidateOnFocus: false })
  const { data: decisionsData, mutate: refreshDecisions } = useSWR<Decision[]>(
    key(`/api/decisions?projectId=${project.id}`), listFetcher, { fallbackData: decisions || [], revalidateOnFocus: false })
  const { data: docsData, mutate: refreshDocs } = useSWR<Doc[]>(
    key(`/api/documents?projectId=${project.id}`), listFetcher, { fallbackData: documents || [], revalidateOnFocus: false })
  const { data: vendorsFetched, mutate: refreshVendors } = useSWR<any>(
    key('/api/procurement/vendors'), fetcher, { revalidateOnFocus: false })

  /* ---------- ui state ---------- */
  const [tab, setTab] = useState<Tab>((initialActiveTab as Tab) || 'overview')
  const [isHeaderExpanded, setIsHeaderExpanded] = useState(true)
  const highlightRef = useRef<HTMLTableRowElement | null>(null)
  
  useEffect(() => {
    if (initialActiveTab && initialActiveTab !== tab) setTab(initialActiveTab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialActiveTab])

  // Ensure the header is expanded on desktop, but allow it to be collapsed on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 1024) setIsHeaderExpanded(true)
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const [financialEntry, setFinancialEntry] = useState<{ open: boolean; entry?: FinancialCost | null }>({ open: false, entry: null })
  const [riskEntry, setRiskEntry] = useState<{ open: boolean; entry?: any | null }>({ open: false, entry: null })
  const [decisionEntry, setDecisionEntry] = useState<{ open: boolean; entry?: Decision | null }>({ open: false, entry: null })
  const [docUploadOpen, setDocUploadOpen] = useState(false)
  const [issueEntry, setIssueEntry] = useState<{ open: boolean; entry?: Issue | null }>({ open: false, entry: null })
  const [resolvingIssue, setResolvingIssue] = useState<Issue | null>(null)
  const [viewingIssue, setViewingIssue] = useState<Issue | null>(null)
  const [reportOpen, setReportOpen] = useState(false)
  const [editingReport, setEditingReport] = useState<PlanningReport | null>(null)
  const [packageModalOpen, setPackageModalOpen] = useState(false)
  const [vendorModalOpen, setVendorModalOpen] = useState(false)
  const [reviewReportEntry, setReviewReportEntry] = useState<PlanningReport | null>(null)
  const [viewingReport, setViewingReport] = useState<PlanningReport | null>(null)

  const [issueFilter, setIssueFilter] = useState<'ALL' | 'OPEN' | 'RESOLVED'>('ALL')
  const [riskFilter, setRiskFilter] = useState({ level: '', status: '', search: '' })
  const [decisionFilter, setDecisionFilter] = useState<'ALL' | (typeof DECISION_STATUSES)[number]>('ALL')
  const [costQ, setCostQ] = useState('')
  const [docQ, setDocQ] = useState('')
  const [procQ, setProcQ] = useState('')
  const [procStatus, setProcStatus] = useState('')

  /* ---------- derived data ---------- */
  const packageRows = safeArray<ProcurementPackage>(procurementData?.packages)
  const rawVendors =
    (Array.isArray(procurementData?.vendors) && procurementData!.vendors!.length ? procurementData!.vendors : null) ??
    (Array.isArray(vendorsFetched) ? vendorsFetched : vendorsFetched?.data ?? null) ?? vendors ?? []
  const vendorList = safeArray<Vendor>(rawVendors)
  const portfolioList = safeArray<any>(procurementData?.portfolios).length ? safeArray<any>(procurementData?.portfolios) : safeArray<any>(portfolios)
  const projectList = safeArray<any>(projectsList).length ? safeArray<any>(projectsList) : [project]

  const projectReports = safeArray<PlanningReport>(planningData?.reports ?? reports).map(normalizeReport).filter(r => String(r?.projectId) === String(project.id))
  const issueRows = safeArray<Issue>(issuesData)
  const riskRows = safeArray<any>(risksData)
  const decisionRows = safeArray<Decision>(decisionsData)
  const docRows = safeArray<Doc>(docsData)
  const costsForCashFlow = safeArray<FinancialCost>(financialData?.recentCosts ?? actualCosts).filter(c => String(c?.projectId) === String(project.id))

  const plan = usePlanModel(planningData, planningItems || tasks, project.id, costsForCashFlow)

  // Same function the CEO dashboard uses, so both pages always agree.
  const evm = useMemo(() => {
    const source = financials || financialData?.projectFinancials?.find((i: any) => String(i.id) === String(project.id)) || {}
    return computeEvm(source, project, {
      bac: plan.totalBudget || null, progress: plan.progress, planned: plan.planned,
      actual: plan.costsTotal,
    })
  }, [financials, financialData, project, plan.totalBudget, plan.progress, plan.planned, plan.costsTotal, plan.pv, plan.pvToDate, plan.ev])

  // Plain-language reasons when a figure is zero, so a 0 is never a mystery.
  const zeroWhy = useMemo(() => {
    const d = plan.diag, w: string[] = []
    if (!d.items) { w.push('There are no plan items yet. Add phases and tasks in the Plan tab: planned value, earned value and progress are all calculated from them.'); return w }
    if (!(plan.totalBudget > 0)) w.push('No phase or task has a budget. Planned value shows the project budget, and earned value is that budget × the completed percentage. Add budgets in the Plan tab for exact figures.')
    if (plan.progress === 0) w.push(`Progress and earned value are 0 because no plan item is marked Completed yet (${d.completedLeaves} of ${d.leaves} tasks). Mark tasks Completed in the Plan tab.`)
    if (!costsForCashFlow.length) w.push('No costs are logged yet, so actual cost is $0 and the forecast equals the budget.')
    return w
  }, [plan.diag, plan.totalBudget, plan.progress, costsForCashFlow.length])

  const pendingTotal = costsForCashFlow.filter(c => String(c.status).toUpperCase() === 'PENDING').reduce((s, c) => s + toUsd(c), 0)

  const filteredIssues = issueRows.filter(i =>
    issueFilter === 'ALL' || (issueFilter === 'OPEN' ? i.status !== 'RESOLVED' && i.status !== 'CLOSED' : i.status === 'RESOLVED' || i.status === 'CLOSED'))
  const filteredRisks = riskRows.filter(r => {
    const q = riskFilter.search.toLowerCase()
    return (!riskFilter.level || r.risk_level === riskFilter.level) && (!riskFilter.status || r.status === riskFilter.status)
      && (!q || r.title?.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q))
  })
  const filteredDecisions = decisionFilter === 'ALL' ? decisionRows : decisionRows.filter(d => d.status === decisionFilter)
  const filteredCosts = costsForCashFlow.filter(c => !costQ || `${c.planName || ''} ${c.description || ''} ${c.poNumber || ''}`.toLowerCase().includes(costQ.toLowerCase()))
  const filteredDocs = docRows.filter(d => !docQ || d.name.toLowerCase().includes(docQ.toLowerCase()))
  const filteredPackages = packageRows.filter(p => {
    const q = procQ.toLowerCase()
    return (!procStatus || p.status === procStatus) && (!q || `${p.title} ${p.code} ${p.vendorName || ''}`.toLowerCase().includes(q))
  })
  const decisionCounts = DECISION_STATUSES.reduce((acc, s) => ({ ...acc, [s]: decisionRows.filter(d => d.status === s).length }), {} as Record<string, number>)

  const heat = useMemo(() => {
    const m: number[][] = Array.from({ length: 5 }, () => Array(5).fill(0))
    riskRows.forEach((r: any) => {
      const p = Number(r.probability), i = Number(r.impact)
      if (p >= 1 && p <= 5 && i >= 1 && i <= 5) m[p - 1][i - 1]++
    })
    return m
  }, [riskRows])
  const heatTone = (score: number) =>
    score >= 20 ? 'bg-eih-danger text-white' : score >= 12 ? 'bg-eih-orange text-white'
    : score >= 6 ? 'bg-eih-gold text-eih-green-dark' : score >= 2 ? 'bg-eih-teal text-eih-green-dark' : 'bg-eih-mint text-eih-ink'

  const procStats = useMemo(() => {
    const totalContractValue = packageRows.reduce((s, p) => s + Number(p.contractValue || p.totalContractValue || 0), 0)
    const totalMilestones = packageRows.reduce((s, p) => s + Number(p.totalMilestones || 0), 0)
    const completedMilestones = packageRows.reduce((s, p) => s + Number(p.completedMilestones || 0), 0)
    return {
      total: packageRows.length, totalContractValue,
      activeVendors: vendorList.filter(v => v.status !== 'BLACKLISTED').length,
      milestoneCompletion: totalMilestones ? Math.round((completedMilestones / totalMilestones) * 100) : 0,
    }
  }, [packageRows, vendorList])

  /* ---------- notification highlight ---------- */
  const highlightedReport = useMemo(() => (highlightItemId ? projectReports.find(r => r.id === highlightItemId) : null), [highlightItemId, projectReports])
  const isHighlightingReport = !!highlightedReport
  const autoReviewed = highlightedReport?.reviewStatus === 'REVIEWED'
  useEffect(() => {
    if (!highlightItemId) return
    const t = setTimeout(() => highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250)
    return () => clearTimeout(t)
  }, [highlightItemId, tab, planningData, issuesData])

  /* ---------- notifications (recipients are re-derived on the server) ---------- */
  const ctx = (extra: any = {}) => ({
    project: { id: project.id, name: project.name, managerId: managerIdOf(project) },
    actorId: user?.id, ...extra,
  })

  /* ---------- actions ---------- */
  const request = async (url: string, method: string) => {
    const res = await fetch(url, { method })
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as any).error || 'Request failed') }
  }
  const remove = async (url: string, confirmText: string, refresh: () => any, done: string) => {
    if (!window.confirm(confirmText)) return
    try { await request(url, 'DELETE'); await refresh(); toast.success(done) }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Delete failed') }
  }
  const deleteReport = (r: PlanningReport) => remove(`/api/planning?id=${r.id}&resource=report`, `Delete the report from ${formatDate(r.reportDate)}?`, refreshPlanning, 'Report deleted')
  const deleteRisk = (id: string) => remove(`/api/risks?id=${id}`, 'Delete this risk?', refreshRisks, 'Risk deleted')
  const deleteDecision = (id: string) => remove(`/api/decisions?id=${id}`, 'Delete this decision?', refreshDecisions, 'Decision deleted')
  const deleteDoc = (id: string) => remove(`/api/documents?id=${id}`, 'Delete this document?', refreshDocs, 'Document deleted')
  const deleteCost = (id: string) => remove(`/api/projects/${project.id}/actual-costs?id=${id}`, 'Delete this cost?', refreshFinancial, 'Cost deleted')

  const saveIssue = async (data: any) => {
    const editing = issueEntry.entry
    const res = await fetch(editing ? `/api/issues?id=${editing.id}` : '/api/issues', {
      method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing ? data : { ...data, projectId: project.id, reportedBy: user.id || 'system' }),
    })
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as any).error || 'Failed') }
    const json = await res.json().catch(() => ({}))
    const created = json.data ?? json.issue ?? json
    await refreshIssues()

    if (!editing && created?.id) {
      notify('ISSUE_CREATED', ctx({ itemId: created.id, title: data.title, severity: data.severity, needsCeoAttention: data.needsCeoAttention }))
      if (data.needsCeoAttention) {
        onIssueEscalated?.({ id: created.id, projectId: project.id, title: data.title, severity: data.severity }, { id: project.id, name: project.name })
      }
    }
    if (editing && data.assignedTo && data.assignedTo !== editing.assignedTo) {
      notify('ISSUE_ASSIGNED', ctx({ itemId: editing.id, title: data.title, assigneeId: data.assignedTo }))
    }
  }
  const resolveIssue = async (issue: Issue, resolution: string) => {
    const res = await fetch(`/api/issues?id=${issue.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'RESOLVED', resolution, resolvedAt: new Date().toISOString() }),
    })
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as any).error || 'Failed') }
    await refreshIssues()
    notify('ISSUE_RESOLVED', ctx({ itemId: issue.id, title: issue.title, reporterId: issue.reportedBy, needsCeoAttention: issue.needsCeoAttention }))
  }
  const onFinancialSaved = (cost: FinancialCost, updated: boolean) => {
    if (!updated && String(cost.status).toUpperCase() === 'PENDING') notify('COST_PENDING', ctx({ itemId: cost.id }))
    refreshFinancial(
      current => {
        const costs = current?.recentCosts || []
        return { ...(current || {}), recentCosts: updated ? costs.map(c => (c.id === cost.id ? { ...c, ...cost } : c)) : [cost, ...costs] }
      },
      { revalidate: true },
    )
  }
  const handleReportCreated = (created: any, submittedToCeo: boolean) => {
    if (!submittedToCeo || !created?.id) return
    onReportSubmittedToCeo?.({ id: created.id, projectId: project.id }, { id: project.id, name: project.name })
  }
  const openEditReport = (r: PlanningReport) => { setEditingReport(r); setReportOpen(true) }
  const openNewReport = () => { setEditingReport(null); setReportOpen(true) }

  const handleDashboardNavigation = () => {
    if (onNavigateToDashboard) {
      onNavigateToDashboard()
    } else {
      // Fallback if the prop wasn't passed
      window.location.href = '/dashboard'
    }
  }

  const tabs: { id: Tab; label: string; icon: any; count?: number }[] = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'plan', label: 'Plan', icon: GanttChart, count: plan.items.length },
    { id: 'procurement', label: 'Procurement', icon: Package, count: packageRows.length },
    { id: 'reports', label: 'Reports', icon: FileBarChart2, count: projectReports.length },
    { id: 'issues', label: 'Issues', icon: Wrench, count: issueRows.length },
    { id: 'financial', label: 'Financial', icon: CircleDollarSign, count: costsForCashFlow.length },
    { id: 'governance', label: 'Governance', icon: ShieldAlert, count: decisionRows.length },
    { id: 'documents', label: 'Documents', icon: FileText, count: docRows.length },
    { id: 'risks', label: 'Risks', icon: TriangleAlert, count: riskRows.length },
  ]

  const ActionButton = ({ onClick, primary, children }: { onClick: () => void; primary?: boolean; children: React.ReactNode }) => (
    <button type="button" onClick={onClick} className={primary ? 'eih-btn eih-btn-gold text-xs' : 'eih-btn eih-btn-outline text-xs'}>{children}</button>
  )
  const IconBtn = ({ onClick, title, danger, children }: { onClick: () => void; title: string; danger?: boolean; children: React.ReactNode }) => (
    <button type="button" onClick={onClick} title={title} aria-label={title} className={`rounded-lg p-1.5 transition ${danger ? 'hover:bg-eih-danger-soft' : 'hover:bg-eih-cream'}`}>{children}</button>
  )

  /* ---------- no access (all hooks have run above) ---------- */
  if (!allowed) {
    return (
      <main className="min-h-screen bg-eih-cream-soft p-8">
        <div className="mx-auto max-w-md rounded-2xl border border-eih-line/70 bg-card p-8 text-center shadow-sm">
          <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-eih-danger" />
          <h1 className="font-serif text-xl text-eih-ink">No access to this project</h1>
          <p className="mt-2 text-sm text-eih-muted">Only the CEO and the project&apos;s assigned manager can open it.</p>
          <p className="mt-2 text-xs text-eih-danger-ink">{explainAccess(user, project)}</p>
          <button type="button" onClick={handleDashboardNavigation} className="eih-btn eih-btn-primary mt-4">Back to Dashboard</button>
        </div>
      </main>
    )
  }

  const util = evm.bac ? Math.min(999, Math.round((Number(evm.ac || 0) / Number(evm.bac)) * 100)) : 0

  return (
    <main className="min-h-screen space-y-6 bg-eih-cream-soft p-4 md:p-8">
      <header className="overflow-hidden rounded-2xl border border-eih-line/70 bg-card shadow-sm transition-all duration-300">
        <div className="h-1.5 w-full bg-gradient-to-r from-eih-gold via-eih-gold-light to-eih-gold" />
        <div className="p-4 md:p-6">
          {/* Header Top Row */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex-1">
              <button 
                type="button" 
                onClick={handleDashboardNavigation} 
                className="inline-flex items-center gap-2 text-sm text-eih-muted transition hover:text-eih-ink"
              >
                <ArrowLeft className="h-4 w-4" /> Back to Dashboard
              </button>
              
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <h1 className="font-serif text-2xl md:text-3xl text-eih-ink">{project.name}</h1>
                <Badge>{project.status}</Badge>
              </div>
              <p className="mt-2 text-sm text-eih-muted">
          <span className="font-mono text-xs text-eih-gold">{project.code}</span> · {project.description}
        </p>
              
              {/* Project Meta & Expand Toggle */}
              <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-eih-muted">
                <span><Users className="mr-1 inline h-4 w-4" />{project.managerName || '—'}</span>
                <span><CalendarDays className="mr-1 inline h-4 w-4" />{formatDate(project.startDate)} → {formatDate(project.endDate)}</span>
                
                <button 
                  type="button"
                  onClick={() => setIsHeaderExpanded(!isHeaderExpanded)}
                  className="ml-auto md:ml-4 inline-flex items-center gap-1.5 rounded-lg border border-eih-line bg-eih-cream-soft px-3 py-1.5 text-xs font-semibold text-eih-ink transition hover:bg-eih-cream"
                >
                  {isHeaderExpanded ? (
                    <><ChevronUp className="h-3.5 w-3.5" /> Hide details</>
                  ) : (
                    <><ChevronDown className="h-3.5 w-3.5" /> Show details</>
                  )}
                </button>
              </div>
            </div>

            <div className="flex gap-2 self-start">
              <button type="button" onClick={() => window.location.reload()} title="Reload" aria-label="Reload page" className="rounded-lg border border-eih-line p-2 text-eih-ink/70 transition hover:bg-eih-cream hover:text-eih-ink">
                <RefreshCw className="h-4 w-4" />
              </button>
              <button type="button" title="Download" aria-label="Download project data" className="rounded-lg border border-eih-line p-2 text-eih-ink/70 transition hover:bg-eih-cream hover:text-eih-ink">
                <Download className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Collapsible Section */}
          <div className={`grid transition-all duration-300 ease-in-out ${isHeaderExpanded ? 'grid-rows-[1fr] opacity-100 mt-6' : 'grid-rows-[0fr] opacity-0 mt-0'}`}>
            <div className="overflow-hidden">
              {viewerIsCEO && (
                <div className="mb-4 rounded-lg border border-eih-gold/40 bg-eih-warn-soft px-3 py-2 text-xs text-eih-warn-ink">
                  Read-only view. You can review submitted reports; all other changes are made by the project manager.
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                <div className="rounded-xl border border-eih-line/70 bg-card p-4">
                  <p className="text-xs text-eih-muted">Progress</p>
                  <p className="mt-1 font-serif text-2xl text-eih-ink">{plan.progress == null ? '—' : `${plan.progress}%`}</p>
                  <Progress value={plan.progress || 0} tone={plan.progress && plan.progress >= 70 ? 'bg-eih-success' : plan.progress && plan.progress >= 30 ? 'bg-eih-gold' : 'bg-eih-danger'} />
                </div>
                <Metric label="Tasks" value={`${plan.completedTasks}/${plan.leafTasks.length}`} />
                <Metric label="Budget" value={formatCurrency(evm.bac ?? (plan.totalBudget || null))} />
                <Metric label="CPI" value={evm.cpi == null ? '—' : evm.cpi.toFixed(2)} tone={idxTone(evm.cpi)} />
                <Metric label="SPI" value={evm.spi == null ? '—' : evm.spi.toFixed(2)} tone={idxTone(evm.spi)} />
                <Metric label="Risks / Issues" value={`${riskRows.length} / ${issueRows.length}`} />
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="overflow-hidden rounded-2xl border border-eih-line/70 bg-card shadow-sm">
        <nav className="scrollbar-hide flex gap-1 overflow-x-auto border-b border-eih-line/60 bg-eih-cream-soft px-3 pt-2">
          {tabs.map(({ id, label, icon: Icon, count }) => (
            <button key={id} type="button" onClick={() => { setTab(id); onClearHighlight?.() }}
              className={`group relative flex shrink-0 items-center gap-2 px-3 py-3 text-xs font-semibold transition-all ${tab === id ? 'text-eih-ink' : 'text-eih-muted hover:text-eih-ink'}`}>
              <Icon className={`h-4 w-4 ${tab === id ? 'text-eih-gold' : ''}`} />
              {label}
              {count !== undefined && <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${tab === id ? 'bg-eih-green text-eih-gold-light' : 'bg-eih-line text-eih-ink'}`}>{count}</span>}
              <span className={`absolute inset-x-2 bottom-0 h-0.5 rounded-t bg-gradient-to-r from-eih-gold to-eih-gold-light transition-opacity ${tab === id ? 'opacity-100' : 'opacity-0'}`} />
            </button>
          ))}
        </nav>

        <div className="p-4 md:p-6">
          {/* ============= OVERVIEW ============= */}
          {tab === 'overview' && (
            <div className="fade-in space-y-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Metric label="Planned Value" value={formatCurrency(evm.pv)} sub={plan.pvToDate != null ? `${formatCurrency(plan.pvToDate)} scheduled by today` : undefined} />
                <Metric label="Earned Value" value={formatCurrency(evm.ev)} sub={plan.progress != null ? `${plan.progress}% of the plan completed` : undefined} />
                <Metric label="Actual Cost" value={formatCurrency(evm.ac)} sub={`${costsForCashFlow.length} logged cost${costsForCashFlow.length === 1 ? '' : 's'}`} />
                <Metric label="Est. at Completion" value={formatCurrency(evm.eac)} sub={evm.bac ? `budget ${formatCurrency(evm.bac)}` : undefined} />
              </div>
              {zeroWhy.length > 0 && (
                <div className="rounded-xl border border-eih-gold/40 bg-eih-warn-soft p-3 text-xs text-eih-warn-ink">
                  <p className="mb-1 font-semibold">Why some figures are zero</p>
                  <ul className="list-disc space-y-0.5 pl-4">{zeroWhy.map(t => <li key={t}>{t}</li>)}</ul>
                </div>
              )}
              <p className="-mt-3 text-xs text-eih-muted">
                Planned value = the plan&apos;s total budget. Earned value = the budget of the plan items marked Completed. Actual cost = costs logged on this
                project (pending and approved, rejected excluded, in USD). Forecast = budget ÷ CPI.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-eih-line/70 bg-card p-5">
                  <p className="text-sm font-semibold text-eih-ink">Cost Performance Index</p>
                  <p className={`mt-1 font-serif text-4xl ${idxTone(evm.cpi)}`}>{evm.cpi == null ? '—' : evm.cpi.toFixed(2)}</p>
                  <p className="mt-2 text-xs text-eih-muted">CPI = EV ÷ AC</p>
                </div>
                <div className="rounded-xl border border-eih-line/70 bg-card p-5">
                  <p className="text-sm font-semibold text-eih-ink">Schedule Performance Index</p>
                  <p className={`mt-1 font-serif text-4xl ${idxTone(evm.spi)}`}>{evm.spi == null ? '—' : evm.spi.toFixed(2)}</p>
                  <p className="mt-2 text-xs text-eih-muted">SPI = EV ÷ planned value scheduled by today</p>
                </div>
              </div>
              <div className="rounded-xl border border-eih-line/70 bg-eih-cream-soft p-5">
                <p className="text-sm font-semibold text-eih-ink">Project description</p>
                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-eih-muted">{project.description || '—'}</p>
              </div>
            </div>
          )}

          {/* ============= PLAN ============= */}
          {tab === 'plan' && (
            <ProjectPlan project={project} planningData={planningData} fallbackItems={planningItems || tasks} costs={costsForCashFlow} canManage={canManage}
              onStatusChanged={(it, target, remarks) => { if (target === 'Blocked') notify('TASK_BLOCKED', ctx({ itemId: it.id, title: it.name, detail: remarks })) }} />
          )}

          {/* ============= PROCUREMENT ============= */}
          {tab === 'procurement' && (
            <div className="fade-in space-y-4">
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                <div>
                  <h2 className="font-serif text-lg text-eih-ink">Procurement</h2>
                  <p className="text-sm text-eih-muted">Track packages, vendors, and milestones across this project.</p>
                </div>
                {canManage && (
                  <div className="flex flex-wrap gap-2">
                    <ActionButton primary onClick={() => setPackageModalOpen(true)}><span className="inline-flex items-center gap-1"><Plus className="h-4 w-4" /> New Package</span></ActionButton>
                    <ActionButton onClick={() => setVendorModalOpen(true)}><span className="inline-flex items-center gap-1"><UserPlus className="h-4 w-4" /> New Vendor</span></ActionButton>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Metric label="Total Packages" value={String(procStats.total)} icon={Package} />
                <Metric label="Total Contract Value" value={formatCurrency(procStats.totalContractValue)} icon={DollarSign} />
                <Metric label="Active Vendors" value={String(procStats.activeVendors)} icon={Users} />
                <Metric label="Milestone Completion" value={`${procStats.milestoneCompletion}%`} icon={CheckCircle}
                  tone={procStats.milestoneCompletion >= 70 ? 'text-eih-success' : procStats.milestoneCompletion >= 30 ? 'text-eih-warn-ink' : 'text-eih-danger'} />
              </div>
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-eih-line/70 bg-card p-3">
                <div className="relative min-w-[240px] flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-eih-ink/40" />
                  <input value={procQ} onChange={e => setProcQ(e.target.value)} placeholder="Search packages by title, code, or vendor…" className={`${field} pl-9`} />
                </div>
                <select value={procStatus} onChange={e => setProcStatus(e.target.value)} className={field} style={{ maxWidth: 180 }}>
                  <option value="">All Status</option>
                  {['DRAFT', 'RELEASED', 'AWARDED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map(s => <option key={s}>{s}</option>)}
                </select>
                <button type="button" onClick={() => { setProcQ(''); setProcStatus('') }} className="rounded-lg border border-eih-line px-3 py-2 text-xs text-eih-ink transition hover:bg-eih-cream"><X className="mr-1 inline h-3.5 w-3.5" /> Reset</button>
              </div>
              <TableShell>
                <table className="w-full min-w-[1000px] text-left text-sm">
                  <thead className="bg-eih-cream-soft"><tr><TH>Package</TH><TH>Vendor</TH><TH right>Contract Value</TH><TH>Progress</TH><TH>Status</TH><TH right>Overdue</TH></tr></thead>
                  <tbody className="divide-y divide-eih-line/40">
                    {filteredPackages.map(pkg => {
                      const pct = pkg.totalMilestones ? Math.round(((pkg.completedMilestones || 0) / pkg.totalMilestones) * 100) : 0
                      const value = Number(pkg.contractValue || pkg.totalContractValue || 0)
                      return (
                        <tr key={pkg.id} className="transition hover:bg-eih-cream-soft">
                          <TD><p className="font-semibold">{pkg.title}</p><p className="font-mono text-xs text-eih-muted">{pkg.code}</p></TD>
                          <TD className="text-eih-muted">{pkg.vendorName || '—'}</TD>
                          <TD right className="font-semibold">{formatCurrency(value, pkg.currency || 'USD')}</TD>
                          <td className="w-40 px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Progress value={pct} tone={pct >= 70 ? 'bg-eih-success' : pct >= 30 ? 'bg-eih-gold' : 'bg-eih-danger'} />
                              <span className="text-xs font-semibold text-eih-ink">{pct}%</span>
                            </div>
                          </td>
                          <TD><Badge>{pkg.status}</Badge></TD>
                          <TD right>
                            {pkg.overdueMilestones
                              ? <span className="inline-flex items-center gap-1 font-semibold text-eih-danger"><AlertTriangle className="h-3.5 w-3.5" /> {pkg.overdueMilestones}</span>
                              : <span className="text-eih-muted">—</span>}
                          </TD>
                        </tr>
                      )
                    })}
                    {!filteredPackages.length && <EmptyRow colSpan={6} icon={Package} label={canManage ? 'No packages match — click "New Package" to add one.' : 'No packages match.'} />}
                  </tbody>
                </table>
              </TableShell>
              {vendorList.length > 0 && (
                <div className="mt-6">
                  <h3 className="mb-2 font-serif text-base text-eih-ink">Vendors</h3>
                  <TableShell>
                    <table className="w-full min-w-[800px] text-left text-sm">
                      <thead className="bg-eih-cream-soft"><tr><TH>Name</TH><TH>Code</TH><TH>Category</TH><TH>Contact</TH><TH>Country</TH><TH right>Rating</TH></tr></thead>
                      <tbody className="divide-y divide-eih-line/40">
                        {vendorList.slice(0, 8).map(v => (
                          <tr key={v.id} className="transition hover:bg-eih-cream-soft">
                            <TD className="font-semibold">{v.name}</TD>
                            <TD className="font-mono text-xs text-eih-muted">{v.code}</TD>
                            <TD className="text-eih-muted">{v.category || '—'}</TD>
                            <TD className="text-eih-muted">{v.contactName || v.email || '—'}</TD>
                            <TD className="text-eih-muted">{v.country || '—'}</TD>
                            <TD right>
                              <span className="inline-flex items-center gap-0.5">
                                {[1, 2, 3, 4, 5].map(r => <Star key={r} className={`h-3 w-3 ${r <= (v.rating || 0) ? 'fill-eih-gold text-eih-gold' : 'text-eih-on-green'}`} />)}
                              </span>
                            </TD>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TableShell>
                </div>
              )}
            </div>
          )}

          {/* ============= REPORTS ============= */}
          {tab === 'reports' && (
            <div className="fade-in space-y-4">
              {isHighlightingReport && autoReviewed && (
                <div className="flex flex-col justify-between gap-3 rounded-xl border border-eih-gold bg-eih-warn-soft p-4 text-eih-warn-ink shadow-sm md:flex-row md:items-center">
                  <div className="flex items-start gap-3">
                    <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-eih-gold" />
                    <div>
                      <p className="text-sm font-bold">Report Automatically Changed to &quot;REVIEWED&quot;</p>
                      <p className="mt-0.5 text-xs">Clicking the notification auto-verified this submission. The highlighted row below is the record you just reviewed.</p>
                    </div>
                  </div>
                  <button type="button" onClick={onClearHighlight} className="self-start rounded-lg bg-eih-gold/20 px-3 py-1.5 text-xs font-semibold transition hover:bg-eih-gold/30 md:self-auto">Dismiss</button>
                </div>
              )}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-serif text-lg text-eih-ink">Progress reports</h2>
                  <p className="text-sm text-eih-muted">Weekly and periodic status updates, reviewed by the CEO.</p>
                </div>
                {canManage && <ActionButton primary onClick={openNewReport}><span className="inline-flex items-center gap-1"><Sparkles className="h-4 w-4" /> Submit Report</span></ActionButton>}
              </div>
              <TableShell>
                <table className="w-full min-w-[1100px] text-left text-sm">
                  <thead className="bg-eih-cream-soft"><tr><TH>Report Date</TH><TH>Summary</TH><TH>Blockers</TH><TH>Next Steps</TH><TH>Review</TH><TH>Attachment</TH><TH right>Actions</TH></tr></thead>
                  <tbody className="divide-y divide-eih-line/40">
                    {projectReports.slice().sort((a, b) => (a.reportDate < b.reportDate ? 1 : -1)).map(r => {
                      const review = r.reviewStatus || 'PENDING_REVIEW'
                      const reviewLabel = review === 'REVIEWED' ? 'Reviewed' : review === 'NEEDS_REVISION' ? 'Needs Revision' : 'Unreviewed'
                      const isTarget = highlightItemId === r.id
                      return (
                        <tr key={r.id} ref={isTarget ? highlightRef : undefined}
                          className={`transition ${isTarget ? 'bg-eih-warn-soft shadow-sm ring-2 ring-eih-gold' : 'hover:bg-eih-cream-soft'}`}>
                          <TD className="whitespace-nowrap text-xs font-semibold text-eih-gold">
                            {formatDate(r.reportDate)}
                            {isTarget && autoReviewed && (
                              <div className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-eih-success-soft px-1.5 py-0.5 text-[9px] font-bold text-eih-success-ink"><CheckCircle className="h-2.5 w-2.5" /> auto-reviewed</div>
                            )}
                          </TD>
                          <TD className="max-w-md">
                            <button type="button" onClick={() => setViewingReport(r)} className="text-left" title="View full report">
                              <p className="line-clamp-2 whitespace-pre-line hover:underline">{r.summary}</p>
                            </button>
                            {r.reviewNotes && <div className="mt-1.5 rounded-md bg-eih-success-soft p-1.5 text-[11px] text-eih-success-ink"><strong>CEO Note:</strong> {r.reviewNotes}</div>}
                          </TD>
                          <TD className="max-w-xs text-xs text-eih-warn-ink">{r.blockers || '—'}</TD>
                          <TD className="max-w-xs text-xs text-eih-muted">{r.nextSteps || '—'}</TD>
                          <TD>
                            <div className="flex flex-col gap-1">
                              <span className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass(review)}`}>{reviewLabel}</span>
                              {r.reviewedByName && <span className="text-[10px] text-eih-muted">by {r.reviewedByName}</span>}
                              {r.reviewedAt && <span className="text-[9px] text-eih-muted/80">{new Date(r.reviewedAt).toLocaleDateString()}</span>}
                            </div>
                          </TD>
                          <TD>
                            {r.attachmentUrl
                              ? <button type="button" onClick={() => setViewingReport(r)} className="inline-flex items-center gap-1 text-xs font-semibold text-eih-gold hover:text-eih-ink" title="View attachment"><Paperclip className="h-3.5 w-3.5" /> {r.attachmentName || 'View'}</button>
                              : r.attachmentName
                                ? <span className="inline-flex items-center gap-1 text-xs text-eih-muted" title="The file name was saved but the file was not returned by the server"><Paperclip className="h-3.5 w-3.5" /> {r.attachmentName}</span>
                                : <span className="text-xs text-eih-muted">—</span>}
                          </TD>
                          <TD right>
                            <div className="flex items-center justify-end gap-1">
                              <IconBtn onClick={() => setViewingReport(r)} title="View report and attachment"><Eye className="h-3.5 w-3.5 text-eih-gold" /></IconBtn>
                              {canManage && <IconBtn onClick={() => openEditReport(r)} title="Edit report"><Edit className="h-3.5 w-3.5 text-eih-ink/70" /></IconBtn>}
                              {canManage && <IconBtn danger onClick={() => deleteReport(r)} title="Delete report"><Trash2 className="h-3.5 w-3.5 text-eih-danger/70" /></IconBtn>}
                              {viewerIsCEO && <IconBtn onClick={() => setReviewReportEntry(r)} title="Review report"><Gavel className="h-3.5 w-3.5 text-eih-ink/70" /></IconBtn>}
                            </div>
                          </TD>
                        </tr>
                      )
                    })}
                    {!projectReports.length && <EmptyRow colSpan={7} icon={FileBarChart2} label={canManage ? 'No reports yet — click "Submit Report" to add one.' : 'No reports yet.'} />}
                  </tbody>
                </table>
              </TableShell>
            </div>
          )}

          {/* ============= ISSUES ============= */}
          {tab === 'issues' && (
            <div className="fade-in space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-serif text-lg text-eih-ink">Issues</h2>
                  <p className="text-sm text-eih-muted">Track and resolve project issues.</p>
                </div>
                {canManage && <ActionButton primary onClick={() => setIssueEntry({ open: true, entry: null })}><span className="inline-flex items-center gap-1"><PlusCircle className="h-4 w-4" /> Register Issue</span></ActionButton>}
              </div>
              <div className="flex gap-2">
                {(['ALL', 'OPEN', 'RESOLVED'] as const).map(f => (
                  <button key={f} type="button" onClick={() => setIssueFilter(f)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${issueFilter === f ? 'bg-eih-green text-eih-gold-light' : 'bg-eih-cream text-eih-ink hover:bg-eih-line'}`}>
                    {f === 'ALL' ? 'All' : f === 'OPEN' ? 'Open' : 'Resolved'}
                  </button>
                ))}
              </div>
              <TableShell>
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-eih-cream-soft"><tr><TH>Title</TH><TH>Severity</TH><TH>Status</TH><TH>Assigned</TH><TH>Reported</TH><TH right>Actions</TH></tr></thead>
                  <tbody className="divide-y divide-eih-line/40">
                    {filteredIssues.map(i => {
                      const isTarget = highlightItemId === i.id
                      const open = i.status !== 'RESOLVED' && i.status !== 'CLOSED'
                      return (
                        <tr key={i.id} ref={isTarget ? highlightRef : undefined}
                          className={`transition ${isTarget ? 'bg-eih-warn-soft ring-2 ring-eih-gold' : 'hover:bg-eih-cream-soft'}`}>
                          <TD>
                            <button type="button" onClick={() => setViewingIssue(i)} className="text-left font-semibold hover:underline" title="View issue">{i.title}</button>
                            {i.description && <p className="truncate text-xs text-eih-muted">{i.description}</p>}
                            {i.needsCeoAttention && open && (
                              <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-eih-danger-soft px-2 py-0.5 text-[10px] font-bold text-eih-danger-ink"><Shield className="h-3 w-3" /> CEO Attention</p>
                            )}
                            {i.resolution && <p className="mt-1 rounded bg-eih-success-soft px-2 py-1 text-[11px] text-eih-success-ink"><strong>Resolved:</strong> {i.resolution}</p>}
                          </TD>
                          <TD><span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${SEVERITY_CLS[i.severity] || SEVERITY_CLS.LOW}`}>{i.severity}</span></TD>
                          <TD><Badge>{i.status}</Badge></TD>
                          <TD className="text-eih-muted">{i.assignedTo || '—'}</TD>
                          <TD className="text-xs text-eih-muted">{formatDate(i.createdAt)}</TD>
                          <TD right>
                            <div className="flex items-center justify-end gap-1">
                              <IconBtn onClick={() => setViewingIssue(i)} title="View issue"><Eye className="h-3.5 w-3.5 text-eih-gold" /></IconBtn>
                              {canManage && open && <IconBtn onClick={() => setIssueEntry({ open: true, entry: i })} title="Edit"><Edit className="h-3.5 w-3.5 text-eih-ink/60" /></IconBtn>}
                              {canResolve && open && <IconBtn onClick={() => setResolvingIssue(i)} title="Resolve"><CheckCircle className="h-3.5 w-3.5 text-eih-success" /></IconBtn>}
                            </div>
                          </TD>
                        </tr>
                      )
                    })}
                    {!filteredIssues.length && <EmptyRow colSpan={6} icon={Wrench} label="No issues to display." />}
                  </tbody>
                </table>
              </TableShell>
            </div>
          )}

          {/* ============= FINANCIAL ============= */}
          {tab === 'financial' && (
            <div className="fade-in space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-serif text-lg text-eih-ink">Financial Management</h2>
                  <p className="text-sm text-eih-muted">Cost log, budget utilization, and pending approvals. Totals are in USD.</p>
                </div>
                {canManage && <ActionButton primary onClick={() => setFinancialEntry({ open: true, entry: null })}><span className="inline-flex items-center gap-1"><Plus className="h-4 w-4" /> Log Cost</span></ActionButton>}
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Metric label="Budget" value={formatCurrency(evm.bac)} />
                <Metric label="Actual Cost" value={formatCurrency(evm.ac)} sub={`${util}% utilized`} />
                <Metric label="Variance" value={formatCurrency(evm.vac)} tone={(evm.vac || 0) >= 0 ? 'text-eih-success' : 'text-eih-danger'} />
                <Metric label="Pending" value={formatCurrency(pendingTotal)} tone="text-eih-warn-ink" />
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-eih-ink/40" />
                <input value={costQ} onChange={e => setCostQ(e.target.value)} placeholder="Search costs…" className={`${field} pl-9`} />
              </div>
              <TableShell>
                <table className="w-full min-w-[950px] text-left text-sm">
                  <thead className="bg-eih-cream-soft"><tr><TH>Date</TH><TH>Task/Phase</TH><TH>Type</TH><TH>Vendor</TH><TH>PO / Invoice</TH><TH right>Amount</TH><TH>Status</TH><TH right>Actions</TH></tr></thead>
                  <tbody className="divide-y divide-eih-line/40">
                    {filteredCosts.map(c => (
                      <tr key={c.id} className="slide-up transition hover:bg-eih-cream-soft">
                        <TD className="whitespace-nowrap text-xs text-eih-muted">{formatDate(c.period)}</TD>
                        <TD><p className="font-medium">{c.planName || '—'}</p>{c.description && <p className="truncate text-[11px] text-eih-muted">{c.description}</p>}</TD>
                        <TD className="text-eih-muted">{c.costType || '—'}</TD>
                        <TD className="text-eih-muted">{c.vendorName || '—'}</TD>
                        <TD className="font-mono text-xs text-eih-muted">{c.poNumber || c.invoiceNumber || '—'}</TD>
                        <TD right className="font-semibold">{formatCurrency(c.amount, c.currency || 'USD')}</TD>
                        <TD><Badge>{c.status}</Badge></TD>
                        <TD right>
                          <div className="flex items-center justify-end gap-1">
                            {canManage && (
                              <>
                                <IconBtn onClick={() => setFinancialEntry({ open: true, entry: c })} title="Edit"><Edit className="h-3.5 w-3.5 text-eih-ink/60" /></IconBtn>
                                <IconBtn danger onClick={() => deleteCost(c.id)} title="Delete"><Trash2 className="h-3.5 w-3.5 text-eih-danger/70" /></IconBtn>
                              </>
                            )}
                          </div>
                        </TD>
                      </tr>
                    ))}
                    {!filteredCosts.length && <EmptyRow colSpan={8} icon={Receipt} label={canManage ? 'No costs logged yet — click "Log Cost" to add one.' : 'No costs logged yet.'} />}
                  </tbody>
                </table>
              </TableShell>
            </div>
          )}

          {/* ============= GOVERNANCE ============= */}
          {tab === 'governance' && (
            <div className="fade-in space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-serif text-lg text-eih-ink">Board Governance</h2>
                  <p className="text-sm text-eih-muted">Decision register &amp; tracker.</p>
                </div>
                {canManage && <ActionButton primary onClick={() => setDecisionEntry({ open: true, entry: null })}><span className="inline-flex items-center gap-1"><Gavel className="h-4 w-4" /> New Decision</span></ActionButton>}
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                {DECISION_STATUSES.map(s => (
                  <button key={s} type="button" onClick={() => setDecisionFilter(decisionFilter === s ? 'ALL' : s)}
                    className={`relative overflow-hidden rounded-xl border bg-card p-3 text-left transition ${decisionFilter === s ? 'border-eih-gold ring-2 ring-eih-gold/30' : 'border-eih-line/70 hover:border-eih-gold/60'}`}>
                    <div className={`absolute inset-x-0 top-0 h-0.5 ${s === 'APPROVED' ? 'bg-eih-success' : s === 'REJECTED' ? 'bg-eih-danger' : s === 'DEFERRED' ? 'bg-eih-gold' : 'bg-eih-green'}`} />
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-eih-muted">{s}</p>
                    <p className="mt-1 font-serif text-xl text-eih-ink">{decisionCounts[s] || 0}</p>
                  </button>
                ))}
              </div>
              <TableShell>
                <table className="w-full min-w-[1000px] text-left text-sm">
                  <thead className="bg-eih-cream-soft"><tr><TH>Ref</TH><TH>Title</TH><TH>Category</TH><TH>Status</TH><TH>Owner</TH><TH>Decided</TH><TH>Due</TH><TH>Attachment</TH><TH right>Actions</TH></tr></thead>
                  <tbody className="divide-y divide-eih-line/40">
                    {filteredDecisions.map(d => (
                      <tr key={d.id} className="transition hover:bg-eih-cream-soft">
                        <TD className="font-mono text-xs text-eih-gold">{d.boardReference || '—'}</TD>
                        <TD><p className="font-semibold">{d.title}</p>{d.description && <p className="line-clamp-1 text-[11px] text-eih-muted">{d.description}</p>}</TD>
                        <TD>{d.category ? <span className="rounded-full bg-eih-cream px-2 py-0.5 text-[10px] font-semibold text-eih-ink">{d.category}</span> : '—'}</TD>
                        <TD><Badge>{d.status}</Badge></TD>
                        <TD className="text-eih-muted">{d.owner || '—'}</TD>
                        <TD className="text-xs text-eih-muted">{formatDate(d.decisionDate)}</TD>
                        <TD className="text-xs text-eih-muted">{formatDate(d.dueDate)}</TD>
                        <TD>
                          {d.attachmentUrl
                            ? <a href={d.attachmentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-eih-gold hover:text-eih-ink"><Paperclip className="h-3.5 w-3.5" /> View</a>
                            : <span className="text-xs text-eih-muted">—</span>}
                        </TD>
                        <TD right>
                          <div className="flex items-center justify-end gap-1">
                            {canManage && (
                              <>
                                <IconBtn onClick={() => setDecisionEntry({ open: true, entry: d })} title="Edit"><Edit className="h-3.5 w-3.5 text-eih-ink/60" /></IconBtn>
                                <IconBtn danger onClick={() => deleteDecision(d.id)} title="Delete"><Trash2 className="h-3.5 w-3.5 text-eih-danger/70" /></IconBtn>
                              </>
                            )}
                          </div>
                        </TD>
                      </tr>
                    ))}
                    {!filteredDecisions.length && <EmptyRow colSpan={9} icon={Gavel} label={canManage ? 'No decisions recorded — click "New Decision" to add one.' : 'No decisions recorded.'} />}
                  </tbody>
                </table>
              </TableShell>
            </div>
          )}

          {/* ============= DOCUMENTS ============= */}
          {tab === 'documents' && (
            <div className="fade-in space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-serif text-lg text-eih-ink">Documents</h2>
                  <p className="text-sm text-eih-muted">Project artefacts, minutes, and reports.</p>
                </div>
                {canManage && <ActionButton primary onClick={() => setDocUploadOpen(true)}><span className="inline-flex items-center gap-1"><Upload className="h-4 w-4" /> Upload Documents</span></ActionButton>}
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-eih-ink/40" />
                <input value={docQ} onChange={e => setDocQ(e.target.value)} placeholder="Search documents…" className={`${field} pl-9`} />
              </div>
              <TableShell>
                <table className="w-full min-w-[800px] text-left text-sm">
                  <thead className="bg-eih-cream-soft"><tr><TH>Name</TH><TH>Type</TH><TH>Version</TH><TH>Uploaded</TH><TH right>Size</TH><TH right>Actions</TH></tr></thead>
                  <tbody className="divide-y divide-eih-line/40">
                    {filteredDocs.map(d => (
                      <tr key={d.id} className="transition hover:bg-eih-cream-soft">
                        <TD>
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-eih-green to-eih-green-light text-eih-gold-light"><FileText className="h-4 w-4" /></div>
                            <span className="font-medium">{d.name}</span>
                          </div>
                        </TD>
                        <TD className="text-eih-muted">{d.type || '—'}</TD>
                        <TD className="text-xs text-eih-muted">v{d.version || '—'}</TD>
                        <TD className="text-xs text-eih-muted">{formatDate(d.createdAt)}</TD>
                        <TD right className="text-xs text-eih-muted">{d.size ? `${(d.size / 1024).toFixed(0)} KB` : '—'}</TD>
                        <TD right>
                          <div className="flex items-center justify-end gap-1">
                            {d.fileUrl && (
                              <a href={d.fileUrl} download={d.name} target="_blank" rel="noreferrer" className="rounded-lg p-1.5 transition hover:bg-eih-cream" title="Download"><Download className="h-3.5 w-3.5 text-eih-ink/60" /></a>
                            )}
                            {canManage && <IconBtn danger onClick={() => deleteDoc(d.id)} title="Delete"><Trash2 className="h-3.5 w-3.5 text-eih-danger/70" /></IconBtn>}
                          </div>
                        </TD>
                      </tr>
                    ))}
                    {!filteredDocs.length && <EmptyRow colSpan={6} icon={FileWarning} label={canManage ? 'No documents uploaded — click "Upload Documents" to add one.' : 'No documents uploaded.'} />}
                  </tbody>
                </table>
              </TableShell>
            </div>
          )}

          {/* ============= RISKS ============= */}
          {tab === 'risks' && (
            <div className="fade-in space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-serif text-lg text-eih-ink">Risk Management</h2>
                  <p className="text-sm text-eih-muted">Identify, assess, and mitigate project risks.</p>
                </div>
                {canManage && <ActionButton primary onClick={() => setRiskEntry({ open: true, entry: null })}><span className="inline-flex items-center gap-1"><Plus className="h-4 w-4" /> Register Risk</span></ActionButton>}
              </div>
              <div className="rounded-xl border border-eih-line/70 bg-card p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-serif text-base text-eih-ink">Risk Heatmap (Probability × Impact)</h3>
                  <div className="flex flex-wrap gap-2 text-[10px]">
                    {([['bg-eih-mint ring-1 ring-eih-line', 'Low'], ['bg-eih-teal', 'Med-Low'], ['bg-eih-gold', 'Med'], ['bg-eih-orange', 'High'], ['bg-eih-danger', 'Critical']] as const).map(([c, l]) => (
                      <span key={l} className="inline-flex items-center gap-1"><span className={`inline-block h-3 w-3 rounded-sm ${c}`} /> {l}</span>
                    ))}
                  </div>
                </div>
                <div className="flex justify-center">
                  <table className="border-separate border-spacing-1">
                    <tbody>
                      {heat.slice().reverse().map((row, ri) => {
                        const prob = 5 - ri
                        return (
                          <tr key={prob}>
                            <td className="pr-2 text-right text-[10px] font-semibold text-eih-muted">P{prob}</td>
                            {row.map((count, ii) => (
                              <td key={ii} className={`h-10 w-10 rounded-md text-center text-xs font-bold transition ${heatTone(prob * (ii + 1))}`}>{count > 0 ? count : ''}</td>
                            ))}
                          </tr>
                        )
                      })}
                      <tr><td />{[1, 2, 3, 4, 5].map(i => <td key={i} className="text-center text-[10px] font-semibold text-eih-muted">I{i}</td>)}</tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[220px] flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-eih-ink/40" />
                  <input value={riskFilter.search} onChange={e => setRiskFilter(f => ({ ...f, search: e.target.value }))} placeholder="Search risks…" className={`${field} pl-9`} />
                </div>
                <select value={riskFilter.level} onChange={e => setRiskFilter(f => ({ ...f, level: e.target.value }))} className={field} style={{ maxWidth: 160 }}>
                  <option value="">All Levels</option>{['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(l => <option key={l}>{l}</option>)}
                </select>
                <select value={riskFilter.status} onChange={e => setRiskFilter(f => ({ ...f, status: e.target.value }))} className={field} style={{ maxWidth: 180 }}>
                  <option value="">All Statuses</option>{['IDENTIFIED', 'ANALYZING', 'MITIGATING', 'CLOSED'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <TableShell>
                <table className="w-full min-w-[1000px] text-left text-sm">
                  <thead className="bg-eih-cream-soft"><tr><TH>Title</TH><TH>Category</TH><TH right>Prob</TH><TH right>Impact</TH><TH right>Score</TH><TH>Level</TH><TH>Status</TH><TH right>Actions</TH></tr></thead>
                  <tbody className="divide-y divide-eih-line/40">
                    {filteredRisks.map(r => (
                      <tr key={r.id} className="transition hover:bg-eih-cream-soft">
                        <TD><p className="font-semibold">{r.title}</p>{r.description && <p className="line-clamp-1 text-[11px] text-eih-muted">{r.description}</p>}</TD>
                        <TD className="text-eih-muted">{r.category || '—'}</TD>
                        <TD right className="tabular-nums">{r.probability ?? '—'}</TD>
                        <TD right className="tabular-nums">{r.impact ?? '—'}</TD>
                        <TD right className="font-mono tabular-nums">{r.risk_score ?? (r.probability && r.impact ? r.probability * r.impact : '—')}</TD>
                        <TD><span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${SEVERITY_CLS[r.risk_level] || SEVERITY_CLS.LOW}`}>{r.risk_level || '—'}</span></TD>
                        <TD><Badge>{r.status}</Badge></TD>
                        <TD right>
                          <div className="flex items-center justify-end gap-1">
                            {canManage && (
                              <>
                                <IconBtn onClick={() => setRiskEntry({ open: true, entry: r })} title="Edit"><Edit className="h-3.5 w-3.5 text-eih-ink/60" /></IconBtn>
                                <IconBtn danger onClick={() => deleteRisk(r.id)} title="Delete"><Trash2 className="h-3.5 w-3.5 text-eih-danger/70" /></IconBtn>
                              </>
                            )}
                          </div>
                        </TD>
                      </tr>
                    ))}
                    {!filteredRisks.length && <EmptyRow colSpan={8} icon={AlertTriangle} label={canManage ? 'No risks match — click "Register Risk" to add one.' : 'No risks match.'} />}
                  </tbody>
                </table>
              </TableShell>
            </div>
          )}
        </div>
      </section>

      {/* ============================ MODALS ============================ */}
      {canManage && (
        <>
          <FinancialEntryModal open={financialEntry.open} onClose={() => setFinancialEntry({ open: false })}
            project={project} entry={financialEntry.entry} planningItems={plan.items.map(i => ({ id: i.id, name: i.name }))} vendors={vendorList}
            onSaved={onFinancialSaved} />

          <RiskEntryModal open={riskEntry.open} onClose={() => setRiskEntry({ open: false })} projectId={project.id} entry={riskEntry.entry}
            onSaved={r => {
              refreshRisks()
              if (!riskEntry.entry && r && ['HIGH', 'CRITICAL'].includes(String(r.risk_level))) notify('RISK_HIGH', ctx({ title: r.title, severity: r.risk_level }))
            }} />

          <DecisionEntryModal open={decisionEntry.open} onClose={() => setDecisionEntry({ open: false })} projectId={project.id} entry={decisionEntry.entry}
            onSaved={d => { refreshDecisions(); if (!decisionEntry.entry && d) notify('DECISION_CREATED', ctx({ title: d.title })) }} />

          <DocumentUploadModal open={docUploadOpen} onClose={() => setDocUploadOpen(false)} projectId={project.id} user={user} onSaved={() => refreshDocs()} />

          <IssueModal isOpen={issueEntry.open} onClose={() => setIssueEntry({ open: false, entry: null })} onSubmit={saveIssue} initialData={issueEntry.entry} user={user} />

          <ReportModal open={reportOpen} onClose={() => { setReportOpen(false); setEditingReport(null) }}
            projectId={project.id} projectName={project.name} entry={editingReport}
            onSaved={() => refreshPlanning()} onCreated={handleReportCreated} />

          <PackageRegistrationModal open={packageModalOpen} onClose={() => setPackageModalOpen(false)} userId={user?.id || ''}
            portfolios={portfolioList} projects={projectList} vendors={vendorList} defaultProjectId={project.id} onSaved={() => refreshProcurement()} />

          <VendorRegistrationModal open={vendorModalOpen} onClose={() => setVendorModalOpen(false)} userId={user?.id || ''}
            onSaved={() => { refreshProcurement(); refreshVendors() }} />
        </>
      )}

      {canResolve && (
        <ResolveModal isOpen={!!resolvingIssue} onClose={() => setResolvingIssue(null)}
          onResolve={async r => { if (resolvingIssue) { await resolveIssue(resolvingIssue, r); setResolvingIssue(null) } }} />
      )}

      {viewerIsCEO && (
        <ReportReviewModal open={!!reviewReportEntry} onClose={() => setReviewReportEntry(null)} report={reviewReportEntry}
          onSaved={(status, notes) => {
            if (reviewReportEntry) notify('REPORT_REVIEWED', ctx({ itemId: reviewReportEntry.id, detail: status === 'NEEDS_REVISION' ? `Needs revision${notes ? `: ${notes}` : ''}` : null }))
            refreshPlanning()
          }} />
      )}

      <IssueViewModal issue={viewingIssue} onClose={() => setViewingIssue(null)}
        onEdit={canManage ? i => setIssueEntry({ open: true, entry: i }) : undefined}
        onResolve={canResolve ? i => setResolvingIssue(i) : undefined} />

      <ReportViewModal open={!!viewingReport} onClose={() => setViewingReport(null)} report={viewingReport} projectName={project.name}
        onEdit={canManage ? r => openEditReport(r) : undefined} />
    </main>
  )
}

export default ProjectDetail