import { describe, expect, it } from "vitest";
import { canManagerApproveQuotation, getQuotationStatusForApprovalRequest } from "@/lib/quotation-status";

describe("quotation approval status helpers", () => {
  it("marks a quotation as ask for approve when a salesperson submits it for approval", () => {
    expect(getQuotationStatusForApprovalRequest("Created")).toBe("Ask for Approve");
    expect(getQuotationStatusForApprovalRequest("Draft")).toBe("Ask for Approve");
  });

  it("keeps manager approval actions available while the quotation is pending approval", () => {
    expect(canManagerApproveQuotation("Created")).toBe(true);
    expect(canManagerApproveQuotation("Ask for Approve")).toBe(true);
    expect(canManagerApproveQuotation("Approved")).toBe(false);
  });
});
