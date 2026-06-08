import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { NavLink } from "@/components/NavLink";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  LogOut,
  BarChart3,
  TrendingUp,
  UserCircle,
  FileText,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { canManageTeam } from "@/lib/access-control";
import { NotificationBell } from "@/components/NotificationBell";
import { FiMenu } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";

const roleLabel = {
  administrator: "Admin",
  general_manager: "General Manager",
  sub_manager: "Manager",
  sales: "Salesperson",
};

const roleBadgeClass = {
  administrator: "bg-violet-500/10 text-violet-600 border-violet-500/25 dark:text-violet-400 dark:border-violet-500/30",
  general_manager: "bg-emerald-500/10 text-emerald-600 border-emerald-500/25 dark:text-emerald-400 dark:border-emerald-500/30",
  sub_manager: "bg-indigo-500/10 text-indigo-600 border-indigo-500/25 dark:text-indigo-400 dark:border-indigo-500/30",
  sales: "bg-amber-500/10 text-amber-600 border-amber-500/25 dark:text-amber-400 dark:border-amber-500/30",
};

const AppLayout: React.FC = () => {
  const { crmUser, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();

  if (!crmUser) return null;

  const isManager = canManageTeam(crmUser.role);

  const navItems = crmUser.role === "administrator"
    ? [
        { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
        { to: "/team", icon: Users, label: "Users" },
      ]
    : crmUser.role === "general_manager"
    ? [
        { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
        { to: "/team", icon: Users, label: "Team" },
      ]
    : [
        { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
        { to: "/customers", icon: Users, label: "Customers" },
        { to: "/items", icon: BarChart3, label: "Items" },
        { to: "/quotations", icon: FileText, label: "Quotations" },
        { to: "/sales-funnel", icon: TrendingUp, label: "Sales Funnel" },
        { to: "/calendar", icon: Calendar, label: "Calendar" },
        ...(isManager ? [{ to: "/team", icon: Users, label: "Team" }] : []),
      ];

  return (
    <div className="min-h-screen flex w-full">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-foreground/20 z-40 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:sticky top-0 left-0 z-50 md:z-auto
          ${sidebarCollapsed ? "w-20" : "w-64"} h-screen bg-sidebar text-sidebar-foreground
          flex flex-col transition-all duration-200 border-r border-sidebar-border/30
          ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        <div className={`p-4 flex ${sidebarCollapsed ? "flex-col items-center gap-4" : "items-center justify-between"} border-b border-sidebar-border/10 transition-all duration-300`}>
          <div className={`flex items-center ${sidebarCollapsed ? "justify-center" : "gap-3"}`}>
            <div className="w-9 h-9 rounded-xl bg-white p-1 flex items-center justify-center shadow-md border border-sidebar-border/30 shrink-0">
              <img src="/GCSS-Logoimg.png" alt="GCSS Logo" className="w-full h-full object-contain" />
            </div>
            {!sidebarCollapsed && (
              <motion.span 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="font-display font-bold text-lg text-white truncate"
              >
                SalesCRM
              </motion.span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Desktop Collapse Button */}
            <Button
              variant="ghost"
              size="icon"
              className={`hidden md:flex text-sidebar-foreground hover:bg-sidebar-accent hover:text-white rounded-xl transition-all duration-200 items-center justify-center ${
                sidebarCollapsed ? "w-10 h-10" : "w-9 h-9"
              }`}
              onClick={() => setSidebarCollapsed((prev) => !prev)}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <motion.div
                animate={{ rotate: sidebarCollapsed ? 90 : 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="flex items-center justify-center"
              >
                <FiMenu className="w-5 h-5" />
              </motion.div>
            </Button>

            {/* Mobile Close Button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-sidebar-foreground hover:bg-sidebar-accent hover:text-white rounded-xl w-9 h-9 flex items-center justify-center"
              onClick={() => setMobileOpen(false)}
              title="Close sidebar"
            >
              <motion.div
                animate={{ rotate: 90 }}
                className="flex items-center justify-center"
              >
                <FiMenu className="w-5 h-5" />
              </motion.div>
            </Button>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/dashboard"}
              className="sidebar-link sidebar-link-inactive"
              activeClassName="sidebar-link sidebar-link-active"
              onClick={() => setMobileOpen(false)}
            >
              <item.icon className="w-5 h-5" />
              <span className={`${sidebarCollapsed ? "md:hidden" : ""}`}>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-sidebar-border space-y-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent/80 px-3 py-2 rounded-xl"
            onClick={() => {
              navigate("/profile");
              setMobileOpen(false);
            }}
          >
            <UserCircle className={`w-4 h-4 ${sidebarCollapsed ? "mr-0 mx-auto" : "mr-2"}`} />
            <span className={sidebarCollapsed ? "sr-only" : ""}>Profile</span>
          </Button>
          <div 
            className={`profile-highlight flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-sidebar-accent/50 transition-colors ${
              sidebarCollapsed ? "justify-center" : ""
            }`} 
            onClick={() => { navigate("/profile"); setMobileOpen(false); }}
          >
            <div className="profile-avatar w-8 h-8 flex items-center justify-center text-xs font-semibold bg-sidebar-primary text-sidebar-primary-foreground rounded-full shrink-0">
              {crmUser.profilePicture ? (
                <img src={crmUser.profilePicture} alt={crmUser.name} className="w-full h-full rounded-full object-cover" />
              ) : (
                (crmUser.name || "User").split(" ").filter(Boolean).map((n) => n[0]).join("").substring(0, 2).toUpperCase()
              )}
            </div>
            <div className={`flex-1 min-w-0 ${sidebarCollapsed ? "md:hidden" : ""}`}>
              <p className="text-sm font-medium text-white truncate">{crmUser.name}</p>
              <p className="text-xs text-white/75 truncate">Role: {roleLabel[crmUser.role]}</p>
            </div>
          </div>
          <Button
            variant="destructive"
            size="sm"
            className="w-full justify-start px-3 py-2 rounded-xl"
            onClick={logout}
          >
            <LogOut className={`w-4 h-4 ${sidebarCollapsed ? "mr-0 mx-auto" : "mr-2"}`} />
            <span className={sidebarCollapsed ? "sr-only" : ""}>Sign Out</span>
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 app-main-surface">
        <header className="h-14 flex items-center justify-between border-b border-border app-main-header px-4 md:px-6 sticky top-0 z-30">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden mr-2 text-foreground hover:bg-accent hover:text-accent-foreground rounded-xl flex items-center justify-center"
              onClick={() => setMobileOpen(true)}
            >
              <FiMenu className="w-5 h-5" />
            </Button>
            <h2 className="text-lg font-display font-semibold capitalize">
              {location.pathname.split("/")[1] || "Dashboard"}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
