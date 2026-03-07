import { Toaster } from "./components/ui/toaster";
import { Toaster as Sonner } from "./components/ui/sonner";
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
import TeamPage from "./pages/TeamPage";
import NotFound from "./pages/NotFound";
import { QUOTATION_CREATE_ALLOWED_ROLES, TEAM_ALLOWED_ROLES } from "./lib/access-control";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const { crmUser, loading } = useAuth();

  if (!isFirebaseConfigured) {
    return (
      <Routes>
        <Route path="*" element={<SetupPage />} />
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

      <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="quotations" element={<QuotationsPage />} />
        <Route path="quotations/new" element={<ProtectedRoute allowedRoles={QUOTATION_CREATE_ALLOWED_ROLES}><CreateQuotationPage /></ProtectedRoute>} />
        <Route path="team" element={<ProtectedRoute allowedRoles={TEAM_ALLOWED_ROLES}><TeamPage /></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
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

export default App;
