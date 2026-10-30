// lib/benchmarks/dashboard-benchmarks.ts
//
// Single source of truth for "is this healthy?" across the whole exec
// dashboard. Everything that currently hardcodes 70/40 thresholds
// (portfolio cards, project cards, filters) should call into this file
// instead, so a CEO filtering by "Critical" always gets the same answer
// as the badge they're looking at.
//
// The design goal: RAG should reflect the full picture — schedule
// progress, cost efficiency, schedule efficiency, and open risk exposure
// — not just percent complete. A project can be 80% complete and still
// be in serious trouble if CPI is 0.6 and it has three critical risks.

export type RAGStatus = 'GREEN' | 'AMBER' | 'RED';

export interface RAGThresholds {
  /** value at/above this = GREEN (or at/below, if inverse) */
  green: number;
  /** value at/above this = AMBER, below = RED (or the inverse) */
  amber: number;
  /** true if LOWER values are better (e.g. risk exposure score) */
  inverse?: boolean;
}

export interface BenchmarkConfig {
  /** % complete vs planned % complete */
  progress: RAGThresholds;
  /** Cost Performance Index — EV / AC. 1.0 = on budget */
  cpi: RAGThresholds;
  /** Schedule Performance Index — EV / PV. 1.0 = on schedule */
  spi: RAGThresholds;
  /** weighted open-risk exposure score, 0-100, lower is safer */
  riskExposure: RAGThresholds;
  /** relative weight of each factor in the composite score, must sum to 1 */
  weights: {
    progress: number;
    cpi: number;
    spi: number;
    riskExposure: number;
  };
}

// Default benchmark — tune per-org or per-portfolio-type as needed.
// This is the fallback used everywhere unless a portfolio/program
// supplies its own override (see resolveBenchmarkConfig below).
export const DEFAULT_BENCHMARKS: BenchmarkConfig = {
  progress: { green: 70, amber: 40 },
  cpi: { green: 0.98, amber: 0.9 },
  spi: { green: 0.98, amber: 0.9 },
  riskExposure: { green: 20, amber: 50, inverse: true },
  weights: { progress: 0.25, cpi: 0.3, spi: 0.25, riskExposure: 0.2 },
};

// Example of an org that wants a stricter cost bar for capital-heavy
// portfolios. Pass this in as `overrides` where relevant.
export const CAPEX_STRICT_BENCHMARKS: Partial<BenchmarkConfig> = {
  cpi: { green: 1.0, amber: 0.95 },
  weights: { progress: 0.2, cpi: 0.4, spi: 0.2, riskExposure: 0.2 },
};

export function resolveBenchmarkConfig(
  overrides?: Partial<BenchmarkConfig>
): BenchmarkConfig {
  if (!overrides) return DEFAULT_BENCHMARKS;
  return {
    ...DEFAULT_BENCHMARKS,
    ...overrides,
    weights: { ...DEFAULT_BENCHMARKS.weights, ...(overrides.weights || {}) },
  };
}

/** Score a single metric against its thresholds -> RAG */
export function evaluateRAG(value: number, t: RAGThresholds): RAGStatus {
  if (value === null || value === undefined || Number.isNaN(value)) return 'AMBER';
  if (t.inverse) {
    if (value <= t.green) return 'GREEN';
    if (value <= t.amber) return 'AMBER';
    return 'RED';
  }
  if (value >= t.green) return 'GREEN';
  if (value >= t.amber) return 'AMBER';
  return 'RED';
}

/** Convert a RAG status to a 0-100 numeric score, for aggregation/sorting */
const RAG_SCORE: Record<RAGStatus, number> = { GREEN: 100, AMBER: 55, RED: 15 };

export interface CompositeInput {
  percentComplete: number;
  plannedPercentComplete?: number; // if known, used for progress-vs-plan instead of raw %
  cpi?: number;
  spi?: number;
  openRisks?: number;
  criticalRisks?: number;
  highRisks?: number;
}

export interface CompositeResult {
  status: RAGStatus;
  score: number; // 0-100 composite health score
  breakdown: {
    progress: { value: number; status: RAGStatus };
    cpi: { value: number; status: RAGStatus };
    spi: { value: number; status: RAGStatus };
    riskExposure: { value: number; status: RAGStatus };
  };
}

/** Weighted risk exposure score: critical risks hurt far more than low ones */
export function computeRiskExposure(input: {
  criticalRisks?: number;
  highRisks?: number;
  openRisks?: number;
}): number {
  const critical = input.criticalRisks || 0;
  const high = input.highRisks || 0;
  const otherOpen = Math.max((input.openRisks || 0) - critical - high, 0);
  // capped at 100 so one runaway risk count doesn't blow out the scale
  return Math.min(critical * 25 + high * 10 + otherOpen * 3, 100);
}

/**
 * The composite health score the whole dashboard should use for RAG.
 * Falls back gracefully when financial/risk data isn't available yet
 * (e.g. a brand-new project with no EVM baseline) by re-weighting
 * around progress alone.
 */
export function computeCompositeRAG(
  input: CompositeInput,
  config: BenchmarkConfig = DEFAULT_BENCHMARKS
): CompositeResult {
  const progressValue =
    input.plannedPercentComplete && input.plannedPercentComplete > 0
      ? (input.percentComplete / input.plannedPercentComplete) * 100
      : input.percentComplete;

  const hasCpi = typeof input.cpi === 'number' && !Number.isNaN(input.cpi);
  const hasSpi = typeof input.spi === 'number' && !Number.isNaN(input.spi);
  const riskExposure = computeRiskExposure(input);

  const progressStatus = evaluateRAG(progressValue, config.progress);
  const cpiStatus = hasCpi ? evaluateRAG(input.cpi as number, config.cpi) : 'AMBER';
  const spiStatus = hasSpi ? evaluateRAG(input.spi as number, config.spi) : 'AMBER';
  const riskStatus = evaluateRAG(riskExposure, config.riskExposure);

  // Re-weight if cpi/spi are missing so a young project isn't punished
  // for not having a cost baseline yet.
  let w = { ...config.weights };
  if (!hasCpi || !hasSpi) {
    const missing = (!hasCpi ? w.cpi : 0) + (!hasSpi ? w.spi : 0);
    const remaining = w.progress + w.riskExposure;
    w = {
      progress: w.progress + (missing * w.progress) / remaining,
      cpi: hasCpi ? w.cpi : 0,
      spi: hasSpi ? w.spi : 0,
      riskExposure: w.riskExposure + (missing * w.riskExposure) / remaining,
    };
  }

  const score =
    RAG_SCORE[progressStatus] * w.progress +
    RAG_SCORE[cpiStatus] * w.cpi +
    RAG_SCORE[spiStatus] * w.spi +
    RAG_SCORE[riskStatus] * w.riskExposure;

  const status: RAGStatus = score >= 80 ? 'GREEN' : score >= 55 ? 'AMBER' : 'RED';

  return {
    status,
    score: Math.round(score),
    breakdown: {
      progress: { value: Math.round(progressValue), status: progressStatus },
      cpi: { value: input.cpi ?? 0, status: cpiStatus },
      spi: { value: input.spi ?? 0, status: spiStatus },
      riskExposure: { value: riskExposure, status: riskStatus },
    },
  };
}

/** Roll many project-level composite scores up into a portfolio/program score */
export function rollUpRAG(items: CompositeResult[]): CompositeResult['status'] {
  if (items.length === 0) return 'GREEN';
  const avgScore = items.reduce((s, i) => s + i.score, 0) / items.length;
  const anyRed = items.some((i) => i.status === 'RED');
  // A portfolio with even one RED project shouldn't average out to AMBER
  // and hide it — surface RED if more than ~15% of projects are RED,
  // otherwise let the average speak but never rate above AMBER.
  const redRatio = items.filter((i) => i.status === 'RED').length / items.length;
  if (redRatio > 0.15) return 'RED';
  if (anyRed) return avgScore >= 80 ? 'AMBER' : avgScore >= 55 ? 'AMBER' : 'RED';
  return avgScore >= 80 ? 'GREEN' : avgScore >= 55 ? 'AMBER' : 'RED';
}
