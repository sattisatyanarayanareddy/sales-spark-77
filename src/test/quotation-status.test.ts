import { describe, expect, it } from "vitest";
import { canManagerApproveQuotation, getQuotationStatusForApprovalRequest } from "@/lib/quotation-status";

describe("quotation approval status helpers", () => {
  it("marks a quotation as approval pending when a salesperson submits it for approval", () => {
    expect(getQuotationStatusForApprovalRequest("Created")).toBe("Approval Pending");
    expect(getQuotationStatusForApprovalRequest("Draft")).toBe("Approval Pending");
  });

  it("keeps manager approval actions available while the quotation is pending approval", () => {
    expect(canManagerApproveQuotation("Created")).toBe(true);
    expect(canManagerApproveQuotation("Approval Pending")).toBe(true);
    expect(canManagerApproveQuotation("Sent")).toBe(false);
  });
});
