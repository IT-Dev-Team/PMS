import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, FolderKanban, Plus } from "lucide-react";

const cards = [
  {
    title: "Projects",
    description: "Create new projects or open existing projects to update budgets, plans, status, risks, and delivery information.",
    href: "/projects/new",
    browseHref: "/dashboard",
    icon: FolderKanban,
    addLabel: "Add project",
    browseLabel: "Manage existing projects",
  },
  {
    title: "Sectors",
    description: "Create and maintain the sectors or portfolios that group projects for executive oversight.",
    href: "/portfolios/new",
    browseHref: "/dashboard",
    icon: BriefcaseBusiness,
    addLabel: "Add sector",
    browseLabel: "Manage existing sectors",
  },
];

export default function ManagementPage() {
  return (
    <main className="min-h-[calc(100vh-4rem)] bg-eih-cream-soft px-4 py-8 md:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 max-w-2xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-eih-gold">Project office</p>
          <h1 className="mt-2 font-serif text-3xl tracking-tight text-eih-ink md:text-4xl">Manage projects and sectors</h1>
          <p className="mt-3 text-sm leading-6 text-eih-muted">Use this workspace to add new records or open the dashboard to modify existing project and sector information. Department selection is no longer part of project registration.</p>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {cards.map((card) => {
            const Icon = card.icon;
            return <section key={card.title} className="rounded-2xl border border-eih-line/70 bg-card p-6 shadow-[0_12px_30px_rgba(15,46,38,0.05)]">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-eih-green/10 text-eih-green-dark"><Icon className="h-5 w-5" /></div>
              <h2 className="mt-5 font-serif text-2xl text-eih-ink">{card.title}</h2>
              <p className="mt-2 min-h-12 text-sm leading-6 text-eih-muted">{card.description}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href={card.href} className="inline-flex items-center gap-2 rounded-lg bg-eih-green px-4 py-2.5 text-sm font-semibold text-eih-on-green transition hover:bg-eih-green-dark"><Plus className="h-4 w-4" />{card.addLabel}</Link>
                <Link href={card.browseHref} className="inline-flex items-center gap-2 rounded-lg border border-eih-line px-4 py-2.5 text-sm font-semibold text-eih-ink transition hover:border-eih-gold hover:bg-eih-cream-soft">{card.browseLabel}<ArrowRight className="h-4 w-4" /></Link>
              </div>
            </section>;
          })}
        </div>
      </div>
    </main>
  );
}
