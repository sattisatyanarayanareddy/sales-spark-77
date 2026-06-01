import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DashboardPage from "@/pages/DashboardPage";
import * as firestoreService from "@/lib/firestore-service";

const mockSubscribeToAllUsers = vi.fn();
const mockSubscribeToSalesFunnel = vi.fn();
const mockSubscribeToNotifications = vi.fn();
const mockRejectQuotationDoc = vi.fn();

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    crmUser: {
      id: "manager-1",
      name: "Alex Manager",
      email: "alex@example.com",
      role: "sub_manager",
      department: "Sales",
      managerId: null,
      createdAt: "2024-01-01",
    },
  }),
}));

vi.mock("@/lib/firestore-service", () => ({
  subscribeToAllUsers: (...args: unknown[]) => mockSubscribeToAllUsers(...args),
  subscribeToSalesFunnel: (...args: unknown[]) => mockSubscribeToSalesFunnel(...args),
  subscribeToNotifications: (...args: unknown[]) => mockSubscribeToNotifications(...args),
  approveQuotationDoc: vi.fn(),
  rejectQuotationDoc: (...args: unknown[]) => mockRejectQuotationDoc(...args),
}));

describe("DashboardPage manager rejection flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockSubscribeToAllUsers.mockImplementation((callback: (users: unknown[]) => void) => {
      callback([]);
      return () => undefined;
    });

    mockSubscribeToSalesFunnel.mockImplementation((_: string, __: string, callback: (funnels: unknown[]) => void) => {
      callback([]);
      return () => undefined;
    });

    mockSubscribeToNotifications.mockImplementation((_: string, callback: (notifications: unknown[]) => void) => {
      callback([
        {
          id: "notif-1",
          type: "quotation_approval",
          title: "Quotation Pending Approval",
          message: "Salesperson requested approval for QT-1001",
          quotationId: "quote-1",
          salespersonId: "sales-1",
          salespersonName: "Nina Sales",
          managerId: "manager-1",
          status: "pending",
          read: false,
          recipientId: "manager-1",
          createdAt: "2024-01-02T00:00:00.000Z",
        },
      ]);
      return () => undefined;
    });

    mockRejectQuotationDoc.mockResolvedValue(undefined);
  });

  it("shows a rejection remarks field and passes the remarks when rejecting", async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Quotations Pending Your Approval")).toBeInTheDocument();
    });

    const remarksField = screen.getByPlaceholderText("Enter rejection remarks for the salesperson");
    expect(remarksField).toBeInTheDocument();

    fireEvent.change(remarksField, { target: { value: "Pricing needs revision" } });

    fireEvent.click(screen.getByRole("button", { name: /reject/i }));

    await waitFor(() => {
      expect(mockRejectQuotationDoc).toHaveBeenCalledWith("notif-1", "quote-1", "Pricing needs revision");
    });
  });
});
