// lib/projects/metrics.ts
// Single source of truth for project figures. ProjectDetail and the CEO dashboard BOTH call computeEvm()
// with the same inputs, so they cannot disagree.
//
// All figures are derived from operational records: plan item budgets and logged costs.
// PV = sum of plan item budgets, EV = sum of completed plan item budgets, AC = sum of all logged costs.
//   CPI = EV/AC   SPI = EV/PV   EAC = BAC/CPI   VAC = BAC - EAC

export type ProjectRaw = { financial: any | null; planning: any | null }
export type PlanFigures = { bac: number | null; pv: number | null; ev: number | null; actual: number | null }

const n = (v: any): number | null => (v == null || v === '' || isNaN(Number(v)) ? null : Number(v))
export function financialSource(financial: any, projectId: string) {
  return (financial?.projectFinancials || []).find((i: any) => String(i.id) === String(projectId)) || {}
}

export function computeEvm(_source: any, _project: any, plan?: PlanFigures | null) {
  // EVM is derived exclusively from the plan and cost ledger. Stored financial estimates
  // must not override the operational truth shown in the dashboard.
  const bac = plan?.bac != null ? plan.bac : null
  const pv = plan?.pv != null ? plan.pv : null
  const ev = plan?.ev != null ? plan.ev : null
  const ac = plan?.actual != null ? plan.actual : null
  
  const cpi = ev != null && ac ? ev / ac : null
  const spi = ev != null && pv ? ev / pv : null
  const eac = bac != null && cpi ? bac / cpi : null          // cpi 0 or null -> no forecast (never Infinity)
  const vac = bac != null && eac != null ? bac - eac : null
  return { pv, ev, ac, bac, cpi, spi, eac, vac }
}

const getJson = (url: string) => fetch(url).then(r => (r.ok ? r.json() : null)).catch(() => null)

export async function fetchProjectMetrics(id: string): Promise<ProjectRaw> {
  const [financial, planning] = await Promise.all([
    getJson(`/api/financial?projectId=${id}`),
    getJson(`/api/planning?projectId=${id}`),
  ])
  return { financial, planning }
}

/** SWR fetcher, key ['exec-metrics', 'id1,id2,...']. Six requests in flight at a time. */
export async function fetchAllMetrics([, joined]: [string, string]): Promise<Record<string, ProjectRaw>> {
  const ids = joined.split(',').filter(Boolean)
  const out: Record<string, ProjectRaw> = {}
  let next = 0
  const worker = async () => { while (next < ids.length) { const id = ids[next++]; out[id] = await fetchProjectMetrics(id) } }
  await Promise.all(Array.from({ length: Math.min(6, ids.length) }, worker))
  return out
}
