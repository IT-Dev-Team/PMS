'use client'

import { useEffect, useState } from 'react'
import { BriefcaseBusiness, FolderKanban, Pencil, Plus, X } from 'lucide-react'
import Link from 'next/link'

type RecordItem = { id: string; name: string; description?: string; status?: string; budget?: number; start_date?: string; end_date?: string; type: 'project' | 'portfolio' }

export function ManagementWorkspace() {
  const [projects, setProjects] = useState<RecordItem[]>([])
  const [portfolios, setPortfolios] = useState<RecordItem[]>([])
  const [editing, setEditing] = useState<RecordItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true); setError('')
    try {
      const [projectResponse, portfolioResponse] = await Promise.all([fetch('/api/projects?limit=1000', { cache: 'no-store' }), fetch('/api/portfolios?active=false', { cache: 'no-store' })])
      if (!projectResponse.ok || !portfolioResponse.ok) throw new Error('Unable to load management records.')
      const projectData = await projectResponse.json(); const portfolioData = await portfolioResponse.json()
      setProjects((projectData.data ?? projectData.projects ?? projectData ?? []).map((item: any) => ({ ...item, type: 'project' })))
      setPortfolios((portfolioData.data ?? portfolioData.portfolios ?? portfolioData ?? []).map((item: any) => ({ ...item, type: 'portfolio' })))
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Unable to load records.') } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!editing) return
    setSaving(true); setError('')
    const form = new FormData(event.currentTarget)
    const payload = Object.fromEntries(form.entries())
    try {
      const endpoint = editing.type === 'project' ? `/api/projects/${editing.id}/details` : `/api/portfolios?id=${editing.id}`
      const response = await fetch(endpoint, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || 'Unable to save changes.')
      setEditing(null); await load()
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Unable to save changes.') } finally { setSaving(false) }
  }

  const list = (title: string, icon: typeof FolderKanban, items: RecordItem[], addHref: string) => {
    const Icon = icon
    return <section className="rounded-2xl border border-eih-line/70 bg-card p-5 shadow-[0_12px_30px_rgba(15,46,38,0.05)]"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-eih-green/10 text-eih-green-dark"><Icon className="h-5 w-5" /></div><div><h2 className="font-serif text-xl text-eih-ink">{title}</h2><p className="text-xs text-eih-muted">{items.length} records</p></div></div><Link href={addHref} className="inline-flex items-center gap-1.5 rounded-lg bg-eih-green px-3 py-2 text-xs font-semibold text-eih-on-green"><Plus className="h-3.5 w-3.5" /> Add</Link></div><div className="mt-4 space-y-2">{items.map((item) => <button key={item.id} type="button" onClick={() => setEditing(item)} className="flex w-full items-center justify-between rounded-xl border border-eih-line/70 p-3 text-left transition hover:border-eih-gold hover:bg-eih-cream-soft"><span><span className="block text-sm font-semibold text-eih-ink">{item.name}</span><span className="text-xs text-eih-muted">{item.status || 'Active'}</span></span><Pencil className="h-4 w-4 text-eih-muted" /></button>)}{!items.length && <p className="rounded-xl bg-eih-cream-soft p-4 text-sm text-eih-muted">No records found.</p>}</div></section>
  }

  return <div className="space-y-5">{error && <div role="alert" className="rounded-xl border border-eih-danger/30 bg-eih-danger-soft p-3 text-sm text-eih-danger-ink">{error}</div>}{loading ? <div className="rounded-xl border border-eih-line bg-card p-8 text-center text-sm text-eih-muted">Loading management records…</div> : <div className="grid gap-5 lg:grid-cols-2">{list('Projects', FolderKanban, projects, '/projects/new')}{list('Sectors', BriefcaseBusiness, portfolios, '/portfolios/new')}</div>}{editing && <div className="fixed inset-0 z-50 flex items-center justify-center bg-eih-green-dark/55 p-4" onMouseDown={(event) => event.target === event.currentTarget && setEditing(null)}><form onSubmit={save} className="w-full max-w-lg rounded-2xl border border-eih-line bg-card p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-eih-gold">Edit {editing.type}</p><h2 className="mt-1 font-serif text-2xl text-eih-ink">{editing.name}</h2></div><button type="button" onClick={() => setEditing(null)} aria-label="Close edit modal" className="rounded-lg p-2 text-eih-muted hover:bg-eih-cream"><X className="h-4 w-4" /></button></div><div className="mt-5 grid gap-4"><label className="text-sm font-medium text-eih-ink">Name<input name="name" defaultValue={editing.name} required className="mt-1 w-full rounded-lg border border-eih-line bg-background px-3 py-2" /></label><label className="text-sm font-medium text-eih-ink">Description<textarea name="description" defaultValue={editing.description || ''} rows={3} className="mt-1 w-full rounded-lg border border-eih-line bg-background px-3 py-2" /></label><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium text-eih-ink">Status<select name="status" defaultValue={editing.status || 'ACTIVE'} className="mt-1 w-full rounded-lg border border-eih-line bg-background px-3 py-2"><option>ACTIVE</option><option>ON_HOLD</option><option>COMPLETED</option><option>CANCELLED</option></select></label>{editing.type === 'project' && <label className="text-sm font-medium text-eih-ink">Budget<input name="budget" type="number" min="0" step="0.01" defaultValue={editing.budget || 0} className="mt-1 w-full rounded-lg border border-eih-line bg-background px-3 py-2" /></label>}</div></div><button disabled={saving} className="mt-6 w-full rounded-lg bg-eih-green px-4 py-2.5 text-sm font-semibold text-eih-on-green disabled:opacity-50">{saving ? 'Saving…' : 'Save changes'}</button></form></div>}</div>
}
