// Sector / cluster tabs -> project table (phase, progress, financial + operational health) -> project detail.
// Every figure comes from the same endpoints and formulas as ProjectDetail (lib/projects/metrics.ts + computePlanModel).
// Visibility: the CEO sees every project; a project manager sees only the projects they manage.
"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Search, X, ArrowUpRight, Loader2 } from "lucide-react";
import {
  computePlanModel,
  getDelay,
  progressOf,
  effectiveStatus,
  type PlanItem,
} from "@/components/projects/ProjectPlan";
import {
  computeEvm,
  financialSource,
  fetchAllMetrics,
  type ProjectRaw,
} from "@/lib/projects/metrics";
import { visiblePortfolios, explainAccess } from "@/lib/projects/access";

type Rag = "R" | "A" | "G" | "N";
const PHASES = ["Initiation", "Planning", "Executing", "Closure"] as const;

// ---------------------------------------------------------------------------
// Tokens + helpers (red / yellow / green are reserved for health)
// ---------------------------------------------------------------------------
const DOT: Record<Rag, string> = {
  R: "bg-eih-danger",
  A: "bg-eih-gold-light",
  G: "bg-eih-success",
  N: "bg-eih-neutral",
};
const SOFT: Record<Rag, string> = {
  R: "bg-eih-danger-soft text-eih-danger-ink",
  A: "bg-eih-warn-soft text-eih-warn-ink",
  G: "bg-eih-success-soft text-eih-success-ink",
  N: "bg-eih-neutral-soft text-eih-muted",
};
const LABEL: Record<Rag, string> = {
  R: "Off track",
  A: "At risk",
  G: "Healthy",
  N: "No data",
};
const RANK: Record<Rag, number> = { R: 0, A: 1, G: 2, N: 3 };
const TONE = {
  red: "text-eih-danger",
  amber: "text-eih-warn-ink",
  green: "text-eih-success",
};
const idxTone = (v: number | null) =>
  v == null
    ? "text-eih-muted"
    : v >= 1
      ? TONE.green
      : v >= 0.95
        ? TONE.amber
        : TONE.red;

const num = (v: any, d = 0) => {
  const n = typeof v === "number" ? v : parseFloat(v);
  return isNaN(n) ? d : n;
};
const clamp = (n: number) => Math.min(Math.max(n, 0), 100);
const money = (n: number | null | undefined) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(n);
const fmtDate = (v?: any) => {
  const d = v ? new Date(v) : null;
  return d && !isNaN(d.getTime())
    ? d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";
};
const lvl = (r: any) => String(r.riskLevel || r.risk_level || "").toUpperCase();
const nstat = (s: any) =>
  String(s || "")
    .toUpperCase()
    .replace(/_/g, " ")
    .trim();
const worst = (a: Rag, b: Rag): Rag => {
  const k = [a, b].filter((x) => x !== "N");
  return !k.length ? "N" : k.includes("R") ? "R" : k.includes("A") ? "A" : "G";
};
const barColor = (v: number) => (v >= 70 ? DOT.G : v >= 40 ? DOT.A : DOT.R);
const burnColor = (burn: number, prog: number) =>
  burn > prog + 12 ? DOT.R : burn > prog + 5 ? DOT.A : DOT.G;

const phaseOf = (status: any, planItems: PlanItem[] = [], byId = new Map<string, PlanItem>()) => {
  const phases = planItems.filter((item) => item.isPhase);
  if (phases.length) {
    const normalized = phases.map((item) => ({
      item,
      name: item.name.toLowerCase(),
      complete: effectiveStatus(item, byId) === "Completed",
    }));
    const firstOpen = normalized.findIndex((phase) => !phase.complete);
    if (firstOpen >= 0) {
      const name = normalized[firstOpen].name;
      if (name.includes("init")) return 0;
      if (name.includes("plan")) return 1;
      if (name.includes("clos") || name.includes("handover")) return 3;
      return 2;
    }
    return 3;
  }
  const v = String(status || "").toUpperCase();
  if (v.startsWith("INIT")) return 0;
  if (v.startsWith("PLAN")) return 1;
  if (v.startsWith("CLOS") || v === "COMPLETED") return 3;
  return 2;
};

// ---------------------------------------------------------------------------
// One project's figures: ProjectDetail's formulas on ProjectDetail's data.
// `raw` is what /api/financial and /api/planning return; until it arrives the server-loaded values are used.
// ---------------------------------------------------------------------------
function model(p: any, pf: any, raw?: ProjectRaw | null) {
  const id = String(p.id);
  const src = raw?.financial
    ? financialSource(raw.financial, id)
    : p.financials || {};
  const costs = (
    Array.isArray(raw?.financial?.recentCosts) ? raw!.financial.recentCosts : []
  ).filter((c: any) => String(c?.projectId) === id);
  const pm = raw?.planning
    ? computePlanModel(raw.planning, null, id, costs)
    : null;
  const e = computeEvm(
    src,
    p,
    pm
      ? {
          bac: pm.totalBudget || null,
          pv: pm.pv,
          ev: pm.ev,
          actual: pm.costsTotal,
        }
      : null,
  );

  const budget = num(e.bac),
    ac = num(e.ac),
    ev = num(e.ev),
    pv = num(e.pv);
  const cpi = e.cpi ?? 1,
    spi = e.spi ?? 1; // neutral when a figure can't be computed
  const eac = e.eac ?? budget,
    vac = e.vac ?? 0;

  const planItems: PlanItem[] = pm?.items ?? [];
  const byId = pm?.byId ?? new Map<string, PlanItem>();
  const planProgress = pm?.progress ?? null;
  const progress =
    planProgress ?? clamp(num(p.percentComplete ?? p.percent_complete));

  const s = p.startDate ? new Date(p.startDate) : null,
    en = p.endDate ? new Date(p.endDate) : null;
  const timePct =
    s && en && en > s
      ? clamp(((Date.now() - s.getTime()) / (en.getTime() - s.getTime())) * 100)
      : null;
  const planned =
    pv > 0 && budget > 0
      ? clamp((pv / budget) * 100)
      : (pm?.planned ?? timePct);
  const done = p.status === "COMPLETED" || progress >= 100;

  const risks = (p.risks || []).filter(
    (r: any) => nstat(r.status) !== "CLOSED",
  );
  const crit = risks.filter((r: any) => lvl(r) === "CRITICAL").length;
  const high = risks.filter((r: any) => lvl(r) === "HIGH").length;

  const burn = budget ? (ac / budget) * 100 : 0;
  const overrunPct = budget ? (-vac / budget) * 100 : 0;
  const noCost = !ac && !ev && !pv;
  const fin: Rag = noCost
    ? "N"
    : cpi < 0.85 || overrunPct > 10
      ? "R"
      : cpi < 0.95 || overrunPct > 3 || burn - progress > 15
        ? "A"
        : "G";
  const gap = planned == null ? 0 : planned - progress;
  const op: Rag = done
    ? "G"
    : spi < 0.85 || gap > 15 || crit > 0
      ? "R"
      : spi < 0.95 || gap > 7 || high >= 2
        ? "A"
        : "G";

  const finWhy = noCost
    ? "No cost data yet"
    : e.cpi == null
      ? `${money(ac)} spent · CPI not available`
      : `CPI ${cpi.toFixed(2)}${vac < 0 ? ` · ${money(-vac)} over` : " · within budget"}`;
  const opWhy = `SPI ${e.spi == null ? "n/a" : spi.toFixed(2)}${gap > 7 ? ` · ${Math.round(gap)} pts behind` : ""}${crit ? ` · ${crit} critical risk${crit > 1 ? "s" : ""}` : ""}`;

  return {
    ...p,
    id,
    pfId: String(pf.id),
    pfName: pf.name,
    budget,
    ac,
    ev,
    pv,
    cpi,
    spi,
    eac,
    vac,
    cpiN: e.cpi,
    spiN: e.spi,
    eacN: e.eac,
    vacN: e.vac,
    progress,
    planned,
    done,
    fromPlan: planProgress != null,
    ready: !!raw,
    planItems,
    byId,
    risks,
    crit,
    high,
    burn,
    fin,
    op,
    health: worst(fin, op),
    finWhy,
    opWhy,
    phase: phaseOf(p.status, planItems, byId),
  };
}

// ---------------------------------------------------------------------------
// Small parts
// ---------------------------------------------------------------------------
const Pill = ({ r }: { r: Rag }) => (
  <span
    className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${SOFT[r]}`}
  >
    <span className={`h-2 w-2 rounded-full ${DOT[r]}`} />
    {LABEL[r]}
  </span>
);
const Bar = ({
  v,
  color,
  h = "h-1.5",
}: {
  v: number;
  color: string;
  h?: string;
}) => (
  <div className={`${h} w-full overflow-hidden rounded-full bg-eih-line/60`}>
    <div
      className={`h-full rounded-full transition-all duration-700 ${color}`}
      style={{ width: `${clamp(v)}%` }}
    />
  </div>
);
const Kpi = ({
  label,
  value,
  sub,
  tone = "",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) => (
  <div className="group rounded-2xl border border-eih-line/70 bg-card/95 p-4 shadow-[0_8px_24px_rgba(15,46,38,0.05)] transition hover:-translate-y-0.5 hover:border-[#ad9d6f]/50 hover:shadow-[0_14px_30px_rgba(15,46,38,0.10)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.20)] dark:hover:shadow-[0_14px_30px_rgba(0,0,0,0.32)]">
    <div className="text-[11px] font-semibold uppercase tracking-wide text-eih-muted">
      {label}
    </div>
    <div
      className={`mt-1 font-serif text-[26px] leading-tight ${tone || "text-eih-ink"}`}
    >
      {value}
    </div>
    {sub && <div className="text-xs text-eih-muted">{sub}</div>}
  </div>
);
const Card = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <section className="overflow-hidden rounded-2xl border border-eih-line/70 bg-card/95 shadow-[0_8px_24px_rgba(15,46,38,0.05)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.20)]">
    <h4 className="border-b border-eih-line/60 px-4 py-2.5 text-sm font-semibold text-eih-ink">
      {title}
    </h4>
    {children}
  </section>
);
const Row = ({
  a,
  b,
  c,
}: {
  a: React.ReactNode;
  b?: React.ReactNode;
  c?: string;
}) => (
  <div className="flex items-center justify-between gap-3 border-b border-eih-line/40 px-4 py-2 text-[13px] last:border-0">
    <span className="min-w-0 truncate text-eih-ink">{a}</span>
    {b && (
      <span className={`shrink-0 text-xs ${c || "text-eih-muted"}`}>{b}</span>
    )}
  </div>
);
const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="px-4 py-5 text-center text-sm text-eih-muted">{children}</p>
);

function PhaseMini({ idx }: { idx: number }) {
  return (
    <div className="min-w-[110px]">
      <div className="flex gap-1">
        {PHASES.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full ${i < idx ? "bg-eih-green/45" : i === idx ? "bg-eih-green" : "bg-eih-line"}`}
          />
        ))}
      </div>
      <div className="mt-1 text-xs font-semibold text-eih-ink">
        {PHASES[idx]}
      </div>
    </div>
  );
}
function PhaseSteps({ idx }: { idx: number }) {
  return (
    <ol className="flex items-center gap-2">
      {PHASES.map((ph, i) => (
        <li key={ph} className="flex flex-1 items-center gap-2">
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${i < idx ? "bg-eih-green/15 text-eih-ink" : i === idx ? "bg-eih-green text-eih-on-green ring-4 ring-eih-gold/25" : "bg-eih-cream text-eih-ink/40"}`}
          >
            {i < idx ? "✓" : i + 1}
          </span>
          <span
            className={`text-xs ${i === idx ? "font-semibold text-eih-ink" : "text-eih-muted"}`}
          >
            {ph}
          </span>
          {i < PHASES.length - 1 && (
            <span
              className={`h-0.5 flex-1 rounded-full ${i < idx ? "bg-eih-green/40" : "bg-eih-line"}`}
            />
          )}
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Project detail (opens under the table)
// ---------------------------------------------------------------------------
const fetcher = async (u: string) => {
  const r = await fetch(u);
  if (!r.ok) throw new Error("load failed");
  return r.json();
};
const OPEN_BTN =
  "inline-flex items-center gap-1 rounded-lg bg-eih-green px-3 py-1.5 text-sm font-medium text-white hover:bg-eih-green-light";

function ProjectPanel({
  p,
  onClose,
  onOpenProject,
}: {
  p: any;
  onClose: () => void;
  onOpenProject?: (projectId: string) => void;
}) {
  const opt = { revalidateOnFocus: false, shouldRetryOnError: false };
  const { data: issues, isLoading: li } = useSWR<any>(
    `/api/issues?projectId=${p.id}`,
    fetcher,
    opt,
  );
  const { data: proc, isLoading: lc } = useSWR<any>(
    `/api/procurement?projectId=${p.id}`,
    fetcher,
    opt,
  );

  const ops = useMemo(() => {
    const items: PlanItem[] = p.planItems;
    if (!items.length) return null;
    const leaves = items.filter((i) => !i.isPhase && !i.children.length);
    const overdue = leaves.filter(
      (t) => t.status !== "Completed" && getDelay(t, t.status).tone === "late",
    );
    return {
      total: leaves.length,
      done: leaves.filter((t) => t.status === "Completed").length,
      blocked: leaves.filter((t) => t.status === "Blocked").length,
      onHold: leaves.filter((t) => t.status === "On hold").length,
      overdue: overdue.length,
      phases: items
        .filter((i) => i.isPhase)
        .map((ph) => ({
          name: ph.name,
          progress: progressOf(ph, p.byId),
          weight: ph.weight,
        })),
    };
  }, [p]);

  const openIssues = useMemo(() => {
    const arr: any[] = Array.isArray(issues)
      ? issues
      : (issues?.data ?? issues?.issues ?? []);
    const sev: Record<string, number> = {
      CRITICAL: 0,
      HIGH: 1,
      MEDIUM: 2,
      LOW: 3,
    };
    return arr
      .filter(
        (i) => !["RESOLVED", "CLOSED"].includes(String(i.status).toUpperCase()),
      )
      .sort(
        (a, b) =>
          (sev[String(a.severity).toUpperCase()] ?? 9) -
          (sev[String(b.severity).toUpperCase()] ?? 9),
      );
  }, [issues]);

  const packages: any[] = proc?.packages || [];
  const committed = packages.reduce(
    (s, x) => s + num(x.totalContractValue ?? x.contractValue),
    0,
  );
  const lateTotal = packages.reduce((s, x) => s + num(x.overdueMilestones), 0);
  const order = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
  const risks = [...p.risks].sort(
    (a: any, b: any) => order.indexOf(lvl(a)) - order.indexOf(lvl(b)),
  );
  const scale = Math.max(p.budget, p.pv, p.ev, p.ac, p.eac, 1);

  return (
    <div
      id="project-detail"
      className="space-y-3 border-t-4 border-eih-line bg-eih-cream-soft p-4 md:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-serif text-2xl text-eih-ink">{p.name}</h3>
            <Pill r={p.health} />
          </div>
          <p className="text-sm text-eih-muted">
            {p.code} · {p.managerName || "No manager assigned"} ·{" "}
            {fmtDate(p.startDate)} to {fmtDate(p.endDate)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(li || lc || !p.ready) && (
            <span className="flex items-center gap-1.5 text-xs text-eih-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading detail…
            </span>
          )}
          {onOpenProject ? (
            <button onClick={() => onOpenProject(p.id)} className={OPEN_BTN}>
              Open full project <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <Link href={`/projects/${p.id}`} className={OPEN_BTN}>
              Open full project <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          )}
          <button
            onClick={onClose}
            aria-label="Close detail"
            className="rounded-lg p-1.5 text-eih-ink/60 hover:bg-eih-cream"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-eih-line/70 bg-card p-4">
        <PhaseSteps idx={p.phase} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Kpi
          label="Progress"
          value={`${Math.round(p.progress)}%`}
          sub={p.fromPlan ? "weighted plan progress" : "from project record"}
          tone={
            p.progress >= 70
              ? TONE.green
              : p.progress >= 40
                ? TONE.amber
                : TONE.red
          }
        />
        <Kpi
          label="Budget"
          value={money(p.budget)}
          sub={`${money(p.ac)} spent (${Math.round(p.burn)}%)`}
        />
        <Kpi
          label="Cost index (CPI)"
          value={p.cpiN == null ? "—" : p.cpiN.toFixed(2)}
          sub={
            p.cpiN == null
              ? undefined
              : p.cpiN >= 1
                ? "under cost"
                : "over cost"
          }
          tone={idxTone(p.cpiN)}
        />
        <Kpi
          label="Schedule index (SPI)"
          value={p.spiN == null ? "—" : p.spiN.toFixed(2)}
          sub={
            p.spiN == null
              ? undefined
              : p.spiN >= 1
                ? "on or ahead"
                : "behind plan"
          }
          tone={idxTone(p.spiN)}
        />
        <Kpi
          label="Open risks"
          value={String(p.risks.length)}
          sub={`${p.crit} critical · ${p.high} high`}
          tone={p.crit ? TONE.red : ""}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Financial health">
          <div className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <Pill r={p.fin} />
              <span className="text-xs text-eih-muted">{p.finWhy}</span>
            </div>
            {(
              [
                ["Planned value", p.pv, "bg-eih-gray"],
                ["Earned value", p.ev, DOT.G],
                ["Actual cost", p.ac, burnColor(p.burn, p.progress)],
                ["Forecast at completion", p.eac, p.vac < 0 ? DOT.R : DOT.G],
                ["Budget", p.budget, "bg-eih-green"],
              ] as [string, number, string][]
            ).map(([l, v, c]) => (
              <div key={l}>
                <div className="mb-0.5 flex justify-between text-xs">
                  <span className="text-eih-ink">{l}</span>
                  <span className="text-eih-muted">{money(v)}</span>
                </div>
                <Bar v={(v / scale) * 100} color={c} />
              </div>
            ))}
          </div>
        </Card>

        <Card title="Operational health">
          <div className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <Pill r={p.op} />
              <span className="text-xs text-eih-muted">{p.opWhy}</span>
            </div>
            {ops ? (
              <>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {(
                    [
                      ["Done", `${ops.done}/${ops.total}`, ""],
                      ["Blocked", ops.blocked, ops.blocked ? TONE.red : ""],
                      ["On hold", ops.onHold, ops.onHold ? TONE.amber : ""],
                      ["Overdue", ops.overdue, ops.overdue ? TONE.red : ""],
                    ] as [string, any, string][]
                  ).map(([l, v, t]) => (
                    <div key={l} className="rounded-lg bg-eih-cream-soft p-2">
                      <div
                        className={`text-lg font-semibold ${t || "text-eih-ink"}`}
                      >
                        {v}
                      </div>
                      <div className="text-[11px] text-eih-muted">{l}</div>
                    </div>
                  ))}
                </div>
                {ops.phases.map((ph) => (
                  <div key={ph.name}>
                    <div className="mb-0.5 flex justify-between text-xs">
                      <span className="text-eih-ink">{ph.name}</span>
                      <span className="text-eih-muted">
                        {ph.progress}% · weight {ph.weight}
                      </span>
                    </div>
                    <Bar v={ph.progress} color={barColor(ph.progress)} />
                  </div>
                ))}
              </>
            ) : (
              <p className="text-sm text-eih-muted">
                {p.ready
                  ? "No plan items have been entered for this project."
                  : "Loading plan…"}
              </p>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card title={`Risks (${p.risks.length})`}>
          {risks.length ? (
            risks
              .slice(0, 5)
              .map((r: any) => (
                <Row
                  key={r.id}
                  a={r.title}
                  b={lvl(r).toLowerCase()}
                  c={
                    lvl(r) === "CRITICAL"
                      ? `${TONE.red} font-semibold`
                      : lvl(r) === "HIGH"
                        ? TONE.amber
                        : ""
                  }
                />
              ))
          ) : (
            <Empty>No open risks.</Empty>
          )}
        </Card>
        <Card title={`Open issues (${openIssues.length})`}>
          {openIssues.length ? (
            openIssues
              .slice(0, 5)
              .map((i: any) => (
                <Row
                  key={i.id}
                  a={i.title}
                  b={String(i.severity).toLowerCase()}
                  c={
                    String(i.severity).toUpperCase() === "CRITICAL"
                      ? `${TONE.red} font-semibold`
                      : String(i.severity).toUpperCase() === "HIGH"
                        ? TONE.amber
                        : ""
                  }
                />
              ))
          ) : (
            <Empty>{li ? "Loading…" : "No open issues."}</Empty>
          )}
        </Card>
        <Card title={`Procurement (${packages.length} packages)`}>
          {packages.length ? (
            <>
              <Row
                a={<b>Committed</b>}
                b={`${money(committed)}${lateTotal ? ` · ${lateTotal} overdue milestone${lateTotal > 1 ? "s" : ""}` : ""}`}
                c={lateTotal ? TONE.red : ""}
              />
              {packages.slice(0, 4).map((x: any) => (
                <Row
                  key={x.id}
                  a={x.title || x.name}
                  b={String(x.status || "")
                    .toLowerCase()
                    .replace(/_/g, " ")}
                />
              ))}
            </>
          ) : (
            <Empty>{lc ? "Loading…" : "No procurement packages."}</Empty>
          )}
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
export function CEOExecutiveDashboard({
  portfolios,
  portfolioMetrics,
  user,
  onOpenProject,
}: {
  portfolios?: any[];
  portfolioMetrics?: any[];
  user?: any;
  onOpenProject?: (projectId: string) => void;
}) {
  // Role filter: CEO = everything, project manager = only projects whose managerId is theirs, nobody = nothing.
  const source = useMemo(
    () => visiblePortfolios(user, portfolios ?? portfolioMetrics ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.id, user?.role, portfolios, portfolioMetrics],
  );
  // What the server handed us, before any role filtering (used to explain an empty screen).
  const incoming: any[] = portfolios ?? portfolioMetrics ?? [];
  const received = incoming.reduce(
    (n: number, pf: any) =>
      n + (Array.isArray(pf?.projects) ? pf.projects.length : 0),
    0,
  );
  const firstIncoming = incoming.flatMap((pf: any) => pf?.projects || [])[0];
  const [openPf, setOpenPf] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [attentionOnly, setAttentionOnly] = useState(false);

  // Each project's figures come from the same endpoints ProjectDetail uses
  const ids = useMemo(
    () =>
      source.flatMap((pf: any) =>
        (pf.projects || []).map((x: any) => String(x.id)),
      ),
    [source],
  );
  const { data: metrics, isLoading: loadingMetrics } = useSWR(
    ids.length ? ["exec-metrics", ids.join(",")] : null,
    fetchAllMetrics,
    { revalidateOnFocus: false },
  );

  const groups = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return source
      .map((pf: any) => {
        const all = (pf.projects || []).map((p: any) =>
          model(p, pf, metrics?.[String(p.id)]),
        );
        const shown = all
          .filter(
            (p: any) =>
              (!needle ||
                `${p.name} ${p.code || ""} ${p.managerName || ""}`
                  .toLowerCase()
                  .includes(needle)) &&
              (!attentionOnly || p.health === "R" || p.health === "A"),
          )
          .sort(
            (a: any, b: any) =>
              RANK[a.health as Rag] - RANK[b.health as Rag] ||
              a.name.localeCompare(b.name),
          );
        const c = { R: 0, A: 0, G: 0, N: 0 };
        all.forEach((p: any) => c[p.health as Rag]++);
        const budget = all.reduce((s: number, p: any) => s + p.budget, 0),
          spent = all.reduce((s: number, p: any) => s + p.ac, 0);
        // budget-weighted, so a large project counts more than a small one
        const progress =
          budget > 0
            ? all.reduce((s: number, p: any) => s + p.progress * p.budget, 0) /
              budget
            : all.length
              ? all.reduce((s: number, p: any) => s + p.progress, 0) /
                all.length
              : 0;
        const health: Rag = c.R ? "R" : c.A ? "A" : c.G ? "G" : "N";
        return {
          id: String(pf.id),
          name: pf.name,
          code: pf.code,
          all,
          shown,
          c,
          budget,
          spent,
          progress,
          health,
        };
      })
      .filter((g) => (!search && !attentionOnly) || g.shown.length)
      .sort(
        (a, b) =>
          RANK[a.health] - RANK[b.health] || a.name.localeCompare(b.name),
      );
  }, [source, metrics, search, attentionOnly]);

  const everyone = groups.flatMap((g) => g.all);
  const attention = everyone.filter(
    (p) => p.health === "R" || p.health === "A",
  ).length;
  const totalBudget = everyone.reduce((s, p) => s + p.budget, 0),
    totalSpent = everyone.reduce((s, p) => s + p.ac, 0);
  const avgProgress =
    totalBudget > 0
      ? everyone.reduce((s, p) => s + p.progress * p.budget, 0) / totalBudget
      : everyone.length
        ? everyone.reduce((s, p) => s + p.progress, 0) / everyone.length
        : 0;
  const settling = !metrics && loadingMetrics;

  useEffect(() => {
    if (groups.length && !groups.some((g) => g.id === openPf))
      setOpenPf(groups[0].id);
  }, [groups, openPf]);
  useEffect(() => {
    if (selected)
      document
        .getElementById("project-detail")
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selected]);

  const fade = settling ? "opacity-50" : "";

  return (
    <div className="relative -m-6 min-h-screen overflow-x-clip bg-background p-4 text-eih-ink md:p-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top_right,rgba(173,157,111,0.16),transparent_42%),linear-gradient(180deg,rgba(27,59,52,0.05),transparent_68%)] dark:bg-[radial-gradient(circle_at_top_right,rgba(173,157,111,0.12),transparent_42%),linear-gradient(180deg,rgba(27,59,52,0.20),transparent_68%)]" />
      <div className="relative mx-auto max-w-[1240px] space-y-4">
        <section
          className={`flex flex-col justify-between gap-4 rounded-2xl border border-eih-line/70 bg-card/75 px-5 py-4 shadow-[0_12px_30px_rgba(15,46,38,0.05)] backdrop-blur-sm sm:flex-row sm:items-end dark:shadow-[0_12px_30px_rgba(0,0,0,0.20)] ${fade}`}
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#ad9d6f]">
              Chief executive office · sector / cluster oversight
            </p>
            <h1 className="mt-1 font-serif text-2xl tracking-tight text-eih-ink md:text-3xl">
              Enterprise sector / cluster review
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-eih-muted">
              A consolidated view of delivery, financial exposure and emerging
              attention items across the EIH sector and cluster portfolio.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-eih-muted">
            <span className="h-2 w-2 rounded-full bg-eih-success shadow-[0_0_0_4px_rgba(31,138,76,0.14)]" />
            Live portfolio view
          </div>
        </section>

        <section className={`grid grid-cols-2 gap-3 lg:grid-cols-4 ${fade}`}>
          <Kpi
label="Sectors / clusters"
            value={String(groups.length)}
            sub={`${everyone.length} projects`}
          />
          <Kpi
            label="Total budget"
            value={money(totalBudget)}
            sub={`${money(totalSpent)} spent (${totalBudget ? Math.round((totalSpent / totalBudget) * 100) : 0}%)`}
          />
          <Kpi
            label="Projects needing attention"
            value={String(attention)}
            sub="financial or operational"
            tone={attention ? TONE.red : TONE.green}
          />
          <Kpi
            label="Average progress"
            value={`${Math.round(avgProgress)}%`}
            sub="budget-weighted; plan progress where a plan exists"
          />
        </section>

        <div className="flex flex-col gap-3 rounded-2xl border border-eih-line/70 bg-card/95 p-3 shadow-[0_8px_24px_rgba(15,46,38,0.05)] backdrop-blur-sm md:flex-row md:items-center dark:shadow-[0_8px_24px_rgba(0,0,0,0.20)]">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-eih-ink/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search project, code or manager…"
              className="w-full rounded-lg border border-eih-line bg-eih-cream-soft py-2 pl-10 pr-3 text-sm outline-none transition focus:border-eih-gold focus:bg-card focus:ring-2 focus:ring-eih-gold/20"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={attentionOnly}
              onChange={(e) => setAttentionOnly(e.target.checked)}
              className="h-4 w-4 accent-eih-green"
            />
            Needs attention only
          </label>
          <div className="hidden items-center gap-3 text-xs text-eih-muted lg:flex">
            {(["G", "A", "R"] as Rag[]).map((k) => (
              <span key={k} className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${DOT[k]}`} />
                {LABEL[k]}
              </span>
            ))}
          </div>
        </div>

        {incoming.length > 0 && received === 0 && (
          <div className="rounded-xl border border-eih-gold/50 bg-eih-warn-soft p-4 text-sm text-eih-warn-ink">
            <b>
              {incoming.length} portfolio(s) arrived but none has a{" "}
              <code>projects</code> array.
            </b>{" "}
            Keys on the first portfolio:{" "}
            {Object.keys(incoming[0] || {}).join(", ") || "none"}. Attach each
            portfolio&apos;s project rows as <code>projects</code>.
          </div>
        )}
        {received > 0 && !everyone.length && !search && !attentionOnly && (
          <div className="rounded-xl border border-eih-danger/30 bg-eih-danger-soft p-4 text-sm text-eih-danger-ink">
            <b>
              {received} project(s) were loaded but none are visible to you.
            </b>{" "}
            {explainAccess(user, firstIncoming)}
            <div className="mt-1 text-xs opacity-80">
              Signed in as: role “{String(user?.role ?? "unknown")}”, id “
              {String(user?.id ?? "none")}”.
            </div>
          </div>
        )}

        {groups.length > 0 &&
          (() => {
            const g = groups.find((x) => x.id === openPf) || groups[0];
            const sel = g.all.find((p: any) => p.id === selected) || null;
            return (
              <>
                <div
                  role="tablist"
                  aria-label="Sectors and clusters"
                  className="flex gap-1 overflow-x-auto rounded-2xl border border-eih-line/70 bg-card/95 p-1.5 shadow-[0_8px_24px_rgba(15,46,38,0.05)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.20)]"
                >
                  {groups.map((x) => {
                    const active = x.id === g.id;
                    return (
                      <button
                        key={x.id}
                        role="tab"
                        aria-selected={active}
                        onClick={() => {
                          setOpenPf(x.id);
                          setSelected(null);
                        }}
                        className={`flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${active ? "bg-eih-green text-white shadow-sm" : "text-eih-muted hover:bg-eih-cream/60 hover:text-eih-ink"}`}
                      >
                        <span
                          className={`h-2.5 w-2.5 rounded-full ring-2 ${DOT[x.health]} ${active ? "ring-white/40" : "ring-transparent"}`}
                        />
                        {x.name}
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${active ? "bg-white/20 text-eih-on-green" : "bg-eih-line/70 text-eih-ink"}`}
                        >
                          ({x.shown.length})
                        </span>
                      </button>
                    );
                  })}
                </div>

                <section
                  role="tabpanel"
                  className="overflow-hidden rounded-2xl border border-eih-line/70 bg-card/95 shadow-[0_12px_30px_rgba(15,46,38,0.06)] dark:shadow-[0_12px_30px_rgba(0,0,0,0.24)]"
                >
                  <div
                    className={`flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-eih-line/60 bg-eih-cream/40 px-4 py-3 ${fade}`}
                  >
                    <div className="min-w-[160px] flex-1">
                      <b className="font-serif text-lg text-eih-ink">
                        {g.name}
                      </b>
                      <div className="text-xs text-eih-muted">
                        {g.code ? `${g.code} · ` : ""}
                        {g.all.length} project{g.all.length === 1 ? "" : "s"}
                      </div>
                    </div>
                    <div className="w-40">
                      <span className="text-xs text-eih-muted">
                        Progress {Math.round(g.progress)}%
                      </span>
                      <Bar v={g.progress} color={barColor(g.progress)} />
                    </div>
                    <div className="w-40">
                      <span className="text-xs text-eih-muted">
                        {money(g.spent)} of {money(g.budget)}
                      </span>
                      <Bar
                        v={g.budget ? (g.spent / g.budget) * 100 : 0}
                        color="bg-eih-green-light"
                      />
                    </div>
                    <div className="flex gap-1 text-[11px] font-bold">
                      <span
                        title="Off track"
                        className="rounded bg-eih-danger-soft px-2 py-0.5 text-eih-danger-ink"
                      >
                        {g.c.R} off track
                      </span>
                      <span
                        title="At risk"
                        className="rounded bg-eih-warn-soft px-2 py-0.5 text-eih-warn-ink"
                      >
                        {g.c.A} at risk
                      </span>
                      <span
                        title="Healthy"
                        className="rounded bg-eih-success-soft px-2 py-0.5 text-eih-success-ink"
                      >
                        {g.c.G} healthy
                      </span>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1040px] text-[13px]">
                      <thead className="bg-eih-cream/60">
                        <tr>
                          {[
                            "Project",
                            "Phase",
                            "Progress",
                            "Budget",
                            "Spent",
                            "Financial health",
                            "Operational health",
                            "Risks",
                            "Ends",
                          ].map((h, i) => (
                            <th
                              key={h}
                              className={`whitespace-nowrap px-3.5 py-2.5 text-xs font-semibold text-eih-muted ${i === 3 || i === 7 ? "text-right" : "text-left"}`}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {g.shown.map((p: any) => {
                          const active = selected === p.id;
                          const dim = p.ready ? "" : "opacity-50";
                          return (
                            <tr
                              key={p.id}
                              onClick={() => setSelected(active ? null : p.id)}
                              aria-selected={active}
                              className={`cursor-pointer border-t border-eih-line/50 transition hover:bg-eih-cream-soft ${active ? "bg-eih-cream/70" : ""}`}
                            >
                              <td
                                className={`border-l-4 px-3.5 py-3 ${p.health === "R" ? "border-l-eih-danger" : p.health === "A" ? "border-l-eih-gold-light" : p.health === "G" ? "border-l-eih-success" : "border-l-eih-neutral"}`}
                              >
                                <b className="block font-semibold text-eih-ink">
                                  {p.name}
                                </b>
                                <span className="text-xs text-eih-muted">
                                  {p.code}
                                  {p.code ? " · " : ""}
                                  {p.managerName || "Unassigned"}
                                </span>
                              </td>
                              <td className="px-3.5 py-3">
                                <PhaseMini idx={p.phase} />
                              </td>
                              <td
                                className={`min-w-[120px] px-3.5 py-3 ${dim}`}
                              >
                                <Bar
                                  v={p.progress}
                                  color={
                                    p.health === "N"
                                      ? barColor(p.progress)
                                      : DOT[p.health as Rag]
                                  }
                                />
                                <small className="text-xs text-eih-muted">
                                  {Math.round(p.progress)}%
                                  {p.planned != null
                                    ? ` · plan ${Math.round(p.planned)}%`
                                    : ""}
                                </small>
                              </td>
                              <td
                                className={`px-3.5 py-3 text-right tabular-nums ${dim}`}
                              >
                                {money(p.budget)}
                              </td>
                              <td
                                className={`min-w-[120px] px-3.5 py-3 ${dim}`}
                              >
                                <Bar
                                  v={p.burn}
                                  color={burnColor(p.burn, p.progress)}
                                />
                                <small className="text-xs text-eih-muted">
                                  {money(p.ac)} · {Math.round(p.burn)}%
                                </small>
                              </td>
                              <td className={`px-3.5 py-3 ${dim}`}>
                                <Pill r={p.fin} />
                                <div className="mt-1 text-[11px] text-eih-muted">
                                  {p.finWhy}
                                </div>
                              </td>
                              <td className={`px-3.5 py-3 ${dim}`}>
                                <Pill r={p.op} />
                                <div className="mt-1 text-[11px] text-eih-muted">
                                  {p.opWhy}
                                </div>
                              </td>
                              <td className="px-3.5 py-3 text-right tabular-nums">
                                {p.risks.length}
                                {p.crit ? (
                                  <span className="font-semibold text-eih-danger">
                                    {" "}
                                    ({p.crit}!)
                                  </span>
                                ) : null}
                              </td>
                              <td className="whitespace-nowrap px-3.5 py-3 text-xs text-eih-muted">
                                {fmtDate(p.endDate)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {!g.shown.length && (
                      <Empty>No projects match these filters.</Empty>
                    )}
                  </div>
                  <p className="border-t border-eih-line/40 px-4 py-2 text-[11px] text-eih-muted">
                    Figures are calculated exactly as on each project page.
                    Financial health: cost index, forecast overrun and spend
                    against progress. Operational health: schedule index,
                    progress against plan and critical or high risks. Select a
                    project for detail.
                  </p>
                  {sel && (
                    <ProjectPanel
                      key={sel.id}
                      p={sel}
                      onClose={() => setSelected(null)}
                      onOpenProject={onOpenProject}
                    />
                  )}
                </section>
              </>
            );
          })()}
        {!groups.length && (
          <div className="rounded-xl border border-eih-line/70 bg-card p-12 text-center text-sm text-eih-muted">
            No sectors, clusters, or projects match these filters, or none are assigned
            to you.
          </div>
        )}
      </div>
    </div>
  );
}

export const ExecutiveDashboard = CEOExecutiveDashboard;
