import { ManagementWorkspace } from "@/components/management/ManagementWorkspace";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { getCurrentUser } from "@/lib/auth/user";
import Link from "next/link";

export default async function ManagementPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  return <div className="min-h-screen bg-eih-cream-soft">
    <DashboardHeader user={user} />
    <main className="px-4 py-8 md:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-eih-gold">Project office</p><h1 className="mt-2 font-serif text-3xl tracking-tight text-eih-ink md:text-4xl">Management</h1><p className="mt-3 text-sm leading-6 text-eih-muted">Select a project or sector to edit its details. Use the dashboard for portfolio-wide reporting and executive oversight.</p></div>
          <Link href="/dashboard" className="rounded-lg border border-eih-line bg-card px-4 py-2.5 text-sm font-semibold text-eih-ink transition hover:border-eih-gold hover:bg-eih-cream-soft">Open dashboard</Link>
        </div>
        <ManagementWorkspace />
      </div>
    </main>
  </div>;
}
