// components/projects/ProcurementModals.tsx
// Package registration wizard (4 steps) and vendor registration.
'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Award, Briefcase, Building2, CheckCircle, Loader2, Plus, Save, Star, Trash2, User } from 'lucide-react'
import toast from 'react-hot-toast'
import { ErrorBanner, ModalShell, field, formatCurrency, label } from './shared'

const PACKAGE_CATEGORIES = ['GOODS', 'SERVICES', 'CONSTRUCTION', 'CONSULTING', 'IT', 'MAINTENANCE', 'OTHER']
const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'ETB']

type Milestone = { title: string; dueDate: string; percentage: number | string }
const emptyMilestones = (): Milestone[] => [0, 1, 2, 3].map(() => ({ title: '', dueDate: '', percentage: 25 }))

/* ============================ PACKAGE ============================ */
export function PackageRegistrationModal({
  open, onClose, userId, portfolios, projects, vendors, defaultProjectId, onSaved,
}: {
  open: boolean; onClose: () => void; userId: string
  portfolios: any[]; projects: any[]; vendors: any[]; defaultProjectId?: string
  onSaved: () => void
}) {
  const [step, setStep] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedPortfolioId, setSelectedPortfolioId] = useState('')
  const [form, setForm] = useState({
    title: '', code: '', description: '', projectId: defaultProjectId || '', category: 'GOODS',
    vendorId: '', contractValue: '', currency: 'USD', paymentSchedule: '',
    startDate: '', endDate: '', deliveryDate: '', terms: '',
    milestones: emptyMilestones(), confirmAccuracy: false,
  })

  useEffect(() => {
    if (open) {
      setStep(1)
      setForm({
        title: '', code: '', description: '', projectId: defaultProjectId || '', category: 'GOODS',
        vendorId: '', contractValue: '', currency: 'USD', paymentSchedule: '',
        startDate: '', endDate: '', deliveryDate: '', terms: '', milestones: emptyMilestones(), confirmAccuracy: false,
      })
      setError(null)
    }
  }, [open, defaultProjectId])

  const filteredProjects = useMemo(() => {
    if (!selectedPortfolioId) return projects
    return projects.filter(p => (p.portfolio_id || p.portfolioId) === selectedPortfolioId)
  }, [projects, selectedPortfolioId])

  const totalPercentage = form.milestones.reduce((s, m) => s + (parseFloat(String(m.percentage)) || 0), 0)
  const contractValue = parseFloat(form.contractValue) || 0

  const setField = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))
  const setMilestone = (i: number, k: string, v: any) => setForm(p => {
    const m = [...p.milestones]; m[i] = { ...m[i], [k]: v }; return { ...p, milestones: m }
  })
  const addMilestone = () => setForm(p => ({ ...p, milestones: [...p.milestones, { title: '', dueDate: '', percentage: 0 }] }))
  const removeMilestone = (i: number) => setForm(p => ({ ...p, milestones: p.milestones.filter((_, idx) => idx !== i) }))

  const validateStep = (s: number): boolean => {
    if (s === 1) {
      if (!form.title.trim()) { setError('Package title is required'); return false }
      if (!form.projectId) { setError('Project is required'); return false }
    }
    if (s === 2) {
      if (!form.contractValue || parseFloat(form.contractValue) <= 0) { setError('Contract value must be > 0'); return false }
      if (form.startDate && form.endDate && form.endDate < form.startDate) { setError('End date must be after the start date'); return false }
    }
    if (s === 3) {
      const valid = form.milestones.filter(m => m.title.trim() && m.dueDate)
      if (!valid.length) { setError('At least one milestone is required'); return false }
      if (Math.abs(totalPercentage - 100) > 0.01) { setError(`Milestones must total 100%. Current: ${totalPercentage}%`); return false }
    }
    if (s === 4 && !form.confirmAccuracy) { setError('Please confirm accuracy'); return false }
    setError(null); return true
  }
  const next = () => validateStep(step) && setStep(step + 1)
  const back = () => { setStep(step - 1); setError(null) }

  const submit = async () => {
    if (!validateStep(4)) return
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/procurement/packages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form, createdBy: userId, contractValue: parseFloat(form.contractValue),
          milestones: form.milestones.filter(m => m.title.trim() && m.dueDate).map(m => ({
            title: m.title, dueDate: new Date(m.dueDate).toISOString(), percentage: parseFloat(String(m.percentage)),
          })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to register package')
      toast.success('Package registered'); onSaved(); onClose()
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to register package') } finally { setBusy(false) }
  }

  if (!open) return null
  const steps = ['Basic', 'Vendor & Value', 'Milestones', 'Review']

  return (
    <ModalShell wide title="Register Procurement Package" subtitle="Create a new package with milestones and vendor." onClose={onClose}
      footer={<>
        <button type="button" onClick={back} disabled={step === 1} className="eih-btn eih-btn-outline disabled:opacity-40">Back</button>
        {step < 4 ? (
          <button type="button" onClick={next} className="eih-btn eih-btn-gold">Next</button>
        ) : (
          <button type="button" onClick={submit} disabled={busy} className="eih-btn eih-btn-primary disabled:opacity-60">
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Registering…</> : <><Save className="h-4 w-4" /> Register Package</>}
          </button>
        )}
      </>}>

      <div className="mb-5 flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s} className="flex flex-1 items-center gap-2">
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
              step > i + 1 ? 'bg-eih-success text-white' : step === i + 1 ? 'bg-eih-green text-eih-gold-light ring-4 ring-eih-gold/20' : 'bg-eih-cream text-eih-ink/50'
            }`}>{step > i + 1 ? <CheckCircle className="h-3.5 w-3.5" /> : i + 1}</div>
            <span className={`hidden text-xs font-medium sm:block ${step >= i + 1 ? 'text-eih-ink' : 'text-eih-muted/60'}`}>{s}</span>
            {i < steps.length - 1 && <div className={`mx-1 h-0.5 flex-1 rounded-full ${step > i + 1 ? 'bg-eih-success' : 'bg-eih-line'}`} />}
          </div>
        ))}
      </div>

      {error && <div className="mb-4"><ErrorBanner><AlertTriangle className="h-4 w-4" /> {error}</ErrorBanner></div>}

      {step === 1 && (
        <div className="slide-up space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div><label className={label}>Package Title *</label><input className={field} value={form.title} onChange={e => setField('title', e.target.value)} /></div>
            <div><label className={label}>Package Code</label><input className={field} value={form.code} onChange={e => setField('code', e.target.value.toUpperCase())} placeholder="e.g. PKG-001" /></div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div><label className={label}>Category</label>
              <select className={field} value={form.category} onChange={e => setField('category', e.target.value)}>
                {PACKAGE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div><label className={label}>Portfolio (filter)</label>
              <select className={field} value={selectedPortfolioId} onChange={e => { setSelectedPortfolioId(e.target.value); setField('projectId', '') }}>
                <option value="">All Portfolios</option>
                {portfolios.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div><label className={label}>Project *</label>
            <select className={field} value={form.projectId} onChange={e => setField('projectId', e.target.value)}>
              <option value="">Select Project…</option>
              {filteredProjects.map((p: any) => <option key={p.id} value={p.id}>{p.name} {p.code ? `(${p.code})` : ''}</option>)}
            </select>
          </div>
          <div><label className={label}>Description</label><textarea rows={3} className={field} value={form.description} onChange={e => setField('description', e.target.value)} /></div>
        </div>
      )}

      {step === 2 && (
        <div className="slide-up space-y-4">
          <div><label className={label}>Vendor</label>
            <select className={field} value={form.vendorId} onChange={e => setField('vendorId', e.target.value)}>
              <option value="">Select Vendor…</option>
              {vendors.map((v: any) => <option key={v.id} value={v.id}>{v.name} {v.code ? `(${v.code})` : ''}</option>)}
            </select>
            {vendors.length === 0 && <p className="mt-1 text-xs text-eih-warn-ink">No vendors found. Register a vendor from the "New Vendor" button first.</p>}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div><label className={label}>Contract Value *</label>
              <input type="number" min="0" step="0.01" className={field} value={form.contractValue} onChange={e => setField('contractValue', e.target.value)} />
            </div>
            <div><label className={label}>Currency</label>
              <select className={field} value={form.currency} onChange={e => setField('currency', e.target.value)}>
                {CURRENCIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div><label className={label}>Payment Schedule Notes</label>
            <textarea rows={2} className={field} value={form.paymentSchedule} onChange={e => setField('paymentSchedule', e.target.value)} placeholder="e.g. 50% upon delivery, 50% after 30 days" />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div><label className={label}>Start Date</label><input type="date" className={field} value={form.startDate} onChange={e => setField('startDate', e.target.value)} /></div>
            <div><label className={label}>End Date</label><input type="date" className={field} min={form.startDate || undefined} value={form.endDate} onChange={e => setField('endDate', e.target.value)} /></div>
            <div><label className={label}>Delivery Date</label><input type="date" className={field} value={form.deliveryDate} onChange={e => setField('deliveryDate', e.target.value)} /></div>
          </div>
          <div><label className={label}>Terms &amp; Conditions</label><textarea rows={2} className={field} value={form.terms} onChange={e => setField('terms', e.target.value)} /></div>
        </div>
      )}

      {step === 3 && (
        <div className="slide-up space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-eih-muted">Milestones must total <b className="text-eih-ink">100%</b>. Current: <b className={Math.abs(totalPercentage - 100) < 0.01 ? 'text-eih-success' : 'text-eih-danger'}>{totalPercentage}%</b></p>
            <button type="button" onClick={addMilestone} className="eih-btn eih-btn-outline text-xs"><Plus className="h-3.5 w-3.5" /> Add Milestone</button>
          </div>
          <div className="space-y-2">
            {form.milestones.map((m, i) => {
              const amt = (contractValue * (parseFloat(String(m.percentage)) || 0)) / 100
              return (
                <div key={i} className="grid grid-cols-[1fr_140px_100px_120px_40px] items-end gap-2 rounded-lg border border-eih-line/70 bg-eih-cream-soft p-3">
                  <div><label className={label}>Title</label><input className={field} value={m.title} onChange={e => setMilestone(i, 'title', e.target.value)} /></div>
                  <div><label className={label}>Due Date</label><input type="date" className={field} value={m.dueDate} onChange={e => setMilestone(i, 'dueDate', e.target.value)} /></div>
                  <div><label className={label}>%</label><input type="number" min="0" max="100" step="0.01" className={field} value={m.percentage} onChange={e => setMilestone(i, 'percentage', e.target.value)} /></div>
                  <div><label className={label}>Payment</label><div className="px-3 py-2 text-sm font-semibold text-eih-success">{formatCurrency(amt, form.currency)}</div></div>
                  <button type="button" onClick={() => removeMilestone(i)} className="mb-1 rounded-lg p-2 text-eih-danger transition hover:bg-eih-danger-soft"><Trash2 className="h-4 w-4" /></button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="slide-up space-y-4">
          <div className="rounded-xl border border-eih-line/70 bg-eih-cream-soft p-4">
            <h3 className="mb-3 font-serif text-base text-eih-ink">Review Package</h3>
            <div className="grid gap-3 md:grid-cols-2">
              {([
                ['Title', form.title], ['Code', form.code], ['Category', form.category],
                ['Project', projects.find(p => p.id === form.projectId)?.name],
                ['Vendor', vendors.find(v => v.id === form.vendorId)?.name],
                ['Contract Value', form.contractValue ? `${form.currency} ${parseFloat(form.contractValue).toLocaleString()}` : '—'],
                ['Start', form.startDate], ['End', form.endDate],
              ] as [string, string | undefined][]).map(([k, v]) => (
                <div key={k}><div className="text-xs text-eih-muted">{k}</div><div className="font-medium text-eih-ink">{v || 'Not set'}</div></div>
              ))}
            </div>
            <div className="mt-4 border-t border-eih-line/60 pt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-eih-muted">Milestones ({totalPercentage}%)</p>
              <div className="space-y-1 text-sm">
                {form.milestones.filter(m => m.title.trim()).map((m, i) => (
                  <div key={i} className="flex items-center justify-between text-eih-ink">
                    <span>{m.title} · due {m.dueDate || '—'}</span>
                    <span className="font-semibold">{m.percentage}% · {formatCurrency((contractValue * Number(m.percentage)) / 100, form.currency)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <label className="flex items-start gap-2 text-sm text-eih-ink">
            <input type="checkbox" checked={form.confirmAccuracy} onChange={e => setField('confirmAccuracy', e.target.checked)} className="mt-0.5 h-4 w-4 accent-eih-gold" />
            I confirm the package information is accurate and complete.
          </label>
        </div>
      )}
    </ModalShell>
  )
}

/* ============================ VENDOR ============================ */
const VENDOR_CATEGORIES = ['CONSTRUCTION', 'ENGINEERING', 'IT', 'CONSULTING', 'MANUFACTURING', 'LOGISTICS', 'MAINTENANCE', 'SUPPLY', 'OTHER']
const VENDOR_TYPES = ['INDIVIDUAL', 'COMPANY', 'PARTNERSHIP', 'LLC', 'CORPORATION']
const COUNTRIES = ['Ethiopia', 'USA', 'Canada', 'UK', 'Germany', 'France', 'Japan', 'China', 'India', 'Australia', 'Brazil', 'Other']
const blankVendor = () => ({
  name: '', code: '', category: 'OTHER', type: 'COMPANY', description: '',
  contactName: '', email: '', phone: '', website: '',
  address: '', city: '', state: '', country: 'Ethiopia', zipCode: '',
  taxId: '', registrationNumber: '', establishedYear: '', employeeCount: '', annualRevenue: '', currency: 'USD',
  certifications: '', expertise: '', rating: 3, status: 'ACTIVE',
})

export function VendorRegistrationModal({
  open, onClose, userId, onSaved,
}: {
  open: boolean; onClose: () => void; userId: string; onSaved: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState(blankVendor())

  useEffect(() => { if (open) { setForm(blankVendor()); setError(null) } }, [open])
  const setField = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))
  const list = (s: string) => (s ? s.split(',').map(x => x.trim()).filter(Boolean) : [])

  const submit = async () => {
    if (!form.name.trim() || !form.code.trim() || !form.contactName.trim() || !form.email.trim() || !form.phone.trim()) {
      setError('Name, code, contact, email, and phone are required'); return
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) { setError('Enter a valid email address'); return }
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/procurement/vendors', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form, createdBy: userId,
          establishedYear: parseInt(form.establishedYear) || null,
          employeeCount: parseInt(form.employeeCount) || null,
          annualRevenue: parseFloat(form.annualRevenue) || null,
          certification: list(form.certifications),
          expertise: list(form.expertise),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to register vendor')
      toast.success('Vendor registered'); onSaved(); onClose()
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to register vendor') } finally { setBusy(false) }
  }

  if (!open) return null
  const Sel = ({ k, options }: { k: keyof ReturnType<typeof blankVendor>; options: string[] }) => (
    <select className={field} value={String(form[k])} onChange={e => setField(k, e.target.value)}>{options.map(o => <option key={o}>{o}</option>)}</select>
  )
  const Txt = ({ k, type = 'text', placeholder, min, max }: { k: keyof ReturnType<typeof blankVendor>; type?: string; placeholder?: string; min?: string; max?: number }) => (
    <input type={type} min={min} max={max} className={field} placeholder={placeholder} value={String(form[k])}
      onChange={e => setField(k, k === 'code' ? e.target.value.toUpperCase() : e.target.value)} />
  )

  return (
    <ModalShell wide title="Register Vendor" subtitle="Add a new vendor to your procurement directory." onClose={onClose}
      footer={<>
        <button onClick={onClose} className="eih-btn eih-btn-outline">Cancel</button>
        <button onClick={submit} disabled={busy} className="eih-btn eih-btn-primary disabled:opacity-60">
          {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Registering…</> : <><Save className="h-4 w-4" /> Register Vendor</>}
        </button>
      </>}>
      {error && <div className="mb-4"><ErrorBanner><AlertTriangle className="h-4 w-4" /> {error}</ErrorBanner></div>}
      <div className="space-y-5">
        <section>
          <h3 className="mb-3 flex items-center gap-2 font-serif text-sm text-eih-ink"><Building2 className="h-4 w-4 text-eih-gold" /> Basic Information</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <div><label className={label}>Vendor Name *</label>{Txt({ k: 'name' })}</div>
            <div><label className={label}>Vendor Code *</label>{Txt({ k: 'code', placeholder: 'e.g. VEN-001' })}</div>
            <div><label className={label}>Category</label>{Sel({ k: 'category', options: VENDOR_CATEGORIES })}</div>
            <div><label className={label}>Type</label>{Sel({ k: 'type', options: VENDOR_TYPES })}</div>
            <div className="md:col-span-2"><label className={label}>Description</label><textarea rows={2} className={field} value={form.description} onChange={e => setField('description', e.target.value)} /></div>
          </div>
        </section>

        <section>
          <h3 className="mb-3 flex items-center gap-2 font-serif text-sm text-eih-ink"><User className="h-4 w-4 text-eih-gold" /> Contact Information</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <div><label className={label}>Contact Person *</label>{Txt({ k: 'contactName' })}</div>
            <div><label className={label}>Email *</label>{Txt({ k: 'email', type: 'email' })}</div>
            <div><label className={label}>Phone *</label>{Txt({ k: 'phone' })}</div>
            <div><label className={label}>Website</label>{Txt({ k: 'website', placeholder: 'https://…' })}</div>
            <div className="md:col-span-2"><label className={label}>Address</label>{Txt({ k: 'address' })}</div>
            <div><label className={label}>City</label>{Txt({ k: 'city' })}</div>
            <div><label className={label}>State/Region</label>{Txt({ k: 'state' })}</div>
            <div><label className={label}>Country</label>{Sel({ k: 'country', options: COUNTRIES })}</div>
            <div><label className={label}>ZIP Code</label>{Txt({ k: 'zipCode' })}</div>
          </div>
        </section>

        <section>
          <h3 className="mb-3 flex items-center gap-2 font-serif text-sm text-eih-ink"><Briefcase className="h-4 w-4 text-eih-gold" /> Business Details</h3>
          <div className="grid gap-3 md:grid-cols-3">
            <div><label className={label}>Tax ID</label>{Txt({ k: 'taxId' })}</div>
            <div><label className={label}>Registration #</label>{Txt({ k: 'registrationNumber' })}</div>
            <div><label className={label}>Established Year</label>{Txt({ k: 'establishedYear', type: 'number', min: '1900', max: new Date().getFullYear() })}</div>
            <div><label className={label}>Employee Count</label>{Txt({ k: 'employeeCount', type: 'number', min: '1' })}</div>
            <div><label className={label}>Annual Revenue</label>{Txt({ k: 'annualRevenue', type: 'number', min: '0' })}</div>
            <div><label className={label}>Currency</label>{Sel({ k: 'currency', options: CURRENCIES })}</div>
          </div>
        </section>

        <section>
          <h3 className="mb-3 flex items-center gap-2 font-serif text-sm text-eih-ink"><Award className="h-4 w-4 text-eih-gold" /> Classification &amp; Rating</h3>
          <div className="space-y-3">
            <div><label className={label}>Certifications (comma-separated)</label>{Txt({ k: 'certifications', placeholder: 'ISO 9001, ISO 27001' })}</div>
            <div><label className={label}>Expertise (comma-separated)</label>{Txt({ k: 'expertise', placeholder: 'IT Hardware, Cloud Services' })}</div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className={label}>Rating</label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map(r => (
                    <button key={r} type="button" onClick={() => setField('rating', r)} className="p-0.5 transition hover:scale-110">
                      <Star className={`h-6 w-6 ${r <= form.rating ? 'fill-eih-gold text-eih-gold' : 'text-eih-on-green'}`} />
                    </button>
                  ))}
                </div>
              </div>
              <div><label className={label}>Status</label>{Sel({ k: 'status', options: ['ACTIVE', 'INACTIVE', 'BLACKLISTED'] })}</div>
            </div>
          </div>
        </section>
      </div>
    </ModalShell>
  )
}