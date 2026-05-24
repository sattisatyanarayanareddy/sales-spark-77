import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchQuotations,
  updateQuotationDoc,
  updateQuotationStatus,
  exportToCSV,
  exportQuotationToPDF,
  createSalesFunnelDoc,
  fetchSalesFunnelByQuotationId,
  requestQuotationApproval,
} from "@/lib/firestore-service";
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
  const [viewQuotation, setViewQuotation] = useState<Quotation | null>(null);
  const [saving, setSaving] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);

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

  if (!crmUser) return null;

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
      const isSalesperson = crmUser.role === "sales";
      const wasNotSent = original ? original.status !== "Sent" : true;
      const isTryingToSend = editQuotation.status === "Sent";

      if (isSalesperson && wasNotSent && isTryingToSend) {
        const originalStatus = original ? original.status : "Created";
        await updateQuotationDoc(editQuotation.id, {
          status: originalStatus,
          poNumber: editQuotation.poNumber,
          poValue: editQuotation.poValue,
          invoiceValue: editQuotation.invoiceValue,
          followUpDate: editQuotation.followUpDate,
          followUpNotes: editQuotation.followUpNotes,
          deliveryStatus: editQuotation.deliveryStatus,
        });

        await requestQuotationApproval(editQuotation);
        toast.success("Status update to 'Sent' submitted for manager approval");
      } else {
        await updateQuotationDoc(editQuotation.id, {
          status: editQuotation.status,
          poNumber: editQuotation.poNumber,
          poValue: editQuotation.poValue,
          invoiceValue: editQuotation.invoiceValue,
          followUpDate: editQuotation.followUpDate,
          followUpNotes: editQuotation.followUpNotes,
          deliveryStatus: editQuotation.deliveryStatus,
        });

        // If status is Sent, link to sales funnel (no duplicate)
        if (editQuotation.status === "Sent") {
          const existingFunnel = await fetchSalesFunnelByQuotationId(editQuotation.id);
          if (!existingFunnel) {
            await createSalesFunnelDoc({
              quotationId: editQuotation.id,
              quotationNumber: editQuotation.quotationNumber,
              companyName: editQuotation.companyName,
              subject: editQuotation.subject,
              quotationValue: editQuotation.totalValue,
              followUpDate: editQuotation.followUpDate,
              status: "Cold", // Default initial funnel status
              poValue: editQuotation.poValue || 0,
              deliveryStatus: editQuotation.deliveryStatus || "Pending",
              invoiceValue: editQuotation.invoiceValue || 0,
              salesPersonId: editQuotation.salesPersonId,
            });
          }
        }

        toast.success("Quotation updated");
      }

      setEditQuotation(null);
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

  const handleDownloadPDF = async () => {
    if (!viewQuotation) return;
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="section-title">Quotations</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 w-48" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-1" /> Export
          </Button>
          {canCreateQuotation(crmUser.role) && (
            <Button size="sm" onClick={() => navigate("/quotations/new")}>
              <Plus className="w-4 h-4 mr-1" /> New Quotation
            </Button>
          )}
        </div>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="stat-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quotation No</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No quotations found</TableCell>
                </TableRow>
              ) : (
                filtered.map((q) => {
                  const isQuotationDisabled = !!q.disabled;
                  return (
                    <TableRow key={q.id} className={isQuotationDisabled ? "opacity-60 bg-muted/10" : ""}>
                      <TableCell className="font-mono text-xs">
                        <div className="flex items-center gap-2">
                          {q.quotationNumber}
                          {isQuotationDisabled && (
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-5 bg-destructive/10 text-destructive border-destructive/20 font-semibold">
                              Disabled
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium text-sm">{q.customerName}</p>
                        <p className="text-xs text-muted-foreground">{q.companyName}</p>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">{q.subject}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(q.totalValue)}</TableCell>
                      <TableCell><StageBadge stage={q.status} /></TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="action-btn" onClick={() => setViewQuotation(q)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="action-btn"
                            onClick={() => setEditQuotation({ ...q })}
                            disabled={isQuotationDisabled}
                            title={isQuotationDisabled ? "Cannot edit disabled quotation" : "Edit"}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={isQuotationDisabled ? "text-success hover:bg-success/10 hover:text-success" : "text-amber-500 hover:bg-amber-500/10 hover:text-amber-500"}
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
                <div><span className="text-muted-foreground">Sales Person:</span> {viewQuotation.salesPersonName}</div>
                <div><span className="text-muted-foreground">Designation:</span> {viewQuotation.salesPersonDesignation || "—"}</div>
                <div><span className="text-muted-foreground">From Company:</span> {viewQuotation.salesPersonCompany || "—"}</div>
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
                        <TableCell className="text-right font-medium">{formatCurrency(p.value)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="text-right font-bold mt-2">Total: {formatCurrency(viewQuotation.totalValue)}</p>
              </div>

              {viewQuotation.salesPersonSignature && (
                <div className="mt-4 p-4 border rounded-lg bg-muted/20 flex flex-col items-end">
                  <span className="text-xs text-muted-foreground mb-1 font-medium">Authorized Signature</span>
                  <div className="w-40 h-16 bg-white border rounded flex items-center justify-center p-1 overflow-hidden">
                    <img src={viewQuotation.salesPersonSignature} alt="Signature" className="max-h-full max-w-full object-contain" />
                  </div>
                  <span className="text-xs font-semibold mt-1 text-foreground">{viewQuotation.salesPersonName}</span>
                  {viewQuotation.salesPersonDesignation && (
                    <span className="text-[10px] text-muted-foreground">{viewQuotation.salesPersonDesignation}</span>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-4 border-t">
                <Button
                  onClick={handleDownloadPDF}
                  className="flex-1"
                  disabled={downloadingPDF}
                >
                  <Download className="w-4 h-4 mr-2" />
                  {downloadingPDF ? "Generating PDF..." : "Download PDF"}
                </Button>
                <Button variant="outline" onClick={() => setViewQuotation(null)} className="flex-1">
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editQuotation} onOpenChange={() => setEditQuotation(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Update Quotation</DialogTitle>
          </DialogHeader>
          {editQuotation && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editQuotation.status} onValueChange={(v) => setEditQuotation({ ...editQuotation, status: v as QuotationStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={saveUpdate} className="w-full" disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QuotationsPage;
