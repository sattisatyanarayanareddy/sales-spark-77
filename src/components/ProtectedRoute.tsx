import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { UserRole } from "@/types/crm";
import { ROLE_HOME_ROUTE, hasRoleAccess } from "@/lib/access-control";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { crmUser, loading } = useAuth();
  const location = useLocation();

  console.log("🛡️ ProtectedRoute check:", { 
    loading, 
    hasCrmUser: !!crmUser, 
    role: crmUser?.role,
    allowedRoles,
    path: location.pathname 
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!crmUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!hasRoleAccess(crmUser.role, allowedRoles)) {
    return <Navigate to={ROLE_HOME_ROUTE[crmUser.role]} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
