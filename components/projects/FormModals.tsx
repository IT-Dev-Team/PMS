// components/projects/FormModals.tsx
// Cost, risk, decision, document and issue modals used by ProjectDetail.
'use client'

import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle, CheckCircle, Edit, Loader2, Paperclip, Save, Shield, Upload,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  Badge, Decision, ErrorBanner, FinancialCost, Issue, ModalShell, field, fileToDataUrl,
  formatDate, label, todayISO,
} from './shared'

const errMsg = async (res: Response, fallback: string) => {
  const e = await res.json().catch(() => ({}))
  return (e as any).error || fallback
}
const ErrBox = ({ msg }: { msg: string | null }) =>
  msg ? <ErrorBanner><AlertTriangle className="h-4 w-4" /> {msg}</ErrorBanner> : null

const SaveButtons = ({ onClose, onSave, busy, text }: { onClose: () => void; onSave: () => void; busy: boolean; text: string }) => (
  <>
    <button onClick={onClose} className="eih-btn eih-btn-outline">Cancel</button>
    <button onClick={onSave} disabled={busy} className="eih-btn eih-btn-primary disabled:opacity-60">
      {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : <><Save className="h-4 w-4" /> {text}</>}
    </button>
  </>
)

/* ============================ FINANCIAL ENTRY ============================ */
export function FinancialEntryModal({
  open, onClose, project, entry, planningItems, vendors, onSaved,
}: {
  open: boolean; onClose: () => void; project: any; entry?: FinancialCost | null
  planningItems: any[] | null | undefined; vendors: any[] | null | undefined
  onSaved: (cost: FinancialCost, updated: boolean) => void
}) {
  const blank = () => ({ planId: '', amount: '', period: todayISO(), costType: 'OTHER', description: '', referenceNumber: '', vendorId: '', invoiceNumber: '', poNumber: '', status: 'PENDING', currency: 'USD', exchangeRate: '1' })
  const [draft, setDraft] = useState<any>(blank())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (entry) {
      setDraft({
        planId: entry.planId || '', amount: String(entry.amount || ''), period: entry.period?.slice(0, 10) || todayISO(),
        costType: entry.costType || 'OTHER', description: entry.description || '',
        referenceNumber: entry.referenceNumber || '', vendorId: entry.vendorId || '',
        invoiceNumber: entry.invoiceNumber || '', poNumber: entry.poNumber || '',
        status: entry.status || 'PENDING', currency: entry.currency || 'USD', exchangeRate: String(entry.exchangeRate || '1'),
      })
    } else setDraft(blank())
    setError(null)
  }, [open, entry])

  const save = async () => {
    if (!draft.planId || !draft.amount) { setError('Task/Phase and amount are required'); return }
    const amount = parseFloat(draft.amount), rate = parseFloat(draft.exchangeRate)
    if (!(amount > 0)) { setError('Amount must be greater than 0'); return }
    if (draft.currency !== 'USD' && !(rate > 0)) { setError('Enter the exchange rate (USD per 1 unit of this currency)'); return }
    setBusy(true); setError(null)
    try {
      const url = entry ? `/api/projects/${project.id}/actual-costs?id=${entry.id}` : `/api/projects/${project.id}/actual-costs`
      const res = await fetch(url, {
        method: entry ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...draft, amount, exchangeRate: draft.currency === 'USD' ? 1 : rate }),
      })
      if (!res.ok) throw new Error(await errMsg(res, 'Save failed'))
      const json = await res.json()
      onSaved(json.data, !!entry)
      toast.success(entry ? 'Cost updated' : 'Cost logged')
      onClose()
    } catch (err) { setError(err instanceof Error ? err.message : 'Save failed') } finally { setBusy(false) }
  }

  if (!open) return null
  return (
    <ModalShell title={entry ? 'Edit Cost' : 'Log Actual Cost'} onClose={onClose}
      footer={<SaveButtons onClose={onClose} onSave={save} busy={busy} text={entry ? 'Update' : 'Save'} />}>
      <ErrBox msg={error} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="md:col-span-2"><label className={label}>Task/Phase *</label>
          <select className={field} value={draft.planId} onChange={e => setDraft({ ...draft, planId: e.target.value })}>
            <option value="">Select…</option>
            {(planningItems || []).map((p: any) => <option key={p.id} value={p.id}>{p.title || p.name}</option>)}
          </select>
        </div>
        <div><label className={label}>Amount *</label><input type="number" step="0.01" min="0" className={field} value={draft.amount} onChange={e => setDraft({ ...draft, amount: e.target.value })} /></div>
        <div><label className={label}>Date</label><input type="date" className={field} value={draft.period} onChange={e => setDraft({ ...draft, period: e.target.value })} /></div>
        <div><label className={label}>Cost Type</label>
          <select className={field} value={draft.costType} onChange={e => setDraft({ ...draft, costType: e.target.value })}>
            {['LABOR', 'MATERIAL', 'EQUIPMENT', 'SUBCONTRACT', 'TRAVEL', 'OTHER'].map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div><label className={label}>Currency</label>
          <select className={field} value={draft.currency} onChange={e => setDraft({ ...draft, currency: e.target.value, exchangeRate: e.target.value === 'USD' ? '1' : draft.exchangeRate })}>
            {['USD', 'EUR', 'GBP', 'ETB'].map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        {draft.currency !== 'USD' && (
          <div className="md:col-span-2"><label className={label}>Exchange rate (USD per 1 {draft.currency}) *</label>
            <input type="number" step="0.0001" min="0" className={field} value={draft.exchangeRate} onChange={e => setDraft({ ...draft, exchangeRate: e.target.value })} />
            <p className="mt-1 text-[11px] text-eih-muted">Reports convert this cost to USD using this rate.</p>
          </div>
        )}
        <div><label className={label}>Vendor</label>
          <select className={field} value={draft.vendorId} onChange={e => setDraft({ ...draft, vendorId: e.target.value })}>
            <option value="">— None —</option>
            {(vendors || []).map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <div><label className={label}>Status</label>
          <select className={field} value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value })}>
            {['PENDING', 'APPROVED', 'REJECTED'].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div><label className={label}>PO Number</label><input className={field} value={draft.poNumber} onChange={e => setDraft({ ...draft, poNumber: e.target.value })} /></div>
        <div><label className={label}>Invoice Number</label><input className={field} value={draft.invoiceNumber} onChange={e => setDraft({ ...draft, invoiceNumber: e.target.value })} /></div>
        <div className="md:col-span-2"><label className={label}>Description</label>
          <textarea rows={2} className={field} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} />
        </div>
      </div>
    </ModalShell>
  )
}

/* ============================ RISK ENTRY ============================ */
export function RiskEntryModal({
  open, onClose, projectId, entry, onSaved,
}: {
  open: boolean; onClose: () => void; projectId: string; entry?: any | null
  onSaved: (saved?: any) => void
}) {
  const blank = () => ({ title: '', description: '', category: '', probability: '3', impact: '3', risk_level: 'MEDIUM', mitigation_plan: '', contingency_plan: '', status: 'IDENTIFIED', owner_id: '' })
  const [draft, setDraft] = useState<any>(blank())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (entry) {
      setDraft({
        title: entry.title || '', description: entry.description || '', category: entry.category || '',
        probability: String(entry.probability ?? 3), impact: String(entry.impact ?? 3),
        risk_level: entry.risk_level || 'MEDIUM', mitigation_plan: entry.mitigation_plan || '',
        contingency_plan: entry.contingency_plan || '', status: entry.status || 'IDENTIFIED', owner_id: entry.owner_id || '',
      })
    } else setDraft(blank())
    setError(null)
  }, [open, entry])

  const save = async () => {
    if (!draft.title?.trim() || !draft.category?.trim()) { setError('Title and category are required'); return }
    setBusy(true); setError(null)
    try {
      const body = { ...draft, probability: parseInt(draft.probability) || null, impact: parseInt(draft.impact) || null }
      const url = entry ? `/api/risks?id=${entry.id}` : '/api/risks'
      const res = await fetch(url, { method: entry ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry ? body : { ...body, projectId }) })
      if (!res.ok) throw new Error(await errMsg(res, 'Save failed'))
      onSaved(body); toast.success(entry ? 'Risk updated' : 'Risk registered'); onClose()
    } catch (err) { setError(err instanceof Error ? err.message : 'Save failed') } finally { setBusy(false) }
  }

  if (!open) return null
  return (
    <ModalShell title={entry ? 'Edit Risk' : 'Register Risk'} onClose={onClose}
      footer={<SaveButtons onClose={onClose} onSave={save} busy={busy} text={entry ? 'Update' : 'Create'} />}>
      <ErrBox msg={error} />
      <div className="space-y-3">
        <div><label className={label}>Title *</label><input className={field} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></div>
        <div><label className={label}>Category *</label><input className={field} value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })} placeholder="e.g. Supply Chain" /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className={label}>Probability (1-5)</label><input type="number" min="1" max="5" className={field} value={draft.probability} onChange={e => setDraft({ ...draft, probability: e.target.value })} /></div>
          <div><label className={label}>Impact (1-5)</label><input type="number" min="1" max="5" className={field} value={draft.impact} onChange={e => setDraft({ ...draft, impact: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className={label}>Level</label>
            <select className={field} value={draft.risk_level} onChange={e => setDraft({ ...draft, risk_level: e.target.value })}>
              {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(l => <option key={l}>{l}</option>)}
            </select>
          </div>
          <div><label className={label}>Status</label>
            <select className={field} value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value })}>
              {['IDENTIFIED', 'ANALYZING', 'MITIGATING', 'CLOSED'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div><label className={label}>Description</label><textarea rows={2} className={field} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} /></div>
        <div><label className={label}>Mitigation Plan</label><textarea rows={2} className={field} value={draft.mitigation_plan} onChange={e => setDraft({ ...draft, mitigation_plan: e.target.value })} /></div>
        <div><label className={label}>Contingency Plan</label><textarea rows={2} className={field} value={draft.contingency_plan} onChange={e => setDraft({ ...draft, contingency_plan: e.target.value })} /></div>
      </div>
    </ModalShell>
  )
}

/* ============================ DECISION ENTRY ============================ */
export const DECISION_STATUSES = ['PROPOSED', 'APPROVED', 'REJECTED', 'DEFERRED', 'CLOSED'] as const
const DECISION_CATEGORIES = ['STRATEGIC', 'FINANCIAL', 'OPERATIONAL', 'COMPLIANCE', 'GOVERNANCE', 'OTHER']

export function DecisionEntryModal({
  open, onClose, projectId, entry, onSaved,
}: {
  open: boolean; onClose: () => void; projectId: string; entry?: Decision | null
  onSaved: (saved?: any) => void
}) {
  const blank = () => ({ title: '', description: '', decisionDate: todayISO(), status: 'PROPOSED', category: 'STRATEGIC', owner: '', dueDate: '', boardReference: '', attachmentUrl: '', attachmentName: '' })
  const [draft, setDraft] = useState<any>(blank())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (entry) {
      setDraft({
        title: entry.title || '', description: entry.description || '',
        decisionDate: entry.decisionDate?.slice(0, 10) || todayISO(),
        status: entry.status || 'PROPOSED', category: entry.category || 'STRATEGIC',
        owner: entry.owner || '', dueDate: entry.dueDate?.slice(0, 10) || '',
        boardReference: entry.boardReference || '',
        attachmentUrl: entry.attachmentUrl || '', attachmentName: entry.attachmentName || '',
      })
    } else setDraft(blank())
    setError(null)
  }, [open, entry])

  const handleFile = async (file?: File) => {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError('File must be under 5MB'); return }
    const url = await fileToDataUrl(file)
    setDraft((d: any) => ({ ...d, attachmentUrl: url, attachmentName: file.name }))
  }

  const save = async () => {
    if (!draft.title?.trim()) { setError('Title is required'); return }
    setBusy(true); setError(null)
    try {
      const url = entry ? `/api/decisions?id=${entry.id}` : '/api/decisions'
      const res = await fetch(url, { method: entry ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry ? draft : { ...draft, projectId }) })
      if (!res.ok) throw new Error(await errMsg(res, 'Save failed'))
      onSaved(draft); toast.success(entry ? 'Decision updated' : 'Decision created'); onClose()
    } catch (err) { setError(err instanceof Error ? err.message : 'Save failed') } finally { setBusy(false) }
  }

  if (!open) return null
  return (
    <ModalShell title={entry ? 'Edit Decision' : 'New Board Decision'} onClose={onClose}
      footer={<SaveButtons onClose={onClose} onSave={save} busy={busy} text={entry ? 'Update' : 'Create'} />}>
      <ErrBox msg={error} />
      <div className="space-y-3">
        <div><label className={label}>Title *</label><input className={field} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className={label}>Status</label>
            <select className={field} value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value })}>
              {DECISION_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div><label className={label}>Category</label>
            <select className={field} value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })}>
              {DECISION_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className={label}>Decision Date</label><input type="date" className={field} value={draft.decisionDate} onChange={e => setDraft({ ...draft, decisionDate: e.target.value })} /></div>
          <div><label className={label}>Due Date</label><input type="date" className={field} value={draft.dueDate} onChange={e => setDraft({ ...draft, dueDate: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className={label}>Owner</label><input className={field} value={draft.owner} onChange={e => setDraft({ ...draft, owner: e.target.value })} /></div>
          <div><label className={label}>Board Ref</label><input className={field} value={draft.boardReference} onChange={e => setDraft({ ...draft, boardReference: e.target.value })} placeholder="e.g. BR-2026-014" /></div>
        </div>
        <div><label className={label}>Description</label><textarea rows={3} className={field} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} /></div>
        <div>
          <label className={label}>Attachment</label>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-eih-line bg-card px-3 py-2 text-xs text-eih-muted transition hover:border-eih-gold">
            <Paperclip className="h-3.5 w-3.5" />
            {draft.attachmentName || 'Attach board minute / resolution…'}
            <input type="file" className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
          </label>
        </div>
      </div>
    </ModalShell>
  )
}

/* ============================ DOCUMENT UPLOAD ============================ */
export function DocumentUploadModal({
  open, onClose, projectId, user, onSaved,
}: {
  open: boolean; onClose: () => void; projectId: string; user: any; onSaved: () => void
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [drag, setDrag] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const upload = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true); setError(null)
    try {
      for (const file of Array.from(files)) {
        if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name} exceeds 10MB limit`)
        const dataUrl = await fileToDataUrl(file)
        const res = await fetch('/api/documents', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, name: file.name, type: file.type || file.name.split('.').pop()?.toUpperCase(), size: file.size, fileUrl: dataUrl, uploadedBy: user?.id, version: '1.0', createdAt: new Date().toISOString() }),
        })
        if (!res.ok) throw new Error(await errMsg(res, `Failed to upload ${file.name}`))
      }
      onSaved(); toast.success('Uploaded'); onClose()
    } catch (err) { setError(err instanceof Error ? err.message : 'Upload failed') } finally { setUploading(false) }
  }

  if (!open) return null
  return (
    <ModalShell title="Upload Documents" subtitle="PDF, images, Office docs — up to 10MB each" onClose={onClose}
      footer={<button onClick={onClose} className="eih-btn eih-btn-outline">Close</button>}>
      <ErrBox msg={error} />
      <div
        onDragOver={e => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files) }}
        onClick={() => inputRef.current?.click()}
        className={`group flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-10 text-center transition-all ${drag ? 'border-eih-gold bg-eih-warn-soft' : 'border-eih-line hover:border-eih-gold/60 hover:bg-eih-cream-soft'}`}>
        <div className={`rounded-2xl p-3 transition ${drag ? 'bg-eih-gold text-eih-green-dark' : 'bg-eih-cream text-eih-ink'}`}>
          {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
        </div>
        <p className="text-sm font-semibold text-eih-ink">{uploading ? 'Uploading…' : drag ? 'Drop files to upload' : 'Click or drop files here'}</p>
        <input ref={inputRef} type="file" multiple className="hidden" onChange={e => upload(e.target.files)} />
      </div>
    </ModalShell>
  )
}

/* ============================ ISSUE CREATE / EDIT ============================ */
export function IssueModal({
  isOpen, onClose, onSubmit, initialData, user,
}: {
  isOpen: boolean; onClose: () => void; onSubmit: (data: any) => Promise<void>
  initialData?: Issue | null; user: any
}) {
  const [title, setTitle] = useState(initialData?.title || '')
  const [description, setDescription] = useState(initialData?.description || '')
  const [severity, setSeverity] = useState<Issue['severity']>(initialData?.severity || 'MEDIUM')
  const [status, setStatus] = useState<Issue['status']>(initialData?.status || 'OPEN')
  const [assignedTo, setAssignedTo] = useState(initialData?.assignedTo || '')
  const [needsCeoAttention, setNeedsCeoAttention] = useState<boolean>(!!initialData?.needsCeoAttention)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canChangeStatus = user?.role === 'PROJECT_MANAGER'
  const canEscalate = !initialData

  useEffect(() => {
    if (isOpen) {
      setTitle(initialData?.title || ''); setDescription(initialData?.description || '')
      setSeverity(initialData?.severity || 'MEDIUM'); setStatus(initialData?.status || 'OPEN')
      setAssignedTo(initialData?.assignedTo || '')
      setNeedsCeoAttention(!!initialData?.needsCeoAttention)
      setError(null)
    }
  }, [isOpen, initialData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!title.trim()) return
    setSubmitting(true); setError(null)
    try {
      await onSubmit({
        title: title.trim(), description: description.trim() || null, severity, status,
        assignedTo: assignedTo || null, needsCeoAttention,
      })
      onClose()
    } catch (err) { setError(err instanceof Error ? err.message : 'Save failed') } finally { setSubmitting(false) }
  }

  if (!isOpen) return null
  return (
    <ModalShell title={initialData ? 'Edit Issue' : 'Register New Issue'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <ErrBox msg={error} />
        <div><label className={label}>Title *</label><input className={field} value={title} onChange={e => setTitle(e.target.value)} required /></div>
        <div><label className={label}>Description</label><textarea rows={3} className={field} value={description} onChange={e => setDescription(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={label}>Severity</label>
            <select className={field} value={severity} onChange={e => setSeverity(e.target.value as Issue['severity'])}>
              {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div><label className={label}>Status</label>
            <select className={field} value={status} onChange={e => setStatus(e.target.value as Issue['status'])} disabled={!canChangeStatus}>
              {['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div><label className={label}>Assigned To</label><input className={field} value={assignedTo} onChange={e => setAssignedTo(e.target.value)} /></div>

        {canEscalate && (
          <div className="rounded-xl border border-eih-danger/30 bg-eih-danger-soft p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" checked={needsCeoAttention} onChange={e => setNeedsCeoAttention(e.target.checked)} className="mt-0.5 h-4 w-4 rounded accent-eih-danger" />
              <div>
                <span className="text-xs font-bold text-eih-danger-ink">Requires CEO Attention (Executive Escalation)</span>
                <p className="text-[11px] text-eih-danger-ink/80">Creates a notification on the CEO's dashboard. The CEO will be redirected here when they click it.</p>
              </div>
            </label>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-eih-line/60 pt-4">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-eih-muted transition hover:bg-eih-cream">Cancel</button>
          <button type="submit" disabled={submitting} className="eih-btn eih-btn-gold disabled:opacity-60">{submitting ? 'Saving…' : initialData ? 'Update' : 'Create'}</button>
        </div>
      </form>
    </ModalShell>
  )
}

/* ============================ ISSUE RESOLVE ============================ */
export function ResolveModal({ isOpen, onClose, onResolve }: { isOpen: boolean; onClose: () => void; onResolve: (r: string) => Promise<void> }) {
  const [resolution, setResolution] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!resolution.trim()) return
    setSubmitting(true); setError(null)
    try { await onResolve(resolution.trim()); setResolution(''); onClose() }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to resolve') } finally { setSubmitting(false) }
  }
  if (!isOpen) return null
  return (
    <ModalShell title="Resolve Issue" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <ErrBox msg={error} />
        <div><label className={label}>Resolution Notes *</label><textarea rows={3} className={field} value={resolution} onChange={e => setResolution(e.target.value)} required /></div>
        <div className="flex justify-end gap-2 border-t border-eih-line/60 pt-4">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-eih-muted transition hover:bg-eih-cream">Cancel</button>
          <button type="submit" disabled={submitting} className="eih-btn eih-btn-primary disabled:opacity-60">{submitting ? 'Resolving…' : 'Resolve'}</button>
        </div>
      </form>
    </ModalShell>
  )
}

/* ============================ ISSUE VIEW (read-only details) ============================ */
const Field = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div>
    <p className="text-[11px] font-semibold uppercase tracking-wide text-eih-muted">{k}</p>
    <div className="mt-0.5 text-sm text-eih-ink">{v || '—'}</div>
  </div>
)

export function IssueViewModal({
  issue, onClose, onEdit, onResolve,
}: {
  issue: Issue | null; onClose: () => void
  onEdit?: (i: Issue) => void; onResolve?: (i: Issue) => void
}) {
  if (!issue) return null
  const open = issue.status !== 'RESOLVED' && issue.status !== 'CLOSED'
  return (
    <ModalShell title={issue.title} subtitle={`Reported ${formatDate(issue.createdAt)}`} onClose={onClose}
      footer={<>
        {onEdit && open && <button onClick={() => { onClose(); onEdit(issue) }} className="eih-btn eih-btn-outline"><Edit className="h-4 w-4" /> Edit</button>}
        {onResolve && open && <button onClick={() => { onClose(); onResolve(issue) }} className="eih-btn eih-btn-primary"><CheckCircle className="h-4 w-4" /> Resolve</button>}
        <button onClick={onClose} className="eih-btn eih-btn-outline">Close</button>
      </>}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge>{issue.status}</Badge>
          <Badge>{issue.severity}</Badge>
          {issue.needsCeoAttention && open && (
            <span className="inline-flex items-center gap-1 rounded-full bg-eih-danger-soft px-2.5 py-1 text-[11px] font-bold text-eih-danger-ink"><Shield className="h-3 w-3" /> CEO Attention</span>
          )}
        </div>
        <div className="whitespace-pre-line rounded-lg border border-eih-line/60 bg-eih-cream-soft p-3 text-sm text-eih-ink">{issue.description || 'No description provided.'}</div>
        <div className="grid grid-cols-2 gap-4">
          <Field k="Assigned to" v={issue.assignedTo} />
          <Field k="Reported by" v={issue.reportedBy} />
          <Field k="Last updated" v={issue.updatedAt ? formatDate(issue.updatedAt) : null} />
          <Field k="Resolved on" v={issue.resolvedAt ? formatDate(issue.resolvedAt) : null} />
        </div>
        {issue.resolution && (
          <div className="rounded-lg border border-eih-success/30 bg-eih-success-soft p-3 text-sm text-eih-success-ink"><strong>Resolution:</strong> {issue.resolution}</div>
        )}
      </div>
    </ModalShell>
  )
}