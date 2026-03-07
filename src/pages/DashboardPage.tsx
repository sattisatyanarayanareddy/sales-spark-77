import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import StatCard from "@/components/StatCard";
import StageBadge from "@/components/StageBadge";
import { getDashboardStats, getTeamMembers, getQuotations, exportToCSV } from "@/lib/demo-data";
import { Quotation } from "@/types/crm";
import { FileText, TrendingUp, ShoppingCart, Receipt, DollarSign, Eye, Download, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { motion } from "framer-motion";

const DashboardPage: React.FC = () => {
  const { crmUser } = useAuth();
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  if (!crmUser) return null;

  const isManager = crmUser.role === "general_manager" || crmUser.role === "sub_manager";
  const stats = getDashboardStats(crmUser.id, crmUser.role);
  const teamMembers = isManager ? getTeamMembers(crmUser.id, crmUser.role) : [];
  const quotations = getQuotations(crmUser.id, crmUser.role);

  const filteredQuotations = quotations.filter((q) => {
    if (selectedMember && q.salesPersonId !== selectedMember) return false;
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

  const memberQuotations = selectedMember
    ? quotations.filter((q) => q.salesPersonId === selectedMember)
    : [];

  const handleExport = () => {
    const csv = exportToCSV(filteredQuotations);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "quotations-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatCurrency = (v: number) => `$${v.toLocaleString()}`;

  return (
    <div className="page-container space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title={isManager ? "Total Quotations" : "My Quotations"} value={stats.totalQuotations} icon={FileText} iconBg="bg-primary/10" iconColor="text-primary" />
        <StatCard title="Active Deals" value={stats.activeDeals} icon={TrendingUp} iconBg="bg-warning/10" iconColor="text-warning" />
        <StatCard title="PO Generated" value={stats.poGenerated} icon={ShoppingCart} iconBg="bg-accent/10" iconColor="text-accent" />
        <StatCard title="Invoices" value={stats.invoicesCreated} icon={Receipt} iconBg="bg-success/10" iconColor="text-success" />
        <StatCard title="Total Sales" value={formatCurrency(stats.totalSalesValue)} icon={DollarSign} iconBg="bg-info/10" iconColor="text-info" />
      </div>

      {/* Team Table (Managers only) */}
      {isManager && teamMembers.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="stat-card p-0 overflow-hidden">
          <div className="p-4 md:p-6 border-b border-border">
            <h3 className="section-title text-lg">Team Overview</h3>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead className="text-right">Active Deals</TableHead>
                  <TableHead className="text-right">PO Generated</TableHead>
                  <TableHead className="text-right">Invoices</TableHead>
                  <TableHead className="text-right">Sales Value</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamMembers.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell className="text-muted-foreground">{m.department}</TableCell>
                    <TableCell className="text-right">{m.activeDeals}</TableCell>
                    <TableCell className="text-right">{m.poGenerated}</TableCell>
                    <TableCell className="text-right">{m.invoiceGenerated}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(m.totalSalesValue)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedMember(m.id)}>
                        <Eye className="w-4 h-4 mr-1" /> View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </motion.div>
      )}

      {/* Quotations / Sales Funnel */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="stat-card p-0 overflow-hidden">
        <div className="p-4 md:p-6 border-b border-border flex flex-col md:flex-row md:items-center gap-3">
          <h3 className="section-title text-lg flex-1">
            {isManager ? "Sales Funnel" : "My Quotations"}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-48"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="quotation_created">Quotation Created</SelectItem>
                <SelectItem value="follow_up">Follow-up</SelectItem>
                <SelectItem value="negotiation">Negotiation</SelectItem>
                <SelectItem value="po_received">PO Received</SelectItem>
                <SelectItem value="invoice_generated">Invoice Generated</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="closed_won">Closed Won</SelectItem>
                <SelectItem value="closed_lost">Closed Lost</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="w-4 h-4 mr-1" /> Export
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quotation No</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead>PO Number</TableHead>
                <TableHead className="text-right">Invoice</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Follow-up</TableHead>
                <TableHead>Delivery</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredQuotations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No quotations found
                  </TableCell>
                </TableRow>
              ) : (
                filteredQuotations.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-mono text-xs">{q.quotationNumber}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{q.customerName}</p>
                        <p className="text-xs text-muted-foreground">{q.companyName}</p>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">{q.subject}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(q.totalValue)}</TableCell>
                    <TableCell className="font-mono text-xs">{q.poNumber || "—"}</TableCell>
                    <TableCell className="text-right">{q.invoiceValue ? formatCurrency(q.invoiceValue) : "—"}</TableCell>
                    <TableCell><StageBadge stage={q.stage} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {q.followUpDate ? new Date(q.followUpDate).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-xs">{q.deliveryStatus || "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </motion.div>

      {/* Member Detail Dialog */}
      <Dialog open={!!selectedMember} onOpenChange={() => setSelectedMember(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Sales Person Details</DialogTitle>
          </DialogHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quotation No</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {memberQuotations.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-mono text-xs">{q.quotationNumber}</TableCell>
                    <TableCell>{q.customerName}</TableCell>
                    <TableCell>{q.subject}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(q.totalValue)}</TableCell>
                    <TableCell><StageBadge stage={q.stage} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DashboardPage;
