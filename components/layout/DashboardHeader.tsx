"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  User,
  LogOut,
  Settings,
  HelpCircle,
  ChevronDown,
  Sparkles,
  Menu,
  LayoutDashboard,
  PlusCircle,
  CheckCircle,
  X,
  Inbox,
} from "lucide-react";
import { CreateProjectModal } from "@/components/projects/CreateProjectModal";
import { CreatePortfolioModal } from "@/components/portfolio/CreatePortfolioModal";
import { useNotifications } from "@/hooks/useNotifications";
import { setNavTarget } from "@/hooks/useDashboardNav";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

interface DashboardHeaderProps {
  user: { id: string; name: string; email: string; role: string };
  onMenuToggle?: () => void;
}

// Helper for relative time
const timeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "Just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
};

export function DashboardHeader({ user, onMenuToggle }: DashboardHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();

  const { notifications, markRead, markReviewed, markAllRead, unreadCount } =
    useNotifications();

  const [showUser, setShowUser] = useState(false);
  const [showBell, setShowBell] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showPortfolioModal, setShowPortfolioModal] = useState(false);

  // Close dropdowns on click outside or Escape
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setShowUser(false);
        setShowBell(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowUser(false);
        setShowBell(false);
        setShowMobileNav(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const normalizedRole = user.role.toLowerCase().replace(/[\s-]/g, "_");
  const isProjectManager = normalizedRole.includes("project_manager");
  const isCeo = normalizedRole.includes("ceo");
  const canManagePortfolios =
    normalizedRole.includes("project_manager") ||
    normalizedRole.includes("portfolio_manager") ||
    normalizedRole.includes("admin");

  /* ---- Notification click: mark read → auto-review if CEO → set nav → route ---- */
  const handleNotificationClick = async (n: (typeof notifications)[number]) => {
    markRead(n.id);
    setShowBell(false);

    if (
      isCeo &&
      n.targetType === "report" &&
      n.type === "REPORT_SUBMITTED_TO_CEO" &&
      !n.reviewed
    ) {
      try {
        await fetch("/api/planning", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resource: "reviewReport",
            id: n.targetId,
            reviewStatus: "REVIEWED",
            reviewNotes: "Auto-reviewed on CEO notification click.",
          }),
        });
        markReviewed(n.id);
      } catch {
        /* non-fatal — still navigate */
      }
    }

    // Shared nav store — CeoDashboardClient will see this the moment it mounts
    setNavTarget({
      projectId: n.projectId,
      tab: n.targetType === "report" ? "reports" : "issues",
      itemId: n.targetId,
    });

    router.push("/dashboard");
  };

  const ceoPendingReports = notifications.filter(
    (n) => n.type === "REPORT_SUBMITTED_TO_CEO" && !n.reviewed,
  ).length;
  const ceoPendingIssues = notifications.filter(
    (n) => n.type === "ISSUE_CEO_ATTENTION" && !n.read,
  ).length;

  const navLinks = [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      show: true,
      
    },
    {
      label: "New Project",
      href: "/projects/new",
      icon: PlusCircle,
      show: isProjectManager,
      onClick: () => setShowProjectModal(true),
    },
    {
      label: "New Sector",
      href: "/portfolios/new",
      icon: PlusCircle,
      show: canManagePortfolios,
      onClick: () => setShowPortfolioModal(true),
    },
  ].filter((l) => l.show);

  const isActive = (href: string) => pathname === href;

  return (
    <>
      <header className="sticky top-0 z-40">
        <div className="h-0.5 w-full bg-gradient-to-r from-eih-gold via-eih-gold-light to-eih-gold" />

        <div className="eih-gradient-deep">
          <div className="flex h-16 items-center gap-4 px-4 md:px-6">
            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setShowMobileNav((v) => !v)}
              className="rounded-lg p-2 text-eih-on-green transition hover:bg-white/10 lg:hidden"
              aria-label="Toggle navigation"
              aria-expanded={showMobileNav}
            >
              {showMobileNav ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>

            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 p-1.5 ring-1 ring-eih-gold/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/eih.png"
                  alt="EIH"
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="hidden sm:block leading-tight">
                <div className="font-serif text-[15px] text-white">
                  Ethiopian Investment Holding
                </div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-eih-on-green/70">
                  Project Management
                </div>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav
              className="hidden items-center gap-1 lg:flex"
              aria-label="Primary"
            >
              {navLinks.map((link) => {
                const active = isActive(link.href);
                const classes = `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-white/10 text-white ring-1 ring-eih-gold/40"
                    : "text-eih-on-green hover:bg-white/10 hover:text-white"
                }`;
                const content = (
                  <>
                    <link.icon
                      className={`h-4 w-4 ${active ? "text-eih-gold-light" : ""}`}
                    />
                    {link.label}
                  </>
                );
                return link.onClick ? (
                  <button
                    key={link.href}
                    type="button"
                    onClick={link.onClick}
                    className={classes}
                  >
                    {content}
                  </button>
                ) : (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={classes}
                  >
                    {content}
                  </Link>
                );
              })}
            </nav>

            {/* Right Actions */}
            <div ref={wrapRef} className="ml-auto flex items-center gap-1.5">
              <button className="hidden items-center gap-2 rounded-lg border border-eih-gold/40 bg-eih-gold/10 px-3 py-1.5 text-xs font-semibold text-eih-gold-light transition hover:bg-eih-gold/20 md:flex">
                <Sparkles className="h-3.5 w-3.5" /> AI Advisor
              </button>

              <ThemeToggle variant="header" />

              {/* ---- Bell Dropdown ---- */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowBell((v) => !v);
                    setShowUser(false);
                  }}
                  aria-label="Notifications"
                  aria-expanded={showBell}
                  className={`relative flex h-11 w-11 items-center justify-center rounded-xl transition ${
                    showBell
                      ? "bg-white/10 text-white"
                      : "text-eih-on-green hover:bg-white/10"
                  }`}
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-eih-danger px-1 text-[9px] font-bold text-white shadow-sm ring-2 ring-eih-green-dark">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </button>

                {showBell && (
                  <div className="pop-in absolute right-0 mt-2 w-[min(24rem,calc(100vw-1rem))] overflow-hidden rounded-xl border border-eih-line/60 bg-card shadow-2xl sm:w-96">
                    <div className="flex items-center justify-between border-b border-eih-line/50 bg-eih-cream-soft/50 px-4 py-3">
                      <div className="text-sm font-semibold text-eih-ink">
                        Notifications
                        {isCeo &&
                          (ceoPendingReports > 0 || ceoPendingIssues > 0) && (
                            <span className="ml-2 text-[10px] font-normal text-eih-gold">
                              {ceoPendingReports} reports · {ceoPendingIssues}{" "}
                              issues
                            </span>
                          )}
                      </div>
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllRead}
                          className="text-xs font-medium text-eih-gold hover:underline"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    <ul className="max-h-[28rem] overflow-y-auto custom-scrollbar">
                      {notifications.length === 0 ? (
                        <li className="flex flex-col items-center justify-center px-4 py-12 text-center">
                          <Inbox className="mb-2 h-8 w-8 text-eih-muted/50" />
                          <p className="text-sm text-eih-muted">
                            You're all caught up.
                          </p>
                        </li>
                      ) : (
                        notifications.map((n) => (
                          <li key={n.id}>
                            <button
                              onClick={() => handleNotificationClick(n)}
                              className={`flex w-full items-start gap-3 border-b border-eih-line/30 px-4 py-3 text-left transition hover:bg-eih-cream-soft ${
                                n.read ? "opacity-60" : "bg-card"
                              }`}
                            >
                              <span
                                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                                  n.type === "ISSUE_CEO_ATTENTION"
                                    ? "bg-eih-danger"
                                    : n.type === "REPORT_SUBMITTED_TO_CEO"
                                      ? "bg-eih-gold"
                                      : "bg-eih-success"
                                }`}
                              />
                              <div className="min-w-0 flex-1">
                                <p
                                  className={`truncate text-sm ${n.read ? "font-medium text-eih-muted" : "font-semibold text-eih-ink"}`}
                                >
                                  {n.title}
                                </p>
                                <p className="mt-0.5 line-clamp-2 text-xs text-eih-muted">
                                  {n.message}
                                </p>
                                <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-eih-muted/70">
                                  <span className="font-medium">
                                    {n.projectName}
                                  </span>
                                  <span>·</span>
                                  <span>{timeAgo(n.createdAt)}</span>
                                </div>
                                {n.reviewed && (
                                  <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-eih-success-soft px-1.5 py-0.5 text-[9px] font-bold text-eih-success-ink">
                                    <CheckCircle className="h-2.5 w-2.5" />{" "}
                                    Reviewed
                                  </span>
                                )}
                              </div>
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                    {notifications.length > 0 && (
                      <button
                        onClick={() => {
                          setShowBell(false);
                          router.push("/dashboard");
                        }}
                        className="w-full border-t border-eih-line/50 bg-eih-cream-soft py-2.5 text-xs font-semibold text-eih-ink transition hover:bg-eih-cream"
                      >
                        View all notifications
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* ---- User Dropdown ---- */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowUser((v) => !v);
                    setShowBell(false);
                  }}
                  aria-expanded={showUser}
                  className={`flex min-h-11 items-center gap-2.5 rounded-xl py-1.5 pl-1.5 pr-2 transition ${
                    showUser ? "bg-white/10" : "hover:bg-white/10"
                  }`}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-eih-gold to-eih-gold-light text-xs font-bold text-eih-green-dark shadow-inner">
                    {initials || "U"}
                  </div>
                  <div className="hidden text-left sm:block">
                    <div className="text-sm font-medium text-white">
                      {user.name}
                    </div>
                    <div className="text-[10px] uppercase tracking-wide text-eih-on-green/70">
                      {user.role.replace(/_/g, " ")}
                    </div>
                  </div>
                  <ChevronDown
                    className={`hidden h-4 w-4 text-eih-on-green/70 transition-transform sm:block ${
                      showUser ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {showUser && (
                  <div className="pop-in absolute right-0 mt-2 w-[min(16rem,calc(100vw-1rem))] overflow-hidden rounded-xl border border-eih-line/60 bg-card shadow-2xl">
                    <div className="flex items-center gap-3 border-b border-eih-line/50 bg-eih-cream-soft px-4 py-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-eih-green to-eih-green-light text-sm font-bold text-eih-gold-light">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-eih-ink">
                          {user.name}
                        </p>
                        <p className="truncate text-xs text-eih-muted">
                          {user.email}
                        </p>
                      </div>
                    </div>
                    <div className="py-1">
                      {[
                        { icon: User, label: "Profile", href: "/profile" },
                        {
                          icon: Settings,
                          label: "Settings",
                          href: "/settings",
                        },
                        {
                          icon: HelpCircle,
                          label: "Help & support",
                          href: "/help",
                        },
                      ].map((item) => (
                        <button
                          key={item.label}
                          onClick={() => {
                            setShowUser(false);
                            router.push(item.href);
                          }}
                          className="flex w-full items-center gap-3 px-4 py-2 text-sm text-eih-ink transition hover:bg-eih-cream"
                        >
                          <item.icon className="h-4 w-4 text-eih-muted" />
                          {item.label}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => router.push("/auth/login")}
                      className="flex w-full items-center gap-3 border-t border-eih-line/50 px-4 py-2.5 text-sm font-medium text-eih-danger transition hover:bg-eih-danger-soft"
                    >
                      <LogOut className="h-4 w-4" /> Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Dropdown */}
      <div
        className={`fixed inset-x-0 top-16 z-30 transform border-b border-eih-line/60 bg-card shadow-lg transition-transform duration-200 ease-in-out lg:hidden ${
          showMobileNav ? "translate-y-0" : "-translate-y-full opacity-0"
        }`}
      >
        <nav className="flex flex-col p-2" aria-label="Mobile Navigation">
          {navLinks.map((link) => {
            const active = isActive(link.href);
            return link.onClick ? (
              <button
                key={link.href}
                type="button"
                onClick={() => {
                  setShowMobileNav(false);
                  link.onClick!();
                }}
                className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition ${
                  active
                    ? "bg-eih-cream text-eih-ink"
                    : "text-eih-muted hover:bg-eih-cream hover:text-eih-ink"
                }`}
              >
                <link.icon
                  className={`h-5 w-5 ${active ? "text-eih-gold" : ""}`}
                />
                {link.label}
              </button>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setShowMobileNav(false)}
                className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition ${
                  active
                    ? "bg-eih-cream text-eih-ink"
                    : "text-eih-muted hover:bg-eih-cream hover:text-eih-ink"
                }`}
              >
                <link.icon
                  className={`h-5 w-5 ${active ? "text-eih-gold" : ""}`}
                />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <CreateProjectModal
        isOpen={showProjectModal}
        onClose={() => setShowProjectModal(false)}
        userId={user.id}
      />
      <CreatePortfolioModal
        isOpen={showPortfolioModal}
        onClose={() => setShowPortfolioModal(false)}
        userId={user.id}
      />
    </>
  );
}
