// lib/projects/access.ts
// One place that decides who can see / change a project. Use it in the UI AND in every API route
// (UI checks are convenience only; the API check is the real security boundary).
//
//  CEO              -> sees every project, read-only (the one write exception: reviewing reports)
//  PROJECT_MANAGER  -> sees and manages ONLY projects whose managerId === their user id
//  TEAM_MEMBER      -> sees and works on ONLY projects that list them as a member
//  anyone else      -> no access

export type AppUser = { id?: string | number | null; role?: string | null; name?: string | null } | null | undefined
export type AccessMode = 'view' | 'modify' | 'review'
export type AccessError = { status: 401 | 403 | 404; error: string }

const s = (v: any) => (v == null ? '' : String(v))

/** 'Project Manager', 'project-manager', 'PROJECT_MANAGER' -> 'PROJECT_MANAGER' */
export const roleOf = (u: AppUser) => s(u?.role).trim().toUpperCase().replace(/[\s-]+/g, '_')
const uid = (u: AppUser) => s(u?.id)

// Accepted spellings of each role (matched after upper-casing and replacing spaces/dashes with _).
const CEO_ROLES = ['CEO', 'CHIEF_EXECUTIVE_OFFICER']
const MANAGER_ROLES = ['PROJECT_MANAGER', 'PM', 'MANAGER']
const MEMBER_ROLES = ['TEAM_MEMBER', 'MEMBER']
const isManagerRole = (u: AppUser) => MANAGER_ROLES.includes(roleOf(u))
const isMemberRole = (u: AppUser) => MEMBER_ROLES.includes(roleOf(u))

export const isCEO = (u: AppUser) => CEO_ROLES.includes(roleOf(u))

export const managerIdOf = (p: any): string =>
  s(p?.managerId ?? p?.manager_id ?? p?.projectManagerId ?? p?.project_manager_id ?? p?.manager?.id)

export const memberIdsOf = (p: any): string[] => {
  const raw = p?.teamMemberIds ?? p?.memberIds ?? p?.members ?? p?.teamMembers ?? []
  return (Array.isArray(raw) ? raw : [])
    .map((m: any) => s(m !== null && typeof m === 'object' ? m.id ?? m.userId ?? m.user_id ?? m.user?.id : m))
    .filter(Boolean)
}

export const isManagerOf = (u: AppUser, p: any) => {
  const m = managerIdOf(p)
  return isManagerRole(u) && !!uid(u) && !!m && m === uid(u)
}

export const isMemberOf = (u: AppUser, p: any) =>
  isMemberRole(u) && !!uid(u) && memberIdsOf(p).includes(uid(u))

export const canViewProject = (u: AppUser, p: any) => !!u && !!p && (isCEO(u) || isManagerOf(u, p) || isMemberOf(u, p))

/** Add / edit / delete anything inside a project. The CEO can never do this. */
export const canModifyProject = (u: AppUser, p: any) => !!u && !!p && !isCEO(u) && (isManagerOf(u, p) || isMemberOf(u, p))

/** Resolving issues is a manager decision. */
export const canResolveIssues = (u: AppUser, p: any) => isManagerOf(u, p)

/** The only write the CEO keeps: reviewing submitted progress reports. */
export const canReviewReports = (u: AppUser) => isCEO(u)

export const visibleProjects = <T,>(u: AppUser, projects: T[] | null | undefined): T[] =>
  (projects || []).filter(p => canViewProject(u, p))

/** Portfolios keep only the projects the user may see. Non-CEOs lose portfolios that end up empty. */
export function visiblePortfolios(u: AppUser, portfolios: any[] | null | undefined): any[] {
  return (portfolios || [])
    .map(pf => ({ ...pf, projects: visibleProjects(u, pf.projects) }))
    .filter(pf => isCEO(u) || pf.projects.length > 0)
}

/**
 * For records that belong to a project (issues, risks, reports, costs, documents, decisions).
 * Pass the projects the user can see; rows for any other project are dropped.
 */
export function filterByProjectAccess<T extends { projectId?: any; project_id?: any }>(
  u: AppUser, rows: T[] | null | undefined, projects: any[] | null | undefined,
): T[] {
  const ok = new Set(visibleProjects(u, projects).map((p: any) => s(p?.id)))
  return (rows || []).filter(r => ok.has(s(r.projectId ?? r.project_id)))
}

/**
 * Describes which projects a user may list, so the DATABASE query can apply it
 * (e.g. Prisma: all -> {}, manager -> { managerId: id }, member -> { members: { some: { userId: id } } },
 * none -> return an empty list without querying).
 */
export type ProjectScope = { kind: 'all' } | { kind: 'manager'; managerId: string } | { kind: 'member'; memberId: string } | { kind: 'none' }
export function projectScope(u: AppUser): ProjectScope {
  if (!uid(u)) return { kind: 'none' }
  if (isCEO(u)) return { kind: 'all' }
  if (isManagerRole(u)) return { kind: 'manager', managerId: uid(u) }
  if (isMemberRole(u)) return { kind: 'member', memberId: uid(u) }
  return { kind: 'none' }
}

/** GET/HEAD -> view; every other method -> modify. Report review is requested explicitly as 'review'. */
export const modeForMethod = (method: string): AccessMode =>
  ['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase()) ? 'view' : 'modify'

/**
 * For API routes. Returns the HTTP error to send, or null when allowed.
 * hideExistence: answer 404 instead of 403 so people can't discover projects they aren't on.
 */
export function authorizeProject(
  u: AppUser, project: any, mode: AccessMode, opts: { hideExistence?: boolean } = {},
): AccessError | null {
  if (!uid(u)) return { status: 401, error: 'Not signed in' }
  if (!project) return { status: 404, error: 'Project not found' }
  const deny = (error: string): AccessError =>
    opts.hideExistence && !canViewProject(u, project) ? { status: 404, error: 'Project not found' } : { status: 403, error }

  if (mode === 'review') {
    if (!canReviewReports(u)) return deny('Only the CEO can review reports')
    return null
  }
  if (mode === 'view') return canViewProject(u, project) ? null : deny('You do not have access to this project')
  if (isCEO(u)) return { status: 403, error: 'The CEO has read-only access' }
  return canModifyProject(u, project) ? null : deny('You are not assigned to this project')
}

/** Human-readable reason a user can or cannot open a project. Used for on-screen diagnostics. */
export function explainAccess(u: AppUser, p: any): string {
  if (!u) return 'No signed-in user reached this component (the `user` prop is missing or undefined).'
  if (!uid(u)) return `The signed-in user has no id (role "${s(u.role)}").`
  if (isCEO(u)) return 'CEO: all projects are visible.'
  if (isManagerRole(u)) {
    const m = managerIdOf(p)
    if (!m) {
      const keys = Object.keys(p || {}).filter(k => /manag/i.test(k))
      return `This project row has no manager id. Manager-related fields on the row: ${keys.length ? keys.join(', ') : 'none'}. Add the manager's user id to the project query (as managerId).`
    }
    return m === uid(u) ? 'You manage this project.' : `Project manager id "${m}" does not match your user id "${uid(u)}".`
  }
  if (isMemberRole(u)) return memberIdsOf(p).includes(uid(u)) ? 'You are a member of this project.' : 'You are not listed as a member of this project (looked at teamMemberIds, memberIds, members, teamMembers).'
  return `Role "${s(u.role)}" is not recognised. Expected CEO, PROJECT_MANAGER or TEAM_MEMBER.`
}