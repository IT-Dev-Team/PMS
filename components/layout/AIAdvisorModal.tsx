"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  Bot,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
  Sparkles,
  TrendingUp,
  Users,
  X,
} from "lucide-react";

type AIAdvisorModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

type AdvisorMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

type ProjectRecord = Record<string, any>;

const initialMessage: AdvisorMessage = {
  id: "welcome",
  role: "assistant",
  text: "I’m your EIH Project Office advisor. I can use the project data loaded into this workspace to summarize delivery, budget, risks, and portfolio priorities.",
};

const asArray = (payload: any): ProjectRecord[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.projects)) return payload.projects;
  if (Array.isArray(payload?.data?.projects)) return payload.data.projects;
  return [];
};

const numberValue = (...values: any[]) => {
  for (const value of values) {
    const parsed = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const projectName = (project: ProjectRecord) =>
  project.name ||
  project.title ||
  project.projectName ||
  project.code ||
  "Unnamed project";

const projectStatus = (project: ProjectRecord) =>
  String(project.status || project.phase || "Not specified")
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const compactMoney = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount || 0);

function answerFromContext(question: string, projects: ProjectRecord[]) {
  const query = question.toLowerCase().trim();
  if (!projects.length) {
    return "No project records are available yet. Use Refresh data when projects have been created, or ask your administrator to confirm the Project Office API is available.";
  }

  const totalBudget = projects.reduce(
    (sum, project) =>
      sum + numberValue(project.budget, project.totalBudget, project.bac),
    0,
  );
  const totalActual = projects.reduce(
    (sum, project) =>
      sum +
      numberValue(
        project.actualCost,
        project.actual,
        project.spent,
        project.financials?.actualCost,
      ),
    0,
  );
  const atRisk = projects.filter((project) => {
    const status =
      `${project.status || ""} ${project.health || ""} ${project.rag || ""}`.toLowerCase();
    return /risk|delay|blocked|overdue|critical|red/.test(status);
  });

  const mentionedProject = projects.find((project) => {
    const name = projectName(project).toLowerCase();
    return name.length > 2 && query.includes(name);
  });

  if (mentionedProject) {
    const progress = numberValue(
      mentionedProject.percentComplete,
      mentionedProject.progress,
      mentionedProject.percent_complete,
    );
    const budget = numberValue(
      mentionedProject.budget,
      mentionedProject.totalBudget,
      mentionedProject.bac,
    );
    const actual = numberValue(
      mentionedProject.actualCost,
      mentionedProject.actual,
      mentionedProject.spent,
      mentionedProject.financials?.actualCost,
    );
    return `${projectName(mentionedProject)} is ${projectStatus(mentionedProject)} at ${Math.round(progress)}% progress. Budget is ${compactMoney(budget)} and recorded actual cost is ${compactMoney(actual)}.${mentionedProject.endDate ? ` The current end date is ${new Date(mentionedProject.endDate).toLocaleDateString("en-US", { dateStyle: "medium" })}.` : ""}`;
  }

  if (/risk|issue|problem|blocked|delay|overdue/.test(query)) {
    if (!atRisk.length)
      return "No project records currently contain an explicit risk, delay, blocked, overdue, or critical indicator.";
    return `${atRisk.length} of ${projects.length} projects contain a risk or delivery-health indicator: ${atRisk.slice(0, 5).map(projectName).join(", ")}${atRisk.length > 5 ? ", and others" : ""}. Review the project risk registers for the underlying issue details.`;
  }

  if (/budget|cost|spend|financial|money|actual/.test(query)) {
    const variance = totalBudget - totalActual;
    return `Across ${projects.length} projects, the available budget is ${compactMoney(totalBudget)} and recorded actual cost is ${compactMoney(totalActual)}. The simple available-to-spend variance is ${compactMoney(variance)}. Use the Financial tabs for approved EVM calculations and committed-cost detail.`;
  }

  if (/progress|status|health|delivery|on track/.test(query)) {
    const completed = projects.filter((project) =>
      /complete|closed|done/i.test(
        String(project.status || project.phase || ""),
      ),
    ).length;
    const averageProgress =
      projects.reduce(
        (sum, project) =>
          sum +
          numberValue(
            project.percentComplete,
            project.progress,
            project.percent_complete,
          ),
        0,
      ) / projects.length;
    return `The workspace contains ${projects.length} projects. ${completed} are marked completed or closed, and average reported progress is ${Math.round(averageProgress)}%. ${atRisk.length ? `${atRisk.length} projects need delivery-health attention.` : "No explicit delivery-health alerts were found in the loaded records."}`;
  }

  if (/how many|count|portfolio|projects/.test(query)) {
    return `There are ${projects.length} project records in the current Project Office context. Ask me about progress, budgets, risks, or a named project for a focused summary.`;
  }

  return `I have context for ${projects.length} project records, including their available status, progress, budget, actual-cost, timeline, and health fields. Try “Which projects are at risk?”, “Summarize the budget”, or ask about a specific project by name.`;
}

export function AIAdvisorModal({ isOpen, onClose }: AIAdvisorModalProps) {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [portfolios, setPortfolios] = useState<ProjectRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<AdvisorMessage[]>([initialMessage]);
  const [showContext, setShowContext] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);

  const loadWorkspaceData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [projectsResponse, portfoliosResponse] = await Promise.all([
        fetch("/api/projects?includeMetrics=true&limit=1000", {
          cache: "no-store",
        }),
        fetch("/api/portfolios?active=true", { cache: "no-store" }),
      ]);
      if (!projectsResponse.ok)
        throw new Error("Project data could not be loaded.");
      const projectsPayload = await projectsResponse.json();
      const portfoliosPayload = portfoliosResponse.ok
        ? await portfoliosResponse.json()
        : [];
      setProjects(asArray(projectsPayload));
      setPortfolios(asArray(portfoliosPayload));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Project data could not be loaded.",
      );
      setProjects([]);
      setPortfolios([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setMessages([initialMessage]);
    setQuestion("");
    setShowContext(false);
    void loadWorkspaceData();
    const timer = window.setTimeout(() => inputRef.current?.focus(), 150);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    const node = messagesRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages]);

  const contextStats = useMemo(() => {
    const budget = projects.reduce(
      (sum, project) =>
        sum + numberValue(project.budget, project.totalBudget, project.bac),
      0,
    );
    const progress = projects.length
      ? projects.reduce(
          (sum, project) =>
            sum +
            numberValue(
              project.percentComplete,
              project.progress,
              project.percent_complete,
            ),
          0,
        ) / projects.length
      : 0;
    return { budget, progress };
  }, [projects]);

  const askQuestion = async (value = question) => {
    const trimmed = value.trim();
    if (!trimmed || sending || loading) return;
    setMessages((current) => [...current, { id: `user-${Date.now()}`, role: "user", text: trimmed }]);
    setQuestion("");
    setSending(true);
    setError(null);
    try {
      const createResponse = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      const created = await createResponse.json();
      if (!createResponse.ok || !created.taskId) throw new Error(created.error || "Could not start Manus AI.");

      const deadline = Date.now() + 120000;
      while (Date.now() < deadline) {
        await new Promise((resolve) => window.setTimeout(resolve, 2000));
        const response = await fetch(`/api/chat?taskId=${encodeURIComponent(created.taskId)}&t=${Date.now()}`, { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not read Manus AI response.");
        if (result.status === "done") {
          setMessages((current) => [...current, { id: `assistant-${Date.now()}`, role: "assistant", text: result.reply }]);
          return;
        }
        if (result.status === "error") throw new Error(result.error || "Manus AI could not complete the request.");
      }
      throw new Error("Manus AI is taking longer than expected. Please try again shortly.");
    } catch (requestError) {
      setMessages((current) => [...current, { id: `assistant-${Date.now()}`, role: "assistant", text: requestError instanceof Error ? requestError.message : "Could not reach Manus AI.", }]);
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center p-3 sm:items-center sm:p-6">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-eih-green-dark/70 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close AI Advisor"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-advisor-title"
        className="relative flex max-h-[min(760px,92vh)] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-border bg-eih-cream-soft/70 px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-eih-green text-eih-gold-light shadow-sm dark:bg-eih-gold/15 dark:text-eih-gold">
              <Bot className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span
                id="ai-advisor-title"
                className="flex items-center gap-2 font-serif text-lg font-semibold text-eih-ink"
              >
                AI Advisor
                <span className="rounded-full bg-eih-success-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-eih-success-ink">
                  Live context
                </span>
              </span>
              <span className="block truncate text-xs text-eih-muted">
                Project Office intelligence for EIH leadership
              </span>
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-eih-muted transition hover:bg-eih-cream hover:text-eih-ink"
            aria-label="Close AI Advisor"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="flex min-h-0 flex-col">
            <div
              ref={messagesRef}
              className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6"
            >
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {message.role === "assistant" && (
                    <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-eih-green/10 text-eih-green dark:bg-eih-gold/10 dark:text-eih-gold">
                      <Sparkles className="h-4 w-4" />
                    </span>
                  )}
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "rounded-br-md bg-eih-green text-white" : "rounded-bl-md bg-eih-cream-soft text-eih-ink"}`}
                  >
                    {message.text}
                  </div>
                </div>
              ))}
              {(loading || sending) && (
                <div className="flex items-center gap-2 text-xs text-eih-muted">
                  <Loader2 className="h-4 w-4 animate-spin text-eih-gold" />{" "}
                  {sending ? "Manus AI is preparing an answer…" : "Loading the latest project office data…"}
                </div>
              )}
              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-eih-danger/25 bg-eih-danger-soft p-3 text-xs text-eih-danger-ink">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}
            </div>

            <div className="border-t border-border bg-eih-cream-soft/35 p-4 sm:p-5">
              <div className="mb-3 flex flex-wrap gap-2">
                {[
                  "Which projects are at risk?",
                  "Summarize the budget",
                  "What is the delivery status?",
                ].map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => void askQuestion(prompt)}
                    className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-eih-muted transition hover:border-eih-gold/60 hover:text-eih-ink"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  askQuestion();
                }}
                className="flex items-center gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm focus-within:border-eih-gold/70 focus-within:ring-2 focus-within:ring-eih-gold/15"
              >
                <MessageCircle className="ml-2 h-4 w-4 shrink-0 text-eih-muted" />
                <input
                  ref={inputRef}
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm text-foreground outline-none placeholder:text-eih-muted"
                  placeholder="Ask about projects, risks, budgets, or delivery…"
                  aria-label="Ask AI Advisor"
                />
                <button
                  type="submit"
                  disabled={!question.trim() || loading || sending}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-eih-green text-white transition hover:bg-eih-green-light disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Send question"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>

          <aside className="hidden min-h-0 border-l border-border bg-eih-cream-soft/35 p-4 md:block">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-eih-gold">
              Workspace context
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-border bg-card p-3">
                <BarChart3 className="h-4 w-4 text-eih-green dark:text-eih-gold" />
                <p className="mt-3 text-lg font-semibold text-eih-ink">
                  {projects.length}
                </p>
                <p className="text-[10px] text-eih-muted">Projects loaded</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-3">
                <BriefcaseBusiness className="h-4 w-4 text-eih-green dark:text-eih-gold" />
                <p className="mt-3 text-lg font-semibold text-eih-ink">
                  {portfolios.length}
                </p>
                <p className="text-[10px] text-eih-muted">Portfolios loaded</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-3">
                <CircleDollarSign className="h-4 w-4 text-eih-green dark:text-eih-gold" />
                <p className="mt-3 text-sm font-semibold text-eih-ink">
                  {compactMoney(contextStats.budget)}
                </p>
                <p className="text-[10px] text-eih-muted">Available budget</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-3">
                <TrendingUp className="h-4 w-4 text-eih-green dark:text-eih-gold" />
                <p className="mt-3 text-lg font-semibold text-eih-ink">
                  {Math.round(contextStats.progress)}%
                </p>
                <p className="text-[10px] text-eih-muted">Average progress</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowContext((current) => !current)}
              className="mt-5 flex w-full items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-left text-xs font-semibold text-eih-ink"
            >
              <span>Project data context</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${showContext ? "rotate-180" : ""}`}
              />
            </button>
            {showContext && (
              <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-border bg-card p-2 custom-scrollbar">
                {projects.length ? (
                  projects.map((project, index) => (
                    <div
                      key={String(project.id || index)}
                      className="border-b border-border px-2 py-2 last:border-b-0"
                    >
                      <p className="truncate text-xs font-semibold text-eih-ink">
                        {projectName(project)}
                      </p>
                      <p className="mt-0.5 text-[10px] text-eih-muted">
                        {projectStatus(project)} ·{" "}
                        {Math.round(
                          numberValue(
                            project.percentComplete,
                            project.progress,
                            project.percent_complete,
                          ),
                        )}
                        %
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="p-2 text-xs text-eih-muted">
                    No project records loaded.
                  </p>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={() => void loadWorkspaceData()}
              disabled={loading}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-eih-muted transition hover:bg-eih-cream hover:text-eih-ink disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              />{" "}
              Refresh data
            </button>
            <div className="mt-5 space-y-2 text-[11px] leading-5 text-eih-muted">
              <p className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-eih-success" />
                Context is loaded from the Project Office APIs when this window
                opens.
              </p>
              <p className="flex gap-2">
                <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0 text-eih-gold" />
                Ask about timelines, delivery status, budget, or risks.
              </p>
              <p className="flex gap-2">
                <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-eih-green dark:text-eih-gold" />
                No project data is exposed outside this authenticated workspace.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
