import { useEffect } from "react";
import { Toaster } from "./components/ui/toaster";
import { Toaster as Sonner, toast } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { isFirebaseConfigured } from "./lib/firebase";
import AppLayout from "./components/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import SetupPage from "./pages/SetupPage";
import DashboardPage from "./pages/DashboardPage";
import QuotationsPage from "./pages/QuotationsPage";
import CreateQuotationPage from "./pages/CreateQuotationPage";
import SendEmailPage from "./pages/SendEmailPage";
import CustomersPage from "./pages/CustomersPage";
import ItemsPage from "./pages/ItemsPage";
import TeamPage from "./pages/TeamPage";
import SalesFunnelPage from "./pages/SalesFunnelPage";
import SalesPersonProfilePage from "./pages/SalesPersonProfilePage";
import ProfileSetupPage from "./pages/ProfileSetupPage";
import CalendarPage from "./pages/CalendarPage";
import NotFound from "./pages/NotFound";
import { QUOTATION_CREATE_ALLOWED_ROLES, TEAM_ALLOWED_ROLES } from "./lib/access-control";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const { crmUser, loading } = useAuth();

  if (!isFirebaseConfigured) {
    return (
      <Routes>
        <Route path="*" element={<NotFound envMissing />} />
      </Routes>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={crmUser ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route
        path="/profile-setup"
        element={
          <ProtectedRoute allowMissingCrmUser>
            <ProfileSetupPage />
          </ProtectedRoute>
        }
      />

      <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="quotations" element={<QuotationsPage />} />
        <Route path="quotations/new" element={<ProtectedRoute allowedRoles={QUOTATION_CREATE_ALLOWED_ROLES}><CreateQuotationPage /></ProtectedRoute>} />
        <Route path="quotations/edit/:id" element={<ProtectedRoute allowedRoles={QUOTATION_CREATE_ALLOWED_ROLES}><CreateQuotationPage /></ProtectedRoute>} />
        <Route path="quotations/send-email/:id" element={<ProtectedRoute allowedRoles={QUOTATION_CREATE_ALLOWED_ROLES}><SendEmailPage /></ProtectedRoute>} />
        <Route path="sales-funnel" element={<SalesFunnelPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="items" element={<ItemsPage />} />
        <Route path="team" element={<ProtectedRoute allowedRoles={TEAM_ALLOWED_ROLES}><TeamPage /></ProtectedRoute>} />
        <Route path="profile" element={<SalesPersonProfilePage />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const useGlobalErrorToast = () => {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      const message = event.error?.message || event.message || "An unexpected error occurred.";
      toast.error(message);
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = reason?.message || String(reason) || "Unhandled promise rejection.";
      toast.error(message);
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);
};

const App = () => {
  useGlobalErrorToast();

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
