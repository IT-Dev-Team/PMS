// app/dashboard/ceo/page.tsx
import { require2Auth } from "@/lib/auth/user";
import { PortfolioQueries } from "@/lib/db/queries/protfolio"; // ← fix spelling if needed
import { ProjectQueries } from "@/lib/db/queries/projects";
import { FinancialQueries } from "@/lib/db/queries/financial";
import { RiskQueries } from "@/lib/db/queries/risks";
import { CeoDashboardClient } from "@/components/dashboards/CeoDashboardClient";

export const dynamic = "force-dynamic";

function toNum(value: any, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  const n = typeof value === "number" ? value : parseFloat(value);
  return isNaN(n) ? fallback : n;
}

export default async function CeoDashboardPage() {
  const user = await require2Auth("PROJECT_MANAGER", "CEO");
  const portfolios = await PortfolioQueries.getPortfoliosWithMetrics();

  const portfolioMetrics = await Promise.all(
    portfolios.map(async (portfolio: any) => {
      const [summary, projects] = await Promise.all([
        ProjectQueries.getPortfolioSummary(portfolio.id),
        ProjectQueries.getPortfolioProjectsWithMetrics(portfolio.id),
      ]);

      const projectDetails = await Promise.all(
        projects.map(async (project: any) => {
          const [fin, risks] = await Promise.all([
            FinancialQueries.getProjectFinancialSummary(project.id),
            RiskQueries.findByProject(project.id),
          ]);
          return {
            ...project,
            budget: toNum(project.budget),
            percentComplete: toNum(project.percentComplete),
            financials: {
              plannedValue: toNum(fin.plannedValue),
              earnedValue: toNum(fin.earnedValue),
              actualCost: toNum(fin.actualCost),
              eac: toNum(fin.eac),
              vac: toNum(fin.vac),
              cpi: toNum(fin.cpi, 1),
              spi: toNum(fin.spi, 1),
            },
            risks,
          };
        }),
      );

      return { ...portfolio, ...summary, projects: projectDetails };
    }),
  );

  const overallHealth = portfolioMetrics.length
    ? portfolioMetrics.reduce((sum, portfolio: any) => {
        const value = toNum(
          portfolio.healthScore ??
            portfolio.overallHealth ??
            portfolio.score ??
            portfolio.compositeScore,
          0,
        );
        return sum + value;
      }, 0) / portfolioMetrics.length
    : 0;

  if (!portfolioMetrics.length) {
    return (
      <div className="eih-page-shell flex min-h-[calc(100vh-4.125rem)] items-center justify-center px-4 py-10">
        <div className="eih-card w-full max-w-xl p-8 text-center sm:p-10">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-eih-gold/12 text-eih-gold">
            <span className="font-serif text-2xl">E</span>
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-eih-gold">
            Portfolio oversight
          </p>
          <h2 className="mt-2 font-serif text-2xl font-semibold text-eih-ink">
            No portfolios yet
          </h2>
          <p className="mt-2 text-sm leading-6 text-eih-muted">
            Once portfolios and projects exist, they will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <CeoDashboardClient
      portfolios={portfolioMetrics}
      overallHealth={overallHealth}
      user={{
        id: user.id,
        name: user.name ?? "User",
        role: String(user.role || "").toUpperCase(),
      }}
    />
  );
}
