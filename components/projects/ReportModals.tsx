// components/projects/ReportModals.tsx
// Create/edit a progress report (project team), review it (CEO only), and view it (everyone with access).
'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Check, Download, Edit, FileBarChart2, FileText, Loader2, Paperclip, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  ErrorBanner, ModalShell, PlanningReport, ReportReviewStatus, field, fileToDataUrl,
  formatDate, label, statusClass, todayISO,
} from './shared'

const failMsg = async (res: Response, fallback: string) => ((await res.json().catch(() => ({}))) as any).error || fallback
const post = (body: any) => fetch('/api/planning', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

/* ============================ CREATE + EDIT ============================ */
export function ReportModal({
  open, onClose, projectId, onSaved, projectName, entry, onCreated,
}: {
  open: boolean; onClose: () => void; projectId: string; onSaved: () => void
  projectName?: string; entry?: PlanningReport | null
  onCreated?: (created: any, submittedToCeo: boolean) => void
}) {
  const isEdit = !!entry
  const [draft, setDraft] = useState<any>({ reportDate: todayISO(), summary: '', blockers: '', nextSteps: '' })
  const [attachment, setAttachment] = useState<{ name: string; dataUrl: string; type: string } | null>(null)
  const [attachmentChanged, setAttachmentChanged] = useState(false)
  const [submitToCeo, setSubmitToCeo] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (entry) {
      setDraft({
        reportDate: entry.reportDate ? entry.reportDate.slice(0, 10) : todayISO(),
        summary: entry.summary || '', blockers: entry.blockers || '', nextSteps: entry.nextSteps || '',
      })
      setAttachment(entry.attachmentUrl
        ? { name: entry.attachmentName || 'Existing attachment', dataUrl: entry.attachmentUrl, type: entry.attachmentType || 'File' }
        : null)
      setSubmitToCeo(!!entry.submittedToCEO)
      setAttachmentChanged(false)
    } else {
      setDraft({ reportDate: todayISO(), summary: '', blockers: '', nextSteps: '' })
      setAttachment(null); setSubmitToCeo(true); setAttachmentChanged(false)
    }
    setError(null)
  }, [open, entry])

  const handleFile = async (file?: File) => {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError('Attachment must be under 5MB'); return }
    const dataUrl = await fileToDataUrl(file)
    setAttachment({ name: file.name, dataUrl, type: file.type || file.name.split('.').pop()?.toUpperCase() || 'File' })
    setAttachmentChanged(true)
  }

  const save = async () => {
    if (!draft.summary.trim()) { setError('Summary is required'); return }
    setBusy(true); setError(null)
    try {
      if (!isEdit) {
        const res = await post({
          resource: 'report', projectId, reportDate: draft.reportDate, summary: draft.summary,
          blockers: draft.blockers, nextSteps: draft.nextSteps, submittedToCEO: submitToCeo,
          attachmentUrl: attachment?.dataUrl, attachmentName: attachment?.name, attachmentType: attachment?.type,
        })
        if (!res.ok) throw new Error(await failMsg(res, 'Save failed'))
        const json = await res.json().catch(() => ({}))
        onCreated?.(json.data ?? json.report ?? json, submitToCeo)
      } else {
        // Only touch the attachment when the user added, replaced or removed it. Sending nulls for an
        // untouched attachment would erase a file the list endpoint simply did not return.
        const res = await post({
          resource: 'updateReport', id: entry!.id, summary: draft.summary,
          blockers: draft.blockers || null, nextSteps: draft.nextSteps || null,
          ...(attachmentChanged ? { attachmentUrl: attachment?.dataUrl ?? null, attachmentName: attachment?.name ?? null, attachmentType: attachment?.type ?? null } : {}),
        })
        if (!res.ok) throw new Error(await failMsg(res, 'Save failed'))
      }
      onSaved()
      toast.success(isEdit ? 'Report updated' : 'Report submitted')
      onClose()
    } catch (err) { setError(err instanceof Error ? err.message : 'Save failed') } finally { setBusy(false) }
  }

  if (!open) return null
  return (
    <ModalShell title={isEdit ? 'Edit Progress Report' : 'Submit Progress Report'} subtitle={projectName ? `For ${projectName}` : undefined} onClose={onClose}
      footer={<>
        <button onClick={onClose} className="eih-btn eih-btn-outline">Cancel</button>
        <button onClick={save} disabled={busy} className="eih-btn eih-btn-primary disabled:opacity-60">
          {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : <><Save className="h-4 w-4" /> {isEdit ? 'Update Report' : 'Submit Report'}</>}
        </button>
      </>}>
      {error && <ErrorBanner><AlertTriangle className="h-4 w-4" /> {error}</ErrorBanner>}
      <div className="space-y-3">
        <div>
          <label className={label}>Report Date</label>
          <input type="date" className={field} value={draft.reportDate} onChange={e => setDraft({ ...draft, reportDate: e.target.value })} disabled={isEdit} />
          {isEdit && <p className="mt-1 text-[11px] text-eih-muted">Report date cannot be changed after submission.</p>}
        </div>
        <div>
          <label className={label}>Summary *</label>
          <textarea rows={4} className={field} value={draft.summary} onChange={e => setDraft({ ...draft, summary: e.target.value })} placeholder="Progress summary, key achievements, key issues…" />
        </div>
        <div>
          <label className={label}>Blockers</label>
          <textarea rows={2} className={field} value={draft.blockers} onChange={e => setDraft({ ...draft, blockers: e.target.value })} placeholder="Anything preventing progress (optional)" />
        </div>
        <div>
          <label className={label}>Next Steps</label>
          <textarea rows={2} className={field} value={draft.nextSteps} onChange={e => setDraft({ ...draft, nextSteps: e.target.value })} placeholder="Planned actions for the coming period (optional)" />
        </div>
        <div>
          <label className={label}>Supporting Attachment</label>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-eih-line bg-card px-3 py-2 text-xs text-eih-muted transition hover:border-eih-gold">
            <Paperclip className="h-3.5 w-3.5" />
            {attachment?.name || 'Attach photo, document, or evidence…'}
            <input type="file" className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
          </label>
          {attachment && <button type="button" onClick={() => { setAttachment(null); setAttachmentChanged(true) }} className="mt-1 text-[11px] font-semibold text-eih-danger hover:underline">Remove</button>}
        </div>
        {!isEdit && (
          <div className="rounded-xl border border-eih-gold/40 bg-eih-warn-soft p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" checked={submitToCeo} onChange={e => setSubmitToCeo(e.target.checked)} className="mt-0.5 h-4 w-4 rounded accent-eih-green" />
              <div>
                <span className="text-xs font-bold text-eih-warn-ink">Submit to CEO for review</span>
                <p className="text-[11px] text-eih-warn-ink/80">Creates a notification on the CEO's dashboard. Clicking it opens this project on the Reports tab.</p>
              </div>
            </label>
          </div>
        )}
      </div>
    </ModalShell>
  )
}

/* ============================ CEO REVIEW ============================ */
export function ReportReviewModal({
  open, onClose, report, onSaved,
}: {
  open: boolean; onClose: () => void; report: PlanningReport | null
  onSaved: (status: ReportReviewStatus, notes: string | null) => void
}) {
  const [status, setStatus] = useState<ReportReviewStatus>('REVIEWED')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setStatus((report?.reviewStatus as ReportReviewStatus) || 'REVIEWED')
      setNotes(report?.reviewNotes || '')
      setError(null)
    }
  }, [open, report])

  const save = async () => {
    if (!report) return
    if (status === 'NEEDS_REVISION' && !notes.trim()) { setError('Add a note explaining what needs to be revised'); return }
    setBusy(true); setError(null)
    try {
      const res = await post({ resource: 'reviewReport', id: report.id, reviewStatus: status, reviewNotes: notes.trim() || null })
      if (!res.ok) throw new Error(await failMsg(res, 'Save failed'))
      toast.success('Report review saved')
      onSaved(status, notes.trim() || null)
      onClose()
    } catch (err) { setError(err instanceof Error ? err.message : 'Save failed') } finally { setBusy(false) }
  }

  if (!open || !report) return null
  return (
    <ModalShell title="Review Progress Report" subtitle={`Report dated ${formatDate(report.reportDate)}`} onClose={onClose}
      footer={<>
        <button onClick={onClose} className="eih-btn eih-btn-outline">Cancel</button>
        <button onClick={save} disabled={busy} className="eih-btn eih-btn-primary disabled:opacity-60">
          {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : <><Save className="h-4 w-4" /> Submit Review</>}
        </button>
      </>}>
      {error && <ErrorBanner><AlertTriangle className="h-4 w-4" /> {error}</ErrorBanner>}
      <div className="mb-4 rounded-xl border border-eih-line/60 bg-eih-cream-soft p-4">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-eih-muted">Report Summary</p>
        <p className="whitespace-pre-line text-sm text-eih-ink">{report.summary}</p>
        {report.blockers && (
          <>
            <p className="mb-1 mt-3 text-xs font-semibold uppercase tracking-wide text-eih-muted">Blockers</p>
            <p className="whitespace-pre-line text-sm text-eih-warn-ink">{report.blockers}</p>
          </>
        )}
      </div>
      <div className="space-y-3">
        <div>
          <label className={label}>Review Status</label>
          <select className={field} value={status} onChange={e => setStatus(e.target.value as ReportReviewStatus)}>
            <option value="REVIEWED">Reviewed</option>
            <option value="NEEDS_REVISION">Needs Revision</option>
            <option value="PENDING_REVIEW">Pending Review</option>
          </select>
        </div>
        <div>
          <label className={label}>Review Notes {status === 'NEEDS_REVISION' ? '*' : ''}</label>
          <textarea rows={3} className={field} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional CEO comments…" />
        </div>
      </div>
    </ModalShell>
  )
}

/* ============================ VIEW ============================ */
export function ReportViewModal({
  open, onClose, report, projectName, onEdit,
}: {
  open: boolean; onClose: () => void; report: PlanningReport | null; projectName?: string
  onEdit?: (r: PlanningReport) => void
}) {
  if (!open || !report) return null

  const review = report.reviewStatus || 'PENDING_REVIEW'
  const reviewLabel = review === 'REVIEWED' ? 'Reviewed' : review === 'NEEDS_REVISION' ? 'Needs Revision' : 'Unreviewed'
  const url = report.attachmentUrl || ''
  const mime = report.attachmentType || ''
  const name = report.attachmentName || 'Attachment'
  const isImage = mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name) || /^data:image\//i.test(url)
  const isPdf = mime === 'application/pdf' || /\.pdf$/i.test(name) || /^data:application\/pdf/i.test(url)

  const AttachmentFooter = ({ note }: { note?: string }) => (
    <div className="flex items-center justify-between border-t border-eih-line/60 px-3 py-2 text-[11px] text-eih-muted">
      <span className="inline-flex items-center gap-1 truncate"><Paperclip className="h-3 w-3 text-eih-gold" /> {name}</span>
      {note && <span className="text-[10px]">{note}</span>}
    </div>
  )

  return (
    <ModalShell wide title="Report Details" subtitle={projectName ? `For ${projectName}` : undefined} onClose={onClose}
      footer={<>
        {onEdit && <button onClick={() => { onClose(); onEdit(report) }} className="eih-btn eih-btn-outline"><Edit className="h-4 w-4" /> Edit Report</button>}
        <button onClick={onClose} className="eih-btn eih-btn-primary"><Check className="h-4 w-4" /> Close</button>
      </>}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-eih-line/70 bg-eih-cream-soft px-4 py-3">
        <div className="flex items-center gap-3">
          <FileBarChart2 className="h-5 w-5 text-eih-gold" />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-eih-muted">Report Date</p>
            <p className="font-serif text-base font-bold text-eih-ink">{formatDate(report.reportDate)}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass(review)}`}>{reviewLabel}</span>
          {report.reviewedByName && (
            <span className="text-[10px] text-eih-muted">by {report.reviewedByName}{report.reviewedAt && ` · ${new Date(report.reviewedAt).toLocaleDateString()}`}</span>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <section>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-eih-muted">Executive Summary</h4>
          <div className="whitespace-pre-line rounded-lg border border-eih-line/60 bg-card p-3 text-sm leading-relaxed text-eih-ink">{report.summary || '—'}</div>
        </section>
        {report.blockers && (
          <section>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-eih-warn-ink">Blockers / Impediments</h4>
            <div className="whitespace-pre-line rounded-lg border border-eih-gold/40 bg-eih-warn-soft p-3 text-sm leading-relaxed text-eih-warn-ink">{report.blockers}</div>
          </section>
        )}
        {report.nextSteps && (
          <section>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-eih-muted">Next Steps</h4>
            <div className="whitespace-pre-line rounded-lg border border-eih-line/60 bg-card p-3 text-sm leading-relaxed text-eih-muted">{report.nextSteps}</div>
          </section>
        )}
        {report.reviewNotes && (
          <section>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-eih-success-ink">CEO Review Note</h4>
            <div className="whitespace-pre-line rounded-lg border border-eih-success/30 bg-eih-success-soft p-3 text-sm leading-relaxed text-eih-success-ink">{report.reviewNotes}</div>
          </section>
        )}

        <section>
          <div className="mb-1 flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-eih-muted">Attachment</h4>
            {url && (
              <a href={url} download={name} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] font-semibold text-eih-gold hover:text-eih-ink">
                <Download className="h-3.5 w-3.5" /> Download
              </a>
            )}
          </div>
          {!url ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-eih-line bg-eih-cream-soft p-6 text-center">
              <Paperclip className="h-6 w-6 text-eih-gold" />
              <p className="text-xs text-eih-muted">No attachment on this report.</p>
              {process.env.NODE_ENV !== 'production' && (
                <p className="max-w-md text-[10px] text-eih-warn-ink">
                  Debug: attachment-related fields received for this report: {Object.keys(report).filter(k => /attach|file/i.test(k)).join(', ') || 'none'}.
                  {report.attachmentName ? ' The file name was stored but the file itself was not returned by GET /api/planning.' : ' If you attached a file when submitting, the server is not saving or returning it.'}
                </p>
              )}
            </div>
          ) : isImage ? (
            <div className="overflow-hidden rounded-lg border border-eih-line/60 bg-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={name} className="max-h-[480px] w-full object-contain" />
              <AttachmentFooter note={url.startsWith('data:') ? 'Embedded image' : undefined} />
            </div>
          ) : isPdf ? (
            <div className="overflow-hidden rounded-lg border border-eih-line/60 bg-card">
              <iframe src={url} title={name} className="h-[480px] w-full" />
              <AttachmentFooter note="PDF preview" />
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-eih-line/60 bg-eih-cream-soft p-3">
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-eih-green to-eih-green-light text-eih-gold-light"><FileText className="h-4 w-4" /></div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-eih-ink">{name}</p>
                  <p className="text-[11px] text-eih-muted">{mime || 'File'} · preview not available</p>
                </div>
              </div>
              <a href={url} download={name} target="_blank" rel="noreferrer" className="rounded-lg bg-eih-green px-3 py-1.5 text-xs font-semibold text-eih-gold-light transition hover:bg-eih-green-light">Open</a>
            </div>
          )}
        </section>
      </div>
    </ModalShell>
  )
}