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

export interface Product {
  name: string;
  description: string;
  modelNumber: string;
  partNumber: string;
  value: number;
  imageUrl?: string;
}

export type QuotationStage =
  | "quotation_created"
  | "follow_up"
  | "negotiation"
  | "po_received"
  | "invoice_generated"
  | "delivered"
  | "closed_won"
  | "closed_lost";

export const STAGE_LABELS: Record<QuotationStage, string> = {
  quotation_created: "Quotation Created",
  follow_up: "Follow-up",
  negotiation: "Negotiation",
  po_received: "PO Received",
  invoice_generated: "Invoice Generated",
  delivered: "Delivered",
  closed_won: "Closed Won",
  closed_lost: "Closed Lost",
};

export const STAGE_COLORS: Record<QuotationStage, string> = {
  quotation_created: "bg-info/10 text-info",
  follow_up: "bg-warning/10 text-warning",
  negotiation: "bg-accent/10 text-accent",
  po_received: "bg-primary/10 text-primary",
  invoice_generated: "bg-success/10 text-success",
  delivered: "bg-success/10 text-success",
  closed_won: "bg-success/10 text-success",
  closed_lost: "bg-destructive/10 text-destructive",
};

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

export interface TeamMember {
  id: string;
  name: string;
  department: string;
  activeDeals: number;
  poGenerated: number;
  invoiceGenerated: number;
  totalSalesValue: number;
}

export interface DashboardStats {
  totalQuotations: number;
  activeDeals: number;
  poGenerated: number;
  invoicesCreated: number;
  totalSalesValue: number;
}
