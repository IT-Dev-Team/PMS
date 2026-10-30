import { requireAuth } from "@/lib/auth/user";
import { CreateProjectWizard } from "@/components/projects/CreateProjectWizard";
import { PortfolioQueries } from "@/lib/db/queries/protfolio";
import { DepartmentQueries } from "@/lib/db/queries/department";

export default async function NewProjectPage() {
  const user = await requireAuth("PROJECT_MANAGER");

  const [portfolios, departments] = await Promise.all([
    PortfolioQueries.getActivePortfolios(),
    DepartmentQueries.findAll(),
  ]);

  return (
    <section className="fade-in space-y-6">
      <div className="flex flex-col justify-between gap-5 border-b border-border pb-6 lg:flex-row lg:items-end">
        <div className="max-w-3xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-eih-gold/35 bg-eih-gold/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-eih-gold">
            <span className="h-1.5 w-1.5 rounded-full bg-eih-gold" />
            Project administration
          </div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-eih-ink sm:text-4xl">
            Create a new project
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-eih-muted sm:text-base">
            Establish the project mandate, scope, budget, governance model, and
            reporting cadence in one controlled workflow.
          </p>
        </div>
        <div className="eih-card flex items-center gap-3 px-4 py-3 text-sm text-eih-muted">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-eih-green/10 text-eih-green dark:bg-eih-gold/10 dark:text-eih-gold">
            <span className="font-mono text-xs font-bold">01</span>
          </div>
          <div>
            <p className="font-semibold text-eih-ink">Governed intake</p>
            <p className="text-xs text-eih-muted">Five-stage setup</p>
          </div>
        </div>
      </div>

      <CreateProjectWizard
        userId={user.id}
        portfolios={portfolios}
        departments={departments}
      />
    </section>
  );
}
