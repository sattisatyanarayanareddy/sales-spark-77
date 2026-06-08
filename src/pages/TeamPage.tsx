import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchTeamUsers,
  updateUserDoc,
  updateUserStatus,
  fetchQuotations,
  fetchSalesFunnel,
  fetchTeamPerformanceData,
  exportTeamPerformanceToCSV,
  subscribeToAllUsers,
  type TeamPerformanceRow,
} from "@/lib/firestore-service";
import { CRMUser, UserRole, Quotation, SalesFunnel } from "@/types/crm";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Plus,
  AlertCircle,
  Pencil,
  Lock,
  Unlock,
  Download,
  FileText,
  CheckCircle,
  DollarSign,
  Activity,
  X,
  Eye,
  EyeOff,
  Shield,
  UserCheck,
  ChevronLeft,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { getAddUserRolePolicy } from "@/lib/user-form-policy";

const roleBadge: Record<string, string> = {
  administrator: "bg-purple-100 text-purple-700",
  general_manager: "bg-success/10 text-success",
  sub_manager: "bg-info/10 text-info",
  sales: "bg-warning/10 text-warning",
};

const roleLabel: Record<string, string> = {
  administrator: "Admin",
  general_manager: "General Manager",
  sub_manager: "Manager",
  sales: "Salesperson",
};

const fmtCurrency = (v: number) => `$${v.toLocaleString()}`;

// ── Salesperson Detail Modal ──────────────────────────────────────────────────

interface SalespersonModalProps {
  user: CRMUser;
  onClose: () => void;
}

const SalespersonModal: React.FC<SalespersonModalProps> = ({ user, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [combinedRows, setCombinedRows] = useState<
    Array<{
      id: string;
      date: string | null;
      quotationNumber: string;
      companyName: string;
      subject: string;
      value: number;
      status: string;
      followUpDate: string | null;
      closingMonthYear: string;
      poValue: number;
      invoiceValue: number;
      paymentStatus?: string;
      pendingPayment?: number;
      remarks?: string;
    }>
  >([]);
  const [members, setMembers] = useState<TeamPerformanceRow[]>([]);
  const [activeUser, setActiveUser] = useState(user);
  const [rootUser, setRootUser] = useState(user);

  useEffect(() => {
    setActiveUser(user);
    setRootUser(user);
  }, [user]);

  const getClosingMonthYear = (value: { closingMonth?: string | null; closingYear?: string | null }) => {
    if (!value.closingMonth && !value.closingYear) return "—";
    if (!value.closingMonth) return value.closingYear || "—";
    if (!value.closingYear) return value.closingMonth;
    return `${value.closingMonth} / ${value.closingYear}`;
  };

  const formatDate = (dateValue?: string | null) => {
    if (!dateValue) return "—";
    const parsed = new Date(dateValue);
    if (Number.isNaN(parsed.getTime())) return "—";
    return parsed.toLocaleDateString();
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case "Won":
        return "bg-green-600/10 text-green-600";
      case "Hot":
        return "bg-red-500/10 text-red-500";
      case "Warm":
        return "bg-orange-500/10 text-orange-500";
      case "Sent":
        return "bg-blue-500/10 text-blue-500";
      case "Created":
        return "bg-primary/10 text-primary";
      default:
        return "bg-gray-500/10 text-gray-500";
    }
  };

  const exportSalespersonSales = () => {
    try {
      const headers = [
        "Date",
        "Quotation No",
        "Company Name",
        "Subject",
        "Value",
        "Status",
        "Follow Up Date",
        "Close Month/Year",
        "PO Value",
        "Invoice Value",
      ];

      const escapeCsv = (value: string) => `"${String(value).replace(/"/g, '""')}"`;
      const rows = combinedRows.map((row) => [
        row.date ? new Date(row.date).toLocaleDateString() : "",
        row.quotationNumber,
        row.companyName,
        row.subject,
        row.value.toString(),
        row.status,
        row.followUpDate ? new Date(row.followUpDate).toLocaleDateString() : "",
        row.closingMonthYear,
        row.poValue.toString(),
        row.invoiceValue.toString(),
      ].map((value) => escapeCsv(value)).join(","));

      const csv = [headers.map(escapeCsv).join(","), ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${activeUser.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "salesperson"}-sales.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Sales report downloaded");
    } catch (error) {
      console.error(error);
      toast.error("Failed to download sales report");
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        if (activeUser.role === "sales") {
          const [qs, sf] = await Promise.all([
            fetchQuotations(activeUser.id, "sales"),
            fetchSalesFunnel(activeUser.id, "sales"),
          ]);

          const nonDraftQuotations = qs.filter((quotation) => quotation.status !== "Draft");
          const nonDraftFunnels = sf;

          const funnelByQuotationNumber = new Map<string, SalesFunnel>();
          nonDraftFunnels.forEach((item) => {
            if (item.quotationNumber) {
              funnelByQuotationNumber.set(item.quotationNumber, item);
            }
          });

          const mergedRows = nonDraftQuotations.map((quotation) => {
            const funnelMatch = funnelByQuotationNumber.get(quotation.quotationNumber);
            return {
              id: quotation.id,
              date: quotation.createdAt,
              quotationNumber: quotation.quotationNumber,
              companyName: quotation.companyName,
              subject: quotation.subject,
              value: quotation.totalValue ?? 0,
              status: funnelMatch?.status || quotation.status,
              followUpDate: funnelMatch?.followUpDate || quotation.followUpDate,
              closingMonthYear: getClosingMonthYear(
                funnelMatch || { closingMonth: null, closingYear: null }
              ),
              poValue: funnelMatch?.poValue ?? quotation.poValue ?? 0,
              invoiceValue: funnelMatch?.invoiceValue ?? quotation.invoiceValue ?? 0,
              paymentStatus: funnelMatch?.paymentStatus ?? "Pending",
              pendingPayment: funnelMatch?.pendingPayment ?? 0,
              remarks: funnelMatch?.remarks ?? quotation.followUpNotes ?? "",
            };
          });

          const unmatchedFunnels = nonDraftFunnels
            .filter((item) => !mergedRows.some((row) => row.quotationNumber === item.quotationNumber))
            .map((item) => ({
              id: item.id,
              date: item.createdAt,
              quotationNumber: item.quotationNumber,
              companyName: item.companyName,
              subject: item.subject,
              value: item.quotationValue ?? 0,
              status: item.status,
              followUpDate: item.followUpDate,
              closingMonthYear: getClosingMonthYear(item),
              poValue: item.poValue ?? 0,
              invoiceValue: item.invoiceValue ?? 0,
              paymentStatus: item.paymentStatus ?? "Pending",
              pendingPayment: item.pendingPayment ?? 0,
              remarks: item.remarks ?? "",
            }));

          setCombinedRows([...mergedRows, ...unmatchedFunnels].sort((a, b) => {
            const aTime = a.date ? new Date(a.date).getTime() : 0;
            const bTime = b.date ? new Date(b.date).getTime() : 0;
            return bTime - aTime;
          }));
          setMembers([]);
          return;
        }
        // If active user is a manager, load only manager's own sales and also fetch their team members
        if (activeUser.role === "sub_manager") {
          const [qs, sf, performanceRows] = await Promise.all([
            fetchQuotations(activeUser.id, "sub_manager"),
            fetchSalesFunnel(activeUser.id, "sub_manager"),
            fetchTeamPerformanceData(activeUser.id, activeUser.role),
          ]);

          const nonDraftQuotations = qs.filter((quotation) => quotation.status !== "Draft");
          const nonDraftFunnels = sf.filter((item) => item.salesPersonId === activeUser.id);

          const funnelByQuotationNumber = new Map<string, SalesFunnel>();
          nonDraftFunnels.forEach((item) => {
            if (item.quotationNumber) {
              funnelByQuotationNumber.set(item.quotationNumber, item);
            }
          });

          const mergedRows = nonDraftQuotations.map((quotation) => {
            const funnelMatch = funnelByQuotationNumber.get(quotation.quotationNumber);
            return {
              id: quotation.id,
              date: quotation.createdAt,
              quotationNumber: quotation.quotationNumber,
              companyName: quotation.companyName,
              subject: quotation.subject,
              value: quotation.totalValue ?? 0,
              status: funnelMatch?.status || quotation.status,
              followUpDate: funnelMatch?.followUpDate || quotation.followUpDate,
              closingMonthYear: getClosingMonthYear(funnelMatch || { closingMonth: null, closingYear: null }),
              poValue: funnelMatch?.poValue ?? quotation.poValue ?? 0,
              invoiceValue: funnelMatch?.invoiceValue ?? quotation.invoiceValue ?? 0,
              paymentStatus: funnelMatch?.paymentStatus ?? "Pending",
              pendingPayment: funnelMatch?.pendingPayment ?? 0,
              remarks: funnelMatch?.remarks ?? quotation.followUpNotes ?? "",
            };
          });

          const unmatchedFunnels = nonDraftFunnels
            .filter((item) => !mergedRows.some((row) => row.quotationNumber === item.quotationNumber))
            .map((item) => ({
              id: item.id,
              date: item.createdAt,
              quotationNumber: item.quotationNumber,
              companyName: item.companyName,
              subject: item.subject,
              value: item.quotationValue ?? 0,
              status: item.status,
              followUpDate: item.followUpDate,
              closingMonthYear: getClosingMonthYear(item),
              poValue: item.poValue ?? 0,
              invoiceValue: item.invoiceValue ?? 0,
              paymentStatus: item.paymentStatus ?? "Pending",
              pendingPayment: item.pendingPayment ?? 0,
              remarks: item.remarks ?? "",
            }));

          setCombinedRows([...mergedRows, ...unmatchedFunnels].sort((a, b) => {
            const aTime = a.date ? new Date(a.date).getTime() : 0;
            const bTime = b.date ? new Date(b.date).getTime() : 0;
            return bTime - aTime;
          }));
          setMembers(performanceRows);
          return;
        }

        // General manager: show aggregated team data (existing behavior)
        const performanceRows = await fetchTeamPerformanceData(activeUser.id, activeUser.role);
        const teamIds = performanceRows.map((row) => row.id);
        const [allQuotations, allFunnels] = await Promise.all([
          fetchQuotations(activeUser.id, "general_manager"),
          fetchSalesFunnel(activeUser.id, "general_manager"),
        ]);

        const nonDraftQuotations = allQuotations.filter((quotation) => quotation.status !== "Draft");
        const nonDraftFunnels = allFunnels;
        const filteredQuotations = nonDraftQuotations.filter((quote) => teamIds.includes(quote.salesPersonId));
        const filteredFunnels = nonDraftFunnels.filter((funnel) => teamIds.includes(funnel.salesPersonId));
        const funnelByQuotationNumber = new Map<string, SalesFunnel>();
        filteredFunnels.forEach((item) => {
          if (item.quotationNumber) {
            funnelByQuotationNumber.set(item.quotationNumber, item);
          }
        });

        const mergedRows = filteredQuotations.map((quotation) => {
          const funnelMatch = funnelByQuotationNumber.get(quotation.quotationNumber);
          return {
            id: quotation.id,
            date: quotation.createdAt,
            quotationNumber: quotation.quotationNumber,
            companyName: quotation.companyName,
            subject: quotation.subject,
            value: quotation.totalValue ?? 0,
            status: funnelMatch?.status || quotation.status,
            followUpDate: funnelMatch?.followUpDate || quotation.followUpDate,
            closingMonthYear: getClosingMonthYear(
              funnelMatch || { closingMonth: null, closingYear: null }
            ),
            poValue: funnelMatch?.poValue ?? quotation.poValue ?? 0,
            invoiceValue: funnelMatch?.invoiceValue ?? quotation.invoiceValue ?? 0,
            paymentStatus: funnelMatch?.paymentStatus ?? "Pending",
            pendingPayment: funnelMatch?.pendingPayment ?? 0,
            remarks: funnelMatch?.remarks ?? quotation.followUpNotes ?? "",
          };
        });

        const unmatchedFunnels = filteredFunnels
          .filter((item) => !mergedRows.some((row) => row.quotationNumber === item.quotationNumber))
          .map((item) => ({
            id: item.id,
            date: item.createdAt,
            quotationNumber: item.quotationNumber,
            companyName: item.companyName,
            subject: item.subject,
            value: item.quotationValue ?? 0,
            status: item.status,
            followUpDate: item.followUpDate,
            closingMonthYear: getClosingMonthYear(item),
            poValue: item.poValue ?? 0,
            invoiceValue: item.invoiceValue ?? 0,
            paymentStatus: item.paymentStatus ?? "Pending",
            pendingPayment: item.pendingPayment ?? 0,
            remarks: item.remarks ?? "",
          }));

        setCombinedRows([...mergedRows, ...unmatchedFunnels].sort((a, b) => {
          const aTime = a.date ? new Date(a.date).getTime() : 0;
          const bTime = b.date ? new Date(b.date).getTime() : 0;
          return bTime - aTime;
        }));
        setMembers(performanceRows);
      } catch (e) {
        console.error(e);
        toast.error("Failed to load salesperson data");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [activeUser.id, activeUser.role]);

  const activeDeals = combinedRows.filter(
    (row) => !["Won", "Closed", "Cancelled", "Lost"].includes(row.status)
  ).length;
  const totalQuotationValue = combinedRows.reduce((s, row) => s + row.value, 0);
  const totalPOValue = combinedRows.reduce((s, row) => s + row.poValue, 0);
  const totalInvoiceValue = combinedRows.reduce((s, row) => s + row.invoiceValue, 0);
  const totalPaymentDues = combinedRows.reduce((sum, row) => sum + (row.pendingPayment ?? 0), 0);
  const wonDeals = combinedRows.filter((row) => row.status === "Won").length;

  const stats = [
    { label: "Active Deals", value: activeDeals, icon: Activity, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Quotation Value", value: fmtCurrency(totalQuotationValue), icon: FileText, color: "text-primary", bg: "bg-primary/10" },
    { label: "PO Value", value: fmtCurrency(totalPOValue), icon: DollarSign, color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Invoice Value", value: fmtCurrency(totalInvoiceValue), icon: Activity, color: "text-teal-500", bg: "bg-teal-500/10" },
    { label: "Payment Due", value: fmtCurrency(totalPaymentDues), icon: AlertCircle, color: "text-rose-600", bg: "bg-rose-600/10" },
    { label: "Won Deals", value: wonDeals, icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/10" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-6 border-b border-border bg-gradient-to-r from-primary/5 to-primary/10">
          <div>
            <h2 className="text-xl font-bold text-foreground">{activeUser.name}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{activeUser.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className={`border-0 text-xs ${roleBadge[activeUser.role]}`}>
                {roleLabel[activeUser.role]}
              </Badge>
              {activeUser.department && (
                <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                  {activeUser.department}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {rootUser.id !== activeUser.id && (
              <Button variant="ghost" size="icon" onClick={() => setActiveUser(rootUser)} title="Back">
                <ChevronLeft className="w-4 h-4" />
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={exportSalespersonSales}
              disabled={combinedRows.length === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 p-5 border-b border-border">
              {stats.map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl border border-border bg-card p-3 flex flex-col gap-1.5"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.bg}`}>
                    <s.icon className={`w-4 h-4 ${s.color}`} />
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-tight">{s.label}</p>
                  <p className="text-base font-bold text-foreground leading-tight">{s.value}</p>
                </div>
              ))}
            </div>

            {activeUser.role === "sub_manager" && members.length > 0 && (
              <div className="p-5 border-b">
                <h4 className="text-sm font-semibold mb-2">Team Members</h4>
                <div className="flex flex-wrap gap-2">
                  {members.filter((m) => m.role === "sales").map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setActiveUser({
                        id: m.id,
                        name: m.name,
                        email: m.email || "",
                        role: "sales",
                        department: m.department || "",
                        managerId: activeUser.id,
                        createdAt: "",
                      } as CRMUser)}
                      className="px-3 py-1 rounded-full bg-card border border-border text-sm hover:bg-primary/5"
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="p-5">
              <div className="mb-3 text-sm text-muted-foreground">
                Showing all sales records for {activeUser.role === "sales" ? "this salesperson" : "the selected team"}
              </div>
              <div className="overflow-x-auto rounded-xl border border-border">
                <Table className="min-w-[1100px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Quotation No</TableHead>
                      <TableHead>Company Name</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Follow up date</TableHead>
                      <TableHead>Close Month/Year</TableHead>
                      <TableHead className="text-right">PO Value</TableHead>
                      <TableHead className="text-right">Invoice value</TableHead>
                      <TableHead className="text-right">Payment</TableHead>
                      <TableHead>Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {combinedRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                          No sales records found
                        </TableCell>
                      </TableRow>
                    ) : (
                      combinedRows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="text-xs text-muted-foreground">{formatDate(row.date)}</TableCell>
                          <TableCell className="font-mono text-xs">{row.quotationNumber}</TableCell>
                          <TableCell className="text-sm">{row.companyName}</TableCell>
                          <TableCell className="text-sm max-w-[220px] truncate">{row.subject}</TableCell>
                          <TableCell className="text-right font-medium">{fmtCurrency(row.value)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`border-0 text-xs ${getStatusClass(row.status)}`}>
                              {row.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{formatDate(row.followUpDate)}</TableCell>
                          <TableCell className="text-sm">{row.closingMonthYear}</TableCell>
                          <TableCell className="text-right">{fmtCurrency(row.poValue)}</TableCell>
                          <TableCell className="text-right">{fmtCurrency(row.invoiceValue)}</TableCell>
                          <TableCell className="text-right text-sm">
                            {row.invoiceValue > 0 ? (
                              row.paymentStatus === "Partial" ?
                                `Partial ($${Math.max(0, row.invoiceValue - (row.pendingPayment ?? 0)).toLocaleString()} paid)` :
                              row.paymentStatus === "Completed" ?
                                "Completed" :
                                `Pending ($${(row.pendingPayment ?? 0).toLocaleString()} due)`
                            ) : "—"}
                          </TableCell>
                          <TableCell className="text-sm max-w-[220px] truncate">{row.remarks || "—"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

// ── TeamPage ──────────────────────────────────────────────────────────────────

const DEPARTMENTS = [
  "Sales",
  "Hardware",
  "Software",
  "Support",
  "Marketing",
  "Finance",
  "HR",
];

const TeamPage: React.FC = () => {
  const { crmUser, createUser, resetPassword } = useAuth();
  const [teamUsers, setTeamUsers] = useState<CRMUser[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [userCount, setUserCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingUser, setEditingUser] = useState<CRMUser | null>(null);
  const [managerId, setManagerId] = useState<string | null>(null);
  const [exportingCSV, setExportingCSV] = useState(false);
  const [selectedSalesperson, setSelectedSalesperson] = useState<CRMUser | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("sales");
  const [department, setDepartment] = useState("");
  const [designation, setDesignation] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const rolePolicy = getAddUserRolePolicy(role);

  // Helper functions for Dialog Form Controls
  const handleOpenAddChange = (open: boolean) => {
    setShowAddDialog(open);
    if (open) {
      setName("");
      setEmail("");
      setRole("sales");
      setDepartment("");
      setManagerId(null);
      setDesignation("");
      setCompanyName("");
      setPassword("");
      setConfirmPassword("");
      setShowPassword(false);
      setShowConfirmPassword(false);
    }
  };

  const handleDepartmentChange = (val: string) => {
    setDepartment(val);
    if (role === "sales" && managerId) {
      const selectedMgr = teamUsers.find((u) => u.id === managerId);
      if (selectedMgr && selectedMgr.department.toLowerCase() !== val.toLowerCase()) {
        setManagerId(null);
      }
    }
  };

  const handleRoleChange = (val: UserRole) => {
    setRole(val);
    setManagerId(null);
    if (val === "general_manager") {
      setDepartment("");
    }
  };

  // Password validation
  const passwordRules = [
    { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
    { label: "At least one uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
    { label: "At least one lowercase letter", test: (p: string) => /[a-z]/.test(p) },
    { label: "At least one number", test: (p: string) => /[0-9]/.test(p) },
    { label: "At least one special character", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
  ];
  const isPasswordValid = password.length > 0 && passwordRules.every((r) => r.test(password));
  const passwordsMatch = password === confirmPassword;

  useEffect(() => {
    if (!crmUser) return;
    setLoading(true);

    const unsubscribe = subscribeToAllUsers((allUsers) => {
      let filtered: CRMUser[] = [];
      if (crmUser.role === "administrator") {
        filtered = allUsers.filter((u) => u.id !== crmUser.id);
      } else if (crmUser.role === "general_manager") {
        // Show all managers (sub_managers) in the system for General Manager
        filtered = allUsers.filter((u) => u.role === "sub_manager");
      } else {
        filtered = allUsers.filter((u) => u.managerId === crmUser.id);
      }

      setTeamUsers(filtered);

      const nonAdminUsers = filtered.filter((u) => u.role !== "administrator");
      const totalUsers =
        crmUser.role === "general_manager" || crmUser.role === "administrator"
          ? nonAdminUsers.length
          : nonAdminUsers.length;
      setUserCount(totalUsers);
      setLoading(false);
    });

    return unsubscribe;
  }, [crmUser]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !role || !password) {
      toast.error("Please fill all required fields");
      return;
    }
    if (rolePolicy.requiresDepartment && !department) {
      toast.error("Please select a department");
      return;
    }
    if (!isPasswordValid || !passwordsMatch) {
      toast.error("Invalid password or passwords do not match");
      return;
    }

    setSubmitting(true);
    try {
      const finalDepartment = rolePolicy.requiresDepartment ? department.trim().toLowerCase() : "";
      let finalManagerId: string | null = null;

      if (role === "sales") {
        finalManagerId = managerId || null;
      }

      await createUser(email, password, name, role, finalDepartment, finalManagerId, designation, companyName);
      toast.success("Team member added!");
      setShowAddDialog(false);
      setName("");
      setEmail("");
      setRole("sales");
      setDepartment("");
      setPassword("");
      setConfirmPassword("");
      setShowPassword(false);
      setShowConfirmPassword(false);
      setManagerId(null);
      setDesignation("");
      setCompanyName("");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to add team member");
    } finally {
      setSubmitting(false);
    }
  };

  const pageTitle = crmUser?.role === "administrator" ? "Users" : crmUser?.role === "general_manager" ? "Managers" : "Team Management";
  const canAddUsers = crmUser?.role === "administrator";
  const canViewSales = crmUser?.role !== "administrator";
  const addButtonLabel = "Add User";
  const addDialogTitle = "Add User";
  const addDialogDescription = "Create a new team member with a password. They can reset it later.";

  const filteredUsers = teamUsers.filter((user) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return [user.name, user.email, user.department, roleLabel[user.role]].join(" ").toLowerCase().includes(query);
  });

  const openEditUser = (user: CRMUser) => {
    setEditingUser(user);
    setName(user.name);
    setEmail(user.email);
    setRole(user.role);
    setDepartment(user.department);
    setDesignation(user.designation || "");
    setCompanyName(user.companyName || "");
    setManagerId(user.managerId);
    setShowEditDialog(true);
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || !name || !role || !department) return;
    setSubmitting(true);
    try {
      let finalManagerId: string | null = editingUser.managerId;
      if (crmUser.role === "administrator") {
        finalManagerId = (role === "sub_manager" || role === "sales") ? managerId : null;
      }
      await updateUserDoc(editingUser.id, { 
        name, 
        role, 
        department: department.trim().toLowerCase(), 
        managerId: finalManagerId,
        designation,
        companyName 
      });
      toast.success("User updated successfully");
      setShowEditDialog(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update user");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendResetLink = async (email: string) => {
    setSubmitting(true);
    try {
      await resetPassword(email);
      toast.success(`Reset link sent to ${email}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to send reset link");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (user: CRMUser) => {
    const newStatus = !user.disabled;
    await updateUserStatus(user.id, newStatus);
    toast.success(`User ${newStatus ? "disabled" : "enabled"}`);
  };

  const handleExportPerformance = async () => {
    if (!crmUser) return;
    setExportingCSV(true);
    try {
      const rows = await fetchTeamPerformanceData(crmUser.id, crmUser.role);
      const csv = exportTeamPerformanceToCSV(rows);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "team-performance-report.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Report downloaded");
    } finally {
      setExportingCSV(false);
    }
  };

  const managersCount = teamUsers.filter((u) => u.role === "sub_manager").length;
  const salesCount = crmUser?.role === "general_manager" ? 0 : teamUsers.filter((u) => u.role === "sales").length;

  if (!crmUser) return null;
  if (loading) return <div className="page-container flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="page-container space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="section-title">{pageTitle}</h2>
        {canAddUsers && (
          <Dialog open={showAddDialog} onOpenChange={handleOpenAddChange}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenAddChange(true)}>
                <Plus className="w-4 h-4 mr-2" />
                {addButtonLabel}
              </Button>
            </DialogTrigger>
            <DialogContent className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl border border-border shadow-2xl p-0 bg-card/95 backdrop-blur-md">
              <div className="flex items-center gap-3 p-6 border-b border-border bg-gradient-to-r from-primary/10 via-blue-500/5 to-transparent">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold tracking-tight text-foreground">{addDialogTitle}</DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    {addDialogDescription}
                  </DialogDescription>
                </div>
              </div>
              <form onSubmit={handleAddMember} className="space-y-4 p-6">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a strong password"
                    required
                    className="pr-10 rounded-xl"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {/* Live password rules */}
                {password.length > 0 && (
                  <ul className="mt-1.5 space-y-1">
                    {passwordRules.map((rule) => (
                      <li key={rule.label} className={`flex items-center gap-1.5 text-xs ${
                        rule.test(password) ? "text-green-600" : "text-muted-foreground"
                      }`}>
                        <span className={`inline-flex w-3.5 h-3.5 rounded-full items-center justify-center text-[9px] font-bold shrink-0 ${
                          rule.test(password) ? "bg-green-500/20 text-green-600" : "bg-muted text-muted-foreground"
                        }`}>
                          {rule.test(password) ? "✓" : "○"}
                        </span>
                        {rule.label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password *</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter the password"
                    required
                    className={`pr-10 rounded-xl ${
                      confirmPassword.length > 0
                        ? passwordsMatch
                          ? "border-green-500 focus-visible:ring-green-500"
                          : "border-destructive focus-visible:ring-destructive"
                        : ""
                    }`}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirmPassword.length > 0 && !passwordsMatch && (
                  <p className="text-xs text-destructive mt-1">Passwords do not match</p>
                )}
                {confirmPassword.length > 0 && passwordsMatch && (
                  <p className="text-xs text-green-600 mt-1">✓ Passwords match</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Select value={role} onValueChange={(val) => handleRoleChange(val as UserRole)}>
                  <SelectTrigger id="role" className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sales">Salesperson</SelectItem>
                    <SelectItem value="sub_manager">Manager</SelectItem>
                    {(crmUser.role === "general_manager" || crmUser.role === "administrator") && <SelectItem value="general_manager">General Manager</SelectItem>}
                    {crmUser.role === "administrator" && <SelectItem value="administrator">Admin</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              {rolePolicy.requiresDepartment && (
                <div className="space-y-2">
                  <Label htmlFor="department">Department *</Label>
                  <Select value={department} onValueChange={(val) => handleDepartmentChange(val)}>
                    <SelectTrigger id="department" className="rounded-xl">
                      <SelectValue placeholder="Select Department" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map((dept) => (
                        <SelectItem key={dept} value={dept.toLowerCase()}>
                          {dept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {rolePolicy.requiresManagerAssignment && (
                <div className="space-y-2">
                  <Label htmlFor="add-manager-select">Assign Manager</Label>
                  <Select value={managerId || "none"} onValueChange={(val) => setManagerId(val === "none" ? null : val)}>
                    <SelectTrigger id="add-manager-select" className="rounded-xl">
                      <SelectValue placeholder={department ? "Select Manager" : "Select department first"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned / None</SelectItem>
                      {teamUsers
                        .filter((u) => u.role === "sub_manager" && u.department.toLowerCase() === department.toLowerCase())
                        .map((m) => (
                          <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {!department && (
                    <p className="text-xs text-muted-foreground">Please select a department first to see managers.</p>
                  )}
                  {department && teamUsers.filter((u) => u.role === "sub_manager" && u.department.toLowerCase() === department.toLowerCase()).length === 0 && (
                    <p className="text-xs text-amber-500 font-medium">⚠️ No managers found in the "{DEPARTMENTS.find(d => d.toLowerCase() === department.toLowerCase()) || department}" department.</p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="designation">Designation</Label>
                <Input id="designation" value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="e.g. Senior Executive" className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name</Label>
                <Input id="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="e.g. Acme Corp" className="rounded-xl" />
              </div>
              <Button type="submit" className="w-full rounded-xl h-11 bg-gradient-to-r from-primary to-blue-700 hover:from-primary/90 hover:to-blue-700/90 text-white font-medium mt-2" disabled={submitting || !isPasswordValid || !passwordsMatch}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {submitting ? "Adding..." : "Add Member"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}
      </div>

      {/* Stats Row */}
      {crmUser?.role === "general_manager" ? (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="stat-card sm:max-w-sm"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Managers</p>
              <h3 className="text-3xl font-extrabold mt-1 text-foreground">{managersCount}</h3>
            </div>
            <div className="p-3 rounded-2xl bg-primary/10 text-primary">
              <Shield className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center text-xs text-muted-foreground">
            Your team managers
          </div>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="stat-card"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Managers</p>
                <h3 className="text-3xl font-extrabold mt-1 text-foreground">{managersCount}</h3>
              </div>
              <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                <Shield className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-center text-xs text-muted-foreground">
              Directing team departments
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="stat-card"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Salespeople</p>
                <h3 className="text-3xl font-extrabold mt-1 text-foreground">{salesCount}</h3>
              </div>
              <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500">
                <UserCheck className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-center text-xs text-muted-foreground">
              Driving active lead funnels
            </div>
          </motion.div>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input type="search" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="max-w-md" />
        {crmUser.role !== "administrator" && (
          <Button variant="outline" size="sm" onClick={handleExportPerformance} disabled={exportingCSV}>
            <Download className="w-4 h-4 mr-2" /> Export Performance
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-lg hover:shadow-xl transition-shadow duration-300">
        <Table>
          <TableHeader>
            <TableRow className="bg-gradient-to-r from-primary/5 via-blue-500/5 to-transparent hover:bg-gradient-to-r hover:from-primary/8 hover:via-blue-500/8 hover:to-transparent transition-colors border-b border-border/60">
              <TableHead className="font-semibold text-foreground/90">Name</TableHead>
              <TableHead className="font-semibold text-foreground/90">Email</TableHead>
              <TableHead className="font-semibold text-foreground/90">Role</TableHead>
              <TableHead className="font-semibold text-foreground/90">Department</TableHead>
              <TableHead className="text-right font-semibold text-foreground/90">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((user, idx) => (
              <TableRow key={user.id} className={`border-b border-border/40 transition-all duration-200 ${user.disabled ? "opacity-50 bg-muted/30" : idx % 2 === 0 ? "hover:bg-muted/40" : "hover:bg-primary/5"}`}>
                <TableCell className="font-semibold text-foreground/95 py-3.5">
                  {canViewSales && user.role !== "administrator" ? (
                    <button
                      type="button"
                      onClick={() => setSelectedSalesperson(user)}
                      className="text-left text-primary hover:text-primary/80 hover:underline font-bold transition-colors"
                    >
                      {user.name}
                    </button>
                  ) : (
                    <span className="font-semibold">{user.name}</span>
                  )}
                  {user.disabled && (
                    <Badge variant="outline" className="ml-2 text-[10px] py-0.5 px-2 h-auto bg-destructive/10 text-destructive border-destructive/30 font-medium">Disabled</Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm py-3.5 font-medium">{user.email}</TableCell>
                <TableCell className="py-3.5">
                  <Badge variant="outline" className={`border-0 text-xs font-semibold px-3 py-1 ${roleBadge[user.role]}`}>{roleLabel[user.role]}</Badge>
                </TableCell>
                <TableCell className="capitalize text-sm font-medium text-foreground/80 py-3.5">{user.department ? user.department.charAt(0).toUpperCase() + user.department.slice(1) : "—"}</TableCell>
                <TableCell className="text-right py-3.5">
                  <div className="inline-flex items-center gap-1.5">
                    <Button variant="ghost" size="icon" className="action-btn h-8 w-8 hover:bg-primary/10 hover:text-primary transition-all" onClick={() => openEditUser(user)} disabled={user.disabled} title={user.disabled ? "Cannot edit disabled user" : "Edit user"}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-8 w-8 transition-all ${user.disabled ? "text-green-600 hover:bg-green-500/10 hover:text-green-700" : "text-amber-600 hover:bg-amber-500/10 hover:text-amber-700"}`}
                      onClick={() => handleToggleStatus(user)}
                      title={user.disabled ? "Enable User" : "Disable User"}
                    >
                      {user.disabled ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filteredUsers.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground font-medium">No team members found matching your search</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit User Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="w-full max-w-md max-h-[80vh] overflow-y-auto rounded-2xl border border-border shadow-2xl p-0 bg-card/95 backdrop-blur-md">
          <div className="flex items-center gap-3 p-6 border-b border-border bg-gradient-to-r from-primary/10 via-blue-500/5 to-transparent">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Pencil className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight text-foreground">Edit Team Member</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Update user role and profile details.
              </DialogDescription>
            </div>
          </div>

          <form onSubmit={handleEditUser} className="space-y-4 p-6">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Full Name *</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input id="edit-email" value={email} disabled className="rounded-xl opacity-60" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-role">Role *</Label>
              <Select value={role} onValueChange={(val) => handleRoleChange(val as UserRole)}>
                <SelectTrigger id="edit-role" className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">Salesperson</SelectItem>
                  <SelectItem value="sub_manager">Manager</SelectItem>
                  {(crmUser.role === "general_manager" || crmUser.role === "administrator") && (
                    <SelectItem value="general_manager">General Manager</SelectItem>
                  )}
                  {crmUser.role === "administrator" && (
                    <SelectItem value="administrator">Admin</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {crmUser.role === "administrator" && role === "sub_manager" && (
              <div className="space-y-2">
                <Label htmlFor="edit-gm-select">Assign General Manager</Label>
                <Select value={managerId || "none"} onValueChange={(val) => setManagerId(val === "none" ? null : val)}>
                  <SelectTrigger id="edit-gm-select" className="rounded-xl">
                    <SelectValue placeholder="Select General Manager" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned / None</SelectItem>
                    {teamUsers.filter((u) => u.role === "general_manager").map((gm) => (
                      <SelectItem key={gm.id} value={gm.id}>{gm.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {crmUser.role === "administrator" && role === "sales" && (
              <div className="space-y-2">
                <Label htmlFor="edit-manager-select">Assign Manager</Label>
                <Select value={managerId || "none"} onValueChange={(val) => setManagerId(val === "none" ? null : val)}>
                  <SelectTrigger id="edit-manager-select" className="rounded-xl">
                    <SelectValue placeholder={department ? "Select Manager" : "Select department first"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned / None</SelectItem>
                    {teamUsers
                      .filter((u) => u.role === "sub_manager" && u.department.toLowerCase() === department.toLowerCase())
                      .map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {!department && (
                  <p className="text-xs text-muted-foreground">Please select a department first to see managers.</p>
                )}
                {department && teamUsers.filter((u) => u.role === "sub_manager" && u.department.toLowerCase() === department.toLowerCase()).length === 0 && (
                  <p className="text-xs text-amber-500 font-medium">⚠️ No managers found in the "{DEPARTMENTS.find(d => d.toLowerCase() === department.toLowerCase()) || department}" department.</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="edit-department">Department *</Label>
              <Select value={department} onValueChange={(val) => handleDepartmentChange(val)}>
                <SelectTrigger id="edit-department" className="rounded-xl">
                  <SelectValue placeholder="Select Department" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((dept) => (
                    <SelectItem key={dept} value={dept.toLowerCase()}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-designation">Designation</Label>
              <Input
                id="edit-designation"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="e.g. Senior Executive"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-companyName">Company Name</Label>
              <Input
                id="edit-companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Acme Corp"
                className="rounded-xl"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1 rounded-xl h-11" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1 rounded-xl h-11 bg-gradient-to-r from-primary to-blue-700 hover:from-primary/90 hover:to-blue-700/90 text-white font-medium" disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {submitting ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Salesperson Drill-down Modal */}
      <AnimatePresence>
        {selectedSalesperson && (
          <SalespersonModal
            user={selectedSalesperson}
            onClose={() => setSelectedSalesperson(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default TeamPage;
