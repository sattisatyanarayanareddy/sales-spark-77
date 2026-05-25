import { describe, expect, it } from "vitest";
import { getAddUserRolePolicy } from "@/lib/user-form-policy";

describe("getAddUserRolePolicy", () => {
  it("does not require a department for general manager users", () => {
    expect(getAddUserRolePolicy("general_manager")).toEqual({
      requiresDepartment: false,
      requiresManagerAssignment: false,
    });
  });

  it("does not require a manager assignment for manager users", () => {
    expect(getAddUserRolePolicy("sub_manager")).toEqual({
      requiresDepartment: true,
      requiresManagerAssignment: false,
    });
  });

  it("requires a manager assignment for sales users", () => {
    expect(getAddUserRolePolicy("sales")).toEqual({
      requiresDepartment: true,
      requiresManagerAssignment: true,
    });
  });
});
