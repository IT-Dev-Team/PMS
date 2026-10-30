// hooks/useDashboardNav.ts
'use client';

import { useSyncExternalStore } from 'react';

export type Tab =
  | 'overview' | 'plan' | 'procurement' | 'reports' | 'issues'
  | 'financial' | 'governance' | 'documents' | 'risks';

export type NavState = {
  projectId: string | null;
  tab: Tab | null;
  itemId: string | null;
};

const DEFAULT: NavState = { projectId: null, tab: null, itemId: null };
const EMPTY: NavState = DEFAULT;

let state: NavState = DEFAULT;
const listeners = new Set<() => void>();

function setState(next: NavState) {
  state = next;
  listeners.forEach((l) => l());
}

// Public setters — importable from anywhere (e.g., DashboardHeader)
export function setNavTarget(target: NavState) {
  setState(target);
}
export function openProject(projectId: string) {
  setState({ projectId, tab: null, itemId: null });
}
export function clearNavHighlight() {
  setState({ ...state, tab: null, itemId: null });
}
export function resetNav() {
  setState(DEFAULT);
}

export function useDashboardNav() {
  const current = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => EMPTY
  );

  return {
    activeProjectId: current.projectId,
    activeTab: current.tab,
    highlightItemId: current.itemId,
    navigateTo: setNavTarget,
    openProject,
    clearHighlight: clearNavHighlight,
    backToDashboard: resetNav,
  };
}