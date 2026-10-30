// lib/notifications/events.ts
// Who gets told about what. recipientsFor() is pure: the client calls notify(), and the
// /api/notifications route calls recipientsFor() again so recipients are never trusted from the browser.

import { managerIdOf } from '@/lib/projects/access'

export type NotificationEvent =
  | 'REPORT_SUBMITTED' | 'REPORT_REVIEWED'
  | 'ISSUE_CREATED' | 'ISSUE_ESCALATED' | 'ISSUE_ASSIGNED' | 'ISSUE_RESOLVED'
  | 'RISK_HIGH' | 'COST_PENDING' | 'DECISION_CREATED' | 'TASK_BLOCKED'

export type Recipient = { userId: string } | { role: 'CEO' }
export type NotifyContext = {
  project: { id: string; name: string; managerId?: string; manager_id?: string }
  actorId?: string | null
  itemId?: string | null
  title?: string                      // title of the issue / risk / report / task
  severity?: string | null
  needsCeoAttention?: boolean
  assigneeId?: string | null
  reporterId?: string | null
  detail?: string | null
}

const sev = (v?: string | null) => String(v || '').toUpperCase()

export function recipientsFor(event: NotificationEvent, c: NotifyContext): Recipient[] {
  const manager = managerIdOf(c.project)
  const out: Recipient[] = []
  const toManager = () => manager && out.push({ userId: manager })
  const toCeo = () => out.push({ role: 'CEO' })
  const critical = sev(c.severity) === 'CRITICAL'

  switch (event) {
    case 'REPORT_SUBMITTED': toCeo(); break
    case 'REPORT_REVIEWED': toManager(); break
    case 'ISSUE_CREATED': toManager(); if (critical || c.needsCeoAttention) toCeo(); break
    case 'ISSUE_ESCALATED': toCeo(); break
    case 'ISSUE_ASSIGNED': if (c.assigneeId) out.push({ userId: String(c.assigneeId) }); break
    case 'ISSUE_RESOLVED':
      if (c.reporterId) out.push({ userId: String(c.reporterId) })
      toManager(); if (c.needsCeoAttention) toCeo(); break
    case 'RISK_HIGH': toManager(); if (critical) toCeo(); break
    case 'COST_PENDING': toManager(); break
    case 'DECISION_CREATED': toManager(); toCeo(); break
    case 'TASK_BLOCKED': toManager(); toCeo(); break
  }
  // never notify the person who did the thing; drop duplicates
  const seen = new Set<string>()
  return out.filter(r => {
    const key = 'userId' in r ? `u:${r.userId}` : `r:${r.role}`
    if ('userId' in r && c.actorId && r.userId === String(c.actorId)) return false
    if (seen.has(key)) return false
    seen.add(key); return true
  })
}

/** Text + deep link (tab and highlighted row) that the notification opens. */
export function describe(event: NotificationEvent, c: NotifyContext): { title: string; message: string; tab: string; priority: 'low' | 'normal' | 'high' } {
  const p = c.project.name, t = c.title ? `“${c.title}”` : ''
  switch (event) {
    case 'REPORT_SUBMITTED': return { title: 'Progress report submitted', message: `A new report for ${p} is waiting for your review.`, tab: 'reports', priority: 'normal' }
    case 'REPORT_REVIEWED': return { title: 'Report reviewed by CEO', message: `Your report for ${p} was reviewed.${c.detail ? ` ${c.detail}` : ''}`, tab: 'reports', priority: 'normal' }
    case 'ISSUE_CREATED': return { title: `New ${sev(c.severity).toLowerCase() || ''} issue`.replace('  ', ' '), message: `${t} was registered on ${p}.`, tab: 'issues', priority: sev(c.severity) === 'CRITICAL' ? 'high' : 'normal' }
    case 'ISSUE_ESCALATED': return { title: 'Issue needs CEO attention', message: `${t} on ${p} was escalated to you.`, tab: 'issues', priority: 'high' }
    case 'ISSUE_ASSIGNED': return { title: 'Issue assigned to you', message: `${t} on ${p} is now assigned to you.`, tab: 'issues', priority: 'normal' }
    case 'ISSUE_RESOLVED': return { title: 'Issue resolved', message: `${t} on ${p} was resolved.`, tab: 'issues', priority: 'low' }
    case 'RISK_HIGH': return { title: `${sev(c.severity) === 'CRITICAL' ? 'Critical' : 'High'} risk registered`, message: `${t} was added to ${p}.`, tab: 'risks', priority: 'high' }
    case 'COST_PENDING': return { title: 'Cost awaiting approval', message: `A new cost on ${p} is pending approval.`, tab: 'financial', priority: 'normal' }
    case 'DECISION_CREATED': return { title: 'New board decision', message: `${t} was recorded on ${p}.`, tab: 'governance', priority: 'normal' }
    case 'TASK_BLOCKED': return { title: 'Task blocked', message: `${t} on ${p} is blocked.${c.detail ? ` ${c.detail}` : ''}`, tab: 'plan', priority: 'high' }
  }
}

/** Fire-and-forget. A failed notification must never break the action that caused it. */
export async function notify(event: NotificationEvent, c: NotifyContext): Promise<void> {
  try {
    await fetch('/api/notifications', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, projectId: c.project.id, itemId: c.itemId ?? null, context: { ...c, project: { id: c.project.id, name: c.project.name } } }),
    })
  } catch { /* ignore */ }
}