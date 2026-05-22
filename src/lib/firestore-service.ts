import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { uploadImageToCloudinary } from "@/lib/cloudinary";
import { CRMUser, Quotation, QuotationStatus, DashboardStats, TeamMember, Product, Customer, UserRole, SalesFunnel, SalesFunnelStatus, AppNotification } from "@/types/crm";

// ── Helpers ──

const toDate = (val: any): string => {
  if (!val) return "";
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof val === "string") return val;
  return new Date(val).toISOString();
};

function mapOldStageToStatus(oldStage: string): QuotationStatus {
  const stageMap: Record<string, QuotationStatus> = {
    quotation_created: "Created",
    follow_up: "Sent",
    po_received: "Sent",
    invoice_sent: "Sent",
    partial_payment: "Sent",
    payment_received: "Sent",
    closed_won: "Won",
    closed_lost: "Sent",
  };
  return stageMap[oldStage] || "Draft";
}

const mapSalesFunnel = (id: string, data: any): SalesFunnel => ({
  id,
  quotationId: data.quotationId || "",
  quotationNumber: data.quotationNumber || "",
  companyName: data.companyName || "",
  subject: data.subject || "",
  quotationValue: data.quotationValue || 0,
  followUpDate: data.followUpDate || null,
  status: data.status || "Hot",
  poValue: data.poValue || 0,
  deliveryStatus: data.deliveryStatus || "Pending",
  invoiceValue: data.invoiceValue || 0,
  salesPersonId: data.salesPersonId || "",
  createdAt: toDate(data.createdAt),
  updatedAt: toDate(data.updatedAt),
  disabled: !!data.disabled,
});

const mapQuotation = (id: string, data: any): Quotation => ({
  id,
  quotationNumber: data.quotationNumber || "",
  customerName: data.customerName || "",
  companyName: data.companyName || "",
  customerEmail: data.customerEmail || "",
  customerPhone: data.customerPhone || "",
  subject: data.subject || "",
  salesPersonId: data.salesPersonId || "",
  salesPersonName: data.salesPersonName || "",
  managerId: data.managerId || "",
  products: data.products || [],
  totalValue: data.totalValue || 0,
  status: data.status || (data.stage ? mapOldStageToStatus(data.stage) : "Draft"),
  poNumber: data.poNumber || "",
  poValue: data.poValue || 0,
  invoiceValue: data.invoiceValue || 0,
  followUpDate: data.followUpDate || null,
  followUpNotes: data.followUpNotes || "",
  deliveryStatus: data.deliveryStatus || "Pending",
  createdAt: toDate(data.createdAt),
  updatedAt: toDate(data.updatedAt),
  disabled: !!data.disabled,
});

// ── Users ──

export async function fetchUserDoc(uid: string): Promise<CRMUser | null> {
  console.log("📖 Fetching user doc for UID:", uid);
  const snap = await getDoc(doc(db, "users", uid));
  console.log("📄 Document exists:", snap.exists());
  if (!snap.exists()) return null;
  const d = snap.data();
  console.log("📦 Raw Firestore data:", d);
  const user: CRMUser = {
    id: uid,
    name: d.name || "",
    email: d.email || "",
    role: d.role || "sales",
    department: d.department || "",
    managerId: (d.managerId && d.managerId !== "null") ? d.managerId : null,
    createdAt: toDate(d.createdAt),
    phone: d.phone || "",
    address: d.address || "",
    profilePicture: d.profilePicture || undefined,
    updatedAt: toDate(d.updatedAt),
    disabled: !!d.disabled,
  };
  console.log("✨ Parsed user object:", user);
  return user;
}

export async function fetchAllUsers(): Promise<CRMUser[]> {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name || "",
      email: data.email || "",
      role: data.role || "sales",
      department: data.department || "",
      managerId: (data.managerId && data.managerId !== "null") ? data.managerId : null,
      createdAt: toDate(data.createdAt),
      phone: data.phone || "",
      address: data.address || "",
      profilePicture: data.profilePicture || undefined,
      updatedAt: toDate(data.updatedAt),
      disabled: !!data.disabled,
    } as CRMUser;
  });
}

export async function fetchTeamUsers(managerId: string, role: string): Promise<CRMUser[]> {
  const allUsers = await fetchAllUsers();
  if (role === "general_manager" || role === "administrator") return allUsers.filter((u) => u.id !== managerId);
  return allUsers.filter((u) => u.managerId === managerId);
}

export async function updateUserDoc(
  userId: string,
  updates: {
    name: string;
    role: UserRole;
    department: string;
    managerId: string | null;
  }
): Promise<void> {
  await updateDoc(doc(db, "users", userId), {
    ...updates,
  });
}

export async function deleteUserDoc(userId: string): Promise<void> {
  await deleteDoc(doc(db, "users", userId));
}

// ── Quotations ──

export async function fetchQuotations(userId: string, role: string): Promise<Quotation[]> {
  const sortByCreatedAtDesc = (items: Quotation[]) => {
    return [...items].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  };

  const isMissingIndexError = (error: unknown) => {
    const code = (error as { code?: string })?.code;
    return code === "failed-precondition";
  };

  let q;
  if (role === "general_manager") {
    q = query(collection(db, "quotations"), orderBy("createdAt", "desc"));
  } else {
    // sub_manager sees ONLY their own quotations (same as sales role)
    // Use fetchQuotationsForSalesperson for team member drill-downs
    try {
      q = query(
        collection(db, "quotations"),
        where("salesPersonId", "==", userId),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => mapQuotation(d.id, d.data()));
    } catch (error) {
      if (!isMissingIndexError(error)) {
        throw error;
      }

      q = query(collection(db, "quotations"), where("salesPersonId", "==", userId));
      const snap = await getDocs(q);
      return sortByCreatedAtDesc(snap.docs.map((d) => mapQuotation(d.id, d.data())));
    }
  }

  const snap = await getDocs(q);
  return snap.docs.map((d) => mapQuotation(d.id, d.data()));
}

export async function fetchQuotationById(id: string): Promise<Quotation | null> {
  const snap = await getDoc(doc(db, "quotations", id));
  if (!snap.exists()) return null;
  return mapQuotation(snap.id, snap.data());
}

export async function createQuotationDoc(
  data: Omit<Quotation, "id" | "quotationNumber" | "createdAt" | "updatedAt">
): Promise<string> {
  // Generate quotation number
  const counterRef = doc(db, "counters", "quotations");
  const counterSnap = await getDoc(counterRef);
  let nextNum = 1;
  if (counterSnap.exists()) {
    nextNum = (counterSnap.data().count || 0) + 1;
    await updateDoc(counterRef, { count: nextNum });
  } else {
    const { setDoc } = await import("firebase/firestore");
    await setDoc(counterRef, { count: 1 });
  }

  const quotationNumber = `QT-${new Date().getFullYear()}-${String(nextNum).padStart(3, "0")}`;

  const docRef = await addDoc(collection(db, "quotations"), {
    ...data,
    quotationNumber,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return docRef.id;
}

export async function requestQuotationApproval(quotation: Quotation): Promise<void> {
  if (!quotation.managerId) {
    throw new Error("No manager is assigned to this salesperson. Cannot request approval.");
  }
  await addDoc(collection(db, "notifications"), {
    type: "quotation_approval",
    title: "Quotation Pending Approval",
    message: `${quotation.salesPersonName} requested approval for quotation ${quotation.quotationNumber} for ${quotation.companyName} ($${quotation.totalValue.toLocaleString()}) to be Sent.`,
    quotationId: quotation.id,
    salespersonId: quotation.salesPersonId,
    salespersonName: quotation.salesPersonName,
    managerId: quotation.managerId,
    status: "pending",
    read: false,
    recipientId: quotation.managerId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateQuotationDoc(
  id: string,
  updates: Partial<Quotation>
): Promise<void> {
  const { id: _id, createdAt: _ca, ...rest } = updates as any;
  await updateDoc(doc(db, "quotations", id), {
    ...rest,
    updatedAt: serverTimestamp(),
  });
}

// ── Sales Funnel ──

export async function fetchSalesFunnel(userId: string, role: UserRole): Promise<SalesFunnel[]> {
  // Load everything and apply permissions filtering in client side to avoid composite index requirement
  const snap = await getDocs(query(collection(db, "salesFunnel")));
  const allFunnels = snap.docs.map((d) => mapSalesFunnel(d.id, d.data()));

  if (role === "general_manager") {
    return allFunnels.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // sub_manager sees ONLY their own funnel items (same as sales role)
  // Use fetchTeamPerformanceData for drill-down views in Team Page
  const ownIds = [userId];

  return allFunnels
    .filter((f) => {
      // include fallback records created before salesPersonId existed
      return !f.salesPersonId || ownIds.includes(f.salesPersonId);
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function fetchSalesFunnelByQuotationId(quotationId: string): Promise<SalesFunnel | null> {
  const q = query(collection(db, "salesFunnel"), where("quotationId", "==", quotationId));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docData = snap.docs[0];
  return mapSalesFunnel(docData.id, docData.data());
}

export async function createSalesFunnelDoc(data: Omit<SalesFunnel, "id" | "createdAt" | "updatedAt">): Promise<string> {
  const docRef = await addDoc(collection(db, "salesFunnel"), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateSalesFunnelDoc(
  id: string,
  updates: Partial<SalesFunnel>
): Promise<void> {
  const { id: _id, createdAt: _ca, ...rest } = updates as any;
  await updateDoc(doc(db, "salesFunnel", id), {
    ...rest,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteSalesFunnelDoc(id: string): Promise<void> {
  await deleteDoc(doc(db, "salesFunnel", id));
}

export async function deleteQuotationDoc(id: string): Promise<void> {
  await deleteDoc(doc(db, "quotations", id));
}

// ── Customers ──

export async function fetchCustomers(userId: string, role: string): Promise<Customer[]> {
  try {
    if (role === "general_manager" || role === "administrator") {
      const snap = await getDocs(collection(db, "customers"));
      return snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Customer[];
    } else {
      // For both sub_manager (manager) and sales, only show customers they created themselves.
      const q = query(collection(db, "customers"), where("createdBy", "==", userId));
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Customer[];
    }
  } catch (error) {
    console.error("Error fetching customers:", error);
    return [];
  }
}

export async function createCustomer(data: {
  name: string;
  companyName: string;
  email: string;
  phone: string;
  department: string;
  createdBy: string;
  userEmail: string;
}): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, "customers"), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error("Error creating customer:", error);
    throw error;
  }
}

export async function deleteCustomer(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "customers", id));
  } catch (error) {
    console.error("Error deleting customer:", error);
    throw error;
  }
}

// ── Products (Items) ──

export async function fetchProducts(userId: string, role: string): Promise<Product[]> {
  try {
    if (role === "general_manager" || role === "administrator") {
      const snap = await getDocs(collection(db, "items"));
      return snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Product[];
    } else if (role === "sub_manager") {
      const team = await fetchTeamUsers(userId, role);
      const teamIds = [userId, ...team.map((t) => t.id)];
      const snap = await getDocs(collection(db, "items"));
      const allProducts = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Product[];
      return allProducts.filter((p) => teamIds.includes(p.createdBy));
    } else {
      const q = query(collection(db, "items"), where("createdBy", "==", userId));
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Product[];
    }
  } catch (error) {
    console.error("Error fetching products:", error);
    return [];
  }
}

export async function createProduct(data: {
  type: "Goods" | "Service";
  name: string;
  sku: string;
  unit: string;
  description: string;
  salesDescription?: string;
  purchaseDescription?: string;
  modelNumber?: string;
  partNumber?: string;
  value: number;
  costPrice: number;
  quantity: number;
  isSellable: boolean;
  saleAccount: string;
  purchaseAccount: string;
  imageFile?: File;
  createdBy: string;
  userEmail: string;
}): Promise<string> {
  try {
    // Upload image to Cloudinary if provided
    let imageUrl = "";
    if (data.imageFile) {
      // Create folder structure: items/{userEmail}
      const folder = `items/${data.userEmail.replace('@', '_').replace('.', '_')}`;
      imageUrl = await uploadImageToCloudinary(data.imageFile, folder);
    }

    const docRef = await addDoc(collection(db, "items"), {
      type: data.type,
      name: data.name,
      sku: data.sku,
      unit: data.unit,
      description: data.description,
      salesDescription: data.salesDescription || "",
      purchaseDescription: data.purchaseDescription || "",
      modelNumber: data.modelNumber || "",
      partNumber: data.partNumber || "",
      value: data.value,
      costPrice: data.costPrice,
      quantity: data.quantity,
      isSellable: data.isSellable,
      saleAccount: data.saleAccount,
      purchaseAccount: data.purchaseAccount,
      imageUrl: imageUrl,
      createdBy: data.createdBy,
      userEmail: data.userEmail,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error("Error creating product:", error);
    throw error;
  }
}

export async function updateProduct(
  id: string,
  data: {
    type: "Goods" | "Service";
    name: string;
    unit: string;
    description: string;
    salesDescription?: string;
    modelNumber?: string;
    value: number;
    saleAccount: string;
    imageFile?: File | null;
    imageUrl?: string;
    userEmail: string;
  }
): Promise<void> {
  try {
    let finalImageUrl = data.imageUrl || "";

    if (data.imageFile) {
      const folder = `items/${data.userEmail.replace('@', '_').replace('.', '_')}`;
      finalImageUrl = await uploadImageToCloudinary(data.imageFile, folder);
    } else if (data.imageFile === null) {
      finalImageUrl = "";
    }

    await updateDoc(doc(db, "items", id), {
      type: data.type,
      name: data.name,
      unit: data.unit,
      description: data.description,
      salesDescription: data.salesDescription || "",
      modelNumber: data.modelNumber || "",
      value: data.value,
      saleAccount: data.saleAccount,
      imageUrl: finalImageUrl,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error updating product:", error);
    throw error;
  }
}

export async function deleteProduct(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "items", id));
  } catch (error) {
    console.error("Error deleting product:", error);
    throw error;
  }
}

// ── Product Units ──

export interface UnitItem {
  id: string;
  name: string;
}

export async function fetchUnits(): Promise<UnitItem[]> {
  try {
    const snap = await getDocs(collection(db, "units"));
    if (snap.empty) {
      // Seed default units
      const defaults = [
        "pcs", "box", "kg", "pack", "roll", "cm", "m", "g", 
        "ml", "dz", "ft", "in", "lb", "mg", "km", 
        "pack of 50", "pack of 100", "pack of 500"
      ];
      const seeded: UnitItem[] = [];
      for (const name of defaults) {
        const docRef = await addDoc(collection(db, "units"), { name, createdAt: serverTimestamp() });
        seeded.push({ id: docRef.id, name });
      }
      return seeded.sort((a, b) => a.name.localeCompare(b.name));
    }
    return snap.docs.map(d => ({
      id: d.id,
      name: d.data().name || ""
    })).sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error("Error fetching units:", error);
    return [];
  }
}

export async function createUnit(name: string): Promise<UnitItem> {
  try {
    const normalized = name.trim().toLowerCase();
    const snap = await getDocs(collection(db, "units"));
    const existing = snap.docs.find(d => (d.data().name || "").trim().toLowerCase() === normalized);
    if (existing) {
      return {
        id: existing.id,
        name: existing.data().name
      };
    }
    const docRef = await addDoc(collection(db, "units"), {
      name: name.trim(),
      createdAt: serverTimestamp()
    });
    return {
      id: docRef.id,
      name: name.trim()
    };
  } catch (error) {
    console.error("Error creating unit:", error);
    throw error;
  }
}

// ── Storage (Cloudinary) ──

export async function uploadProductImage(file: File, quotationId: string): Promise<string> {
  try {
    // Upload to Cloudinary folder: sales-crm/quotations/{quotationId}
    const folder = `sales-crm/quotations/${quotationId}`;
    const imageUrl = await uploadImageToCloudinary(file, folder);
    console.log("✅ Product image uploaded:", imageUrl);
    return imageUrl;
  } catch (error) {
    console.error("❌ Product image upload failed:", error);
    throw error;
  }
}

// ── Stats ──

export function computeStats(quotations: Quotation[]): DashboardStats {
  return {
    totalQuotations: quotations.length,
    activeDeals: quotations.filter((q) => !["Won", "Closed", "Cancelled", "Lost"].includes(q.status)).length,
    poGenerated: quotations.filter((q) => !!q.poNumber).length,
    invoicesCreated: quotations.filter((q) => q.invoiceValue > 0).length,
    totalSalesValue: quotations.reduce((sum, q) => sum + q.totalValue, 0),
  };
}

export function computeTeamMembers(users: CRMUser[], quotations: Quotation[]): TeamMember[] {
  return users.map((u) => {
    const uq = quotations.filter((q) => q.salesPersonId === u.id);
    return {
      id: u.id,
      name: u.name,
      department: u.department,
      activeDeals: uq.filter((q) => !["Won", "Closed", "Cancelled", "Lost"].includes(q.status)).length,
      poGenerated: uq.filter((q) => !!q.poNumber).length,
      invoiceGenerated: uq.filter((q) => q.invoiceValue > 0).length,
      totalSalesValue: uq.reduce((s, q) => s + q.totalValue, 0),
    };
  });
}

// ── CSV Export ──

export function exportToCSV(data: Quotation[]): string {
  const headers = [
    "Quotation No", "Customer", "Company", "Subject", "Value",
    "Status", "PO Number", "PO Value", "Invoice Value", "Sales Person", "Created",
  ];
  const rows = data.map((q) => [
    q.quotationNumber, q.customerName, q.companyName, q.subject,
    q.totalValue.toString(), q.status, q.poNumber, q.poValue.toString(), q.invoiceValue.toString(),
    q.salesPersonName, q.createdAt ? new Date(q.createdAt).toLocaleDateString() : "",
  ]);
  return [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
}

// ── Team Performance ──

export interface TeamPerformanceRow {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  activeDeals: number;
  totalQuotationValue: number;
  totalPOValue: number;
  totalInvoiceValue: number;
  wonDeals: number;
}

export async function fetchTeamPerformanceData(managerId: string, managerRole: string): Promise<TeamPerformanceRow[]> {
  // Fetch all team members (salespersons) under this manager
  const team = await fetchTeamUsers(managerId, managerRole);
  const salesPersons = team.filter((u) => u.role === "sales");

  // Also include the manager themselves
  const managerSnap = await getDoc(doc(db, "users", managerId));
  const allMembers: CRMUser[] = [];
  if (managerSnap.exists()) {
    const d = managerSnap.data();
    allMembers.push({
      id: managerId,
      name: d.name || "",
      email: d.email || "",
      role: d.role || "sub_manager",
      department: d.department || "",
      managerId: d.managerId || null,
      createdAt: toDate(d.createdAt),
      disabled: !!d.disabled,
    });
  }
  allMembers.push(...salesPersons);

  // Fetch all their sales funnel entries in batches
  const allIds = allMembers.map((m) => m.id);
  const allFunnels: SalesFunnel[] = [];
  for (let i = 0; i < allIds.length; i += 30) {
    const chunk = allIds.slice(i, i + 30);
    const snap = await getDocs(
      query(collection(db, "salesFunnel"), where("salesPersonId", "in", chunk))
    );
    snap.docs.forEach((d) => allFunnels.push(mapSalesFunnel(d.id, d.data())));
  }

  // Build performance row for each member
  return allMembers.map((member) => {
    const memberFunnels = allFunnels.filter((f) => f.salesPersonId === member.id);
    return {
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      department: member.department,
      activeDeals: memberFunnels.filter((f) => !["Won", "Closed", "Cancelled", "Lost"].includes(f.status)).length,
      totalQuotationValue: memberFunnels.reduce((sum, f) => sum + (f.quotationValue || 0), 0),
      totalPOValue: memberFunnels.reduce((sum, f) => sum + (f.poValue || 0), 0),
      totalInvoiceValue: memberFunnels.reduce((sum, f) => sum + (f.invoiceValue || 0), 0),
      wonDeals: memberFunnels.filter((f) => f.status === "Won").length,
    };
  });
}

export function exportTeamPerformanceToCSV(rows: TeamPerformanceRow[]): string {
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const headers = [
    "Name", "Email", "Role", "Department",
    "Active Deals", "Total Quotation Value", "Total PO Value (Sales Done)",
    "Total Invoice Value", "Won Deals",
  ];
  const roleLabel: Record<string, string> = {
    administrator: "Admin",
    general_manager: "General Manager",
    sub_manager: "Manager",
    sales: "Salesperson",
  };
  const dataRows = rows.map((r) => [
    esc(r.name),
    esc(r.email),
    esc(roleLabel[r.role] || r.role),
    esc(r.department),
    esc(r.activeDeals.toString()),
    esc(r.totalQuotationValue.toString()),
    esc(r.totalPOValue.toString()),
    esc(r.totalInvoiceValue.toString()),
    esc(r.wonDeals.toString()),
  ].join(","));
  return [headers.map(esc).join(","), ...dataRows].join("\n");
}

// ── PDF Export ──

export async function exportQuotationToPDF(quotation: Quotation): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const html2canvas = (await import("html2canvas")).default;

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  // Create a temporary container
  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.left = "-10000px";
  container.style.top = "-10000px";
  container.style.width = "920px";
  container.style.backgroundColor = "white";
  container.style.padding = "40px";
  container.style.fontFamily = "Inter, Arial, sans-serif";

  // Build HTML content
  container.innerHTML = `
    <div style="margin-bottom: 28px; background: linear-gradient(135deg, #2563eb, #7c3aed); color: #fff; border-radius: 14px; padding: 20px 24px;">
      <h1 style="font-size: 30px; margin: 0 0 8px 0; font-weight: 700; letter-spacing: 0.4px;">QUOTATION</h1>
      <p style="font-size: 14px; margin: 0; opacity: 0.95;">#${escapeHtml(quotation.quotationNumber)}</p>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 26px;">
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius: 10px; padding: 14px;">
        <h3 style="font-size: 11px; color: #64748b; text-transform: uppercase; margin: 0 0 8px 0; letter-spacing: .4px;">From</h3>
        <p style="font-size: 15px; font-weight: 700; margin: 0; color:#0f172a;">SalesERP</p>
      </div>
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius: 10px; padding: 14px;">
        <h3 style="font-size: 11px; color: #64748b; text-transform: uppercase; margin: 0 0 8px 0; letter-spacing: .4px;">Bill To</h3>
        <p style="font-size: 15px; font-weight: 700; margin: 0; color:#0f172a;">${escapeHtml(quotation.customerName)}</p>
        <p style="font-size: 13px; margin: 5px 0 0 0; color: #334155;">${escapeHtml(quotation.companyName)}</p>
        ${quotation.customerEmail ? `<p style="font-size: 12px; margin: 3px 0 0 0; color: #475569;">${escapeHtml(quotation.customerEmail)}</p>` : ""}
        ${quotation.customerPhone ? `<p style="font-size: 12px; margin: 3px 0 0 0; color: #475569;">${escapeHtml(quotation.customerPhone)}</p>` : ""}
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; font-size: 13px;">
      <div style="padding: 10px 12px; border-left: 4px solid #2563eb; background: #eff6ff; border-radius: 8px;">
        <p style="margin: 0; color: #1e3a8a;"><strong>Sales Person:</strong> ${escapeHtml(quotation.salesPersonName)}</p>
      </div>
      <div style="padding: 10px 12px; border-left: 4px solid #7c3aed; background: #f5f3ff; border-radius: 8px;">
        <p style="margin: 0; color: #5b21b6;"><strong>Date:</strong> ${new Date(quotation.createdAt).toLocaleDateString()}</p>
      </div>
    </div>

    <div style="margin-bottom: 22px; background:#f8fafc; border:1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px;">
      <h3 style="font-size: 13px; margin: 0 0 4px 0; color: #334155;">Subject</h3>
      <p style="font-size: 13px; margin: 0; color: #0f172a;">${escapeHtml(quotation.subject)}</p>
    </div>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 13px;">
      <thead>
        <tr style="background: linear-gradient(90deg, #e0e7ff, #ede9fe); border-bottom: 2px solid #c7d2fe;">
          <th style="text-align: center; padding: 10px; border: 1px solid #cbd5e1; width: 88px;">Image</th>
          <th style="text-align: left; padding: 12px; border: 1px solid #ddd;">Product</th>
          <th style="text-align: left; padding: 12px; border: 1px solid #ddd;">Model</th>
          <th style="text-align: left; padding: 12px; border: 1px solid #ddd;">Part Number</th>
          <th style="text-align: right; padding: 12px; border: 1px solid #ddd;">Value</th>
        </tr>
      </thead>
      <tbody>
        ${quotation.products.map((p, index) => `
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 8px; border: 1px solid #e2e8f0; text-align:center; background:${index % 2 === 0 ? "#ffffff" : "#f8fafc"};">
              ${p.imageUrl
                ? `<img crossorigin="anonymous" src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(p.name)}" style="width:70px;height:70px;object-fit:cover;border-radius:8px;border:1px solid #cbd5e1;display:block;margin:0 auto;"/>`
                : `<div style="width:70px;height:70px;border-radius:8px;border:1px dashed #cbd5e1;background:#f1f5f9;color:#94a3b8;font-size:11px;display:flex;align-items:center;justify-content:center;margin:0 auto;">No image</div>`}
            </td>
            <td style="padding: 12px; border: 1px solid #ddd;">
              <strong>${escapeHtml(p.name)}</strong>
              ${p.description ? `<br/><span style="color: #64748b; font-size: 11px;">${escapeHtml(p.description)}</span>` : ""}
            </td>
            <td style="padding: 12px; border: 1px solid #ddd;">${p.modelNumber ? escapeHtml(p.modelNumber) : "—"}</td>
            <td style="padding: 12px; border: 1px solid #ddd;">${p.partNumber ? escapeHtml(p.partNumber) : "—"}</td>
            <td style="text-align: right; padding: 12px; border: 1px solid #ddd;">$${p.value.toLocaleString()}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>

    <div style="text-align: right; padding: 15px; background: linear-gradient(90deg, #eff6ff, #f5f3ff); border:1px solid #c7d2fe; border-radius: 10px;">
      <p style="margin: 0; font-size: 14px; color: #334155;">
        <strong>Total Value: </strong>
        <span style="font-size: 20px; color: #1d4ed8; font-weight: bold;">$${quotation.totalValue.toLocaleString()}</span>
      </p>
    </div>

    <div style="margin-top: 34px; padding-top: 18px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #64748b;">
      <p style="margin: 0;">This quotation is valid for 30 days from the date of issue.</p>
      <p style="margin: 5px 0 0 0;">Thank you for your business!</p>
    </div>
  `;

  document.body.appendChild(container);

  try {
    const images = Array.from(container.querySelectorAll("img"));
    await Promise.all(
      images.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete) {
              resolve();
              return;
            }
            img.onload = () => resolve();
            img.onerror = () => resolve();
          })
      )
    );

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: "#ffffff",
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const margin = 10;
    const pageWidth = 210;
    const pageHeight = 297;
    const contentWidth = pageWidth - margin * 2;
    const renderedHeight = (canvas.height * contentWidth) / canvas.width;
    const printableHeight = pageHeight - margin * 2;
    const totalPages = Math.max(1, Math.ceil(renderedHeight / printableHeight));

    for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
      if (pageIndex > 0) {
        pdf.addPage();
      }

      const yOffset = margin - pageIndex * printableHeight;
      pdf.addImage(imgData, "PNG", margin, yOffset, contentWidth, renderedHeight);

      pdf.setFontSize(10);
      pdf.setTextColor(140);
      pdf.text(`Page ${pageIndex + 1} of ${totalPages}`, pageWidth / 2, pageHeight - 6, {
        align: "center",
      });
    }

    pdf.save(`${quotation.quotationNumber}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}

// ── User Profile ──

export async function updateUserProfile(
  userId: string,
  updates: Partial<CRMUser>
): Promise<void> {
  const { id: _id, createdAt: _ca, ...rest } = updates as any;
  await updateDoc(doc(db, "users", userId), {
    ...rest,
    updatedAt: serverTimestamp(),
  });
}

export async function uploadProfilePicture(userId: string, base64Data: string): Promise<string> {
  // Store profile picture as a data URL in Firestore
  // In production, you might want to use Cloud Storage instead
  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, {
    profilePicture: base64Data,
    updatedAt: serverTimestamp(),
  });
  return base64Data;
}

// ── Notifications & Approvals ──

export async function fetchNotificationsForManager(managerId: string): Promise<AppNotification[]> {
  const q = query(
    collection(db, "notifications"),
    where("managerId", "==", managerId),
    orderBy("createdAt", "desc")
  );
  try {
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        type: data.type || "quotation_approval",
        title: data.title || "",
        message: data.message || "",
        quotationId: data.quotationId || "",
        salespersonId: data.salespersonId || "",
        salespersonName: data.salespersonName || "",
        managerId: data.managerId || "",
        status: data.status || "pending",
        createdAt: toDate(data.createdAt),
      } as AppNotification;
    });
  } catch (error) {
    console.warn("Falling back to client-side sorting for notifications:", error);
    const fallbackQ = query(
      collection(db, "notifications"),
      where("managerId", "==", managerId)
    );
    const snap = await getDocs(fallbackQ);
    const results = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        type: data.type || "quotation_approval",
        title: data.title || "",
        message: data.message || "",
        quotationId: data.quotationId || "",
        salespersonId: data.salespersonId || "",
        salespersonName: data.salespersonName || "",
        managerId: data.managerId || "",
        status: data.status || "pending",
        createdAt: toDate(data.createdAt),
      } as AppNotification;
    });
    return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}

export async function approveQuotationDoc(notificationId: string, quotationId: string): Promise<void> {
  // Update notification status
  await updateDoc(doc(db, "notifications", notificationId), {
    status: "approved",
    read: true,
    updatedAt: serverTimestamp(),
  });

  // Fetch the quotation to get details
  const quotation = await fetchQuotationById(quotationId);
  if (!quotation) {
    throw new Error("Quotation not found");
  }

  // Update quotation status to Sent
  await updateDoc(doc(db, "quotations", quotationId), {
    status: "Sent",
    updatedAt: serverTimestamp(),
  });

  // Add to sales funnel if not already there
  const existingFunnel = await fetchSalesFunnelByQuotationId(quotationId);
  if (!existingFunnel) {
    await createSalesFunnelDoc({
      quotationId: quotation.id,
      quotationNumber: quotation.quotationNumber,
      companyName: quotation.companyName,
      subject: quotation.subject,
      quotationValue: quotation.totalValue,
      followUpDate: quotation.followUpDate,
      status: "Cold",
      poValue: quotation.poValue || 0,
      deliveryStatus: quotation.deliveryStatus || "Pending",
      invoiceValue: quotation.invoiceValue || 0,
      salesPersonId: quotation.salesPersonId,
    });
  }

  // Send approved notification back to the salesperson
  await addDoc(collection(db, "notifications"), {
    type: "quotation_approval",
    title: "Quotation Approved",
    message: `Your quotation ${quotation.quotationNumber} for ${quotation.companyName} ($${quotation.totalValue.toLocaleString()}) has been approved.`,
    quotationId: quotationId,
    salespersonId: quotation.salesPersonId,
    salespersonName: quotation.salesPersonName,
    managerId: quotation.managerId,
    status: "approved",
    read: false,
    recipientId: quotation.salesPersonId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function rejectQuotationDoc(notificationId: string, quotationId: string): Promise<void> {
  // Update notification status
  await updateDoc(doc(db, "notifications", notificationId), {
    status: "rejected",
    read: true,
    updatedAt: serverTimestamp(),
  });

  // Fetch the quotation to get details
  const quotation = await fetchQuotationById(quotationId);
  if (!quotation) {
    throw new Error("Quotation not found");
  }

  // Update quotation status to Draft
  await updateDoc(doc(db, "quotations", quotationId), {
    status: "Draft",
    updatedAt: serverTimestamp(),
  });

  // Send rejected notification back to the salesperson
  await addDoc(collection(db, "notifications"), {
    type: "quotation_approval",
    title: "Quotation Rejected",
    message: `Your quotation ${quotation.quotationNumber} for ${quotation.companyName} ($${quotation.totalValue.toLocaleString()}) has been rejected.`,
    quotationId: quotationId,
    salespersonId: quotation.salesPersonId,
    salespersonName: quotation.salesPersonName,
    managerId: quotation.managerId,
    status: "rejected",
    read: false,
    recipientId: quotation.salesPersonId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function subscribeNotifications(
  userId: string,
  role: string,
  onUpdate: (notifications: AppNotification[]) => void
): () => void {
  const isManager = role === "sub_manager" || role === "general_manager";
  const filterField = isManager ? "managerId" : "salespersonId";

  const q = query(
    collection(db, "notifications"),
    where(filterField, "==", userId)
  );

  return onSnapshot(
    q,
    (snap) => {
      const notifs = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          type: data.type || "quotation_approval",
          title: data.title || "",
          message: data.message || "",
          quotationId: data.quotationId || "",
          salespersonId: data.salespersonId || "",
          salespersonName: data.salespersonName || "",
          managerId: data.managerId || "",
          status: data.status || "pending",
          read: data.read ?? false,
          recipientId: data.recipientId || "",
          createdAt: toDate(data.createdAt),
        } as AppNotification;
      });

      // Filter based on recipientId if it exists to make sure we don't show salesperson notifications to manager and vice versa
      const filtered = notifs.filter((n) => {
        if (n.recipientId) {
          return n.recipientId === userId;
        }
        // Fallback for legacy notifications:
        if (isManager) {
          return n.status === "pending";
        } else {
          return n.status === "approved" || n.status === "rejected";
        }
      });

      // Sort client side by createdAt desc
      filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      onUpdate(filtered);
    },
    (error) => {
      console.error("Error subscribing to notifications:", error);
    }
  );
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
  await updateDoc(doc(db, "notifications", notificationId), {
    read: true,
    updatedAt: serverTimestamp(),
  });
}

export async function markAllNotificationsAsRead(userId: string, role: string): Promise<void> {
  const isManager = role === "sub_manager" || role === "general_manager";
  const filterField = isManager ? "managerId" : "salespersonId";
  const q = query(
    collection(db, "notifications"),
    where(filterField, "==", userId),
    where("read", "==", false)
  );
  try {
    const snap = await getDocs(q);
    const promises = snap.docs
      .filter((d) => {
        const data = d.data();
        if (data.recipientId) {
          return data.recipientId === userId;
        }
        if (isManager) {
          return data.status === "pending";
        } else {
          return data.status === "approved" || data.status === "rejected";
        }
      })
      .map((d) =>
        updateDoc(doc(db, "notifications", d.id), {
          read: true,
          updatedAt: serverTimestamp(),
        })
      );
    await Promise.all(promises);
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
  }
}

export async function updateCustomerStatus(id: string, disabled: boolean): Promise<void> {
  await updateDoc(doc(db, "customers", id), {
    disabled,
    updatedAt: serverTimestamp(),
  });
}

export async function updateProductStatus(id: string, disabled: boolean): Promise<void> {
  await updateDoc(doc(db, "items", id), {
    disabled,
    updatedAt: serverTimestamp(),
  });
}

export async function updateQuotationStatus(id: string, disabled: boolean): Promise<void> {
  await updateDoc(doc(db, "quotations", id), {
    disabled,
    updatedAt: serverTimestamp(),
  });
}

export async function updateSalesFunnelStatus(id: string, disabled: boolean): Promise<void> {
  await updateDoc(doc(db, "salesFunnel", id), {
    disabled,
    updatedAt: serverTimestamp(),
  });
}

export async function updateUserStatus(userId: string, disabled: boolean): Promise<void> {
  await updateDoc(doc(db, "users", userId), {
    disabled,
    updatedAt: serverTimestamp(),
  });
}
