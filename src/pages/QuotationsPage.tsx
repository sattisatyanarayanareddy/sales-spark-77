import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchQuotations,
  updateQuotationDoc,
  updateQuotationStatus,
  exportToCSV,
  exportQuotationToPDF,
  createSalesFunnelDoc,
  updateSalesFunnelDoc,
  getSafePendingPayment,
  fetchSalesFunnelByQuotationId,
  requestQuotationApproval,
} from "@/lib/firestore-service";
import { getQuotationStatusForApprovalRequest } from "@/lib/quotation-status";
import { Quotation, QuotationStatus, STATUS_LABELS } from "@/types/crm";
import StageBadge from "@/components/StageBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, Plus, Download, Edit, Lock, Unlock, Eye, Loader2, ExternalLink, ImageOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { canCreateQuotation, canDeleteQuotation } from "@/lib/access-control";

const QuotationsPage: React.FC = () => {
  const { crmUser } = useAuth();
  const navigate = useNavigate();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editQuotation, setEditQuotation] = useState<Quotation | null>(null);
  const [editStatusDraft, setEditStatusDraft] = useState<QuotationStatus | null>(null);
  const [editStatusDirty, setEditStatusDirty] = useState(false);
  const [viewQuotation, setViewQuotation] = useState<Quotation | null>(null);
  const [saving, setSaving] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [emailDraftOpen, setEmailDraftOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailCc, setEmailCc] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const deliveryStatusOptions = ["Pending", "Partial Delivery", "Delivered"] as const;

  const loadData = async () => {
    if (!crmUser) return;
    setLoadingData(true);
    try {
      const qs = await fetchQuotations(crmUser.id, crmUser.role);
      setQuotations(qs);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load quotations");
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [crmUser]);

  useEffect(() => {
    if (!viewQuotation || !crmUser) {
      setEmailDraftOpen(false);
      return;
    }

    setEmailTo(viewQuotation.customerEmail || "");
    setEmailCc("");
    setEmailSubject(`Sales Quotation ${viewQuotation.quotationNumber} from ${crmUser.name}`);
    setEmailBody(`Dear ${viewQuotation.customerName},\n\nPlease find attached our quotation ${viewQuotation.quotationNumber} for ${viewQuotation.companyName}. We hope this proposal meets your requirements. If you have any questions or need any changes, please let us know.\n\nBest regards,\n${crmUser.name}${crmUser.designation ? `\n${crmUser.designation}` : ""}${crmUser.companyName ? `\n${crmUser.companyName}` : ""}`);
  }, [viewQuotation, crmUser]);

  if (!crmUser) return null;

  const editableStatusOptions: [QuotationStatus, string][] = crmUser.role === "sales"
    ? [
        ["Draft", "Draft"],
        ["Created", "Created"],
        ["Ask for Approve", "Ask for Approve"],
      ]
    : [
        ["Draft", "Draft"],
        ["Created", "Created"],
        ["Approved", "Approved"],
      ];


  // If quotation is already Approved by manager, allow salesperson to send it via email
  const canTransitionToSentMail = editQuotation?.status === "Approved";

  const filtered = quotations.filter((q) => {
    if (statusFilter !== "all" && q.status !== statusFilter) return false;
    if (searchQuery) {
      const s = searchQuery.toLowerCase();
      return (
        q.quotationNumber.toLowerCase().includes(s) ||
        q.customerName.toLowerCase().includes(s) ||
        q.companyName.toLowerCase().includes(s) ||
        q.subject.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const openEditQuotation = (quotation: Quotation) => {
    setEditQuotation({ ...quotation });
    setEditStatusDirty(false);
    setEditStatusDraft(quotation.status);
  };

  const isStatusChangeLocked = editQuotation?.status === "Ask for Approve";
  const selectedStatus = editStatusDirty && editStatusDraft ? editStatusDraft : editQuotation?.status;
  const canEditValues = selectedStatus === "Draft" || selectedStatus === "Created";

  const handleToggleStatus = async (id: string, currentDisabled: boolean) => {
    const newStatus = !currentDisabled;
    const actionText = newStatus ? "disable" : "enable";
    if (!confirm(`Are you sure you want to ${actionText} this quotation?`)) return;
    try {
      await updateQuotationStatus(id, newStatus);
      toast.success(`Quotation ${newStatus ? "disabled" : "enabled"} successfully`);
      loadData();
    } catch (e) {
      console.error(e);
      toast.error(`Failed to ${actionText} quotation`);
    }
  };

  const saveUpdate = async () => {
    if (!editQuotation) return;
    setSaving(true);
    try {
      const original = quotations.find((q) => q.id === editQuotation.id);
      const statusToSave = editStatusDirty && editStatusDraft ? editStatusDraft : editQuotation.status;
      const isSalesperson = crmUser.role === "sales";
      const requestApproval = isSalesperson && statusToSave === "Ask for Approve" && original?.status !== "Ask for Approve";

      if (requestApproval) {
        await updateQuotationDoc(editQuotation.id, {
          status: statusToSave,
          poNumber: editQuotation.poNumber,
          poValue: editQuotation.poValue,
          invoiceValue: editQuotation.invoiceValue,
          followUpDate: editQuotation.followUpDate,
          followUpNotes: editQuotation.followUpNotes,
          deliveryStatus: editQuotation.deliveryStatus,
        });

        await requestQuotationApproval({
          ...editQuotation,
          status: statusToSave,
        });
        toast.success("Quotation submitted for manager approval");
      } else {
        await updateQuotationDoc(editQuotation.id, {
          status: statusToSave,
          totalValue: editQuotation.totalValue,
          poNumber: editQuotation.poNumber,
          poValue: editQuotation.poValue,
          invoiceValue: editQuotation.invoiceValue,
          followUpDate: editQuotation.followUpDate,
          followUpNotes: editQuotation.followUpNotes,
          deliveryStatus: editQuotation.deliveryStatus,
        });

        if (statusToSave === "Approved") {
          const existingFunnel = await fetchSalesFunnelByQuotationId(editQuotation.id);
          const safePendingPayment = getSafePendingPayment(
            editQuotation.paymentStatus ?? "Pending",
            editQuotation.invoiceValue || 0,
            editQuotation.pendingPayment ?? 0
          );

          if (!existingFunnel) {
            await createSalesFunnelDoc({
              quotationId: editQuotation.id,
              quotationNumber: editQuotation.quotationNumber,
              companyName: editQuotation.companyName,
              subject: editQuotation.subject,
              quotationValue: editQuotation.totalValue,
              followUpDate: editQuotation.followUpDate,
              remarks: editQuotation.followUpNotes || "",
              status: "Cold",
              poValue: editQuotation.poValue || 0,
              deliveryStatus: editQuotation.deliveryStatus || "Pending",
              invoiceValue: editQuotation.invoiceValue || 0,
              pendingPayment: safePendingPayment,
              paymentStatus: editQuotation.paymentStatus ?? "Pending",
              closingMonth: null,
              closingYear: null,
              closingDate: null,
              salesPersonId: editQuotation.salesPersonId,
            });
          } else {
            await updateSalesFunnelDoc(existingFunnel.id, {
              companyName: editQuotation.companyName,
              subject: editQuotation.subject,
              quotationValue: editQuotation.totalValue,
              followUpDate: editQuotation.followUpDate,
              remarks: editQuotation.followUpNotes || "",
              poValue: editQuotation.poValue || 0,
              deliveryStatus: editQuotation.deliveryStatus || "Pending",
              invoiceValue: editQuotation.invoiceValue || 0,
              pendingPayment: safePendingPayment,
              paymentStatus: editQuotation.paymentStatus ?? "Pending",
            });
          }
        }

        toast.success("Quotation updated");
      }

      setEditQuotation(null);
      setEditStatusDraft(null);
      setEditStatusDirty(false);
      loadData();
    } catch (e: any) {
      toast.error(e.message || "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    const csv = exportToCSV(filtered);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "quotations.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSendEmail = async () => {
    if (!viewQuotation) return;
    if (!emailTo.trim()) {
      toast.error("Please enter a recipient email address.");
      return;
    }

    setSendingEmail(true);
    try {
      await updateQuotationDoc(viewQuotation.id, { status: "Sent Mail" });
      setViewQuotation({ ...viewQuotation, status: "Sent Mail" });
      toast.success("Quotation marked as Sent Mail. Your email draft is opening.");

      const mailto = `mailto:${encodeURIComponent(emailTo)}?cc=${encodeURIComponent(emailCc)}&subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
      window.location.href = mailto;
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to prepare email draft");
    } finally {
      setSendingEmail(false);
    }
  };

  const canDownloadPDF = viewQuotation?.status === "Approved" || viewQuotation?.status === "Sent Mail";

  const handleDownloadPDF = async () => {
    if (!viewQuotation || !canDownloadPDF) return;
    setDownloadingPDF(true);
    try {
      await exportQuotationToPDF(viewQuotation);
      toast.success("PDF downloaded successfully");
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate PDF");
    } finally {
      setDownloadingPDF(false);
    }
  };

  const formatCurrency = (v: number) => `$${v.toLocaleString()}`;

  if (loadingData) {
    return (
      <div className="page-container flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="page-container space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="section-title">Quotations</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {filtered.length} quotation{filtered.length !== 1 ? "s" : ""}{statusFilter !== "all" ? ` · ${statusFilter}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search quotations…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-52 h-9 rounded-xl bg-card/80 border-border/50 text-sm"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36 h-9 rounded-xl text-sm">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {editableStatusOptions.map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleExport} className="h-9 rounded-xl gap-1.5 text-sm">
              <Download className="w-3.5 h-3.5" /> Export
            </Button>
            {canCreateQuotation(crmUser.role) && (
              <Button size="sm" onClick={() => navigate("/quotations/new")} className="h-9 rounded-xl gap-1.5 btn-gradient text-sm">
                <Plus className="w-3.5 h-3.5" /> New Quotation
              </Button>
            )}
          </div>
        </div>

      {/* ── Quotations Table ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
        className="dashboard-panel overflow-hidden p-0"
      >
        <div className="overflow-x-auto">
          <Table className="enhanced-table">
            <TableHeader>
              <TableRow className="border-b border-border/60">
                <TableHead className="pl-6 py-3.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quotation No</TableHead>
                <TableHead className="py-3.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Customer</TableHead>
                <TableHead className="py-3.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Subject</TableHead>
                <TableHead className="py-3.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground text-right">Value</TableHead>
                <TableHead className="py-3.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</TableHead>
                <TableHead className="pr-6 py-3.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Search className="w-8 h-8 opacity-30" />
                      <p className="font-medium text-sm">No quotations found</p>
                      <p className="text-xs">Try adjusting your search or filter</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((q) => {
                  const isQuotationDisabled = !!q.disabled;
                  return (
                    <TableRow
                      key={q.id}
                      className={`border-b border-border/30 transition-colors duration-150 ${isQuotationDisabled ? "opacity-50" : ""}`}
                    >
                      <TableCell className="pl-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-foreground/80 bg-muted/60 px-2 py-0.5 rounded-md">
                            {q.quotationNumber}
                          </span>
                          {isQuotationDisabled && (
                            <Badge variant="outline" className="text-[9px] py-0 px-1.5 h-4 bg-destructive/10 text-destructive border-destructive/20 font-semibold">
                              Disabled
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <p className="font-semibold text-sm text-foreground">{q.customerName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{q.companyName}</p>
                      </TableCell>
                      <TableCell className="py-4 max-w-[200px]">
                        <p className="text-sm text-foreground/80 truncate">{q.subject}</p>
                      </TableCell>
                      <TableCell className="py-4 text-right">
                        <span className="font-bold text-sm text-foreground">
                          {isQuotationDisabled ? "—" : formatCurrency(q.totalValue)}
                        </span>
                      </TableCell>
                      <TableCell className="py-4"><StageBadge stage={q.status} /></TableCell>
                      <TableCell className="pr-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost" size="icon"
                            className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors"
                            onClick={() => setViewQuotation(q)}
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            className="h-8 w-8 rounded-lg hover:bg-amber-500/10 hover:text-amber-600 transition-colors"
                            onClick={() => {
                              // Route to email sending page for Approved quotations
                              if (q.status === "Approved") {
                                navigate(`/quotations/send-email/${q.id}`);
                              } else {
                                navigate(`/quotations/edit/${q.id}`);
                              }
                            }}
                            disabled={isQuotationDisabled || q.status === "Ask for Approve" || q.status === "Sent Mail"}
                            title={isQuotationDisabled ? "Cannot edit disabled quotation" : (q.status === "Ask for Approve" || q.status === "Sent Mail") ? "Cannot edit quotation in its current status" : (q.status === "Approved" ? "Send email" : "Edit")}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            className={`h-8 w-8 rounded-lg transition-colors ${isQuotationDisabled ? "hover:bg-emerald-500/10 hover:text-emerald-600 text-emerald-500" : "hover:bg-orange-500/10 hover:text-orange-600 text-orange-500"}`}
                            onClick={() => handleToggleStatus(q.id, isQuotationDisabled)}
                            title={isQuotationDisabled ? "Enable Quotation" : "Disable Quotation"}
                          >
                            {isQuotationDisabled ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </motion.div>

      {/* View Detail Dialog */}
      <Dialog open={!!viewQuotation} onOpenChange={() => setViewQuotation(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{viewQuotation?.quotationNumber}</DialogTitle>
          </DialogHeader>
          {viewQuotation && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Customer:</span> <span className="font-medium">{viewQuotation.customerName}</span></div>
                <div><span className="text-muted-foreground">Company:</span> <span className="font-medium">{viewQuotation.companyName}</span></div>
                <div><span className="text-muted-foreground">Email:</span> {viewQuotation.customerEmail}</div>
                <div><span className="text-muted-foreground">Phone:</span> {viewQuotation.customerPhone}</div>
                <div><span className="text-muted-foreground">Subject:</span> {viewQuotation.subject}</div>
                <div><span className="text-muted-foreground">Status:</span> <StageBadge stage={viewQuotation.status} /></div>
                <div><span className="text-muted-foreground">PO Number:</span> {viewQuotation.poNumber || "—"}</div>
                <div><span className="text-muted-foreground">Invoice:</span> {viewQuotation.invoiceValue ? formatCurrency(viewQuotation.invoiceValue) : "—"}</div>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Products</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Image</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Part No</TableHead>
                      <TableHead>Image URL</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewQuotation.products.map((p, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <div className="w-20 h-20 rounded-md border border-border bg-muted/40 overflow-hidden flex items-center justify-center">
                            {p.imageUrl ? (
                              <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="flex flex-col items-center justify-center text-muted-foreground">
                                <ImageOff className="w-4 h-4" />
                                <span className="text-[10px] mt-1">No image</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.description}</p>
                        </TableCell>
                        <TableCell className="text-sm">{p.modelNumber}</TableCell>
                        <TableCell className="text-sm">{p.partNumber}</TableCell>
                        <TableCell className="max-w-[220px]">
                          {p.imageUrl ? (
                            <a
                              href={p.imageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline text-xs break-all"
                            >
                              Open URL <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {viewQuotation.disabled ? "—" : formatCurrency(p.value)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="text-right font-bold mt-2">
                  Total: {viewQuotation.disabled ? "—" : formatCurrency(viewQuotation.totalValue)}
                </p>
              </div>
              {(viewQuotation.status === "Approved" || viewQuotation.status === "Sent Mail") && (
                <div className="rounded-2xl border border-border/70 bg-card p-4 mb-4">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">Send email with quotation PDF</p>
                        <p className="text-xs text-muted-foreground">Use the default template below, then open your mail client to attach the PDF.</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEmailDraftOpen((prev) => !prev)}
                      >
                        {emailDraftOpen ? "Hide draft" : viewQuotation.status === "Sent Mail" ? "Review draft" : "Open draft"}
                      </Button>
                    </div>

                    {emailDraftOpen && (
                      <div className="space-y-3">
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>To</Label>
                            <Input value={emailTo} onChange={(e) => setEmailTo(e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label>CC</Label>
                            <Input value={emailCc} onChange={(e) => setEmailCc(e.target.value)} placeholder="sales@example.com, manager@example.com" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Subject</Label>
                          <Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>Message</Label>
                          <Textarea value={emailBody} onChange={(e) => setEmailBody(e.target.value)} rows={8} />
                        </div>
                        <div className="flex flex-col gap-2 md:flex-row">
                          <Button
                            onClick={handleSendEmail}
                            className="flex-1"
                            disabled={sendingEmail}
                          >
                            {sendingEmail ? "Preparing mail..." : "Send Email Draft"}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={handleDownloadPDF}
                            disabled={downloadingPDF}
                            className="flex-1"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            {downloadingPDF ? "Generating PDF..." : "Download PDF"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="flex gap-2 pt-4 border-t">
                {canDownloadPDF && !emailDraftOpen && (
                  <Button
                    onClick={handleDownloadPDF}
                    className="flex-1"
                    disabled={downloadingPDF}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {downloadingPDF ? "Generating PDF..." : "Download PDF"}
                  </Button>
                )}
                <Button variant="outline" onClick={() => setViewQuotation(null)} className="flex-1">
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editQuotation} onOpenChange={() => {
        setEditQuotation(null);
        setEditStatusDraft(null);
        setEditStatusDirty(false);
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Update Quotation</DialogTitle>
          </DialogHeader>
          {editQuotation && (
            <div className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={editStatusDraft ?? editQuotation.status}
                    disabled={isStatusChangeLocked}
                    onValueChange={(value) => {
                      if (isStatusChangeLocked) return;
                      setEditStatusDraft(value as QuotationStatus);
                      setEditStatusDirty(true);
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {canTransitionToSentMail ? (
                        // Manager approved → only allow sending email via SendEmailPage, not in this dialog
                        <>
                          <SelectItem value="Sent Mail" disabled>Sent Mail (use Send Email button)</SelectItem>
                        </>
                      ) : (
                        // Draft/Created/Ask for Approve workflow
                        editableStatusOptions.map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {isStatusChangeLocked && (
                    <p className="text-xs text-muted-foreground">
                      Status cannot be changed while the quotation is in Ask for Approve.
                    </p>
                  )}
                  {!canEditValues && !canTransitionToSentMail && (
                    <p className="text-xs text-muted-foreground">
                      Quotation values can only be changed when status is Draft or Created.
                    </p>
                  )}
                  {canTransitionToSentMail && (
                    <p className="text-xs text-muted-foreground">
                      Manager has approved this quotation. You can now send it via email.
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {editQuotation.poNumber ? (
                    <div className="space-y-2">
                      <Label>PO Number</Label>
                      <Input
                        value={editQuotation.poNumber}
                        disabled={!canEditValues}
                        onChange={(e) => setEditQuotation({ ...editQuotation, poNumber: e.target.value })}
                      />
                    </div>
                  ) : null}
                  {editQuotation.totalValue > 0 ? (
                    <div className="space-y-2">
                      <Label>Quotation Value</Label>
                      <Input
                        type="number"
                        value={editQuotation.totalValue}
                        disabled={!canEditValues}
                        onChange={(e) => setEditQuotation({ ...editQuotation, totalValue: Number(e.target.value) || 0 })}
                      />
                    </div>
                  ) : null}
                  {editQuotation.poValue > 0 ? (
                    <div className="space-y-2">
                      <Label>PO Value</Label>
                      <Input
                        type="number"
                        value={editQuotation.poValue}
                        disabled={!canEditValues}
                        onChange={(e) => setEditQuotation({ ...editQuotation, poValue: Number(e.target.value) || 0 })}
                      />
                    </div>
                  ) : null}
                  {editQuotation.invoiceValue > 0 ? (
                    <div className="space-y-2">
                      <Label>Invoice Value</Label>
                      <Input
                        type="number"
                        value={editQuotation.invoiceValue}
                        disabled={!canEditValues}
                        onChange={(e) => setEditQuotation({ ...editQuotation, invoiceValue: Number(e.target.value) || 0 })}
                      />
                    </div>
                  ) : null}
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {editQuotation.followUpDate ? (
                    <div className="space-y-2">
                      <Label>Follow Up Date</Label>
                      <Input
                        type="date"
                        disabled={!canEditValues}
                        value={editQuotation.followUpDate}
                        onChange={(e) => setEditQuotation({ ...editQuotation, followUpDate: e.target.value || null })}
                      />
                    </div>
                  ) : null}
                  {editQuotation.followUpNotes ? (
                    <div className="space-y-2">
                      <Label>Follow Up Notes</Label>
                      <Textarea
                        value={editQuotation.followUpNotes}
                        disabled={!canEditValues}
                        onChange={(e) => setEditQuotation({ ...editQuotation, followUpNotes: e.target.value })}
                        rows={3}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
              {(() => {
                const originalQuotation = quotations.find((q) => q.id === editQuotation.id);
                const selectedStatus = editStatusDirty && editStatusDraft ? editStatusDraft : editQuotation.status;
                const isSalespersonApprovalFlow =
                  crmUser.role === "sales" &&
                  selectedStatus === "Ask for Approve" &&
                  originalQuotation?.status !== "Ask for Approve";
                const isSendingEmail = selectedStatus === "Sent Mail" && originalQuotation?.status === "Approved";

                return (
                  <Button
                    onClick={saveUpdate}
                    className="w-full"
                    disabled={saving}
                  >
                    {saving
                      ? "Saving..."
                      : isSalespersonApprovalFlow
                        ? "Request manager approval"
                        : isSendingEmail
                        ? "Mark as Sent Mail"
                        : "Save Changes"}
                  </Button>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QuotationsPage;
