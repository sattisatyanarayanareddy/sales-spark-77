import { QuotationStatus } from "@/types/crm";

export const APPROVAL_PENDING_STATUS: QuotationStatus = "Approval Pending";

export function getQuotationStatusForApprovalRequest(_currentStatus: QuotationStatus): QuotationStatus {
  return APPROVAL_PENDING_STATUS;
}

export function canManagerApproveQuotation(status: QuotationStatus): boolean {
  return status === "Created" || status === APPROVAL_PENDING_STATUS;
}
