import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  updateSalesFunnelDoc,
  updateSalesFunnelStatus,
  subscribeToSalesFunnel,
  subscribeToAllUsers,
  fetchQuotationById,
} from "@/lib/firestore-service";
import { SalesFunnel, SalesFunnelStatus, SALES_FUNNEL_STATUS_LABELS, CRMUser, Quotation } from "@/types/crm";
import StageBadge from "@/components/StageBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, Edit, Lock, Unlock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

const SalesFunnelPage: React.FC = () => {
  const { crmUser } = useAuth();
  const [funnels, setFunnels] = useState<SalesFunnel[]>([]);
  const [users, setUsers] = useState<CRMUser[]>([]);
  const [quotationDetails, setQuotationDetails] = useState<Record<string, Quotation | null>>({});
  const [loadingData, setLoadingData] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editFunnel, setEditFunnel] = useState<SalesFunnel | null>(null);
  const [poValueStr, setPoValueStr] = useState("");
  const [invoiceValueStr, setInvoiceValueStr] = useState("");
  const [completedPaymentStr, setCompletedPaymentStr] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<"Pending" | "Partial" | "Completed">("Pending");
  const [validationError, setValidationError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editFunnel) {
      setPoValueStr(editFunnel.poValue ? String(Math.round(editFunnel.poValue)) : "");
      setInvoiceValueStr(editFunnel.invoiceValue ? String(Math.round(editFunnel.invoiceValue)) : "");
      setPaymentStatus(editFunnel.paymentStatus || "Pending");
      setCompletedPaymentStr(() => {
        const invoice = editFunnel.invoiceValue || 0;
        const pending = editFunnel.pendingPayment ?? invoice;
        if (editFunnel.paymentStatus === "Completed") {
          return invoice ? String(Math.round(invoice)) : "";
        }
        if (editFunnel.paymentStatus === "Partial") {
          return String(Math.round(Math.max(0, invoice - pending)));
        }
        return "0";
      });
      setValidationError("");
    } else {
      setPoValueStr("");
      setInvoiceValueStr("");
      setCompletedPaymentStr("");
      setValidationError("");
    }
  }, [editFunnel?.id]);

  useEffect(() => {
    if (!editFunnel) {
      setValidationError("");
      return;
    }

    // Remarks are mandatory for sales funnel entries
    if (!editFunnel.remarks || !editFunnel.remarks.trim()) {
      setValidationError("Remarks are required");
      return;
    }

    const parsedPo = Math.round(parseFloat(poValueStr) || 0);
    const parsedInv = Math.round(parseFloat(invoiceValueStr) || 0);
    const parsedCompletedPayment = Math.round(parseFloat(completedPaymentStr) || 0);
    const quotationValue = Math.round(editFunnel.quotationValue);
    const requiresClosingFields = ["Cold", "Warm", "Hot", "Won"].includes(editFunnel.status);

    if (editFunnel.status === "Won") {
      if (parsedPo > quotationValue) {
        setValidationError(`PO Value ($${parsedPo.toLocaleString()}) cannot exceed Quotation Value ($${quotationValue.toLocaleString()})`);
        return;
      }

      const hasInvoiceInput = editFunnel.deliveryStatus === "Partial Delivery" || editFunnel.deliveryStatus === "Delivered";
      if (hasInvoiceInput && parsedInv > parsedPo) {
        setValidationError(`Invoice Value ($${parsedInv.toLocaleString()}) cannot exceed PO Value ($${parsedPo.toLocaleString()})`);
        return;
      }

      if (hasInvoiceInput) {
        if (paymentStatus === "Pending" && parsedCompletedPayment !== 0) {
          setValidationError("Completed payment must be 0 when status is Pending");
          return;
        }
        // No strict client-side check when marking as Completed; server will enforce pendingPayment consistency.
        if (paymentStatus === "Partial" && (parsedCompletedPayment <= 0 || parsedCompletedPayment >= parsedInv)) {
          setValidationError("Completed payment must be greater than 0 and less than invoice value when status is Partial");
          return;
        }
      }

      if (parsedPo === 0) {
        setValidationError("PO Value should be greater than 0 for Won deals");
        return;
      }
    }

    const requiresFollowUpDate = !["Closed", "Cancelled", "Lost"].includes(editFunnel.status) && paymentStatus === "Pending";
    if (requiresFollowUpDate && !editFunnel.followUpDate) {
      setValidationError("Follow-up date is required");
      return;
    }

      if (requiresClosingFields) {
      if (!editFunnel.closingMonth || !editFunnel.closingYear) {
        setValidationError("Closing Month and Closing Year are required for Cold, Warm, Hot or Won deals");
        return;
      }

      if (!/^\d{4}$/.test(editFunnel.closingYear)) {
        setValidationError("Closing Year must be a valid 4-digit year");
        return;
      }
    }

    setValidationError("");
  }, [poValueStr, invoiceValueStr, completedPaymentStr, paymentStatus, editFunnel?.status, editFunnel?.deliveryStatus, editFunnel?.followUpDate, editFunnel?.closingMonth, editFunnel?.closingYear, editFunnel?.quotationValue, editFunnel?.remarks]);

  useEffect(() => {
    if (!crmUser) return;
    setLoadingData(true);

    const unsubFunnels = subscribeToSalesFunnel(crmUser.id, crmUser.role, async (fs) => {
      setFunnels(fs);

      const uniqueQuotationIds = [...new Set(fs.map((f) => f.quotationId).filter(Boolean))];
      if (uniqueQuotationIds.length === 0) {
        setQuotationDetails({});
        setLoadingData(false);
        return;
      }

      try {
        const resolved = await Promise.all(
          uniqueQuotationIds.map(async (quotationId) => {
            try {
              return [quotationId, await fetchQuotationById(quotationId)] as const;
            } catch {
              return [quotationId, null] as const;
            }
          })
        );

        setQuotationDetails(Object.fromEntries(resolved));
      } catch {
        setQuotationDetails({});
      } finally {
        setLoadingData(false);
      }
    });

    const unsubUsers = subscribeToAllUsers((allUsers) => {
      setUsers(allUsers);
    });

    return () => {
      unsubFunnels();
      unsubUsers();
    };
  }, [crmUser]);

  if (!crmUser) return null;

  const isManager = crmUser.role === "sub_manager" || crmUser.role === "general_manager";
  const isSalesperson = crmUser.role === "sales";

  // Salespersons and managers should only see funnels created by themselves.
  const visibleFunnels = (isSalesperson || isManager)
    ? funnels.filter((f) => f.salesPersonId === crmUser.id)
    : funnels;

  const filtered = visibleFunnels.filter((f) => {
    if (statusFilter !== "all" && f.status !== statusFilter) return false;
    if (searchQuery) {
      const s = searchQuery.toLowerCase();
      const quotation = quotationDetails[f.quotationId] || null;
      const items = quotation?.products
        ?.map((product) => product.name.toLowerCase())
        .join(" ") || "";
      return (
        f.quotationNumber.toLowerCase().includes(s) ||
        f.companyName.toLowerCase().includes(s) ||
        f.subject.toLowerCase().includes(s) ||
        (quotation?.customerName || "").toLowerCase().includes(s) ||
        items.includes(s)
      );
    }
    return true;
  });

  const handleToggleStatus = async (id: string, currentDisabled: boolean) => {
    const newStatus = !currentDisabled;
    const actionText = newStatus ? "disable" : "enable";
    if (!confirm(`Are you sure you want to ${actionText} this sales funnel entry?`)) return;
    try {
      await updateSalesFunnelStatus(id, newStatus);
      toast.success(`Sales funnel entry ${newStatus ? "disabled" : "enabled"} successfully`);
    } catch (e) {
      console.error(e);
      toast.error(`Failed to ${actionText} sales funnel entry`);
    }
  };

  const saveUpdate = async () => {
    if (!editFunnel) return;

    const requiresFollowUpDate = !["Closed", "Cancelled", "Lost"].includes(editFunnel.status) && paymentStatus === "Pending";
    const requiresClosingFields = ["Cold", "Warm", "Hot"].includes(editFunnel.status);

    if (requiresFollowUpDate && !editFunnel.followUpDate) {
      setValidationError("Follow-up date is required");
      return;
    }

    if (requiresClosingFields) {
      if (!editFunnel.closingMonth || !editFunnel.closingYear) {
        setValidationError("Closing Month and Closing Year are required for Cold, Warm, Hot or Won deals");
        return;
      }

      if (!/^\d{4}$/.test(editFunnel.closingYear)) {
        setValidationError("Closing Year must be a valid 4-digit year");
        return;
      }
    }

    // Parse and round to integers
    const parsedPo = Math.round(parseFloat(poValueStr) || 0);
    const parsedInv = Math.round(parseFloat(invoiceValueStr) || 0);
    const parsedCompletedPayment = Math.round(parseFloat(completedPaymentStr) || 0);
    const quotationValue = Math.round(editFunnel.quotationValue);

    // Validation: Invoice <= PO <= Quotation
    if (parsedPo > quotationValue) {
      setValidationError(`PO Value ($${parsedPo.toLocaleString()}) cannot exceed Quotation Value ($${quotationValue.toLocaleString()})`);
      return;
    }

    if (parsedInv > parsedPo) {
      setValidationError(`Invoice Value ($${parsedInv.toLocaleString()}) cannot exceed PO Value ($${parsedPo.toLocaleString()})`);
      return;
    }

    if (paymentStatus === "Pending" && parsedCompletedPayment !== 0) {
      setValidationError("Completed payment must be 0 when status is Pending");
      return;
    }
    // Allow marking as Completed without requiring entered completed payment amount on the client.
    if (paymentStatus === "Partial" && (parsedCompletedPayment <= 0 || parsedCompletedPayment >= parsedInv)) {
      setValidationError("Completed payment must be greater than 0 and less than invoice value when status is Partial");
      return;
    }

    // Warn but allow if values seem off (in case of intentional adjustments)
    if (editFunnel.status === "Won" && parsedPo === 0) {
      setValidationError("PO Value should be greater than 0 for Won deals");
      return;
    }

    setSaving(true);
    try {
      await updateSalesFunnelDoc(editFunnel.id, {
        status: editFunnel.status,
        poValue: parsedPo,
        deliveryStatus: editFunnel.deliveryStatus,
        invoiceValue: parsedInv,
        pendingPayment: paymentStatus === "Completed"
          ? 0
          : paymentStatus === "Pending"
            ? parsedInv
            : Math.max(0, parsedInv - parsedCompletedPayment),
        paymentStatus,
        followUpDate: requiresFollowUpDate ? editFunnel.followUpDate : null,
          closingMonth: requiresClosingFields ? editFunnel.closingMonth : null,
          closingYear: requiresClosingFields ? editFunnel.closingYear : null,
          wonMonth: editFunnel.wonMonth ?? null,
        remarks: editFunnel.remarks ?? "",
      });
      toast.success("Sales funnel updated successfully!");
      setEditFunnel(null);
    } catch (e) {
      console.error(e);
      toast.error("Failed to update sales funnel");
    } finally {
      setSaving(false);
    }
  };

  if (loadingData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const showSalespersonCol = crmUser.role === "sub_manager" || crmUser.role === "general_manager";
  const closingMonthOptions = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const getClosingMonthYear = (funnel: SalesFunnel) => {
    if (!funnel.closingMonth && !funnel.closingYear) return "—";
    if (!funnel.closingMonth) return funnel.closingYear || "—";
    if (!funnel.closingYear) return funnel.closingMonth;
    return `${funnel.closingMonth} / ${funnel.closingYear}`;
  };

  const getWonMonthYear = (funnel: SalesFunnel) => {
    if (!funnel.wonMonth) return "—";
    return funnel.wonMonth;
  };

  return (
    <div className="page-container space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="section-title">Sales Funnel</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 w-48" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {Object.entries(SALES_FUNNEL_STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="stat-card p-0 overflow-x-auto">
        <div className="min-w-[1350px]">
          <Table className="min-w-[1350px]">
            <TableHeader>
              <TableRow>
                <TableHead>Sent Date</TableHead>
                <TableHead>Quotation No.</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Customer</TableHead>
                {showSalespersonCol && <TableHead>Salesperson</TableHead>}
                <TableHead className="text-right">Quotation Value</TableHead>
                <TableHead>Follow-Up Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Closing Month/Year</TableHead>
                <TableHead>Won Month</TableHead>
                <TableHead className="text-right">PO Value</TableHead>
                <TableHead>Delivery Status</TableHead>
                <TableHead className="text-right">Invoice Value</TableHead>
                <TableHead className="text-right">Payment</TableHead>
                <TableHead>Remarks</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((funnel) => {
                const isFunnelDisabled = !!funnel.disabled;
                const quotation = quotationDetails[funnel.quotationId] || null;
                return (
                  <TableRow key={funnel.id} className={isFunnelDisabled ? "opacity-60 bg-muted/10" : ""}>
                    <TableCell className="text-sm">{new Date(funnel.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="font-mono text-xs">
                      <div className="flex items-center gap-2">
                        {funnel.quotationNumber}
                        {isFunnelDisabled && (
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-5 bg-destructive/10 text-destructive border-destructive/20 font-semibold">
                            Disabled
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{funnel.companyName}</TableCell>
                    <TableCell className="text-sm">{quotation?.customerName || "—"}</TableCell>
                    {showSalespersonCol && (
                      <TableCell className="text-sm font-medium">
                        {users.find((u) => u.id === funnel.salesPersonId)?.name || funnel.salesPersonId || "—"}
                      </TableCell>
                    )}
                    <TableCell className="text-right font-medium">${funnel.quotationValue.toLocaleString()}</TableCell>
                    <TableCell className="text-sm">{funnel.followUpDate ? new Date(funnel.followUpDate).toLocaleDateString() : "—"}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        funnel.status === "Hot" ? "bg-red-100 text-red-800" :
                        funnel.status === "Warm" ? "bg-orange-100 text-orange-800" :
                        funnel.status === "Cold" ? "bg-gray-100 text-gray-800" :
                        funnel.status === "Won" ? "bg-green-100 text-green-800" :
                        funnel.status === "Lost" ? "bg-red-100 text-red-800" :
                        funnel.status === "Closed" ? "bg-blue-100 text-blue-800" :
                        "bg-purple-100 text-purple-800"
                      }`}>
                        {funnel.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{getClosingMonthYear(funnel)}</TableCell>
                    <TableCell className="text-sm">{getWonMonthYear(funnel)}</TableCell>
                    <TableCell className="text-right text-sm">{funnel.poValue > 0 ? `$${funnel.poValue.toLocaleString()}` : "—"}</TableCell>
                    <TableCell className="text-sm">{funnel.deliveryStatus}</TableCell>
                    <TableCell className="text-right text-sm">{funnel.invoiceValue > 0 ? `$${funnel.invoiceValue.toLocaleString()}` : "—"}</TableCell>
                    <TableCell className="text-right text-sm">
                      {funnel.invoiceValue > 0 ? (
                        funnel.paymentStatus === "Partial" ?
                          `Partial ($${(funnel.invoiceValue - funnel.pendingPayment).toLocaleString()} paid)` :
                        funnel.paymentStatus === "Completed" ?
                          "Completed" :
                          `Pending ($${funnel.pendingPayment.toLocaleString()} due)`
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-sm max-w-[260px] break-words">{funnel.remarks ? funnel.remarks : "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="action-btn"
                          onClick={() => setEditFunnel({ ...funnel })}
                          disabled={isFunnelDisabled}
                          title={isFunnelDisabled ? "Cannot edit disabled sales funnel entry" : "Edit"}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={isFunnelDisabled ? "text-success hover:bg-success/10 hover:text-success" : "text-amber-500 hover:bg-amber-500/10 hover:text-amber-500"}
                          onClick={() => handleToggleStatus(funnel.id, isFunnelDisabled)}
                          title={isFunnelDisabled ? "Enable Entry" : "Disable Entry"}
                        >
                          {isFunnelDisabled ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </motion.div>

      {/* Edit Dialog */}
      <Dialog open={!!editFunnel} onOpenChange={() => setEditFunnel(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Update Sales Funnel</DialogTitle>
          </DialogHeader>
          {editFunnel && (
            <div className="space-y-4">
              {/* Display Quotation Value for reference */}
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-xs text-muted-foreground">Quotation Value (Reference)</p>
                <p className="text-lg font-bold text-foreground">${Math.round(editFunnel.quotationValue).toLocaleString()}</p>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editFunnel.status}
                  onValueChange={(v) => {
                    const nextStatus = v as SalesFunnelStatus;
                    const shouldClearFollowUp = ["Closed", "Cancelled", "Lost"].includes(nextStatus);
                    const now = new Date();
                    const defaultMonth = now.toLocaleString(undefined, { month: "long" });
                    const defaultYear = String(now.getFullYear());
                    setEditFunnel({
                      ...editFunnel,
                      status: nextStatus,
                      followUpDate: shouldClearFollowUp ? null : editFunnel.followUpDate,
                      // If user switches to Won and closingMonth/year are empty, prefill them
                        closingMonth: nextStatus === "Won" && !editFunnel.closingMonth ? defaultMonth : editFunnel.closingMonth,
                        closingYear: nextStatus === "Won" && !editFunnel.closingYear ? defaultYear : editFunnel.closingYear,
                        // Also prefill wonMonth when moving to Won
                        wonMonth: nextStatus === "Won" && !editFunnel.wonMonth ? defaultMonth : editFunnel.wonMonth,
                    });
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(SALES_FUNNEL_STATUS_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {["Cold", "Warm", "Hot", "Won"].includes(editFunnel.status) && (
                <>
                  <div className="space-y-2">
                    <Label>Closing Month *</Label>
                    <Select
                      value={editFunnel.closingMonth || ""}
                      onValueChange={(v) => setEditFunnel({ ...editFunnel, closingMonth: v })}
                    >
                      <SelectTrigger><SelectValue placeholder="Select month" /></SelectTrigger>
                      <SelectContent>
                        {closingMonthOptions.map((month) => (
                          <SelectItem key={month} value={month}>{month}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Closing Year *</Label>
                    <Input
                      type="number"
                      value={editFunnel.closingYear || ""}
                      onChange={(e) => setEditFunnel({ ...editFunnel, closingYear: e.target.value })}
                      placeholder="2026"
                      min="1900"
                      max="2100"
                      className="rounded-xl"
                    />
                  </div>

                  {editFunnel.status === "Won" && (
                    <>
                      <div className="space-y-2">
                        <Label>Won Month *</Label>
                        <Select
                          value={editFunnel.wonMonth || ""}
                          onValueChange={(v) => setEditFunnel({ ...editFunnel, wonMonth: v })}
                        >
                          <SelectTrigger><SelectValue placeholder="Select month" /></SelectTrigger>
                          <SelectContent>
                            {closingMonthOptions.map((month) => (
                              <SelectItem key={month} value={month}>{month}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* wonYear removed - only wonMonth is tracked now */}
                    </>
                  )}
                </>
              )}

              {editFunnel.status === "Won" && (
                <>
                  <div className="space-y-2">
                    <Label className="flex items-center justify-between">
                      <span>PO Value (≤ ${Math.round(editFunnel.quotationValue).toLocaleString()})</span>
                      <span className="text-xs text-muted-foreground font-normal">Integer only</span>
                    </Label>
                    <Input 
                      type="number" 
                      value={poValueStr} 
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "" || /^\d+$/.test(val)) {
                          setPoValueStr(val);
                        } else {
                          const num = parseFloat(val);
                          if (!isNaN(num)) {
                            setPoValueStr(String(Math.round(num)));
                          }
                        }
                      }} 
                      placeholder="0"
                      min="0"
                      step="1"
                      className="rounded-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Delivery Status</Label>
                    <Select value={editFunnel.deliveryStatus} onValueChange={(v) => {
                      setEditFunnel({ ...editFunnel, deliveryStatus: v as "Pending" | "Partial Delivery" | "Delivered" });
                    }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="Partial Delivery">Partial Delivery</SelectItem>
                        <SelectItem value="Delivered">Delivered</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {(editFunnel.deliveryStatus === "Partial Delivery" || editFunnel.deliveryStatus === "Delivered") && (
                    <>
                      <div className="space-y-2">
                        <Label className="flex items-center justify-between">
                          <span>Invoice Value (≤ ${poValueStr || "0"})</span>
                          <span className="text-xs text-muted-foreground font-normal">Integer only</span>
                        </Label>
                        <Input 
                          type="number" 
                          value={invoiceValueStr} 
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "" || /^\d+$/.test(val)) {
                              setInvoiceValueStr(val);
                            } else {
                              const num = parseFloat(val);
                              if (!isNaN(num)) {
                                setInvoiceValueStr(String(Math.round(num)));
                              }
                            }
                          }} 
                          placeholder="0"
                          min="0"
                          step="1"
                          className="rounded-xl"
                        />
                      </div>

                    </>
                  )}
                </>
              )}

              {/* Validation Hierarchy Info */}
              {editFunnel.status === "Won" && (
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                  <p className="text-xs font-semibold text-blue-900 mb-2">Value Hierarchy:</p>
                  <div className="space-y-1 text-xs text-blue-800">
                    <p>✓ Quotation: ${Math.round(editFunnel.quotationValue).toLocaleString()}</p>
                    <p>↓ PO Value: {poValueStr ? `$${parseInt(poValueStr).toLocaleString()}` : "$0"} (max: ${Math.round(editFunnel.quotationValue).toLocaleString()})</p>
                    <p>↓ Invoice: {invoiceValueStr ? `$${parseInt(invoiceValueStr).toLocaleString()}` : "$0"} (max: {poValueStr ? `$${parseInt(poValueStr).toLocaleString()}` : "$0"})</p>
                  </div>
                </div>
              )}

              {/* Validation Error */}
              {validationError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex gap-2">
                  <span className="text-red-600 text-xs font-semibold flex-shrink-0">⚠</span>
                  <p className="text-xs text-red-800">{validationError}</p>
                </div>
              )}

              {!["Closed", "Cancelled", "Lost"].includes(editFunnel.status) && (
                <div className="space-y-2">
                  <Label>Follow-up Date *</Label>
                  <Input
                    type="date"
                    required
                    value={editFunnel.followUpDate || ""}
                    onChange={(e) => setEditFunnel({ ...editFunnel, followUpDate: e.target.value })}
                    className="rounded-xl"
                  />
                </div>
              )}
 
                <div className="space-y-2">
                  <Label>Payment Pending</Label>
                  <Select value={paymentStatus} onValueChange={(v) => {
                    const ps = v as "Pending" | "Partial" | "Completed";
                    setPaymentStatus(ps);
                    if (editFunnel) {
                      if (ps === "Partial" || ps === "Completed") {
                        setEditFunnel({ ...editFunnel, followUpDate: null });
                      }
                    }
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Partial">Partially Completed</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>

                  {paymentStatus === "Partial" ? (
                    <div className="space-y-2">
                      <Label className="flex items-center justify-between">
                        <span>Amount Paid</span>
                        <span className="text-xs text-muted-foreground font-normal">Amount received so far</span>
                      </Label>
                      <Input
                        type="number"
                        value={completedPaymentStr}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "" || /^\d+$/.test(val)) {
                            setCompletedPaymentStr(val);
                          } else {
                            const num = parseFloat(val);
                            if (!isNaN(num)) {
                              setCompletedPaymentStr(String(Math.round(num)));
                            }
                          }
                        }}
                        placeholder={invoiceValueStr || "0"}
                        min="0"
                        step="1"
                        className="rounded-xl"
                      />
                      <p className="text-xs text-muted-foreground">
                        Amount due: ${invoiceValueStr ? ` ${Math.max(0, Math.round(parseInt(invoiceValueStr || "0", 10) - parseInt(completedPaymentStr || "0", 10))).toLocaleString()}` : "0"}
                      </p>
                    </div>
                  ) : paymentStatus === "Pending" ? (
                    <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-900">
                      No payment has been completed yet.
                    </div>
                  ) : (
                    <div className="rounded-xl bg-green-50 border border-green-200 p-3 text-sm text-green-900">
                      Completed payment means pending payment is 0 and invoice is fully paid.
                    </div>
                  )}
                </div>

              <div className="space-y-2">
                <Label>Remarks *</Label>
                <Textarea
                  value={editFunnel.remarks || ""}
                  onChange={(e) => setEditFunnel({ ...editFunnel, remarks: e.target.value })}
                  placeholder="Enter remarks"
                  required
                  className="rounded-xl"
                />
              </div>

              <Button
                onClick={saveUpdate}
                className="w-full rounded-xl h-11 bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90 text-white font-medium"
                disabled={saving || ((!["Closed", "Cancelled", "Lost"].includes(editFunnel.status) && paymentStatus === "Pending" && !editFunnel.followUpDate) || !!validationError || !editFunnel.remarks || !editFunnel.remarks.trim())}
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SalesFunnelPage;