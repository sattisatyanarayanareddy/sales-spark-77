export type UserRole = "administrator" | "general_manager" | "sub_manager" | "sales";

export interface CRMUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  managerId: string | null;
  createdAt: string;
  profilePicture?: string;
  phone?: string;
  address?: string;
  updatedAt?: string;
}

export type QuotationStatus = "Draft" | "Created" | "Sent" | "Won";

export interface Customer {
  id: string;
  name: string;
  companyName: string;
  email: string;
  phone: string;
  department: string;
  createdBy: string;
  userEmail: string;
}

export interface Product {
  id: string;
  type: "Goods" | "Service";
  name: string;
  sku: string;
  unit: "box" | "cm" | "dz" | "ft" | "g" | "in" | "kg" | "km" | "lb" | "mg" | "ml" | "m" | "pcs" | "roll" | "pack" | "pack of 50" | "pack of 100" | "pack of 500";
  description: string;
  salesDescription?: string;
  purchaseDescription?: string;
  modelNumber?: string;
  partNumber?: string;
  value: number; // selling price
  costPrice: number;
  quantity?: number;
  imageUrl: string;
  isSellable: boolean;
  saleAccount: string;
  purchaseAccount: string;
  createdBy: string;
  userEmail: string;
  createdAt: string;
  updatedAt: string;
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
  status: QuotationStatus;
  poNumber: string;
  poValue: number;
  invoiceValue: number;
  followUpDate: string | null;
  followUpNotes: string;
  deliveryStatus: "Pending" | "Partial Delivery" | "Delivered";
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

export const STATUS_LABELS: Record<QuotationStatus, string> = {
  Draft: "Draft",
  Created: "Created",
  Sent: "Sent",
};

export type SalesFunnelStatus =
  | "Hot"
  | "Warm"
  | "Cold"
  | "Closed"
  | "Cancelled"
  | "Lost"
  | "Won";

export interface SalesFunnel {
  id: string;
  quotationId: string;
  quotationNumber: string;
  companyName: string;
  subject: string;
  quotationValue: number;
  followUpDate: string | null;
  status: SalesFunnelStatus;
  poValue: number;
  deliveryStatus: "Pending" | "Partial Delivery" | "Delivered";
  invoiceValue: number;
  salesPersonId: string;
  createdAt: string;
  updatedAt: string;
}

export const STATUS_COLORS: Record<QuotationStatus, string> = {
  Draft: "bg-gray-500/10 text-gray-500",
  Created: "bg-primary/10 text-primary",
  Sent: "bg-blue-500/10 text-blue-500",
};

export const SALES_FUNNEL_STATUS_LABELS: Record<SalesFunnelStatus, string> = {
  Hot: "Hot",
  Warm: "Warm",
  Cold: "Cold",
  Closed: "Closed",
  Cancelled: "Cancelled",
  Lost: "Lost",
  Won: "Won",
};

export const SALES_FUNNEL_STATUS_COLORS: Record<SalesFunnelStatus, string> = {
  Hot: "bg-red-500/10 text-red-500",
  Warm: "bg-orange-500/10 text-orange-500",
  Cold: "bg-gray-500/10 text-gray-500",
  Closed: "bg-green-500/10 text-green-500",
  Cancelled: "bg-yellow-500/10 text-yellow-500",
  Lost: "bg-red-600/10 text-red-600",
  Won: "bg-green-600/10 text-green-600",
};
