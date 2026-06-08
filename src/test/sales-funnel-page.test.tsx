import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SalesFunnelPage from "@/pages/SalesFunnelPage";

const mockSubscribeToSalesFunnel = vi.fn();
const mockSubscribeToAllUsers = vi.fn();
const mockUpdateSalesFunnelDoc = vi.fn();
const mockFetchQuotationById = vi.fn();

import { CRMUser, UserRole } from "@/types/crm";

const mockCrmUser = {
  id: "sales-1",
  name: "Salesperson",
  email: "sales@example.com",
  role: "sales" as UserRole,
  department: "sales",
  managerId: null,
  createdAt: "2024-01-01",
};

const funnel = {
  id: "funnel-1",
  quotationId: "quote-1",
  quotationNumber: "Q-100",
  companyName: "Acme Corp",
  subject: "Office chairs",
  quotationValue: 1000,
  followUpDate: "2026-01-20",
  closingMonth: "March",
  closingYear: "2026",
  status: "Hot" as const,
  poValue: 0,
  deliveryStatus: "Pending" as const,
  invoiceValue: 0,
  salesPersonId: "sales-1",
  createdAt: "2024-01-01",
  updatedAt: "2024-01-02",
};

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    crmUser: mockCrmUser,
  }),
}));

vi.mock("@/lib/firestore-service", () => ({
  updateSalesFunnelDoc: (...args: unknown[]) => mockUpdateSalesFunnelDoc(...args),
  updateSalesFunnelStatus: vi.fn(),
  subscribeToSalesFunnel: (...args: unknown[]) => mockSubscribeToSalesFunnel(...args),
  subscribeToAllUsers: (...args: unknown[]) => mockSubscribeToAllUsers(...args),
  fetchQuotationById: (...args: unknown[]) => mockFetchQuotationById(...args),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("SalesFunnelPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscribeToSalesFunnel.mockImplementation((_userId: string, _role: string, callback: (funnels: typeof funnel[]) => void) => {
      callback([funnel]);
      return () => undefined;
    });
    mockSubscribeToAllUsers.mockImplementation((callback: (users: unknown[]) => void) => {
      callback([]);
      return () => undefined;
    });
    mockFetchQuotationById.mockResolvedValue({
      customerName: "Jane Customer",
      products: [{ name: "Office Chair", quantity: 2 }, { name: "Desk Lamp", quantity: 1 }],
    });
    mockUpdateSalesFunnelDoc.mockResolvedValue(undefined);
  });

  it("renders closing month and closing year in the table and edit dialog", async () => {
    render(<SalesFunnelPage />);

    await waitFor(() => {
      expect(screen.getByText("Q-100")).toBeInTheDocument();
    });

    expect(screen.getByText("Closing Month/Year")).toBeInTheDocument();
    expect(screen.getByText("March / 2026")).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Edit"));

    expect(await screen.findByText("Closing Month *")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("2026")).toBeInTheDocument();
  });

  it("saves closing month and year when editing a Hot deal", async () => {
    render(<SalesFunnelPage />);

    await waitFor(() => {
      expect(screen.getByText("Q-100")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle("Edit"));

    const monthTrigger = screen.getAllByRole("combobox").find((button) => button.textContent?.includes("March"));
    expect(monthTrigger).toBeTruthy();
    fireEvent.click(monthTrigger as HTMLElement);
    fireEvent.click(await screen.findByText("April"));

    const yearInput = screen.getByPlaceholderText("2026");
    fireEvent.change(yearInput, { target: { value: "2027" } });

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(mockUpdateSalesFunnelDoc).toHaveBeenCalledWith(
        "funnel-1",
        expect.objectContaining({
          closingMonth: "April",
          closingYear: "2027",
        }),
      );
    });
  });

  it("shows customer details without showing the items column", async () => {
    render(<SalesFunnelPage />);

    await waitFor(() => {
      expect(screen.getByText("Q-100")).toBeInTheDocument();
    });

    expect(screen.getByText("Customer")).toBeInTheDocument();
    expect(screen.queryByText("Items")).not.toBeInTheDocument();
    expect(screen.getByText("Jane Customer")).toBeInTheDocument();
    expect(screen.queryByText("Office Chair × 2, Desk Lamp × 1")).not.toBeInTheDocument();
  });

  it("shows only the manager's own sales funnel entries and hides team summary cards", async () => {
    mockCrmUser.id = "mgr-1";
    mockCrmUser.role = "sub_manager";

    mockSubscribeToSalesFunnel.mockImplementation((_userId: string, _role: string, callback: (funnels: typeof funnel[]) => void) => {
      callback([
        { ...funnel, id: "funnel-1", salesPersonId: "mgr-1", quotationNumber: "Q-100", companyName: "Manager Owned Company" },
        { ...funnel, id: "funnel-2", salesPersonId: "sales-2", quotationNumber: "Q-200", companyName: "Other Company" },
      ]);
      return () => undefined;
    });

    mockSubscribeToAllUsers.mockImplementation((callback: (users: unknown[]) => void) => {
      callback([
        { id: "sales-1", name: "Owned Sales", email: "owned@example.com", role: "sales", department: "sales", managerId: "mgr-1", createdAt: "2024-01-01" },
        { id: "sales-2", name: "Other Sales", email: "other@example.com", role: "sales", department: "sales", managerId: "mgr-2", createdAt: "2024-01-01" },
      ]);
      return () => undefined;
    });

    render(<SalesFunnelPage />);

    await waitFor(() => {
      expect(screen.getByText("Q-100")).toBeInTheDocument();
    });

    expect(screen.getByText("Manager Owned Company")).toBeInTheDocument();
    expect(screen.queryByText("Other Company")).not.toBeInTheDocument();
    expect(screen.queryByText("Team Quotation Value")).not.toBeInTheDocument();
    expect(screen.queryByText("Team PO Value")).not.toBeInTheDocument();
    expect(screen.queryByText("Team Invoice Value")).not.toBeInTheDocument();
    expect(screen.queryByText("Team Won Deals")).not.toBeInTheDocument();
  });
});
