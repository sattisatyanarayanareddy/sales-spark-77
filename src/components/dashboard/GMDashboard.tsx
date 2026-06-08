import React, { useState } from "react";
import { motion, Variants } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CRMUser, SalesFunnel } from "@/types/crm";
import { ShieldAlert, ImageOff, FileText, Clock } from "lucide-react";

interface GMDashboardProps {
  users: CRMUser[];
  funnels: SalesFunnel[];
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } }
};

const fmtCurrency = (v: number) => `$${(v || 0).toLocaleString()}`;

const SALES_FUNNEL_STATUS_COLORS: Record<string, string> = {
  Hot: "bg-red-500/10 text-red-500 border-red-500/25",
  Warm: "bg-orange-500/10 text-orange-500 border-orange-500/25",
  Cold: "bg-purple-500/10 text-purple-500 border-purple-500/25",
  Won: "bg-green-500/10 text-green-500 border-green-500/25",
  Lost: "bg-rose-950/10 text-rose-600 border-rose-950/25",
  Closed: "bg-slate-500/10 text-slate-500 border-slate-500/25",
  Cancelled: "bg-yellow-500/10 text-yellow-500 border-yellow-500/25",
};

export const GMDashboard: React.FC<GMDashboardProps> = ({ users, funnels }) => {
  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null);
  const [showAllManagers, setShowAllManagers] = useState(false);

  const managers = users.filter((u) => u.role === "sub_manager");
  const visibleManagers = managers.length > 0 ? managers : [];
  const activeManager = selectedManagerId ? visibleManagers.find((m) => m.id === selectedManagerId) : null;

  // Filter funnels based on selected manager (includes disabled ones for Recent Activity visibility)
  const filteredFunnels = activeManager
    ? (() => {
        const teamIds = users
          .filter((u) => u.managerId === activeManager.id || u.id === activeManager.id)
          .map((u) => u.id);
        return funnels.filter((f) => teamIds.includes(f.salesPersonId));
      })()
    : funnels;

  // Get active manager's salesperson list
  const activeTeamMembers = activeManager
    ? users.filter((u) => u.managerId === activeManager.id && u.role === "sales")
    : [];

  // Recent activities include disabled entries (max 5)
  const recentActivities = filteredFunnels.slice(0, 5);

  // Helper for computing team stats for a manager card (only counts active/non-disabled entries)
  const getManagerTeamStats = (managerId: string) => {
    const teamIds = users
      .filter((u) => u.managerId === managerId || u.id === managerId)
      .map((u) => u.id);
    const teamFunnels = funnels.filter((f) => teamIds.includes(f.salesPersonId) && !f.disabled);
    return {
      activeDeals: teamFunnels.filter((f) => !["Won", "Closed", "Cancelled", "Lost"].includes(f.status)).length,
      quotationValue: teamFunnels.reduce((sum, f) => sum + (f.quotationValue || 0), 0),
      poValue: teamFunnels.reduce((sum, f) => sum + (f.poValue || 0), 0),
      paymentDues: teamFunnels.reduce((sum, f) => sum + (f.pendingPayment || 0), 0),
      wonDeals: teamFunnels.filter((f) => f.status === "Won").length,
    };
  };

  return (
    <div className="space-y-6">
      {/* stats banner indicator */}
      {activeManager && (
        <motion.div
          variants={itemVariants}
          className="flex items-center justify-between p-4 rounded-xl bg-primary/5 border border-primary/20 text-sm animate-in fade-in slide-in-from-top-2 duration-300"
        >
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-primary shrink-0" />
            <span>Showing team stats for manager <strong>{activeManager.name}</strong></span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setSelectedManagerId(null)} className="h-7 text-primary hover:bg-primary/10">
            Reset Filter
          </Button>
        </motion.div>
      )}

      {/* Managers Grid */}
      <motion.div variants={itemVariants} className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Your Managers</h2>
          {selectedManagerId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedManagerId(null)}
              className="h-8 border-primary/30 text-primary hover:bg-primary/5 transition-all"
            >
              Show All Managers
            </Button>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(showAllManagers ? visibleManagers : visibleManagers.slice(0, 3)).map((m) => {
            const stats = getManagerTeamStats(m.id);
            const isSelected = selectedManagerId === m.id;
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
                onClick={() => setSelectedManagerId(isSelected ? null : m.id)}
                className={`cursor-pointer p-6 rounded-2xl border transition-all duration-300 ${
                  isSelected
                    ? "border-primary/80 bg-gradient-to-br from-primary/12 via-primary/5 to-card shadow-lg shadow-primary/10 ring-1 ring-primary/40 -translate-y-1"
                    : "border-border/80 bg-card/90 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-base font-bold uppercase">{m.department || "SALES"}</p>
                    <h3 className="text-sm text-muted-foreground mt-1">{m.name}</h3>
                    <div className="text-xs text-muted-foreground mt-1">
                      <span className="mr-2">Payment Due:</span>
                      <span className="font-medium text-rose-600 dark:text-rose-400">{fmtCurrency(stats.paymentDues)}</span>
                    </div>
                  </div>
                  <Badge variant={isSelected ? "default" : "outline"} className="text-[10px] px-2 py-0.5">
                    {isSelected ? "Active Filter" : "Manager"}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-border/40 text-xs">
                  <div>
                    <p className="text-muted-foreground/80 text-[11px]">Quotation Value</p>
                    <p className="font-bold text-sm text-foreground mt-1">${stats.quotationValue.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground/80 text-[11px]">Active Deals</p>
                    <p className="font-bold text-sm text-foreground mt-1">{stats.activeDeals}</p>
                  </div>
                  <div className="mt-2">
                    <p className="text-muted-foreground/80 text-[11px]">PO Value</p>
                    <p className="font-bold text-sm text-amber-600 mt-1">${stats.poValue.toLocaleString()}</p>
                  </div>
                  <div className="mt-2">
                    <p className="text-muted-foreground/80 text-[11px]">Payment Due</p>
                    <p className="font-bold text-sm text-rose-600 dark:text-rose-400 mt-1">${stats.paymentDues.toLocaleString()}</p>
                  </div>
                  <div className="mt-2">
                    <p className="text-muted-foreground/80 text-[11px]">Won Deals</p>
                    <p className="font-bold text-sm text-green-600 mt-1">{stats.wonDeals}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
          {visibleManagers.length === 0 && (
            <p className="text-muted-foreground text-sm py-4 col-span-full">No managers assigned to your team yet.</p>
          )}
        </div>

        {visibleManagers.length > 3 && (
          <div className="flex justify-center pt-2">
            <Button
              onClick={() => setShowAllManagers(!showAllManagers)}
              variant="outline"
              className="rounded-xl border-primary/30 text-primary hover:bg-primary/5 font-medium"
            >
              {showAllManagers ? "Show Less" : `See More (${visibleManagers.length - 3} more)`}
            </Button>
          </div>
        )}
      </motion.div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Column: Recent Activity (Funnels) */}
        <motion.div variants={itemVariants} className={`dashboard-panel ${activeManager ? "md:col-span-2" : "md:col-span-3"}`}>
          <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
          {recentActivities.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No sales funnel entries yet. Send quotations to start tracking deals!
            </p>
          ) : (
            <div className="space-y-3">
              {recentActivities.map((funnel) => {
                const isFunnelDisabled = !!funnel.disabled;
                return (
                  <div
                    key={funnel.id}
                    className={`flex items-center justify-between p-3.5 rounded-xl border border-border/40 hover:bg-accent/40 transition-all duration-300 ${
                      isFunnelDisabled ? "opacity-50" : ""
                    }`}
                  >
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{funnel.companyName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Quotation #{funnel.quotationNumber}
                        {isFunnelDisabled && (
                          <Badge variant="outline" className="ml-2 text-[9px] py-0 px-1.5 h-4 bg-destructive/10 text-destructive border-destructive/20 font-semibold inline-flex items-center">
                            Disabled
                          </Badge>
                        )}
                        {users.find(u => u.id === funnel.salesPersonId) && (
                          <span className="ml-2 font-medium text-primary/80">• Salesperson: {users.find(u => u.id === funnel.salesPersonId)?.name}</span>
                        )}
                      </p>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1.5">
                      <p className="font-bold text-sm text-foreground">
                        {isFunnelDisabled ? "—" : `$${(funnel.quotationValue || 0).toLocaleString()}`}
                      </p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold tracking-wide border border-transparent ${
                        SALES_FUNNEL_STATUS_COLORS[funnel.status] || "bg-muted text-muted-foreground"
                      }`}>
                        {funnel.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Right Column: Salespersons Sidebar */}
        {activeManager && (
          <motion.div variants={itemVariants} className="dashboard-panel">
            <h2 className="text-xl font-semibold mb-4">Salesperson Team</h2>
            {activeTeamMembers.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4">No salespersons assigned to this manager's team.</p>
            ) : (
              <div className="space-y-3">
                {activeTeamMembers.map((u) => {
                  const personFunnels = funnels.filter(f => f.salesPersonId === u.id && !f.disabled);
                  const totalSales = personFunnels.reduce((sum, f) => sum + (f.quotationValue || 0), 0);
                  return (
                    <div key={u.id} className="p-3 rounded-xl border border-border/40 bg-card hover:bg-accent/10 transition-all">
                      <p className="font-semibold text-sm">{u.name}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                      <p className="text-xs font-bold text-primary mt-1">${totalSales.toLocaleString()} in Quotations</p>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};
