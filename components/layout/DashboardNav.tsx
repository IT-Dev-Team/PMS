// components/layout/DashboardNav.tsx
'use client';

import { useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard, FolderKanban, Bell, Home, Activity, ClipboardList,
  TrendingUp, ChevronDown, ChevronRight, Search, Sparkles, LogOut, HelpCircle,
} from 'lucide-react';

interface NavItem {
  label: string; href: string; icon: any; roles?: string[];
  children?: NavItem[]; badge?: string;
}
interface DashboardNavProps { userRole: string; collapsed?: boolean; onToggle?: () => void; }

export function DashboardNav({ userRole, collapsed = false, onToggle }: DashboardNavProps) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['CEO Dashboard', 'PM Workspace']));
  const [query, setQuery] = useState('');

  const toggle = (label: string) => {
    const s = new Set(expanded);
    s.has(label) ? s.delete(label) : s.add(label);
    setExpanded(s);
  };

  const navItems: NavItem[] = [
    { label: 'Dashboard', href: '/dashboard/ceo', icon: LayoutDashboard,
      roles: ['CEO','PORTFOLIO_MANAGER','PROJECT_MANAGER','FINANCE','PROCUREMENT','BOARD_MEMBER','TEAM_MEMBER'] },
    
   
  ];

  const filterItems = (items: NavItem[]): NavItem[] =>
    items
      .filter(i => !i.roles || i.roles.includes(userRole))
      .map(i => i.children ? { ...i, children: filterItems(i.children) } : i)
      .filter(i => !i.children || i.children.length > 0);

  const filtered = useMemo(() => filterItems(navItems), [userRole]);

  const matches = (item: NavItem) =>
    !query || item.label.toLowerCase().includes(query.toLowerCase());

  const renderItem = (item: NavItem, depth = 0) => {
    if (!matches(item)) return null;
    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
    const hasChildren = !!item.children?.length;
    const isOpen = expanded.has(item.label);

    if (item.href.includes('[id]')) return null;

    if (hasChildren) {
      return (
        <div key={item.label}>
          <button
            onClick={() => toggle(item.label)}
            style={{ paddingLeft: collapsed ? '12px' : `${12 + depth * 14}px` }}
            className={`group flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-all ${
              isActive
                ? 'bg-[#1B3B34] text-white shadow-sm'
                : 'text-[#1B3B34]/80 hover:bg-[#F5E9DA] hover:text-[#1B3B34]'
            } ${collapsed ? 'justify-center' : ''}`}
          >
            <div className="flex items-center gap-3">
              <item.icon className={`h-[18px] w-[18px] ${isActive ? 'text-[#E8B100]' : 'text-[#1B3B34]/60 group-hover:text-[#1B3B34]'}`} />
              {!collapsed && <span className="font-medium">{item.label}</span>}
            </div>
            {!collapsed && (
              <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-0' : '-rotate-90'} ${isActive ? 'text-[#E8B100]' : 'text-[#1B3B34]/40'}`} />
            )}
          </button>
          {!collapsed && isOpen && item.children && (
            <div className="relative mt-1 ml-5 space-y-0.5 border-l border-[#EAD9C3] pl-3">
              {item.children.map(c => renderItem(c, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        style={{ paddingLeft: collapsed ? '12px' : `${12 + depth * 14}px` }}
        className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all ${
          isActive
            ? 'bg-[#1B3B34] text-white shadow-sm'
            : 'text-[#1B3B34]/80 hover:bg-[#F5E9DA] hover:text-[#1B3B34]'
        } ${collapsed ? 'justify-center' : ''}`}
        title={collapsed ? item.label : undefined}
      >
        {isActive && (
          <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-[#C9A227]" />
        )}
        <item.icon className={`h-[18px] w-[18px] ${isActive ? 'text-[#E8B100]' : 'text-[#1B3B34]/60 group-hover:text-[#1B3B34]'}`} />
        {!collapsed && <span className="font-medium">{item.label}</span>}
        {!collapsed && item.badge && (
          <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
            isActive ? 'bg-[#C9A227] text-[#1B3B34]' : 'bg-[#EAD9C3] text-[#1B3B34]'
          }`}>{item.badge}</span>
        )}
      </Link>
    );
  };

  return (
    <aside
      className={`sticky top-[4.125rem] flex h-[calc(100vh-4.125rem)] flex-col border-r border-[#EAD9C3]/70 bg-white transition-all duration-300 ${
        collapsed ? 'w-[68px]' : 'w-64'
      }`}
    >
      {/* Search */}
      {!collapsed && (
        <div className="border-b border-[#EAD9C3]/60 p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#1B3B34]/40" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search menu…"
              className="w-full rounded-lg border border-[#EAD9C3] bg-[#FAF7F2] py-1.5 pl-8 pr-2 text-xs text-[#1B3B34] placeholder:text-[#1B3B34]/40 focus:border-[#C9A227] focus:outline-none focus:ring-2 focus:ring-[#C9A227]/20"
            />
          </div>
        </div>
      )}

      {/* Toggle */}
      {onToggle && (
        <div className={`flex ${collapsed ? 'justify-center' : 'justify-end'} px-2 pt-2`}>
          <button
            onClick={onToggle}
            aria-label="Toggle sidebar"
            className="rounded-md p-1.5 text-[#1B3B34]/50 transition hover:bg-[#F5E9DA] hover:text-[#1B3B34]"
          >
            <ChevronRight className={`h-4 w-4 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
          </button>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3 custom-scrollbar">
        {!collapsed && (
          <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#1B3B34]/40">
            Navigation
          </div>
        )}
        {filtered.map(i => renderItem(i))}
      </nav>

      {/* AI CTA */}
      {!collapsed && (
        <div className="mx-3 mb-3 rounded-xl bg-gradient-to-br from-[#1B3B34] to-[#255a4f] p-3.5 text-white shadow-md">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#E8B100]" />
            <span className="text-xs font-semibold tracking-wide text-[#E8B100]">AI ADVISOR</span>
          </div>
          <p className="text-[11px] leading-snug text-[#EAD9C3]/80">
            Get portfolio insights, risk predictions, and executive summaries.
          </p>
          <button className="mt-2.5 w-full rounded-lg bg-[#C9A227] py-1.5 text-[11px] font-bold text-[#1B3B34] transition hover:bg-[#E8B100]">
            Open Advisor
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-[#EAD9C3]/60 p-3">
        {!collapsed ? (
          <div className="space-y-1">
            <Link href="/help" className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-[#1B3B34]/70 transition hover:bg-[#F5E9DA] hover:text-[#1B3B34]">
              <HelpCircle className="h-3.5 w-3.5" /> Help & support
            </Link>
            <div className="px-2 pt-1 text-[10px] text-[#1B3B34]/40">
              EIH PMS v1.0 · © {new Date().getFullYear()}
            </div>
          </div>
        ) : (
          <div className="flex justify-center text-[#1B3B34]/40">
            <HelpCircle className="h-4 w-4" />
          </div>
        )}
      </div>
    </aside>
  );
}