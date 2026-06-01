import { beforeEach, describe, expect, it, vi } from "vitest";
import * as firestoreService from "@/lib/firestore-service";

const mockGetDocs = vi.fn();
const mockGetDoc = vi.fn();
const mockOnSnapshot = vi.fn();
const mockAddDoc = vi.fn();
const mockUpdateDoc = vi.fn();

vi.mock("firebase/firestore", async () => {
  const actual = await vi.importActual<typeof import("firebase/firestore")>("firebase/firestore");

  return {
    ...actual,
    collection: vi.fn(() => ({ collection: true })),
    doc: vi.fn((...args: unknown[]) => ({ doc: args })),
    getDoc: (...args: unknown[]) => mockGetDoc(...args),
    getDocs: (...args: unknown[]) => mockGetDocs(...args),
    addDoc: (...args: unknown[]) => mockAddDoc(...args),
    updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
    deleteDoc: vi.fn(),
    query: vi.fn((...args: unknown[]) => ({ query: args })),
    where: vi.fn((...args: unknown[]) => ({ where: args })),
    orderBy: vi.fn((...args: unknown[]) => ({ orderBy: args })),
    serverTimestamp: vi.fn(),
    Timestamp: class Timestamp {},
    onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  };
});

vi.mock("@/lib/firebase", () => ({
  db: {},
}));

const makeDoc = (id: string, salesPersonId: string, createdAt: string) => ({
  id,
  data: () => ({
    quotationId: `quote-${id}`,
    quotationNumber: `Q-${id}`,
    companyName: `Company ${id}`,
    subject: `Subject ${id}`,
    quotationValue: 1000,
    followUpDate: null,
    closingMonth: null,
    closingYear: null,
    status: "Cold",
    poValue: 0,
    deliveryStatus: "Pending",
    invoiceValue: 0,
    salesPersonId,
    createdAt,
    updatedAt: createdAt,
  }),
});

const makeCustomerDoc = (id: string, createdBy: string) => ({
  id,
  data: () => ({
    name: `Customer ${id}`,
    companyName: `Company ${id}`,
    email: `customer${id}@example.com`,
    phone: "1234567890",
    department: "Hardware",
    createdBy,
    userEmail: `creator${createdBy}@example.com`,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  }),
});

const makeProductDoc = (id: string, department: string, createdBy: string) => ({
  id,
  data: () => ({
    type: "Goods",
    name: `Item ${id}`,
    sku: `SKU-${id}`,
    unit: "pcs",
    description: "",
    salesDescription: "",
    purchaseDescription: "",
    modelNumber: "",
    partNumber: "",
    value: 100,
    costPrice: 50,
    quantity: 1,
    isSellable: true,
    saleAccount: "Sales",
    purchaseAccount: "Purchase",
    imageUrl: "",
    createdBy,
    userEmail: `creator${createdBy}@example.com`,
    department,
    disabled: false,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  }),
});

describe("firestore shared visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAddDoc.mockResolvedValue({ id: "notification-1" });
    mockUpdateDoc.mockResolvedValue(undefined);
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      id: "quote-123",
      data: () => ({
        quotationNumber: "Q-123",
        companyName: "Acme Corp",
        subject: "Office Chairs",
        customerName: "Jane Customer",
        customerEmail: "jane@example.com",
        customerPhone: "1234567890",
        customerAddress: "Main Street",
        salesPersonId: "sales-1",
        salesPersonName: "Jane Sales",
        managerId: "manager-1",
        totalValue: 1500,
        status: "Sent",
        products: [],
        createdAt: "2026-05-01T00:00:00.000Z",
        updatedAt: "2026-05-01T00:00:00.000Z",
        followUpDate: null,
        poValue: 0,
        invoiceValue: 0,
        deliveryStatus: "Pending",
      }),
    });
  });

  it("returns all funnel records for sales users, even when created by another salesperson", async () => {
    mockGetDocs.mockResolvedValue({
      docs: [makeDoc("1", "sales-1", "2026-05-01T08:00:00.000Z"), makeDoc("2", "sales-2", "2026-05-02T08:00:00.000Z")],
    });

    const funnels = await firestoreService.fetchSalesFunnel("sales-1", "sales");

    expect(funnels).toHaveLength(2);
    expect(funnels.map((funnel) => funnel.id)).toEqual(["2", "1"]);
    expect(funnels.some((funnel) => funnel.salesPersonId === "sales-2")).toBe(true);
  });

  it("subscribes all funnel records for sales users, even when created by another salesperson", async () => {
    const callback = vi.fn();

    mockOnSnapshot.mockImplementation((_query: unknown, snapshotCallback: (snap: { docs: ReturnType<typeof makeDoc>[] }) => void) => {
      snapshotCallback({
        docs: [makeDoc("1", "sales-1", "2026-05-01T08:00:00.000Z"), makeDoc("2", "sales-2", "2026-05-02T08:00:00.000Z")],
      });
      return () => undefined;
    });

    firestoreService.subscribeToSalesFunnel("sales-1", "sales", callback);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0]).toHaveLength(2);
    expect(callback.mock.calls[0][0].map((funnel: { id: string }) => funnel.id)).toEqual(["2", "1"]);
  });

  it("returns all customers for sales users so every department can see shared customers", async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        makeCustomerDoc("1", "hardware-user"),
        makeCustomerDoc("2", "software-user"),
      ],
    });

    const customers = await firestoreService.fetchCustomers("sales-1", "sales");

    expect(customers).toHaveLength(2);
    expect(customers.map((customer) => customer.id)).toEqual(["1", "2"]);
    expect(customers.some((customer) => customer.createdBy === "hardware-user")).toBe(true);
  });

  it("returns all products for sales users so every department can see shared items", async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        makeProductDoc("1", "Hardware", "hardware-user"),
        makeProductDoc("2", "Finance", "finance-user"),
      ],
    });

    const products = await firestoreService.fetchProducts("sales-1", "sales", "Software");

    expect(products).toHaveLength(2);
    expect(products.map((product) => product.id)).toEqual(["1", "2"]);
    expect(products.some((product) => product.department === "Hardware")).toBe(true);
  });

  it("subscribes all customers for sales users so every department can see shared customers", async () => {
    const callback = vi.fn();

    mockOnSnapshot.mockImplementation((_query: unknown, snapshotCallback: (snap: { docs: ReturnType<typeof makeCustomerDoc>[] }) => void) => {
      snapshotCallback({
        docs: [makeCustomerDoc("1", "hardware-user"), makeCustomerDoc("2", "software-user")],
      });
      return () => undefined;
    });

    firestoreService.subscribeToCustomers("sales-1", "sales", callback);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0]).toHaveLength(2);
    expect(callback.mock.calls[0][0].map((customer: { id: string }) => customer.id)).toEqual(["1", "2"]);
  });

  it("subscribes all products for sales users so every department can see shared items", async () => {
    const callback = vi.fn();

    mockOnSnapshot.mockImplementation((_query: unknown, snapshotCallback: (snap: { docs: ReturnType<typeof makeProductDoc>[] }) => void) => {
      snapshotCallback({
        docs: [makeProductDoc("1", "Hardware", "hardware-user"), makeProductDoc("2", "Finance", "finance-user")],
      });
      return () => undefined;
    });

    firestoreService.subscribeToProducts("sales-1", "sales", "Software", callback);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0]).toHaveLength(2);
    expect(callback.mock.calls[0][0].map((product: { id: string }) => product.id)).toEqual(["1", "2"]);
  });

  it("includes rejection remarks in the salesperson notification", async () => {
    await firestoreService.rejectQuotationDoc("notification-1", "quote-123", "Pricing needs revision");

    expect(mockUpdateDoc).toHaveBeenCalledTimes(2);
    expect(mockAddDoc).toHaveBeenCalledTimes(1);
    expect(mockAddDoc.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        message: expect.stringContaining("Pricing needs revision"),
      })
    );
  });
});
