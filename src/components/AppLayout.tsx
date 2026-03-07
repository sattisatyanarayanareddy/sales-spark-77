import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { NavLink } from "@/components/NavLink";
import { useLocation, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  Users,
  LogOut,
  BarChart3,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { canManageTeam } from "@/lib/access-control";

const roleLabel = {
  general_manager: "General Manager",
  sub_manager: "Sub Manager",
  sales: "Sales Person",
};

const roleBadgeClass = {
  general_manager: "bg-success/10 text-success border-success/20",
  sub_manager: "bg-info/10 text-info border-info/20",
  sales: "bg-warning/10 text-warning border-warning/20",
};

const AppLayout: React.FC = () => {
  const { crmUser, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  if (!crmUser) return null;

  const isManager = canManageTeam(crmUser.role);

  const navItems = [
    { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/quotations", icon: FileText, label: "Quotations" },
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
          w-64 h-screen bg-sidebar text-sidebar-foreground
          flex flex-col transition-transform duration-200
          ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        <div className="p-6 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sidebar-primary flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          <span className="font-display font-bold text-lg">SalesCRM</span>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto md:hidden text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={() => setMobileOpen(false)}
          >
            <X className="w-5 h-5" />
          </Button>
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
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-sidebar-accent flex items-center justify-center text-sm font-semibold">
              {crmUser.name.split(" ").map((n) => n[0]).join("")}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{crmUser.name}</p>
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${roleBadgeClass[crmUser.role]}`}>
                {roleLabel[crmUser.role]}
              </Badge>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={logout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 flex items-center border-b border-border bg-card px-4 md:px-6 sticky top-0 z-30">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden mr-2"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </Button>
          <h2 className="text-lg font-display font-semibold capitalize">
            {location.pathname.split("/")[1] || "Dashboard"}
          </h2>
        </header>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
