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
import { db } from "@/lib/firebase";
import { uploadImageToCloudinary } from "@/lib/cloudinary";
import { CRMUser, Quotation, QuotationStatus, DashboardStats, TeamMember, Product, Customer, UserRole, SalesFunnel, SalesFunnelStatus } from "@/types/crm";

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
    } as CRMUser;
  });
}

export async function fetchTeamUsers(managerId: string, role: string): Promise<CRMUser[]> {
  const allUsers = await fetchAllUsers();
  if (role === "general_manager") return allUsers.filter((u) => u.id !== managerId);
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
      try {
        const snap = await getDocs(
          query(collection(db, "quotations"), where("salesPersonId", "in", chunk), orderBy("createdAt", "desc"))
        );
        snap.docs.forEach((d) => results.push(mapQuotation(d.id, d.data())));
      } catch (error) {
        if (!isMissingIndexError(error)) {
          throw error;
        }

        const snap = await getDocs(
          query(collection(db, "quotations"), where("salesPersonId", "in", chunk))
        );
        snap.docs.forEach((d) => results.push(mapQuotation(d.id, d.data())));
      }
    }
    return sortByCreatedAtDesc(results);
  } else {
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

  const teamIds = role === "sub_manager" ? [userId, ...((await fetchTeamUsers(userId, role)).map((t) => t.id))] : [userId];

  return allFunnels
    .filter((f) => {
      // include fallback records created before salesPersonId existed
      return !f.salesPersonId || teamIds.includes(f.salesPersonId);
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
    const q = query(collection(db, "customers"), where("createdBy", "==", userId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Customer[];
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
    const q = query(collection(db, "items"), where("createdBy", "==", userId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Product[];
  } catch (error) {
    console.error("Error fetching products:", error);
    return [];
  }
}

export async function createProduct(data: {
  type: "Goods" | "Service";
  name: string;
  sku: string;
  unit:
    | "box"
    | "cm"
    | "dz"
    | "ft"
    | "g"
    | "in"
    | "kg"
    | "km"
    | "lb"
    | "mg"
    | "ml"
    | "m"
    | "pcs"
    | "roll"
    | "pack"
    | "pack of 50"
    | "pack of 100"
    | "pack of 500";
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

export async function deleteProduct(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "items", id));
  } catch (error) {
    console.error("Error deleting product:", error);
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

// ── PDF Export ──

export async function exportQuotationToPDF(quotation: Quotation): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const html2canvas = (await import("html2canvas")).default;

  const escapeHtml = (value: string) =>
    value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

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
        <p style="font-size: 15px; font-weight: 700; margin: 0; color:#0f172a;">SalesCRM</p>
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
