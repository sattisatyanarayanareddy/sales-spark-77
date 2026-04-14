import { UserRole } from "@/types/crm";

export const ROLE_HOME_ROUTE: Record<UserRole, string> = {
  administrator: "/dashboard",
  general_manager: "/dashboard",
  sub_manager: "/dashboard",
  sales: "/dashboard",
};

export const TEAM_ALLOWED_ROLES: UserRole[] = ["administrator", "general_manager", "sub_manager"];
export const QUOTATION_CREATE_ALLOWED_ROLES: UserRole[] = ["sales"];
export const QUOTATION_DELETE_ALLOWED_ROLES: UserRole[] = ["sales", "general_manager"];

export const hasRoleAccess = (role: UserRole, allowedRoles?: UserRole[]) => {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  return allowedRoles.includes(role);
};

export const canManageTeam = (role: UserRole) => hasRoleAccess(role, TEAM_ALLOWED_ROLES);
export const canCreateQuotation = (role: UserRole) => hasRoleAccess(role, QUOTATION_CREATE_ALLOWED_ROLES);
export const canDeleteQuotation = (role: UserRole) => hasRoleAccess(role, QUOTATION_DELETE_ALLOWED_ROLES);
