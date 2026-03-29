import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import StatCard from "../components/StatCard";
import { fetchSalesFunnel } from "../lib/firestore-service";
import { SalesFunnel } from "../types/crm";
import { FileText, TrendingUp, Clock, CheckCircle2 } from "lucide-react";

const DashboardPage = () => {
  const { crmUser } = useAuth();
  const [funnels, setFunnels] = useState<SalesFunnel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFunnels = async () => {
      if (!crmUser) return;
      
      try {
        setLoading(true);
        const data = await fetchSalesFunnel(crmUser.id, crmUser.role);
        setFunnels(data);
      } catch (error) {
        console.error("Error fetching sales funnel:", error);
      } finally {
        setLoading(false);
      }
    };

    loadFunnels();
  }, [crmUser]);

  const quotationValue = funnels.reduce((sum, f) => sum + (f.quotationValue || 0), 0);
  const poValue = funnels
    .filter(f => f.poValue && f.poValue > 0)
    .reduce((sum, f) => sum + (f.poValue || 0), 0);
  const invoiceValue = funnels
    .filter(f => f.invoiceValue && f.invoiceValue > 0)
    .reduce((sum, f) => sum + (f.invoiceValue || 0), 0);
  const wonDeals = funnels.filter(f => f.status === "Won").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="page-container space-y-6">
      <div className="dashboard-hero flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back, {crmUser?.name || "User"}
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          Updated live from your sales data
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
      </div>

      <div className="dashboard-panel">
        <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
        {funnels.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No sales funnel entries yet. Send quotations to start tracking deals!
          </p>
        ) : (
          <div className="space-y-3">
            {funnels.slice(0, 5).map((funnel) => (
              <div
                key={funnel.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border/40 hover:bg-accent/40 transition-colors"
              >
                <div className="flex-1">
                  <p className="font-medium">{funnel.companyName}</p>
                  <p className="text-sm text-muted-foreground">
                    Quotation #{funnel.quotationNumber}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">${funnel.quotationValue.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {funnel.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
