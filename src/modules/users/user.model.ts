import { User, UserWithoutPassword } from '../../db/schema';

/**
 * Remove sensitive fields from user object
 */
export function sanitizeUser(user: User): UserWithoutPassword {
  const { password_hash, token_version, ...sanitizedUser } = user;
  return sanitizedUser;
}

/**
 * Remove sensitive fields from multiple user objects
 */
export function sanitizeUsers(users: User[]): UserWithoutPassword[] {
  return users.map(sanitizeUser);
}

/**
 * Validate user role
 */
export function isValidRole(role: string): role is 'admin' | 'manager' | 'viewer' {
  return ['admin', 'manager', 'viewer'].includes(role);
}

/**
 * Check if user can manage another user based on roles
 */
export function canManageUser(actorRole: string, targetRole: string): boolean {
  // Admin can manage everyone
  if (actorRole === 'admin') {
    return true;
  }
  
  // Manager can manage viewers but not other managers or admins
  if (actorRole === 'manager') {
    return targetRole === 'viewer';
  }
  
  // Viewers cannot manage anyone
  return false;
}

/**
 * Get role hierarchy level (higher number = more permissions)
 */
export function getRoleLevel(role: string): number {
  switch (role) {
    case 'admin': return 3;
    case 'manager': return 2;
    case 'viewer': return 1;
    default: return 0;
  }
}