import React from "react";
import { motion, Variants } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { CRMUser, SalesFunnel } from "@/types/crm";
import { FileText, TrendingUp, Clock, CheckCircle2, ShieldAlert } from "lucide-react";
import StatCard from "../StatCard";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Legend,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
} from "recharts";

interface SalespersonDashboardProps {
  users: CRMUser[];
  funnels: SalesFunnel[];
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } }
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card/95 backdrop-blur-md border border-border/80 p-4 rounded-xl shadow-xl space-y-1.5 text-xs">
        <p className="font-semibold text-foreground border-b border-border/40 pb-1 mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.stroke || entry.color }} />
              {entry.name}:
            </span>
            <span className="font-bold text-foreground">
              {entry.value !== undefined ? `$${(entry.value).toLocaleString()}` : "$0"}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const DonutTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const entry = payload[0];
    return (
      <div className="bg-card/95 backdrop-blur-md border border-border/80 px-3.5 py-2 rounded-xl shadow-xl text-xs flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.payload.color || entry.color }} />
        <span className="font-medium text-muted-foreground">{entry.name}:</span>
        <span className="font-bold text-foreground">{entry.value} deals</span>
      </div>
    );
  }
  return null;
};

const SALES_FUNNEL_STATUS_COLORS: Record<string, string> = {
  Hot: "bg-red-500/10 text-red-500 border-red-500/25",
  Warm: "bg-orange-500/10 text-orange-500 border-orange-500/25",
  Cold: "bg-purple-500/10 text-purple-500 border-purple-500/25",
  Won: "bg-green-500/10 text-green-500 border-green-500/25",
  Lost: "bg-rose-950/10 text-rose-600 border-rose-950/25",
  Closed: "bg-slate-500/10 text-slate-500 border-slate-500/25",
  Cancelled: "bg-yellow-500/10 text-yellow-500 border-yellow-500/25",
};

export const SalespersonDashboard: React.FC<SalespersonDashboardProps> = ({
  users,
  funnels,
}) => {
  // All metrics calculations (only active funnels)
  const activeFunnels = funnels.filter((f) => !f.disabled);
  const quotationValue = activeFunnels.reduce((sum, f) => sum + (f.quotationValue || 0), 0);
  const poValue = activeFunnels.filter(f => f.poValue && f.poValue > 0).reduce((sum, f) => sum + (f.poValue || 0), 0);
  const invoiceValue = activeFunnels.filter(f => f.invoiceValue && f.invoiceValue > 0).reduce((sum, f) => sum + (f.invoiceValue || 0), 0);
  const wonDeals = activeFunnels.filter(f => f.status === "Won").length;
  const paymentDues = activeFunnels.reduce((sum, f) => sum + (f.pendingPayment || 0), 0);

  // Recent activities include disabled entries (max 5)
  const recentActivities = funnels.slice(0, 5);

  const statusCounts = activeFunnels.reduce((acc, f) => {
    acc[f.status] = (acc[f.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const donutData = Object.entries(statusCounts).map(([status, count]) => {
    let color = "#2563eb";
    if (status === "Won") color = "#10b981";
    else if (status === "Closed") color = "#059669";
    else if (status === "Hot") color = "#ef4444";
    else if (status === "Warm") color = "#f97316";
    else if (status === "Cold") color = "#3b82f6";
    else if (status === "Lost") color = "#dc2626";
    else if (status === "Cancelled") color = "#6b7280";
    return { name: status, value: count, color };
  });

  const getMonthlyTrendData = () => {
    const monthsMap: Record<string, { month: string; rawDate: Date; poValue: number; invoiceValue: number; paymentDues: number }> = {};
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleString("default", { month: "short", year: "2-digit" });
      monthsMap[key] = {
        month: key,
        rawDate: d,
        poValue: 0,
        invoiceValue: 0,
        paymentDues: 0,
      };
    }

    activeFunnels.forEach((f) => {
      const date = f.createdAt ? new Date(f.createdAt) : null;
      if (!date || isNaN(date.getTime())) return;
      const key = date.toLocaleString("default", { month: "short", year: "2-digit" });

      if (!monthsMap[key]) {
        monthsMap[key] = {
          month: key,
          rawDate: date,
          poValue: 0,
          invoiceValue: 0,
          paymentDues: 0,
        };
      }
      monthsMap[key].poValue += f.poValue || 0;
      monthsMap[key].invoiceValue += f.invoiceValue || 0;
      monthsMap[key].paymentDues += f.pendingPayment || 0;
    });

    return Object.values(monthsMap).sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());
  };

  const monthlyTrendData = getMonthlyTrendData();

  return (
    <div className="space-y-6">
      {/* Metrics Banner */}
      <motion.div variants={itemVariants} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="Quotation Value"
          value={`$${quotationValue.toLocaleString()}`}
          icon={FileText}
          description="Value in sales pipeline"
          variant="default"
        />
        <StatCard
          title="PO Value"
          value={`$${poValue.toLocaleString()}`}
          icon={TrendingUp}
          description="Purchase orders generated"
          variant="amber"
        />
        <StatCard
          title="Invoice Value"
          value={`$${invoiceValue.toLocaleString()}`}
          icon={CheckCircle2}
          description="Generated invoices"
          variant="emerald"
        />
        <StatCard
          title="Won Deals"
          value={wonDeals.toString()}
          icon={Clock}
          description="Converted sales count"
          variant="default"
        />
        <StatCard
          title="Payment Dues"
          value={`$${paymentDues.toLocaleString()}`}
          icon={ShieldAlert}
          description="Outstanding receivables"
          variant="rose"
        />
      </motion.div>

      {/* Charts Section */}
      <motion.div variants={itemVariants} className="grid gap-6 md:grid-cols-5">
        {/* Monthly Trend Area Chart */}
        <div className="md:col-span-3 dashboard-panel relative flex flex-col justify-between overflow-hidden">
          <div>
            <h3 className="text-lg font-bold tracking-tight text-foreground">Monthly Financial Trend</h3>
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">Comparison of PO Value, Invoiced Value and Payment Dues</p>
          </div>
          <div className="h-72 w-full mt-6 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthlyTrendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorInv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="month"
                  stroke="#888888"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  dy={10}
                />
                <YAxis
                  stroke="#888888"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `$${value.toLocaleString()}`}
                  dx={-5}
                />
                <RechartsTooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="poValue"
                  name="PO Value"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorPo)"
                />
                <Area
                  type="monotone"
                  dataKey="invoiceValue"
                  name="Invoice Value"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorInv)"
                />
                <Line
                  type="monotone"
                  dataKey="paymentDues"
                  name="Payment Dues"
                  stroke="#ef4444"
                  strokeWidth={3}
                  dot={{ r: 3, stroke: "#ef4444", strokeWidth: 1.5, fill: "#fff" }}
                  activeDot={{ r: 5, stroke: "#ef4444", strokeWidth: 2 }}
                />
                <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', fontWeight: 500 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sales Funnel Donut Chart */}
        <div className="md:col-span-2 dashboard-panel relative flex flex-col justify-between overflow-hidden">
          <div>
            <h3 className="text-lg font-bold tracking-tight text-foreground">Sales Funnel</h3>
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">Distribution of current deals across funnel stages</p>
          </div>

          {donutData.length === 0 ? (
            <div className="h-72 flex flex-col items-center justify-center text-muted-foreground text-xs font-medium">
              <Clock className="w-10 h-10 text-muted-foreground/30 mb-2" />
              No funnel stages tracked yet.
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
              <div className="relative w-48 h-48 flex-shrink-0 mx-auto sm:mx-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <RechartsTooltip content={<DonutTooltip />} />
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={62}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {donutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-extrabold text-foreground tracking-tight">
                    {activeFunnels.length}
                  </span>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mt-0.5">
                    Total Deals
                  </span>
                </div>
              </div>

              <div className="flex-1 space-y-1.5 w-full">
                {donutData.map((entry, index) => {
                  const totalDeals = activeFunnels.length;
                  const percentage = totalDeals > 0
                    ? Math.round((entry.value / totalDeals) * 100)
                    : 0;
                  return (
                    <div key={index} className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg hover:bg-accent/40 transition-all">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                        <span className="font-semibold text-muted-foreground">{entry.name}</span>
                      </div>
                      <div className="text-right flex items-center gap-3">
                        <span className="font-bold text-foreground">{entry.value}</span>
                        <span className="text-[10px] font-medium text-white bg-accent px-1.5 py-0.5 rounded-md">
                          {percentage}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Recent Activity (Funnels) */}
      <motion.div variants={itemVariants} className="dashboard-panel md:col-span-3">
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
    </div>
  );
};
