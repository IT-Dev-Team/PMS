// hooks/useNotifications.ts
'use client';

import { useSyncExternalStore } from 'react';

export type NotificationItem = {
  id: string;
  type: 'REPORT_SUBMITTED_TO_CEO' | 'ISSUE_CEO_ATTENTION' | 'GENERAL';
  title: string;
  message: string;
  projectId: string;
  projectName: string;
  targetType: 'report' | 'issue';
  targetId: string;
  createdAt: string;
  read: boolean;
  reviewed: boolean;
  submittedBy: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
};

const KEY = 'eih_notifications';
const EMPTY: NotificationItem[] = [];

// ---- Module-level store (shared across every useNotifications() call) ----
let state: NotificationItem[] = [];
const listeners = new Set<() => void>();
let hydrated = false;

function emit() {
  listeners.forEach((l) => l());
}

function persist() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* quota / private mode — ignore */
  }
}

function hydrateOnce() {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(KEY);
    state = raw ? (JSON.parse(raw) as NotificationItem[]) : [];
  } catch {
    state = [];
  }
  emit();
}

// Kick hydration immediately on the client (no-op on server)
if (typeof window !== 'undefined') hydrateOnce();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

// ---- Mutators (callable from anywhere — header, page, buttons) ----
export function pushNotification(
  n: Omit<NotificationItem, 'id' | 'createdAt' | 'read' | 'reviewed'>
): NotificationItem {
  const created: NotificationItem = {
    ...n,
    id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    read: false,
    reviewed: false,
  };
  state = [created, ...state];
  persist();
  emit();
  return created;
}

export function markNotificationRead(id: string) {
  state = state.map((n) => (n.id === id ? { ...n, read: true } : n));
  persist();
  emit();
}

export function markNotificationReviewed(id: string) {
  state = state.map((n) =>
    n.id === id ? { ...n, reviewed: true, read: true } : n
  );
  persist();
  emit();
}

export function markAllNotificationsRead() {
  state = state.map((n) => ({ ...n, read: true }));
  persist();
  emit();
}

// ---- Hook ----
export function useNotifications() {
  const notifications = useSyncExternalStore(
    subscribe,
    () => state,
    () => EMPTY
  );

  return {
    notifications,
    push: pushNotification,
    markRead: markNotificationRead,
    markReviewed: markNotificationReviewed,
    markAllRead: markAllNotificationsRead,
    unreadCount: notifications.filter((n) => !n.read).length,
  };
}