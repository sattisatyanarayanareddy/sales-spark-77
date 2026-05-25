import { UserRole } from "@/types/crm";

export interface AddUserRolePolicy {
  requiresDepartment: boolean;
  requiresManagerAssignment: boolean;
}

export function getAddUserRolePolicy(role: UserRole): AddUserRolePolicy {
  return {
    requiresDepartment: role !== "general_manager",
    requiresManagerAssignment: role === "sales",
  };
}
