export type UserRole = "general_manager" | "sub_manager" | "sales";

export interface CRMUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  managerId: string | null;
  createdAt: string;
}

export type QuotationStage =
  | "quotation_created"
  | "follow_up"
  | "po_received"
  | "invoice_sent"
  | "partial_payment"
  | "payment_received"
  | "closed_won"
  | "closed_lost";

export interface Product {
  name: string;
  description: string;
  modelNumber: string;
  partNumber: string;
  value: number;
  imageUrl: string;
}

export interface Quotation {
  id: string;
  quotationNumber: string;
  customerName: string;
  companyName: string;
  customerEmail: string;
  customerPhone: string;
  subject: string;
  salesPersonId: string;
  salesPersonName: string;
  managerId: string;
  products: Product[];
  totalValue: number;
  stage: QuotationStage;
  poNumber: string;
  invoiceValue: number;
  followUpDate: string | null;
  followUpNotes: string;
  deliveryStatus: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  totalQuotations: number;
  activeDeals: number;
  poGenerated: number;
  invoicesCreated: number;
  totalSalesValue: number;
}

export interface TeamMember {
  id: string;
  name: string;
  department: string;
  activeDeals: number;
  poGenerated: number;
  invoiceGenerated: number;
  totalSalesValue: number;
}

export const STAGE_LABELS: Record<QuotationStage, string> = {
  quotation_created: "Quotation Created",
  follow_up: "Follow Up",
  po_received: "PO Received",
  invoice_sent: "Invoice Sent",
  partial_payment: "Partial Payment",
  payment_received: "Payment Received",
  closed_won: "Closed Won",
  closed_lost: "Closed Lost",
};

export const STAGE_COLORS: Record<QuotationStage, string> = {
  quotation_created: "bg-primary/10 text-primary",
  follow_up: "bg-warning/10 text-warning",
  po_received: "bg-info/10 text-info",
  invoice_sent: "bg-secondary text-secondary-foreground",
  partial_payment: "bg-warning/10 text-warning",
  payment_received: "bg-success/10 text-success",
  closed_won: "bg-success/10 text-success",
  closed_lost: "bg-destructive/10 text-destructive",
};
