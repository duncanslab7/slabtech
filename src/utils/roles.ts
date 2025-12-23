/**
 * Role-based permission utilities for multi-tenancy
 */

export type UserRole = 'super_admin' | 'company_admin' | 'user'

/**
 * Check if user can manage companies (create, edit, delete companies)
 */
export function canManageCompany(userRole: UserRole): boolean {
  return userRole === 'super_admin'
}

/**
 * Check if user can invite new users to a company
 */
export function canInviteUsers(userRole: UserRole): boolean {
  return userRole === 'super_admin' || userRole === 'company_admin'
}

/**
 * Check if user can view all users in their company
 */
export function canViewCompanyUsers(userRole: UserRole): boolean {
  return userRole === 'super_admin' || userRole === 'company_admin'
}

/**
 * Check if user can view all transcripts in their company
 */
export function canViewAllTranscripts(userRole: UserRole): boolean {
  return userRole === 'super_admin' || userRole === 'company_admin'
}

/**
 * Check if user can delete transcripts (own or any in company)
 */
export function canDeleteTranscripts(userRole: UserRole, isOwner: boolean = false): boolean {
  return userRole === 'super_admin' || userRole === 'company_admin' || isOwner
}

/**
 * Check if user can manage company settings (branding, config)
 */
export function canManageCompanySettings(userRole: UserRole): boolean {
  return userRole === 'super_admin' || userRole === 'company_admin'
}

/**
 * Check if user can view login activity for their company
 */
export function canViewLoginActivity(userRole: UserRole): boolean {
  return userRole === 'super_admin' || userRole === 'company_admin'
}

/**
 * Get display-friendly role name
 */
export function getRoleDisplayName(role: UserRole): string {
  switch (role) {
    case 'super_admin':
      return 'Super Admin'
    case 'company_admin':
      return 'Company Admin'
    case 'user':
      return 'User'
    default:
      return role
  }
}

/**
 * Get role badge color for UI
 */
export function getRoleBadgeColor(role: UserRole): { bg: string; text: string } {
  switch (role) {
    case 'super_admin':
      return { bg: 'bg-purple-100', text: 'text-purple-700' }
    case 'company_admin':
      return { bg: 'bg-blue-100', text: 'text-blue-700' }
    case 'user':
      return { bg: 'bg-gray-100', text: 'text-gray-700' }
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-700' }
  }
}
