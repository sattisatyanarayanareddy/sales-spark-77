import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchSalesFunnel,
  updateSalesFunnelDoc,
  updateSalesFunnelStatus,
  fetchAllUsers,
} from "@/lib/firestore-service";
import { SalesFunnel, SalesFunnelStatus, SALES_FUNNEL_STATUS_LABELS, CRMUser } from "@/types/crm";
import StageBadge from "@/components/StageBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Edit, Lock, Unlock, Loader2, FileText, TrendingUp, Clock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import StatCard from "@/components/StatCard";

const SalesFunnelPage: React.FC = () => {
  const { crmUser } = useAuth();
  const [funnels, setFunnels] = useState<SalesFunnel[]>([]);
  const [users, setUsers] = useState<CRMUser[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editFunnel, setEditFunnel] = useState<SalesFunnel | null>(null);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    if (!crmUser) return;
    setLoadingData(true);
    try {
      const [fs, allUsers] = await Promise.all([
        fetchSalesFunnel(crmUser.id, crmUser.role),
        fetchAllUsers(),
      ]);
      setFunnels(fs);
      setUsers(allUsers);
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

  const handleToggleStatus = async (id: string, currentDisabled: boolean) => {
    const newStatus = !currentDisabled;
    const actionText = newStatus ? "disable" : "enable";
    if (!confirm(`Are you sure you want to ${actionText} this sales funnel entry?`)) return;
    try {
      await updateSalesFunnelStatus(id, newStatus);
      toast.success(`Sales funnel entry ${newStatus ? "disabled" : "enabled"} successfully`);
      loadData();
    } catch (e) {
      console.error(e);
      toast.error(`Failed to ${actionText} sales funnel entry`);
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

  // Calculate salesperson-specific team metrics for manager
  const isManager = crmUser.role === "sub_manager";
  const teamSalespersons = users.filter((u) => u.managerId === crmUser.id && u.role === "sales");
  const teamSalespersonIds = teamSalespersons.map((u) => u.id);
  const teamSalesFunnels = funnels.filter((f) => teamSalespersonIds.includes(f.salesPersonId));

  const teamQuotationValue = teamSalesFunnels.reduce((sum, f) => sum + (f.quotationValue || 0), 0);
  const teamPoValue = teamSalesFunnels
    .filter((f) => f.poValue && f.poValue > 0)
    .reduce((sum, f) => sum + (f.poValue || 0), 0);
  const teamInvoiceValue = teamSalesFunnels
    .filter((f) => f.invoiceValue && f.invoiceValue > 0)
    .reduce((sum, f) => sum + (f.invoiceValue || 0), 0);
  const teamWonDeals = teamSalesFunnels.filter((f) => f.status === "Won").length;

  const showSalespersonCol = crmUser.role === "sub_manager" || crmUser.role === "general_manager";

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

      {/* Team performance metrics dashboard for managers */}
      {isManager && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 animate-in fade-in duration-300">
          <StatCard
            title="Team Quotation Value"
            value={`$${teamQuotationValue.toLocaleString()}`}
            icon={FileText}
            description="Total value of salesperson quotations"
          />
          <StatCard
            title="Team PO Value"
            value={`$${teamPoValue.toLocaleString()}`}
            icon={TrendingUp}
            description="Total team purchase orders value"
          />
          <StatCard
            title="Team Invoice Value"
            value={`$${teamInvoiceValue.toLocaleString()}`}
            icon={CheckCircle2}
            description="Total team invoices generated"
          />
          <StatCard
            title="Team Won Deals"
            value={teamWonDeals.toString()}
            icon={Clock}
            description="Conversions by salespersons"
          />
        </div>
      )}

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="stat-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sent Date</TableHead>
                <TableHead>Quotation No.</TableHead>
                <TableHead>Company</TableHead>
                {showSalespersonCol && <TableHead>Salesperson</TableHead>}
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
              {filtered.map((funnel) => {
                const isFunnelDisabled = !!funnel.disabled;
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
                    <TableCell className="text-right text-sm">{funnel.poValue > 0 ? `$${funnel.poValue.toLocaleString()}` : "—"}</TableCell>
                    <TableCell className="text-sm">{funnel.deliveryStatus}</TableCell>
                    <TableCell className="text-right text-sm">{funnel.invoiceValue > 0 ? `$${funnel.invoiceValue.toLocaleString()}` : "—"}</TableCell>
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