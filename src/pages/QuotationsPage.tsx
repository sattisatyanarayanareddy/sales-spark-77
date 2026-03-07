import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getQuotations, updateQuotation, deleteQuotation, exportToCSV } from "@/lib/demo-data";
import { Quotation, QuotationStage, STAGE_LABELS } from "@/types/crm";
import StageBadge from "@/components/StageBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, Plus, Download, Edit, Trash2, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";

const QuotationsPage: React.FC = () => {
  const { crmUser } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editQuotation, setEditQuotation] = useState<Quotation | null>(null);
  const [viewQuotation, setViewQuotation] = useState<Quotation | null>(null);
  const [, setRefresh] = useState(0);

  if (!crmUser) return null;

  const quotations = getQuotations(crmUser.id, crmUser.role);

  const filtered = quotations.filter((q) => {
    if (statusFilter !== "all" && q.stage !== statusFilter) return false;
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

  const handleDelete = (id: string) => {
    if (deleteQuotation(id)) {
      toast.success("Quotation deleted");
      setRefresh((r) => r + 1);
    }
  };

  const handleUpdateStatus = (q: Quotation) => {
    setEditQuotation({ ...q });
  };

  const saveUpdate = () => {
    if (!editQuotation) return;
    updateQuotation(editQuotation.id, editQuotation);
    toast.success("Quotation updated");
    setEditQuotation(null);
    setRefresh((r) => r + 1);
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

  const formatCurrency = (v: number) => `$${v.toLocaleString()}`;

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
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {Object.entries(STAGE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-1" /> Export
          </Button>
          {crmUser.role === "sales" && (
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
                <TableHead>Follow-up</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No quotations found</TableCell>
                </TableRow>
              ) : (
                filtered.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-mono text-xs">{q.quotationNumber}</TableCell>
                    <TableCell>
                      <p className="font-medium text-sm">{q.customerName}</p>
                      <p className="text-xs text-muted-foreground">{q.companyName}</p>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">{q.subject}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(q.totalValue)}</TableCell>
                    <TableCell><StageBadge stage={q.stage} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {q.followUpDate ? new Date(q.followUpDate).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setViewQuotation(q)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleUpdateStatus(q)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        {(crmUser.role === "sales" || crmUser.role === "general_manager") && (
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(q.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
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
                <div><span className="text-muted-foreground">Status:</span> <StageBadge stage={viewQuotation.stage} /></div>
                <div><span className="text-muted-foreground">PO Number:</span> {viewQuotation.poNumber || "—"}</div>
                <div><span className="text-muted-foreground">Invoice:</span> {viewQuotation.invoiceValue ? formatCurrency(viewQuotation.invoiceValue) : "—"}</div>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Products</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Part No</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewQuotation.products.map((p, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <p className="font-medium">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.description}</p>
                        </TableCell>
                        <TableCell className="text-sm">{p.modelNumber}</TableCell>
                        <TableCell className="text-sm">{p.partNumber}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(p.value)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="text-right font-bold mt-2">Total: {formatCurrency(viewQuotation.totalValue)}</p>
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
                <Label>Stage</Label>
                <Select
                  value={editQuotation.stage}
                  onValueChange={(v) => setEditQuotation({ ...editQuotation, stage: v as QuotationStage })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STAGE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>PO Number</Label>
                <Input value={editQuotation.poNumber} onChange={(e) => setEditQuotation({ ...editQuotation, poNumber: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Invoice Value</Label>
                <Input type="number" value={editQuotation.invoiceValue} onChange={(e) => setEditQuotation({ ...editQuotation, invoiceValue: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Follow-up Date</Label>
                <Input type="date" value={editQuotation.followUpDate || ""} onChange={(e) => setEditQuotation({ ...editQuotation, followUpDate: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Follow-up Notes</Label>
                <Textarea value={editQuotation.followUpNotes} onChange={(e) => setEditQuotation({ ...editQuotation, followUpNotes: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Delivery Status</Label>
                <Input value={editQuotation.deliveryStatus} onChange={(e) => setEditQuotation({ ...editQuotation, deliveryStatus: e.target.value })} />
              </div>
              <Button onClick={saveUpdate} className="w-full">Save Changes</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QuotationsPage;
