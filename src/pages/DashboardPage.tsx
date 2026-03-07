import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import StatCard from "../components/StatCard";
import { fetchQuotations } from "../lib/firestore-service";
import { Quotation } from "../types/crm";
import { FileText, TrendingUp, Clock, CheckCircle2 } from "lucide-react";

const DashboardPage = () => {
  const { crmUser } = useAuth();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadQuotations = async () => {
      if (!crmUser) return;
      
      try {
        setLoading(true);
        const data = await fetchQuotations(crmUser.id, crmUser.role);
        setQuotations(data);
      } catch (error) {
        console.error("Error fetching quotations:", error);
      } finally {
        setLoading(false);
      }
    };

    loadQuotations();
  }, [crmUser]);

  const totalQuotations = quotations.length;
  const pendingQuotations = quotations.filter(q => 
    q.stage === "quotation_created" || q.stage === "follow_up"
  ).length;
  const wonQuotations = quotations.filter(q => q.stage === "closed_won").length;
  const totalValue = quotations
    .filter(q => q.stage === "closed_won")
    .reduce((sum, q) => sum + (q.totalValue || 0), 0);

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
          Updated live from your quotations data
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Quotations"
          value={totalQuotations.toString()}
          icon={FileText}
          description="All time quotations"
        />
        <StatCard
          title="Pending"
          value={pendingQuotations.toString()}
          icon={Clock}
          description="Awaiting response"
          trend="neutral"
        />
        <StatCard
          title="Won Deals"
          value={wonQuotations.toString()}
          icon={CheckCircle2}
          description="Successful conversions"
          trend="up"
        />
        <StatCard
          title="Total Value"
          value={`$${totalValue.toLocaleString()}`}
          icon={TrendingUp}
          description="Won deals value"
          trend="up"
        />
      </div>

      <div className="dashboard-panel">
        <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
        {quotations.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No quotations yet. Create your first quotation to get started!
          </p>
        ) : (
          <div className="space-y-3">
            {quotations.slice(0, 5).map((quotation) => (
              <div
                key={quotation.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border/40 hover:bg-accent/40 transition-colors"
              >
                <div className="flex-1">
                  <p className="font-medium">{quotation.customerName}</p>
                  <p className="text-sm text-muted-foreground">
                    Quotation #{quotation.quotationNumber}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">${quotation.totalValue.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {quotation.stage.replace(/_/g, ' ')}
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
