import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchSalesFunnel,
  updateSalesFunnelDoc,
  deleteSalesFunnelDoc,
} from "@/lib/firestore-service";
import { SalesFunnel, SalesFunnelStatus, SALES_FUNNEL_STATUS_LABELS } from "@/types/crm";
import StageBadge from "@/components/StageBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Edit, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

const SalesFunnelPage: React.FC = () => {
  const { crmUser } = useAuth();
  const [funnels, setFunnels] = useState<SalesFunnel[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editFunnel, setEditFunnel] = useState<SalesFunnel | null>(null);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    if (!crmUser) return;
    setLoadingData(true);
    try {
      const fs = await fetchSalesFunnel(crmUser.id, crmUser.role);
      setFunnels(fs);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load sales funnel");
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [crmUser]);

  if (!crmUser) return null;

  const filtered = funnels.filter((f) => {
    if (statusFilter !== "all" && f.status !== statusFilter) return false;
    if (searchQuery) {
      const s = searchQuery.toLowerCase();
      return (
        f.quotationNumber.toLowerCase().includes(s) ||
        f.companyName.toLowerCase().includes(s) ||
        f.subject.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this sales funnel entry?")) return;
    try {
      await deleteSalesFunnelDoc(id);
      toast.success("Sales funnel entry deleted");
      loadData();
    } catch (e) {
      toast.error("Failed to delete");
    }
  };

  const saveUpdate = async () => {
    if (!editFunnel) return;
    setSaving(true);
    try {
      await updateSalesFunnelDoc(editFunnel.id, {
        status: editFunnel.status,
        poValue: editFunnel.poValue,
        deliveryStatus: editFunnel.deliveryStatus,
        invoiceValue: editFunnel.invoiceValue,
        followUpDate: editFunnel.followUpDate,
      });
      toast.success("Sales funnel updated");
      setEditFunnel(null);
      loadData();
    } catch (e) {
      toast.error("Failed to update");
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

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="stat-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sent Date</TableHead>
                <TableHead>Quotation No.</TableHead>
                <TableHead>Company</TableHead>
                <TableHead className="text-right">Quotation Value</TableHead>
                <TableHead>Follow-Up Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">PO Value</TableHead>
                <TableHead>Delivery Status</TableHead>
                <TableHead className="text-right">Invoice Value</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((funnel) => (
                <TableRow key={funnel.id}>
                  <TableCell className="text-sm">{new Date(funnel.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="font-mono text-xs">{funnel.quotationNumber}</TableCell>
                  <TableCell className="text-sm">{funnel.companyName}</TableCell>
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
                  <TableCell className="text-right text-sm">{funnel.poValue > 0 ? `$${funnel.poValue.toLocaleString()}` : "—"}</TableCell>
                  <TableCell className="text-sm">{funnel.deliveryStatus}</TableCell>
                  <TableCell className="text-right text-sm">{funnel.invoiceValue > 0 ? `$${funnel.invoiceValue.toLocaleString()}` : "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="action-btn" onClick={() => setEditFunnel({ ...funnel })}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="action-btn action-btn-danger" onClick={() => handleDelete(funnel.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </motion.div>

      {/* Edit Dialog */}
      <Dialog open={!!editFunnel} onOpenChange={() => setEditFunnel(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Update Sales Funnel</DialogTitle>
          </DialogHeader>
          {editFunnel && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editFunnel.status} onValueChange={(v) => setEditFunnel({ ...editFunnel, status: v as SalesFunnelStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(SALES_FUNNEL_STATUS_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {editFunnel.status === "Won" && (
                <>
                  <div className="space-y-2">
                    <Label>PO Value</Label>
                    <Input type="number" value={editFunnel.poValue} onChange={(e) => setEditFunnel({ ...editFunnel, poValue: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Delivery Status</Label>
                    <Select value={editFunnel.deliveryStatus} onValueChange={(v) => setEditFunnel({ ...editFunnel, deliveryStatus: v as "Pending" | "Partial Delivery" | "Delivered" })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="Partial Delivery">Partial Delivery</SelectItem>
                        <SelectItem value="Delivered">Delivered</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {(editFunnel.deliveryStatus === "Partial Delivery" || editFunnel.deliveryStatus === "Delivered") && (
                    <div className="space-y-2">
                      <Label>Invoice Value</Label>
                      <Input type="number" value={editFunnel.invoiceValue} onChange={(e) => setEditFunnel({ ...editFunnel, invoiceValue: Number(e.target.value) })} />
                    </div>
                  )}
                </>
              )}
              <div className="space-y-2">
                <Label>Follow-up Date</Label>
                <Input type="date" value={editFunnel.followUpDate || ""} onChange={(e) => setEditFunnel({ ...editFunnel, followUpDate: e.target.value })} />
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

export default SalesFunnelPage;