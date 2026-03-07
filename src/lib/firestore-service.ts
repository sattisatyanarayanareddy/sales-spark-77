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
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { CRMUser, Quotation, QuotationStage, DashboardStats, TeamMember, Product } from "@/types/crm";

// ── Helpers ──

const toDate = (val: any): string => {
  if (!val) return "";
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof val === "string") return val;
  return new Date(val).toISOString();
};

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
  stage: data.stage || "quotation_created",
  poNumber: data.poNumber || "",
  invoiceValue: data.invoiceValue || 0,
  followUpDate: data.followUpDate || null,
  followUpNotes: data.followUpNotes || "",
  deliveryStatus: data.deliveryStatus || "",
  createdAt: toDate(data.createdAt),
  updatedAt: toDate(data.updatedAt),
});

// ── Users ──

export async function fetchUserDoc(uid: string): Promise<CRMUser | null> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    id: uid,
    name: d.name || "",
    email: d.email || "",
    role: d.role || "sales",
    department: d.department || "",
    managerId: d.managerId || null,
    createdAt: toDate(d.createdAt),
  };
}

export async function fetchAllUsers(): Promise<CRMUser[]> {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    createdAt: toDate(d.data().createdAt),
  })) as CRMUser[];
}

export async function fetchTeamUsers(managerId: string, role: string): Promise<CRMUser[]> {
  const allUsers = await fetchAllUsers();
  if (role === "general_manager") return allUsers.filter((u) => u.id !== managerId);
  return allUsers.filter((u) => u.managerId === managerId);
}

// ── Quotations ──

export async function fetchQuotations(userId: string, role: string): Promise<Quotation[]> {
  let q;
  if (role === "general_manager") {
    q = query(collection(db, "quotations"), orderBy("createdAt", "desc"));
  } else if (role === "sub_manager") {
    // Get team member IDs first
    const team = await fetchTeamUsers(userId, role);
    const teamIds = [userId, ...team.map((t) => t.id)];
    // Firestore 'in' supports max 30 values
    const chunks = [];
    for (let i = 0; i < teamIds.length; i += 30) {
      chunks.push(teamIds.slice(i, i + 30));
    }
    const results: Quotation[] = [];
    for (const chunk of chunks) {
      const snap = await getDocs(
        query(collection(db, "quotations"), where("salesPersonId", "in", chunk), orderBy("createdAt", "desc"))
      );
      snap.docs.forEach((d) => results.push(mapQuotation(d.id, d.data())));
    }
    return results;
  } else {
    q = query(
      collection(db, "quotations"),
      where("salesPersonId", "==", userId),
      orderBy("createdAt", "desc")
    );
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

export async function deleteQuotationDoc(id: string): Promise<void> {
  await deleteDoc(doc(db, "quotations", id));
}

// ── Storage ──

export async function uploadProductImage(file: File, quotationId: string): Promise<string> {
  const fileRef = ref(storage, `product-images/${quotationId}/${Date.now()}_${file.name}`);
  await uploadBytes(fileRef, file);
  return getDownloadURL(fileRef);
}

// ── Stats ──

export function computeStats(quotations: Quotation[]): DashboardStats {
  return {
    totalQuotations: quotations.length,
    activeDeals: quotations.filter((q) => !["closed_won", "closed_lost"].includes(q.stage)).length,
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
      activeDeals: uq.filter((q) => !["closed_won", "closed_lost"].includes(q.stage)).length,
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
    "Stage", "PO Number", "Invoice Value", "Sales Person", "Created",
  ];
  const rows = data.map((q) => [
    q.quotationNumber, q.customerName, q.companyName, q.subject,
    q.totalValue.toString(), q.stage, q.poNumber, q.invoiceValue.toString(),
    q.salesPersonName, q.createdAt ? new Date(q.createdAt).toLocaleDateString() : "",
  ]);
  return [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
}
