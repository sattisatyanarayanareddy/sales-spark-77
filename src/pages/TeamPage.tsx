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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

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
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [funnel, setFunnel] = useState<SalesFunnel[]>([]);
  const [activeTab, setActiveTab] = useState<"quotations" | "funnel" | "performance" | "members">("quotations");
  const [members, setMembers] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        if (user.role === "sales") {
          const [qs, sf] = await Promise.all([
            fetchQuotations(user.id, "sales"),
            fetchSalesFunnel(user.id, "sales"),
          ]);
          setQuotations(qs);
          setFunnel(sf);
          setMembers([]);
          setActiveTab("quotations");
        } else {
          // For managers, fetch team performance rows
          const rows = await fetchTeamPerformanceData(user.id, user.role);
          setMembers(rows);
          // aggregate values for top-level stats
          setQuotations([]);
          setFunnel([]);
          setActiveTab("performance");
        }
      } catch (e) {
        console.error(e);
        toast.error("Failed to load salesperson data");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user.id]);

  const activeDeals = quotations.filter(
    (q) => !["Won", "Closed", "Cancelled", "Lost"].includes(q.status)
  ).length;
  const totalQuotationValue = quotations.reduce((s, q) => s + q.totalValue, 0);
  const totalPOValue = funnel.reduce((s, f) => s + (f.poValue || 0), 0);
  const totalInvoiceValue = funnel.reduce((s, f) => s + (f.invoiceValue || 0), 0);
  const wonDeals = funnel.filter((f) => f.status === "Won").length;

  const stats = [
    { label: "Active Deals", value: activeDeals, icon: Activity, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Quotation Value", value: fmtCurrency(totalQuotationValue), icon: FileText, color: "text-violet-500", bg: "bg-violet-500/10" },
    { label: "PO Value", value: fmtCurrency(totalPOValue), icon: DollarSign, color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Invoice Value", value: fmtCurrency(totalInvoiceValue), icon: Activity, color: "text-teal-500", bg: "bg-teal-500/10" },
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
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-6 border-b border-border bg-gradient-to-r from-primary/5 to-violet-500/5">
          <div>
            <h2 className="text-xl font-bold text-foreground">{user.name}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{user.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className={`border-0 text-xs ${roleBadge[user.role]}`}>
                {roleLabel[user.role]}
              </Badge>
              {user.department && (
                <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                  {user.department}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-5 border-b border-border">
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

            <div className="flex border-b border-border px-5 pt-4 gap-1">
              {((user.role === "sales") ? (["quotations", "funnel"] as const) : (["performance", "members"] as const)).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
                    activeTab === tab
                      ? "border-primary text-primary bg-primary/5"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab === "quotations" && `Quotations (${quotations.length})`}
                  {tab === "funnel" && `Sales Funnel (${funnel.length})`}
                  {tab === "performance" && `Team Performance (${members.reduce((s, r) => s + (r.activeDeals || 0), 0)})`}
                  {tab === "members" && `Members (${members.length})`}
                </button>
              ))}
            </div>

            <div className="p-5">
              {activeTab === "quotations" && (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Quotation No</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {quotations.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No quotations found
                          </TableCell>
                        </TableRow>
                      ) : (
                        quotations.map((q) => (
                          <TableRow key={q.id}>
                            <TableCell className="font-mono text-xs">{q.quotationNumber}</TableCell>
                            <TableCell className="text-sm">{q.companyName}</TableCell>
                            <TableCell className="text-sm max-w-[180px] truncate">{q.subject}</TableCell>
                            <TableCell className="text-right font-medium">{fmtCurrency(q.totalValue)}</TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`border-0 text-xs ${
                                  q.status === "Won"
                                    ? "bg-green-500/10 text-green-500"
                                    : q.status === "Sent"
                                    ? "bg-blue-500/10 text-blue-500"
                                    : q.status === "Created"
                                    ? "bg-primary/10 text-primary"
                                    : "bg-gray-500/10 text-gray-500"
                                }`}
                              >
                                {q.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {q.createdAt ? new Date(q.createdAt).toLocaleDateString() : "—"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}

              {activeTab === "funnel" && (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Company</TableHead>
                        <TableHead className="text-right">Quotation Value</TableHead>
                        <TableHead className="text-right">PO Value</TableHead>
                        <TableHead className="text-right">Invoice Value</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Follow-up</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {funnel.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No funnel entries found
                          </TableCell>
                        </TableRow>
                      ) : (
                        funnel.map((f) => (
                          <TableRow key={f.id}>
                            <TableCell className="text-sm">{f.companyName}</TableCell>
                            <TableCell className="text-right font-medium">{fmtCurrency(f.quotationValue)}</TableCell>
                            <TableCell className="text-right">{fmtCurrency(f.poValue)}</TableCell>
                            <TableCell className="text-right">{fmtCurrency(f.invoiceValue)}</TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`border-0 text-xs ${
                                  f.status === "Won"
                                    ? "bg-green-600/10 text-green-600"
                                    : f.status === "Hot"
                                    ? "bg-red-500/10 text-red-500"
                                    : f.status === "Warm"
                                    ? "bg-orange-500/10 text-orange-500"
                                    : f.status === "Lost"
                                    ? "bg-red-600/10 text-red-600"
                                    : "bg-gray-500/10 text-gray-500"
                                }`}
                              >
                                {f.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {f.followUpDate ? new Date(f.followUpDate).toLocaleDateString() : "—"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}

              {activeTab === "performance" && (
                <div className="p-5">
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {(() => {
                      const activeDeals = members.reduce((s, r) => s + (r.activeDeals || 0), 0);
                      const totalQuotationValue = members.reduce((s, r) => s + (r.totalQuotationValue || 0), 0);
                      const totalPOValue = members.reduce((s, r) => s + (r.totalPOValue || 0), 0);
                      const totalInvoiceValue = members.reduce((s, r) => s + (r.totalInvoiceValue || 0), 0);
                      const wonDeals = members.reduce((s, r) => s + (r.wonDeals || 0), 0);

                      const stats = [
                        { label: "Active Deals", value: activeDeals, icon: Activity, color: "text-blue-500", bg: "bg-blue-500/10" },
                        { label: "Quotation Value", value: fmtCurrency(totalQuotationValue), icon: FileText, color: "text-violet-500", bg: "bg-violet-500/10" },
                        { label: "PO Value", value: fmtCurrency(totalPOValue), icon: DollarSign, color: "text-amber-500", bg: "bg-amber-500/10" },
                        { label: "Invoice Value", value: fmtCurrency(totalInvoiceValue), icon: Activity, color: "text-teal-500", bg: "bg-teal-500/10" },
                        { label: "Won Deals", value: wonDeals, icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/10" },
                      ];

                      return stats.map((s) => (
                        <div key={s.label} className="rounded-xl border border-border bg-card p-3 flex flex-col gap-1.5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.bg}`}>
                            <s.icon className={`w-4 h-4 ${s.color}`} />
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-tight">{s.label}</p>
                          <p className="text-base font-bold text-foreground leading-tight">{s.value}</p>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}

              {activeTab === "members" && (
                <div className="p-5 overflow-x-auto rounded-xl border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead className="text-right">Active Deals</TableHead>
                        <TableHead className="text-right">Quotation Value</TableHead>
                        <TableHead className="text-right">PO Value</TableHead>
                        <TableHead className="text-right">Invoice Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {members.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No members found</TableCell>
                        </TableRow>
                      ) : (
                        members.map((m) => (
                          <TableRow key={m.id}>
                            <TableCell className="font-medium">{m.name}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">{m.email}</TableCell>
                            <TableCell className="text-right">{m.activeDeals}</TableCell>
                            <TableCell className="text-right">{fmtCurrency(m.totalQuotationValue)}</TableCell>
                            <TableCell className="text-right">{fmtCurrency(m.totalPOValue)}</TableCell>
                            <TableCell className="text-right">{fmtCurrency(m.totalInvoiceValue)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

// ── TeamPage ──────────────────────────────────────────────────────────────────

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

  const loadData = async () => {
    if (!crmUser) return;
    setLoading(true);
    try {
      const users = await fetchTeamUsers(crmUser.id, crmUser.role);
      setTeamUsers(users);
      // Count non-admin users only
      const nonAdminUsers = users.filter((u) => u.role !== "administrator");
      const totalUsers =
        crmUser.role === "general_manager" || crmUser.role === "administrator"
          ? nonAdminUsers.length  // admin itself isn't counted
          : nonAdminUsers.length;
      setUserCount(totalUsers);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load team data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [crmUser]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !role || !department || !password) {
      toast.error("Please fill all fields");
      return;
    }
    if (!isPasswordValid || !passwordsMatch) {
      toast.error("Invalid password or passwords do not match");
      return;
    }

    setSubmitting(true);
    try {
      let finalManagerId: string | null = null;
      if (crmUser.role === "administrator") {
        if (role === "sub_manager" || role === "sales") {
          finalManagerId = managerId || null;
        }
      } else {
        finalManagerId = role === "general_manager" || role === "administrator" ? null : crmUser!.id;
      }

      await createUser(email, password, name, role, department.trim().toLowerCase(), finalManagerId, designation, companyName);
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
      await loadData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to add team member");
    } finally {
      setSubmitting(false);
    }
  };

  const pageTitle = crmUser?.role === "administrator" ? "Users" : "Team Management";
  const addButtonLabel = crmUser?.role === "administrator" ? "Add User" : "Add Team Member";
  const addDialogTitle = crmUser?.role === "administrator" ? "Add User" : "Add Team Member";
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
      await loadData();
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
    await loadData();
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

  if (!crmUser) return null;
  if (loading) return <div className="page-container flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="page-container space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="section-title">{pageTitle}</h2>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              {addButtonLabel}
            </Button>
          </DialogTrigger>
          <DialogContent className="w-full max-w-md max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{addDialogTitle}</DialogTitle>
              <DialogDescription>{addDialogDescription}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddMember} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
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
                    className="pr-10"
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
                    className={`pr-10 ${
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
                <Select value={role} onValueChange={(val) => setRole(val as UserRole)}>
                  <SelectTrigger id="role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sales">Salesperson</SelectItem>
                    <SelectItem value="sub_manager">Manager</SelectItem>
                    {(crmUser.role === "general_manager" || crmUser.role === "administrator") && <SelectItem value="general_manager">General Manager</SelectItem>}
                    {crmUser.role === "administrator" && <SelectItem value="administrator">Admin</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">Department *</Label>
                <Input id="department" value={department} onChange={(e) => setDepartment(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="designation">Designation</Label>
                <Input id="designation" value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="e.g. Senior Executive" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name</Label>
                <Input id="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="e.g. Acme Corp" />
              </div>
              <Button type="submit" className="w-full" disabled={submitting || !isPasswordValid || !passwordsMatch}>Add Member</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input type="search" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="max-w-md" />
        {crmUser.role !== "administrator" && (
          <Button variant="outline" size="sm" onClick={handleExportPerformance} disabled={exportingCSV}>
            <Download className="w-4 h-4 mr-2" /> Export Performance
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Designation</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Assigned With</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((user) => {
              // Find the manager/GM this user is assigned to
              const assignedTo = user.managerId
                ? teamUsers.find((u) => u.id === user.managerId)
                : null;
              return (
                <TableRow key={user.id} className={user.disabled ? "opacity-60 bg-muted/10" : ""}>
                  <TableCell className="font-medium">
                    {user.role === "sales" && crmUser.role !== "administrator" ? (
                      <button onClick={() => setSelectedSalesperson(user)} className="text-primary hover:underline font-semibold">{user.name}</button>
                    ) : user.name}
                    {user.disabled && (
                      <Badge variant="outline" className="ml-2 text-[10px] py-0 px-1.5 h-5 bg-destructive/10 text-destructive border-destructive/20">Disabled</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{user.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`border-0 ${roleBadge[user.role]}`}>{roleLabel[user.role]}</Badge>
                  </TableCell>
                  <TableCell className="capitalize text-sm">{user.department || "—"}</TableCell>
                  <TableCell className="text-sm">{user.designation || "—"}</TableCell>
                  <TableCell className="text-sm">{user.companyName || "—"}</TableCell>
                  <TableCell className="text-sm">
                    {assignedTo ? (
                      <span className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold inline-flex items-center justify-center shrink-0">
                          {assignedTo.name.charAt(0).toUpperCase()}
                        </span>
                        <span className="text-foreground font-medium">{assignedTo.name}</span>
                        <span className="text-muted-foreground text-xs">({roleLabel[assignedTo.role]})</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs italic">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="action-btn" onClick={() => openEditUser(user)} disabled={user.disabled} title={user.disabled ? "Cannot edit disabled user" : "Edit"}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={user.disabled ? "text-success hover:bg-success/10 hover:text-success" : "text-amber-500 hover:bg-amber-500/10 hover:text-amber-500"}
                        onClick={() => handleToggleStatus(user)}
                        title={user.disabled ? "Enable User" : "Disable User"}
                      >
                        {user.disabled ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {filteredUsers.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No team members found</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit User Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Team Member</DialogTitle>
            <DialogDescription>
              Update user role and profile details.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditUser} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Full Name *</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input id="edit-email" value={email} disabled />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-role">Role *</Label>
              <Select value={role} onValueChange={(val) => { setRole(val as UserRole); setManagerId(null); }}>
                <SelectTrigger id="edit-role">
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
                  <SelectTrigger id="edit-gm-select">
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
                  <SelectTrigger id="edit-manager-select">
                    <SelectValue placeholder="Select Manager" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned / None</SelectItem>
                    {teamUsers.filter((u) => u.role === "sub_manager").map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="edit-department">Department *</Label>
              <Input
                id="edit-department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-designation">Designation</Label>
              <Input
                id="edit-designation"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="e.g. Senior Executive"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-companyName">Company Name</Label>
              <Input
                id="edit-companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Acme Corp"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={submitting}>
                {submitting ? "Saving..." : "Save"}
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
