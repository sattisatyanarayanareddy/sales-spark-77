import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TeamPage from "@/pages/TeamPage";
import * as firestoreService from "@/lib/firestore-service";

const mockSubscribeToAllUsers = vi.fn();

const managers = [
  {
    id: "mgr-1",
    name: "Alex GM",
    email: "alex@example.com",
    role: "sub_manager" as const,
    department: "sales",
    managerId: null,
    createdAt: "2024-01-01",
  },
];

const mockCrmUser = {
  id: "gm-1",
  name: "General Manager",
  email: "gm@example.com",
  role: "general_manager" as const,
  department: "sales",
  managerId: null,
  createdAt: "2024-01-01",
};

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    crmUser: mockCrmUser,
    createUser: vi.fn(),
    resetPassword: vi.fn(),
  }),
}));

vi.mock("@/lib/firestore-service", () => ({
  fetchTeamUsers: vi.fn(),
  updateUserDoc: vi.fn(),
  updateUserStatus: vi.fn(),
  fetchQuotations: vi.fn(),
  fetchSalesFunnel: vi.fn(),
  fetchTeamPerformanceData: vi.fn(),
  exportTeamPerformanceToCSV: vi.fn(() => "csv-data"),
  subscribeToAllUsers: (...args: unknown[]) => mockSubscribeToAllUsers(...args),
}));

describe("TeamPage manager table", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCrmUser.id = "gm-1";
    mockCrmUser.role = "general_manager";
    mockSubscribeToAllUsers.mockImplementation((callback: (users: typeof managers) => void) => {
      callback(managers);
      return () => undefined;
    });
    vi.mocked(firestoreService.fetchQuotations).mockResolvedValue([]);
    vi.mocked(firestoreService.fetchSalesFunnel).mockResolvedValue([]);
  });

  it("renders a clickable manager name and hides the extra columns", async () => {
    render(<TeamPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /alex gm/i })).toBeInTheDocument();
    });

    expect(screen.queryByText("Designation")).not.toBeInTheDocument();
    expect(screen.queryByText("Company")).not.toBeInTheDocument();
    expect(screen.queryByText("Assigned With")).not.toBeInTheDocument();
  });

  it("shows a single unified sales table when clicking a salesperson", async () => {
    const salesUser = {
      id: "sales-1",
      name: "Nina Sales",
      email: "nina@example.com",
      role: "sales" as const,
      department: "sales",
      managerId: "mgr-1",
      createdAt: "2024-01-01",
    };

    mockCrmUser.id = "mgr-1";
    mockCrmUser.role = "sub_manager";

    mockSubscribeToAllUsers.mockImplementation((callback: (users: typeof managers | typeof salesUser[]) => void) => {
      callback([salesUser]);
      return () => undefined;
    });

    vi.mocked(firestoreService.fetchQuotations).mockResolvedValue([
      {
        id: "q-1",
        quotationNumber: "QT-1001",
        companyName: "Acme Corp",
        subject: "ERP rollout",
        totalValue: 120000,
        status: "Created",
        createdAt: "2024-02-01",
      },
    ]);

    vi.mocked(firestoreService.fetchSalesFunnel).mockResolvedValue([
      {
        id: "sf-1",
        companyName: "Acme Corp",
        quotationValue: 120000,
        poValue: 70000,
        invoiceValue: 30000,
        status: "Hot",
        followUpDate: "2024-03-15",
        closingMonth: "March",
        closingYear: "2024",
        subject: "ERP rollout",
        quotationNumber: "QT-1001",
        createdAt: "2024-02-10",
      },
    ]);

    render(<TeamPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /nina sales/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /nina sales/i }));

    await waitFor(() => {
      expect(screen.getByText("Close Month/Year")).toBeInTheDocument();
      expect(screen.getByText("QT-1001")).toBeInTheDocument();
      expect(screen.getByText("March / 2024")).toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: /quotations/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sales funnel/i })).not.toBeInTheDocument();
  });

  it("filters out draft quotations and provides a download action for the salesperson sales view", async () => {
    const salesUser = {
      id: "sales-1",
      name: "Nina Sales",
      email: "nina@example.com",
      role: "sales" as const,
      department: "sales",
      managerId: "mgr-1",
      createdAt: "2024-01-01",
    };

    mockCrmUser.id = "mgr-1";
    mockCrmUser.role = "sub_manager";

    mockSubscribeToAllUsers.mockImplementation((callback: (users: typeof managers | typeof salesUser[]) => void) => {
      callback([salesUser]);
      return () => undefined;
    });

    vi.mocked(firestoreService.fetchQuotations).mockResolvedValue([
      {
        id: "q-draft",
        quotationNumber: "QT-1001",
        companyName: "Draft Corp",
        subject: "Draft quote",
        totalValue: 5000,
        status: "Draft",
        createdAt: "2024-02-01",
      },
      {
        id: "q-live",
        quotationNumber: "QT-1002",
        companyName: "Live Corp",
        subject: "Live quote",
        totalValue: 15000,
        status: "Created",
        createdAt: "2024-02-02",
      },
    ]);

    vi.mocked(firestoreService.fetchSalesFunnel).mockResolvedValue([]);

    const createObjectURL = vi.fn(() => "blob:mock");
    const revokeObjectURL = vi.fn();
    const originalURL = globalThis.URL;

    Object.defineProperty(globalThis, "URL", {
      configurable: true,
      value: {
        ...originalURL,
        createObjectURL,
        revokeObjectURL,
      },
    });

    render(<TeamPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /nina sales/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /nina sales/i }));

    await waitFor(() => {
      expect(screen.getByText("QT-1002")).toBeInTheDocument();
    });

    expect(screen.queryByText("QT-1001")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /download/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /download/i }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);

    Object.defineProperty(globalThis, "URL", {
      configurable: true,
      value: originalURL,
    });
  });
});
