export function resolveQuotationApprovalManagerId(
  quotationManagerId: string,
  salespersonManagerId?: string | null
): string | null {
  if (salespersonManagerId) {
    return salespersonManagerId;
  }

  if (quotationManagerId) {
    return quotationManagerId;
  }

  return null;
}
