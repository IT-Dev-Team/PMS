// lib/projects/metrics.ts
// Single source of truth for project figures. ProjectDetail and the CEO dashboard BOTH call computeEvm()
// with the same inputs, so they cannot disagree.
//
// Order of trust for each figure:  API value (if > 0) -> derived from the plan -> project record -> null
//   BAC (budget) = API budget, else project.budget, else the plan's total budget
//   PV           = BAC x weighted planned % (time elapsed per task, rolled up with task weights)
//   EV           = BAC x weighted actual progress %
//   AC           = API actual cost, else logged costs (rejected excluded, converted to USD), else project.actualCost
//   CPI = EV/AC   SPI = EV/PV   EAC = BAC/CPI   VAC = BAC - EAC

export type ProjectRaw = { financial: any | null; planning: any | null }
export type PlanFigures = { bac: number | null; progress: number | null; planned: number | null; actual: number | null }

const n = (v: any): number | null => (v == null || v === '' || isNaN(Number(v)) ? null : Number(v))
// Helper to treat 0 from API as empty so we fall back to plan calculations
const positiveOrNull = (v: any): number | null => {
  const num = n(v)
  return num !== null && num > 0 ? num : null
}

export function financialSource(financial: any, projectId: string) {
  return (financial?.projectFinancials || []).find((i: any) => String(i.id) === String(projectId)) || {}
}

export function computeEvm(source: any, project: any, plan?: PlanFigures | null) {
  const src = source || {}
  
  // Use positiveOrNull so an API '0' falls through to project.budget or plan.bac
  const bac = positiveOrNull(src.budget) ?? positiveOrNull(project?.budget) ?? (plan?.bac && plan.bac > 0 ? plan.bac : null)
  
  // Calculate plan-based PV/EV first, so we can fall back to them if API is 0
  const planPv = bac != null && plan?.planned != null ? (bac * plan.planned) / 100 : null
  const planEv = bac != null && plan?.progress != null ? (bac * plan.progress) / 100 : null
  
  const pv = positiveOrNull(src.plannedValue ?? src.pv) ?? planPv
  const ev = positiveOrNull(src.earnedValue ?? src.ev) ?? planEv
  
  // For AC, check plan.actual (logged costs) before project record
  const ac = positiveOrNull(src.actualCost ?? src.ac) ?? (plan?.actual && plan.actual > 0 ? plan.actual : n(project?.actualCost))
  
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