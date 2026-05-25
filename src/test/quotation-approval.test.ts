import { describe, expect, it } from "vitest";
import { resolveQuotationApprovalManagerId } from "@/lib/quotation-approval";

describe("resolveQuotationApprovalManagerId", () => {
  it("prefers the salesperson's current manager assignment when the quotation managerId is missing", () => {
    expect(resolveQuotationApprovalManagerId("", "manager-123")).toBe("manager-123");
  });

  it("falls back to the quotation managerId when the salesperson manager is unavailable", () => {
    expect(resolveQuotationApprovalManagerId("manager-456", null)).toBe("manager-456");
  });

  it("returns null when neither manager source is available", () => {
    expect(resolveQuotationApprovalManagerId("", null)).toBeNull();
  });
});
