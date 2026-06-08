import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  subscribeToAllUsers,
  subscribeToSalesFunnel,
  subscribeToNotifications,
  approveQuotationDoc,
  rejectQuotationDoc,
} from "../lib/firestore-service";
import { CRMUser, SalesFunnel, AppNotification } from "../types/crm";
import { motion, Variants } from "framer-motion";
import { toast } from "sonner";
import { AdminDashboard } from "../components/dashboard/AdminDashboard";
import { GMDashboard } from "../components/dashboard/GMDashboard";
import { ManagerDashboard } from "../components/dashboard/ManagerDashboard";
import { SalespersonDashboard } from "../components/dashboard/SalespersonDashboard";

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

const DashboardPage = () => {
  const navigate = useNavigate();
  const { crmUser } = useAuth();
  const [funnels, setFunnels] = useState<SalesFunnel[]>([]);
  const [users, setUsers] = useState<CRMUser[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectionRemarks, setRejectionRemarks] = useState<Record<string, string>>({});

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

    let unsubNotifs = () => { };
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
      navigate("/sales-funnel");
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to approve quotation");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (notificationId: string, quotationId: string, remarks: string) => {
    const trimmedRemarks = remarks?.trim() || "";

    if (!trimmedRemarks) {
      toast.error("Please enter rejection remarks before rejecting the quotation.");
      return;
    }

    setActionLoading(true);
    try {
      await rejectQuotationDoc(notificationId, quotationId, trimmedRemarks);
      setRejectionRemarks((prev) => ({ ...prev, [notificationId]: "" }));
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

  // Choose dashboard view based on user role
  const renderDashboardByRole = () => {
    switch (crmUser.role) {
      case "administrator":
        return <AdminDashboard users={users} />;
      case "general_manager":
        return <GMDashboard users={users} funnels={funnels} />;
      case "sub_manager":
        return (
          <ManagerDashboard
            users={users}
            funnels={funnels}
            notifications={notifications}
            actionLoading={actionLoading}
            handleApprove={handleApprove}
            handleReject={handleReject}
            rejectionRemarks={rejectionRemarks}
            setRejectionRemarks={setRejectionRemarks}
          />
        );
      case "sales":
      default:
        return <SalespersonDashboard users={users} funnels={funnels} />;
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="page-container space-y-6"
    >
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-2">
        <div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-foreground/70 bg-clip-text text-transparent">Dashboard</h1>
          <p className="text-muted-foreground mt-1.5 text-base font-medium">
            Welcome back, {crmUser?.name || "User"}
          </p>
        </div>
      </motion.div>

      {renderDashboardByRole()}
    </motion.div>
  );
};

export default DashboardPage;
