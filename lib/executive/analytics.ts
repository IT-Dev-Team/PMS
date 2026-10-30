// lib/executive/analytics.ts
// Pure logic (no React). Turns portfolio/project data into six executive "dimensions",
// roll-ups at any level, rule-based insights, and a compact context for the AI briefing.

export type Rag = 'R' | 'A' | 'G' | 'N'; // N = no data (not loaded / not applicable)
export type Dim = 'financial' | 'schedule' | 'operational' | 'risk' | 'issues' | 'procurement';
export type P = Record<string, any>;

export const DIMS: { key: Dim; label: string; blurb: string }[] = [
  { key: 'financial', label: 'Financial', blurb: 'Cost against budget and forecast' },
  { key: 'schedule', label: 'Against plan', blurb: 'Progress against what was planned' },
  { key: 'operational', label: 'Operational', blurb: 'Blocked, late and on-hold work' },
  { key: 'risk', label: 'Risk', blurb: 'Open risks and mitigation' },
  { key: 'issues', label: 'Issues', blurb: 'Registered issues and their age' },
  { key: 'procurement', label: 'Procurement', blurb: 'Packages, milestones and vendors' },
];

const DAY = 864e5;
export const num = (v: any, d = 0) => { const n = typeof v === 'number' ? v : parseFloat(v); return isNaN(n) ? d : n; };
const clamp = (n: number, lo = 0, hi = 100) => Math.min(Math.max(n, lo), hi);
const dt = (v: any) => { const d = v ? new Date(v) : null; return d && !isNaN(d.getTime()) ? d : null; };
const nstat = (s: any) => String(s || '').toUpperCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
export const lvl = (r: any) => String(r.riskLevel || r.risk_level || '').toUpperCase();
const sev = (i: any) => String(i.severity || '').toUpperCase();
const RANK: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
export const money = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(n || 0);
export const worst = (rs: Rag[]): Rag => {
  const k = rs.filter(r => r !== 'N');
  return !k.length ? 'N' : k.includes('R') ? 'R' : k.includes('A') ? 'A' : 'G';
};

// ---------------------------------------------------------------------------
// Build one enriched model per project
// ---------------------------------------------------------------------------
export function buildProjects(portfolios: any[], dims?: Record<string, any>): P[] {
  const now = Date.now();
  return portfolios.flatMap((pf: any) => (pf.projects || []).map((raw: any) => {
    const id = String(raw.id), f = raw.financials || {};
    const budget = num(raw.budget ?? f.budget), ac = num(f.actualCost ?? raw.actualCost);
    const ev = num(f.earnedValue ?? raw.earnedValue), pv = num(f.plannedValue ?? raw.plannedValue);
    const cpi = f.cpi != null ? num(f.cpi, 1) : ac > 0 ? ev / ac : 1;
    const spi = f.spi != null ? num(f.spi, 1) : pv > 0 ? ev / pv : 1;
    const eac = num(f.eac ?? raw.eac, budget);
    const vac = f.vac != null ? num(f.vac) : budget - eac;
    const progress = clamp(num(raw.percentComplete ?? raw.percent_complete));
    const start = dt(raw.startDate), end = dt(raw.endDate);
    const timePct = start && end && end > start ? clamp(((now - start.getTime()) / (end.getTime() - start.getTime())) * 100) : null;
    const planned = pv > 0 && budget > 0 ? clamp((pv / budget) * 100) : timePct;
    const done = raw.status === 'COMPLETED' || progress >= 100;
    const d = dims?.[id];

    // ---- risks (from page data)
    const risks: any[] | null = raw.risks ? raw.risks.filter((r: any) => nstat(r.status) !== 'CLOSED') : null;
    const rstat = risks ? {
      open: risks.length,
      crit: risks.filter(r => lvl(r) === 'CRITICAL').length, high: risks.filter(r => lvl(r) === 'HIGH').length,
      med: risks.filter(r => lvl(r) === 'MEDIUM').length, low: risks.filter(r => lvl(r) === 'LOW').length,
      noMit: risks.filter(r => ['CRITICAL', 'HIGH'].includes(lvl(r)) && !(r.mitigation_plan || r.mitigationPlan)).length,
      list: risks.map(r => ({ title: r.title, level: lvl(r), score: num(r.risk_score ?? r.riskScore), status: r.status, mitigated: !!(r.mitigation_plan || r.mitigationPlan) })),
    } : null;

    // ---- planning / operational (lazy)
    const items: any[] | null = d?.planning?.items ?? null;
    const tasks = items ? items.filter(i => String(i.itemType) !== 'phase') : null;
    const ops = tasks ? (() => {
      const isS = (t: any, s: string) => nstat(t.status) === s;
      const open = tasks.filter(t => !isS(t, 'COMPLETED'));
      const overdue = open.filter(t => { const e = dt(t.endDate); return e && e.getTime() < now; });
      const lateStart = tasks.filter(t => isS(t, 'NOT STARTED') && (dt(t.startDate)?.getTime() ?? Infinity) < now);
      const stuck = tasks.filter(t => isS(t, 'BLOCKED') || isS(t, 'ON HOLD'));
      return {
        total: tasks.length, done: tasks.length - open.length, blocked: tasks.filter(t => isS(t, 'BLOCKED')).length,
        onHold: tasks.filter(t => isS(t, 'ON HOLD')).length, overdue: overdue.length, lateStart: lateStart.length,
        stuckList: stuck.slice(0, 20).map(t => ({ name: t.name || t.title, status: nstat(t.status), owner: t.owner })),
        overdueList: overdue.slice(0, 30).map(t => ({ name: t.name || t.title, end: t.endDate, owner: t.owner })),
      };
    })() : null;
    const phases = items ? items.filter(i => String(i.itemType) === 'phase' && i.parentId == null).map(ph => {
      const kids = (pid: string): any[] => items.filter(i => String(i.parentId) === pid).flatMap(c => [c, ...kids(String(c.id))]);
      const ts = kids(String(ph.id)).filter(i => String(i.itemType) !== 'phase');
      return { name: ph.name, total: ts.length, done: ts.filter(t => nstat(t.status) === 'COMPLETED').length, end: ph.endDate };
    }) : null;
    const report = (d?.planning?.reports || []).slice().sort((a: any, b: any) => +new Date(b.reportDate) - +new Date(a.reportDate))[0] || null;

    // ---- issues (lazy)
    const ia: any[] | null = d?.issues ?? null;
    const iss = ia ? (() => {
      const open = ia.filter(i => !['RESOLVED', 'CLOSED'].includes(String(i.status).toUpperCase()));
      const age = (i: any) => (now - new Date(i.createdAt).getTime()) / DAY;
      return {
        total: ia.length, open: open.length, resolved: ia.length - open.length,
        crit: open.filter(i => sev(i) === 'CRITICAL').length, high: open.filter(i => sev(i) === 'HIGH').length,
        aged: open.filter(i => age(i) > 30).length,
        list: [...open].sort((a, b) => (RANK[sev(a)] ?? 9) - (RANK[sev(b)] ?? 9) || age(b) - age(a)).slice(0, 20)
          .map(i => ({ title: i.title, sev: sev(i), age: Math.round(age(i)) || 0, assignedTo: i.assignedTo })),
      };
    })() : null;

    // ---- procurement (lazy)
    const pk: any[] | null = d?.packages ?? null;
    const proc = pk ? (() => {
      const val = (x: any) => num(x.totalContractValue ?? x.contractValue);
      const closed = ['COMPLETED', 'CANCELLED', 'CLOSED'];
      const late = pk.filter(x => (dt(x.endDate)?.getTime() ?? Infinity) < now && !closed.includes(String(x.status).toUpperCase()));
      const byVendor: Record<string, number> = {};
      pk.forEach(x => { const v = x.vendorName || 'Unknown vendor'; byVendor[v] = (byVendor[v] || 0) + val(x); });
      return {
        n: pk.length, committed: pk.reduce((a, x) => a + val(x), 0), overdue: late.length, byVendor,
        completedMs: pk.reduce((a, x) => a + num(x.completedMilestones), 0), totalMs: pk.reduce((a, x) => a + num(x.totalMilestones), 0),
        list: pk.slice(0, 30).map(x => ({
          title: x.title || x.name, code: x.code, vendor: x.vendorName, value: val(x), status: x.status, end: x.endDate,
          overdue: late.includes(x), ms: x.totalMilestones ? Math.round((num(x.completedMilestones) / num(x.totalMilestones)) * 100) : null,
        })),
      };
    })() : null;

    // ---- per-dimension status
    const noCost = !ac && !ev && !pv;
    const overrunPct = budget ? (-vac / budget) * 100 : 0;
    const burn = budget ? (ac / budget) * 100 : 0;
    const gap = planned == null ? 0 : planned - progress;
    const overdueShare = ops && ops.total ? ops.overdue / ops.total : 0;
    const topShare = proc && proc.committed ? Math.max(...Object.values(proc.byVendor)) / proc.committed : 0;

    const rag: Record<Dim, Rag> = {
      financial: noCost ? 'N' : cpi < 0.85 || overrunPct > 10 ? 'R' : cpi < 0.95 || overrunPct > 3 || burn - progress > 15 ? 'A' : 'G',
      schedule: done ? 'G' : planned == null && pv === 0 && !ops ? 'N'
        : spi < 0.85 || gap > 15 || overdueShare > 0.2 ? 'R' : spi < 0.95 || gap > 7 || (ops?.overdue ?? 0) > 0 ? 'A' : 'G',
      operational: !ops ? 'N' : ops.blocked >= 3 || (ops.total && ops.blocked / ops.total > 0.15) ? 'R'
        : ops.blocked > 0 || ops.onHold > 0 || ops.lateStart > 0 ? 'A' : 'G',
      risk: !rstat ? 'N' : rstat.crit > 0 ? 'R' : rstat.high >= 2 || rstat.noMit > 0 ? 'A' : 'G',
      issues: !iss ? 'N' : iss.crit > 0 ? 'R' : iss.high > 0 || iss.aged >= 2 ? 'A' : 'G',
      procurement: !proc || proc.n === 0 ? 'N' : proc.overdue >= 2 ? 'R' : proc.overdue >= 1 || (proc.n >= 3 && topShare > 0.6) ? 'A' : 'G',
    };
    // Overall: worst of the core dimensions; operational / procurement can lift green to amber but not to red
    let overall = worst([rag.financial, rag.schedule, rag.risk, rag.issues]);
    if (overall === 'G' || overall === 'N') overall = [rag.operational, rag.procurement].some(r => r === 'R' || r === 'A') ? 'A' : overall === 'N' ? 'G' : 'G';
    if (done) overall = 'G';

    const line: Record<Dim, string> = {
      financial: noCost ? 'No cost data yet' : `CPI ${cpi.toFixed(2)} · ${vac < 0 ? money(-vac) + ' forecast overrun' : 'forecast within budget'}`,
      schedule: `${Math.round(progress)}% done${planned != null ? ` vs ${Math.round(planned)}% planned` : ''}${ops?.overdue ? ` · ${ops.overdue} overdue tasks` : ''}`,
      operational: ops ? `${ops.done}/${ops.total} tasks done · ${ops.blocked} blocked` : 'Plan not loaded',
      risk: rstat ? `${rstat.open} open · ${rstat.crit} critical · ${rstat.high} high` : 'No risk data',
      issues: iss ? `${iss.open} open · ${iss.crit} critical · ${iss.aged} older than 30 days` : 'Issues not loaded',
      procurement: proc ? (proc.n ? `${proc.n} packages · ${money(proc.committed)} · ${proc.overdue} overdue` : 'No packages') : 'Not loaded',
    };

    return {
      ...raw, id, pfId: String(pf.id), pfName: pf.name, budget, ac, ev, pv, eac, vac, cpi, spi, progress, planned, done,
      start, end, risks, rstat, ops, phases, report, iss, proc, dim: rag, line, rag: overall as Rag,
      critical: rstat?.crit ?? 0, openRisks: rstat?.open ?? 0,
    };
  }));
}

// ---------------------------------------------------------------------------
// Aggregators (work on any list of projects: one, a portfolio, or everything)
// ---------------------------------------------------------------------------
const sum = (ps: P[], f: (p: P) => number) => ps.reduce((a, p) => a + f(p), 0);

export const aggFin = (ps: P[]) => {
  const ac = sum(ps, p => p.ac), ev = sum(ps, p => p.ev), pv = sum(ps, p => p.pv), budget = sum(ps, p => p.budget), eac = sum(ps, p => p.eac);
  return { budget, ac, ev, pv, eac, vac: budget - eac, overrun: sum(ps, p => Math.min(0, p.vac)), cpi: ac > 0 ? ev / ac : 1, spi: pv > 0 ? ev / pv : 1, burn: budget ? (ac / budget) * 100 : 0 };
};
export const aggSched = (ps: P[]) => {
  const withPlan = ps.filter(p => p.planned != null);
  const progress = ps.length ? sum(ps, p => p.progress) / ps.length : 0;
  const planned = withPlan.length ? sum(withPlan, p => p.planned) / withPlan.length : null;
  return { progress, planned, gap: planned == null ? 0 : planned - progress, overdue: sum(ps, p => p.ops?.overdue ?? 0), loaded: ps.some(p => p.ops) };
};
export const aggOps = (ps: P[]) => ({
  total: sum(ps, p => p.ops?.total ?? 0), done: sum(ps, p => p.ops?.done ?? 0), blocked: sum(ps, p => p.ops?.blocked ?? 0),
  onHold: sum(ps, p => p.ops?.onHold ?? 0), lateStart: sum(ps, p => p.ops?.lateStart ?? 0), overdue: sum(ps, p => p.ops?.overdue ?? 0), loaded: ps.some(p => p.ops),
});
export const aggRisk = (ps: P[]) => ({
  open: sum(ps, p => p.rstat?.open ?? 0), crit: sum(ps, p => p.rstat?.crit ?? 0), high: sum(ps, p => p.rstat?.high ?? 0),
  med: sum(ps, p => p.rstat?.med ?? 0), low: sum(ps, p => p.rstat?.low ?? 0), noMit: sum(ps, p => p.rstat?.noMit ?? 0), loaded: ps.some(p => p.rstat),
});
export const aggIssues = (ps: P[]) => {
  const total = sum(ps, p => p.iss?.total ?? 0), resolved = sum(ps, p => p.iss?.resolved ?? 0);
  return { total, open: sum(ps, p => p.iss?.open ?? 0), resolved, crit: sum(ps, p => p.iss?.crit ?? 0), high: sum(ps, p => p.iss?.high ?? 0), aged: sum(ps, p => p.iss?.aged ?? 0), resolvedPct: total ? (resolved / total) * 100 : 0, loaded: ps.some(p => p.iss) };
};
export const aggProc = (ps: P[]) => {
  const byVendor: Record<string, number> = {};
  ps.forEach(p => Object.entries(p.proc?.byVendor || {}).forEach(([v, n]) => { byVendor[v] = (byVendor[v] || 0) + (n as number); }));
  const committed = sum(ps, p => p.proc?.committed ?? 0), totalMs = sum(ps, p => p.proc?.totalMs ?? 0);
  const top = Object.entries(byVendor).sort((a, b) => b[1] - a[1]);
  return { n: sum(ps, p => p.proc?.n ?? 0), committed, overdue: sum(ps, p => p.proc?.overdue ?? 0), msPct: totalMs ? (sum(ps, p => p.proc?.completedMs ?? 0) / totalMs) * 100 : 0, byVendor: top, topShare: committed && top.length ? top[0][1] / committed : 0, loaded: ps.some(p => p.proc) };
};

export function rollCounts(ps: P[], dim: Dim) {
  const c = { R: 0, A: 0, G: 0, N: 0 };
  ps.forEach(p => c[p.dim[dim] as Rag]++);
  return c;
}
export function rollRag(ps: P[], dim: Dim): Rag {
  const c = rollCounts(ps, dim);
  return c.R ? 'R' : c.A ? 'A' : c.G ? 'G' : 'N';
}

// One-line summary shown on each dimension tile
export function dimSummary(ps: P[], dim: Dim): { rag: Rag; big: string; sub: string } {
  const rag = rollRag(ps, dim);
  switch (dim) {
    case 'financial': { const a = aggFin(ps); return { rag, big: a.cpi.toFixed(2), sub: a.overrun < 0 ? `${money(-a.overrun)} forecast overrun` : 'Forecast within budget' }; }
    case 'schedule': { const a = aggSched(ps); return { rag, big: `${Math.round(a.progress)}%`, sub: a.planned != null ? `vs ${Math.round(a.planned)}% planned` : 'planned % unavailable' }; }
    case 'operational': { const a = aggOps(ps); return a.loaded ? { rag, big: `${a.blocked}`, sub: `blocked · ${a.done}/${a.total} tasks done` } : { rag, big: '…', sub: 'Loading plan data' }; }
    case 'risk': { const a = aggRisk(ps); return a.loaded ? { rag, big: `${a.crit}`, sub: `critical · ${a.open} open` } : { rag, big: '—', sub: 'No risk data' }; }
    case 'issues': { const a = aggIssues(ps); return a.loaded ? { rag, big: `${a.crit + a.high}`, sub: `critical/high · ${a.open} open` } : { rag, big: '…', sub: 'Loading issues' }; }
    case 'procurement': { const a = aggProc(ps); return a.loaded ? { rag, big: money(a.committed), sub: `${a.overdue} overdue of ${a.n} packages` } : { rag, big: '…', sub: 'Loading procurement' }; }
  }
}

// ---------------------------------------------------------------------------
// Rule-based insights (always available; the AI briefing builds on the same facts)
// ---------------------------------------------------------------------------
export interface Insight { id: string; dim: Dim | 'good'; sev: 'critical' | 'warning' | 'info' | 'good'; title: string; detail: string; pfId?: string; projectId?: string }

export function buildInsights(ps: P[]): Insight[] {
  const out: Insight[] = [];
  const names = (xs: P[], n = 3) => xs.slice(0, n).map(p => p.name).join(', ') + (xs.length > n ? ` and ${xs.length - n} more` : '');
  const one = (xs: P[]) => (xs.length === 1 ? { pfId: xs[0].pfId, projectId: xs[0].id } : new Set(xs.map(p => p.pfId)).size === 1 ? { pfId: xs[0].pfId } : {});
  const live = ps.filter(p => !p.done);

  const finR = live.filter(p => p.dim.financial === 'R').sort((a, b) => a.vac - b.vac);
  const finA = live.filter(p => p.dim.financial === 'A');
  const fin = aggFin(ps);
  if (fin.overrun < 0) out.push({ id: 'fin-total', dim: 'financial', sev: finR.length ? 'critical' : 'warning', title: `Forecast overrun of ${money(-fin.overrun)} across ${ps.filter(p => p.vac < 0).length} project(s)`, detail: `Overall CPI is ${fin.cpi.toFixed(2)}. Largest: ${finR.slice(0, 2).map(p => `${p.name} (${money(-p.vac)})`).join(', ') || 'see Financial'}.`, ...one(finR.length ? finR : ps.filter(p => p.vac < 0)) });
  finA.slice(0, 2).forEach(p => out.push({ id: `fin-${p.id}`, dim: 'financial', sev: 'warning', title: `${p.name}: spending is ahead of progress`, detail: `${Math.round((p.ac / (p.budget || 1)) * 100)}% of budget used at ${Math.round(p.progress)}% complete (CPI ${p.cpi.toFixed(2)}).`, pfId: p.pfId, projectId: p.id }));

  const schR = live.filter(p => p.dim.schedule === 'R').sort((a, b) => a.spi - b.spi);
  if (schR.length) out.push({ id: 'sch', dim: 'schedule', sev: 'critical', title: `${schR.length} project(s) are well behind plan`, detail: schR.slice(0, 3).map(p => `${p.name}: ${Math.round(p.progress)}% done vs ${p.planned != null ? Math.round(p.planned) : '?'}% planned`).join(' · '), ...one(schR) });
  const od = aggSched(ps).overdue;
  if (od > 0) out.push({ id: 'overdue', dim: 'schedule', sev: 'warning', title: `${od} task(s) are past their end date`, detail: `Across ${ps.filter(p => (p.ops?.overdue ?? 0) > 0).length} project(s). Open Against plan for the list.`, ...one(ps.filter(p => (p.ops?.overdue ?? 0) > 0)) });

  const ops = aggOps(ps);
  if (ops.blocked > 0) out.push({ id: 'ops', dim: 'operational', sev: ops.blocked >= 3 ? 'critical' : 'warning', title: `${ops.blocked} blocked task(s), ${ops.onHold} on hold`, detail: `Projects affected: ${names(ps.filter(p => (p.ops?.blocked ?? 0) > 0))}.`, ...one(ps.filter(p => (p.ops?.blocked ?? 0) > 0)) });

  const rk = aggRisk(ps);
  if (rk.crit > 0) out.push({ id: 'risk-c', dim: 'risk', sev: 'critical', title: `${rk.crit} critical risk(s) open`, detail: ps.filter(p => (p.rstat?.crit ?? 0) > 0).slice(0, 3).map(p => `${p.name}: ${p.rstat.list.find((r: any) => r.level === 'CRITICAL')?.title}`).join(' · '), ...one(ps.filter(p => (p.rstat?.crit ?? 0) > 0)) });
  if (rk.noMit > 0) out.push({ id: 'risk-m', dim: 'risk', sev: 'warning', title: `${rk.noMit} high/critical risk(s) have no mitigation plan`, detail: `Projects: ${names(ps.filter(p => (p.rstat?.noMit ?? 0) > 0))}.`, ...one(ps.filter(p => (p.rstat?.noMit ?? 0) > 0)) });

  const is = aggIssues(ps);
  if (is.crit > 0) out.push({ id: 'iss-c', dim: 'issues', sev: 'critical', title: `${is.crit} critical issue(s) unresolved`, detail: ps.filter(p => (p.iss?.crit ?? 0) > 0).slice(0, 3).map(p => `${p.name}: ${p.iss.list.find((i: any) => i.sev === 'CRITICAL')?.title}`).join(' · '), ...one(ps.filter(p => (p.iss?.crit ?? 0) > 0)) });
  if (is.aged > 0) out.push({ id: 'iss-a', dim: 'issues', sev: 'warning', title: `${is.aged} open issue(s) older than 30 days`, detail: `Resolution rate to date is ${Math.round(is.resolvedPct)}%.`, ...one(ps.filter(p => (p.iss?.aged ?? 0) > 0)) });

  const pc = aggProc(ps);
  if (pc.overdue > 0) out.push({ id: 'proc-o', dim: 'procurement', sev: pc.overdue >= 2 ? 'critical' : 'warning', title: `${pc.overdue} procurement package(s) past their end date`, detail: `Projects: ${names(ps.filter(p => (p.proc?.overdue ?? 0) > 0))}.`, ...one(ps.filter(p => (p.proc?.overdue ?? 0) > 0)) });
  if (pc.byVendor.length >= 2 && pc.topShare > 0.5) out.push({ id: 'proc-v', dim: 'procurement', sev: 'info', title: `${pc.byVendor[0][0]} holds ${Math.round(pc.topShare * 100)}% of committed value`, detail: `${money(pc.byVendor[0][1])} of ${money(pc.committed)} committed. Consider vendor concentration risk.` });

  const green = ps.filter(p => p.rag === 'G').length;
  if (green > 0) out.push({ id: 'good', dim: 'good', sev: 'good', title: `${green} of ${ps.length} project(s) are on track`, detail: `Cost and schedule indexes are healthy and no critical risks or issues are open on these.` });

  const order = { critical: 0, warning: 1, info: 2, good: 3 };
  return out.sort((a, b) => order[a.sev] - order[b.sev]).slice(0, 14);
}

// ---------------------------------------------------------------------------
// Compact, grounded context for the AI briefing (kept small on purpose)
// ---------------------------------------------------------------------------
export function buildAIContext(ps: P[], scope: string, focus: string, insights: Insight[], dims?: Record<string, any>) {
  const fin = aggFin(ps), sc = aggSched(ps), rk = aggRisk(ps), is = aggIssues(ps), pc = aggProc(ps), op = aggOps(ps);
  const order: Record<Rag, number> = { R: 0, A: 1, G: 2, N: 3 };
  const sorted = [...ps].sort((a, b) => order[a.rag as Rag] - order[b.rag as Rag]);
  const d = Object.values(dims || {}) as any[];
  return {
    scope, focus, asOf: new Date().toISOString().slice(0, 10), projectCount: ps.length,
    dataLoaded: { issues: d.some(x => x?.issues), procurement: d.some(x => x?.packages), planning: d.some(x => x?.planning) },
    totals: {
      budget: Math.round(fin.budget), actualCost: Math.round(fin.ac), forecastAtCompletion: Math.round(fin.eac), forecastOverrun: Math.round(-fin.overrun),
      cpi: +fin.cpi.toFixed(2), spi: +fin.spi.toFixed(2), avgProgressPct: Math.round(sc.progress), avgPlannedPct: sc.planned == null ? null : Math.round(sc.planned),
      overdueTasks: sc.overdue, blockedTasks: op.blocked, openRisks: rk.open, criticalRisks: rk.crit, highRisksWithoutMitigation: rk.noMit,
      openIssues: is.open, criticalIssues: is.crit, issuesOlderThan30d: is.aged, procurementPackages: pc.n, procurementCommitted: Math.round(pc.committed), overduePackages: pc.overdue,
    },
    dimensionStatus: Object.fromEntries(DIMS.map(x => [x.key, rollCounts(ps, x.key)])),
    projects: sorted.slice(0, 40).map(p => ({
      name: p.name, portfolio: p.pfName, overall: p.rag, status: p.dim, cpi: +p.cpi.toFixed(2), spi: +p.spi.toFixed(2),
      progressPct: Math.round(p.progress), plannedPct: p.planned == null ? null : Math.round(p.planned),
      budget: Math.round(p.budget), actualCost: Math.round(p.ac), forecastOverrun: Math.round(Math.max(0, -p.vac)), endDate: p.endDate || null,
      risks: p.rstat ? { open: p.rstat.open, critical: p.rstat.crit, high: p.rstat.high, noMitigation: p.rstat.noMit, top: p.rstat.list.slice(0, 2).map((r: any) => r.title) } : null,
      issues: p.iss ? { open: p.iss.open, critical: p.iss.crit, older30d: p.iss.aged, top: p.iss.list.slice(0, 2).map((i: any) => i.title) } : null,
      procurement: p.proc ? { packages: p.proc.n, committed: Math.round(p.proc.committed), overdue: p.proc.overdue } : null,
      work: p.ops ? { tasks: p.ops.total, done: p.ops.done, blocked: p.ops.blocked, overdue: p.ops.overdue, stuck: p.ops.stuckList.slice(0, 2).map((t: any) => t.name) } : null,
      latestReportBlockers: p.report?.blockers || null,
    })),
    omittedProjects: Math.max(0, ps.length - 40),
    ruleBasedFindings: insights.slice(0, 12).map(i => ({ dimension: i.dim, severity: i.sev, title: i.title, detail: i.detail })),
  };
}