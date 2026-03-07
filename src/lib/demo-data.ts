import { Quotation, QuotationStage, DashboardStats, TeamMember, CRMUser } from "@/types/crm";

// Demo data store
let quotations: Quotation[] = [
  {
    id: "q-001",
    quotationNumber: "QT-2026-001",
    customerName: "John Smith",
    companyName: "Acme Corp",
    customerEmail: "john@acme.com",
    customerPhone: "+1-555-0101",
    subject: "Industrial Equipment Supply",
    salesPersonId: "sp-001",
    salesPersonName: "Alex Rivera",
    managerId: "sm-001",
    products: [
      { name: "Hydraulic Press", description: "50-ton capacity", modelNumber: "HP-50", partNumber: "HP-50-2026", value: 25000 },
      { name: "Control Panel", description: "Digital PLC control", modelNumber: "CP-D1", partNumber: "CP-D1-2026", value: 5000 },
    ],
    totalValue: 30000,
    stage: "negotiation",
    poNumber: "",
    invoiceValue: 0,
    followUpDate: "2026-03-10",
    followUpNotes: "Client reviewing proposal",
    deliveryStatus: "",
    createdAt: "2026-02-15T10:00:00Z",
    updatedAt: "2026-03-05T14:30:00Z",
  },
  {
    id: "q-002",
    quotationNumber: "QT-2026-002",
    customerName: "Lisa Park",
    companyName: "TechFlow Inc",
    customerEmail: "lisa@techflow.com",
    customerPhone: "+1-555-0102",
    subject: "Office Automation System",
    salesPersonId: "sp-001",
    salesPersonName: "Alex Rivera",
    managerId: "sm-001",
    products: [
      { name: "Smart Desk Hub", description: "IoT-enabled desk", modelNumber: "SDH-1", partNumber: "SDH-1-2026", value: 3500 },
    ],
    totalValue: 3500,
    stage: "po_received",
    poNumber: "PO-TF-2026-045",
    invoiceValue: 3500,
    followUpDate: null,
    followUpNotes: "",
    deliveryStatus: "In Transit",
    createdAt: "2026-01-20T09:00:00Z",
    updatedAt: "2026-03-01T11:00:00Z",
  },
  {
    id: "q-003",
    quotationNumber: "QT-2026-003",
    customerName: "Carlos Mendez",
    companyName: "BuildRight LLC",
    customerEmail: "carlos@buildright.com",
    customerPhone: "+1-555-0103",
    subject: "Construction Tools Package",
    salesPersonId: "sp-001",
    salesPersonName: "Alex Rivera",
    managerId: "sm-001",
    products: [
      { name: "Power Drill Set", description: "Professional grade", modelNumber: "PDS-Pro", partNumber: "PDS-Pro-2026", value: 1200 },
      { name: "Laser Level", description: "360° rotating", modelNumber: "LL-360", partNumber: "LL-360-2026", value: 800 },
    ],
    totalValue: 2000,
    stage: "follow_up",
    poNumber: "",
    invoiceValue: 0,
    followUpDate: "2026-03-08",
    followUpNotes: "Follow up on pricing",
    deliveryStatus: "",
    createdAt: "2026-03-01T16:00:00Z",
    updatedAt: "2026-03-06T09:00:00Z",
  },
  {
    id: "q-004",
    quotationNumber: "QT-2026-004",
    customerName: "Emma Wilson",
    companyName: "GreenTech Solutions",
    customerEmail: "emma@greentech.com",
    customerPhone: "+1-555-0104",
    subject: "Solar Panel Installation Kit",
    salesPersonId: "sp-001",
    salesPersonName: "Alex Rivera",
    managerId: "sm-001",
    products: [
      { name: "Solar Panel 400W", description: "Monocrystalline", modelNumber: "SP-400M", partNumber: "SP-400M-2026", value: 12000 },
    ],
    totalValue: 12000,
    stage: "invoice_generated",
    poNumber: "PO-GT-2026-012",
    invoiceValue: 12000,
    followUpDate: null,
    followUpNotes: "",
    deliveryStatus: "Delivered",
    createdAt: "2026-01-10T08:00:00Z",
    updatedAt: "2026-02-28T10:00:00Z",
  },
  {
    id: "q-005",
    quotationNumber: "QT-2026-005",
    customerName: "David Kim",
    companyName: "FastTrack Logistics",
    customerEmail: "david@fasttrack.com",
    customerPhone: "+1-555-0105",
    subject: "Warehouse Equipment",
    salesPersonId: "sp-001",
    salesPersonName: "Alex Rivera",
    managerId: "sm-001",
    products: [
      { name: "Pallet Jack", description: "Electric", modelNumber: "PJ-E2", partNumber: "PJ-E2-2026", value: 4500 },
    ],
    totalValue: 4500,
    stage: "closed_won",
    poNumber: "PO-FT-2026-089",
    invoiceValue: 4500,
    followUpDate: null,
    followUpNotes: "",
    deliveryStatus: "Delivered",
    createdAt: "2025-12-15T11:00:00Z",
    updatedAt: "2026-02-20T15:00:00Z",
  },
  {
    id: "q-006",
    quotationNumber: "QT-2026-006",
    customerName: "Nina Patel",
    companyName: "MedSupply Co",
    customerEmail: "nina@medsupply.com",
    customerPhone: "+1-555-0106",
    subject: "Medical Equipment Order",
    salesPersonId: "sp-001",
    salesPersonName: "Alex Rivera",
    managerId: "sm-001",
    products: [
      { name: "Sterilizer Unit", description: "Autoclave 50L", modelNumber: "SU-50", partNumber: "SU-50-2026", value: 8000 },
    ],
    totalValue: 8000,
    stage: "quotation_created",
    poNumber: "",
    invoiceValue: 0,
    followUpDate: "2026-03-12",
    followUpNotes: "Pending client approval",
    deliveryStatus: "",
    createdAt: "2026-03-05T13:00:00Z",
    updatedAt: "2026-03-05T13:00:00Z",
  },
];

let quotationCounter = 7;

const users: CRMUser[] = [
  { id: "gm-001", name: "Sarah Johnson", email: "gm@demo.com", role: "general_manager", department: "Management", managerId: null, createdAt: "2025-01-01T00:00:00Z" },
  { id: "sm-001", name: "Mike Chen", email: "sm@demo.com", role: "sub_manager", department: "Sales East", managerId: "gm-001", createdAt: "2025-02-01T00:00:00Z" },
  { id: "sm-002", name: "Priya Sharma", email: "sm2@demo.com", role: "sub_manager", department: "Sales West", managerId: "gm-001", createdAt: "2025-02-15T00:00:00Z" },
  { id: "sp-001", name: "Alex Rivera", email: "sp@demo.com", role: "sales", department: "Sales East", managerId: "sm-001", createdAt: "2025-03-01T00:00:00Z" },
  { id: "sp-002", name: "Jordan Lee", email: "sp2@demo.com", role: "sales", department: "Sales East", managerId: "sm-001", createdAt: "2025-03-15T00:00:00Z" },
  { id: "sp-003", name: "Sam Taylor", email: "sp3@demo.com", role: "sales", department: "Sales West", managerId: "sm-002", createdAt: "2025-04-01T00:00:00Z" },
];

export function getQuotations(userId: string, role: string): Quotation[] {
  if (role === "general_manager") return quotations;
  if (role === "sub_manager") {
    const teamIds = users.filter((u) => u.managerId === userId).map((u) => u.id);
    return quotations.filter((q) => teamIds.includes(q.salesPersonId) || q.salesPersonId === userId);
  }
  return quotations.filter((q) => q.salesPersonId === userId);
}

export function getQuotationById(id: string): Quotation | undefined {
  return quotations.find((q) => q.id === id);
}

export function createQuotation(data: Omit<Quotation, "id" | "quotationNumber" | "createdAt" | "updatedAt">): Quotation {
  const q: Quotation = {
    ...data,
    id: `q-${String(quotationCounter).padStart(3, "0")}`,
    quotationNumber: `QT-2026-${String(quotationCounter).padStart(3, "0")}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  quotationCounter++;
  quotations = [q, ...quotations];
  return q;
}

export function updateQuotation(id: string, updates: Partial<Quotation>): Quotation | undefined {
  const idx = quotations.findIndex((q) => q.id === id);
  if (idx === -1) return undefined;
  quotations[idx] = { ...quotations[idx], ...updates, updatedAt: new Date().toISOString() };
  return quotations[idx];
}

export function deleteQuotation(id: string): boolean {
  const len = quotations.length;
  quotations = quotations.filter((q) => q.id !== id);
  return quotations.length < len;
}

export function getDashboardStats(userId: string, role: string): DashboardStats {
  const qs = getQuotations(userId, role);
  return {
    totalQuotations: qs.length,
    activeDeals: qs.filter((q) => !["closed_won", "closed_lost"].includes(q.stage)).length,
    poGenerated: qs.filter((q) => q.poNumber).length,
    invoicesCreated: qs.filter((q) => q.invoiceValue > 0).length,
    totalSalesValue: qs.reduce((sum, q) => sum + q.totalValue, 0),
  };
}

export function getTeamMembers(managerId: string, role: string): TeamMember[] {
  let members: CRMUser[];
  if (role === "general_manager") {
    members = users.filter((u) => u.role !== "general_manager");
  } else {
    members = users.filter((u) => u.managerId === managerId);
  }

  return members.map((m) => {
    const memberQuotations = quotations.filter((q) => q.salesPersonId === m.id);
    return {
      id: m.id,
      name: m.name,
      department: m.department,
      activeDeals: memberQuotations.filter((q) => !["closed_won", "closed_lost"].includes(q.stage)).length,
      poGenerated: memberQuotations.filter((q) => q.poNumber).length,
      invoiceGenerated: memberQuotations.filter((q) => q.invoiceValue > 0).length,
      totalSalesValue: memberQuotations.reduce((sum, q) => sum + q.totalValue, 0),
    };
  });
}

export function getUsers(): CRMUser[] {
  return users;
}

export function getUserById(id: string): CRMUser | undefined {
  return users.find((u) => u.id === id);
}

export function exportToCSV(data: Quotation[]): string {
  const headers = ["Quotation No", "Customer", "Company", "Subject", "Value", "Stage", "PO Number", "Invoice Value", "Sales Person", "Created"];
  const rows = data.map((q) => [
    q.quotationNumber, q.customerName, q.companyName, q.subject,
    q.totalValue.toString(), q.stage, q.poNumber, q.invoiceValue.toString(),
    q.salesPersonName, new Date(q.createdAt).toLocaleDateString(),
  ]);
  return [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
}
