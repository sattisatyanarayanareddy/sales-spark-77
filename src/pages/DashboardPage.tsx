import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import StatCard from "../components/StatCard";
import {
  subscribeToAllUsers,
  subscribeToSalesFunnel,
  subscribeToNotifications,
  approveQuotationDoc,
  rejectQuotationDoc,
} from "../lib/firestore-service";
import { CRMUser, SalesFunnel, SALES_FUNNEL_STATUS_COLORS, AppNotification } from "../types/crm";
import { FileText, TrendingUp, Clock, CheckCircle2, Users, Check, X, ShieldAlert, Loader2 } from "lucide-react";
import { motion, Variants } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const DashboardPage = () => {
  const { crmUser } = useAuth();
  const [funnels, setFunnels] = useState<SalesFunnel[]>([]);
  const [users, setUsers] = useState<CRMUser[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showAllManagers, setShowAllManagers] = useState(false);

  useEffect(() => {
    if (!crmUser) return;

    setLoading(true);

    const unsubUsers = subscribeToAllUsers((allUsers) => {
      setUsers(allUsers);
    });

    const unsubFunnels = subscribeToSalesFunnel(crmUser.id, crmUser.role, (allFunnels) => {
      setFunnels(crmUser.role === "administrator" ? [] : allFunnels);
      setLoading(false);
    });

    let unsubNotifs = () => {};
    if (crmUser.role === "sub_manager") {
      unsubNotifs = subscribeToNotifications(crmUser.id, (notifs) => {
        setNotifications(notifs);
      });
    }

    return () => {
      unsubUsers();
      unsubFunnels();
      unsubNotifs();
    };
  }, [crmUser]);

  const handleApprove = async (notificationId: string, quotationId: string) => {
    setActionLoading(true);
    try {
      await approveQuotationDoc(notificationId, quotationId);
      toast.success("Quotation approved successfully!");
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to approve quotation");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (notificationId: string, quotationId: string) => {
    setActionLoading(true);
    try {
      await rejectQuotationDoc(notificationId, quotationId);
      toast.success("Quotation rejected and marked as draft");
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to reject quotation");
    } finally {
      setActionLoading(false);
    }
  };

  if (!crmUser) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08
      }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } }
  };

  // General Manager role specific filters
  const isGM = crmUser.role === "general_manager";
  // Show ALL department managers for GM, not just assigned ones
  const managers = users.filter((u) => u.role === "sub_manager");
  const visibleManagers = managers.length > 0 ? managers : [];
  const activeManager = selectedManagerId ? visibleManagers.find((m) => m.id === selectedManagerId) : null;

  // Filter funnels based on selected manager
  const filteredFunnels = activeManager
    ? (() => {
        const teamIds = users
          .filter((u) => u.managerId === activeManager.id || u.id === activeManager.id)
          .map((u) => u.id);
        return funnels.filter((f) => teamIds.includes(f.salesPersonId));
      })()
    : funnels;

  // Metrics calculations
  const quotationValue = filteredFunnels.reduce((sum, f) => sum + (f.quotationValue || 0), 0);
  const poValue = filteredFunnels
    .filter(f => f.poValue && f.poValue > 0)
    .reduce((sum, f) => sum + (f.poValue || 0), 0);
  const invoiceValue = filteredFunnels
    .filter(f => f.invoiceValue && f.invoiceValue > 0)
    .reduce((sum, f) => sum + (f.invoiceValue || 0), 0);
  const wonDeals = filteredFunnels.filter(f => f.status === "Won").length;

  const sortedUsers = [...users].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });
  const recentUsers = sortedUsers.slice(0, 5);

  // Get active manager's salesperson list
  const activeTeamMembers = activeManager
    ? users.filter((u) => u.managerId === activeManager.id && u.role === "sales")
    : [];

  // Get recent activities (recent sales funnels)
  const recentActivities = filteredFunnels.slice(0, 5);

  // Helper for computing team stats for a manager card
  const getManagerTeamStats = (managerId: string) => {
    const teamIds = users
      .filter((u) => u.managerId === managerId || u.id === managerId)
      .map((u) => u.id);
    const teamFunnels = funnels.filter((f) => teamIds.includes(f.salesPersonId));
    return {
      activeDeals: teamFunnels.filter((f) => !["Won", "Closed", "Cancelled", "Lost"].includes(f.status)).length,
      quotationValue: teamFunnels.reduce((sum, f) => sum + (f.quotationValue || 0), 0),
      poValue: teamFunnels.reduce((sum, f) => sum + (f.poValue || 0), 0),
      wonDeals: teamFunnels.filter((f) => f.status === "Won").length,
    };
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="page-container space-y-6"
    >
      <motion.div variants={itemVariants} className="dashboard-hero flex flex-col md:flex-row md:items-center md:justify-between gap-6 p-6 rounded-2xl bg-gradient-to-br from-primary/5 via-violet-500/5 to-transparent border border-border/40">
        <div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Dashboard</h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Welcome back, {crmUser?.name || "User"}
          </p>
        </div>
        <div className="text-sm text-muted-foreground p-4 rounded-xl bg-card/60 border border-border/30 backdrop-blur-sm">
          {crmUser?.role === "administrator" 
            ? "Overview of registered users and recent activity" 
            : activeManager 
              ? `📊 Filtered by Manager: ${activeManager.name}` 
              : "📈 Updated live from your sales data"}
        </div>
      </motion.div>

      {/* General Manager: Managers Grid */}
      {isGM && (
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
                  className={`cursor-pointer p-5 rounded-2xl border transition-all duration-300 ${
                    isSelected
                      ? "border-primary bg-gradient-to-br from-primary/10 via-primary/5 to-transparent shadow-lg shadow-primary/20 ring-1 ring-primary"
                      : "border-border/65 bg-card hover:border-primary/50 hover:shadow-lg hover:shadow-muted/20"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-base">{m.name}</h3>
                      <p className="text-xs text-muted-foreground">{m.department || "Sales Manager"}</p>
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

          {/* See More / Show Less Button */}
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
      )}

      {/* Admin dashboard layout */}
      {crmUser?.role === "administrator" ? (
        <>
          <motion.div variants={itemVariants} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total Users"
              value={users.filter((u) => u.role !== "administrator").length.toString()}
              icon={Users}
              description="Registered users in the CRM (excluding admins)"
            />
          </motion.div>

          <motion.div variants={itemVariants} className="dashboard-panel">
            <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
            {recentUsers.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No user activity available yet.
              </p>
            ) : (
              <div className="space-y-3">
                {recentUsers.map((user) => (
                  <div
                    key={user.id}
                    className="p-3.5 rounded-xl border border-border/40 hover:bg-accent/40 transition-all duration-300"
                  >
                    <p className="font-semibold text-sm">{user.name || user.email}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Role: {user.role.replace("_", " ")} • {user.department}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Joined: {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "Unknown"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </>
      ) : (
        <>
          {/* General Manager stats banner indicator */}
          {isGM && activeManager && (
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

          {/* Manager: Pending Approvals Panel */}
          {crmUser.role === "sub_manager" && notifications.filter(n => n.status === "pending").length > 0 && (
            <motion.div variants={itemVariants} className="dashboard-panel bg-gradient-to-br from-primary/5 via-card to-card border-primary/20">
              <div className="flex items-center gap-2 mb-4 border-b border-border/40 pb-3">
                <ShieldAlert className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold">Quotations Pending Your Approval</h2>
              </div>
              <div className="space-y-3">
                {notifications.filter(n => n.status === "pending").map((notif) => (
                  <div
                    key={notif.id}
                    className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border border-primary/25 bg-card/80 hover:shadow-md transition-all gap-4"
                  >
                    <div className="flex-1 space-y-1">
                      <p className="font-semibold text-sm text-foreground">{notif.title}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{notif.message}</p>
                      <p className="text-[10px] text-muted-foreground/80 mt-1">
                        Requested: {notif.createdAt ? new Date(notif.createdAt).toLocaleString() : "Just now"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 md:self-center">
                      <Button
                        size="sm"
                        disabled={actionLoading}
                        onClick={() => handleApprove(notif.id, notif.quotationId)}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground h-8 text-xs flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionLoading}
                        onClick={() => handleReject(notif.id, notif.quotationId)}
                        className="border-destructive/30 hover:bg-destructive/5 text-destructive h-8 text-xs flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" />
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          <motion.div variants={itemVariants} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Quotation Value"
              value={`$${quotationValue.toLocaleString()}`}
              icon={FileText}
              description="Total quotation value"
            />
            <StatCard
              title="PO Value"
              value={`$${poValue.toLocaleString()}`}
              icon={TrendingUp}
              description="Purchase orders value"
            />
            <StatCard
              title="Invoice Value"
              value={`$${invoiceValue.toLocaleString()}`}
              icon={CheckCircle2}
              description="Invoices generated"
            />
            <StatCard
              title="Won Deals"
              value={wonDeals.toString()}
              icon={Clock}
              description="Successful conversions"
            />
          </motion.div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Left Column: Recent Activity (Funnels) */}
            <motion.div variants={itemVariants} className={`dashboard-panel ${isGM && activeManager ? "md:col-span-2" : "md:col-span-3"}`}>
              <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
              {recentActivities.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No sales funnel entries yet. Send quotations to start tracking deals!
                </p>
              ) : (
                <div className="space-y-3">
                  {recentActivities.map((funnel) => (
                    <div
                      key={funnel.id}
                      className="flex items-center justify-between p-3.5 rounded-xl border border-border/40 hover:bg-accent/40 transition-all duration-300"
                    >
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{funnel.companyName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Quotation #{funnel.quotationNumber}
                          {users.find(u => u.id === funnel.salesPersonId) && (
                            <span className="ml-2 font-medium text-primary/80">• Salesperson: {users.find(u => u.id === funnel.salesPersonId)?.name}</span>
                          )}
                        </p>
                      </div>
                      <div className="text-right flex flex-col items-end gap-1.5">
                        <p className="font-bold text-sm text-foreground">
                          ${(funnel.quotationValue || 0).toLocaleString()}
                        </p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold tracking-wide border border-transparent ${
                          SALES_FUNNEL_STATUS_COLORS[funnel.status] || "bg-muted text-muted-foreground"
                        }`}>
                          {funnel.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Right Column (General Manager specific): Salespersons Sidebar */}
            {isGM && activeManager && (
              <motion.div variants={itemVariants} className="dashboard-panel">
                <h2 className="text-xl font-semibold mb-4">Salesperson Team</h2>
                {activeTeamMembers.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-4">No salespersons assigned to this manager's team.</p>
                ) : (
                  <div className="space-y-3">
                    {activeTeamMembers.map((u) => {
                      const personFunnels = funnels.filter(f => f.salesPersonId === u.id);
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
        </>
      )}
    </motion.div>
  );
};

export default DashboardPage;
