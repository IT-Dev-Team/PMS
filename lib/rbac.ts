import { executeQuery } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/user'

export type UserRole =
  | 'ceo'
  | 'portfolio_manager'
  | 'project_manager'
  | 'financial_controller'
  | 'procurement_lead'
  | 'board_member'
  | 'team_member'

export const ROLE_PERMISSIONS: Record<UserRole, Record<string, boolean>> = {
  ceo: {
    canViewExecutive: true,
    canApprove: true,
    canManageBoardDecisions: true,
    canViewAllProjects: true,
    canExportData: true,
  },
  portfolio_manager: {
    canViewPortfolio: true,
    canManageProjects: true,
    canViewAllProjects: true,
    canViewFinancials: true,
    canManageRisks: true,
  },
  project_manager: {
    canManageProjects: true,
    canManageTasks: true,
    canManageSchedule: true,
    canManageTeam: true,
    canViewRisks: true,
  },
  financial_controller: {
    canManageFinancials: true,
    canViewAllFinancials: true,
    canGenerateReports: true,
    canManageBudgets: true,
    canAudit: true,
  },
  procurement_lead: {
    canManageProcurement: true,
    canManageVendors: true,
    canEvaluateContractors: true,
    canManageSLAs: true,
  },
  board_member: {
    canVoteOnDecisions: true,
    canViewExecutive: true,
    canViewProjects: true,
    canViewRisks: true,
  },
  team_member: {
    canManageTasks: true,
    canViewOwnProjects: true,
    canTrackTime: true,
  },
}

// Get current user's roles
export async function getUserRoles(): Promise<UserRole[]> {
  try {
    const user = await getCurrentUser()
    if (!user) return []

    const roleNormalized = (user.role || '').toLowerCase().replace(/[\s-]/g, '_') as UserRole
    if (roleNormalized in ROLE_PERMISSIONS) {
      return [roleNormalized]
    }
    return ['team_member']
  } catch {
    return []
  }
}

export async function getUserRolesForOrg(_organizationId?: number): Promise<UserRole[]> {
  return getUserRoles()
}

// Check if user has a specific role
export async function hasRole(role: UserRole): Promise<boolean> {
  const roles = await getUserRoles()
  return roles.includes(role)
}

// Check if user has any of the specified roles
export async function hasAnyRole(roles: UserRole[]): Promise<boolean> {
  const userRoles = await getUserRoles()
  return roles.some((role) => userRoles.includes(role))
}

// Check if user has permission for an action
export async function canPerform(
  action: string
): Promise<boolean> {
  const userRoles = await getUserRoles()
  return userRoles.some((role) => {
    const perms = ROLE_PERMISSIONS[role]
    return perms ? !!perms[action] : false
  })
}

// Role-based access control requirement
export async function requireRole(roles: UserRole[]): Promise<boolean> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Unauthorized: Not authenticated')
  }

  const userRoles = await getUserRoles()
  const hasRequiredRole = roles.some((role) => userRoles.includes(role))

  if (!hasRequiredRole) {
    throw new Error('Unauthorized: Insufficient permissions')
  }

  return true
}
