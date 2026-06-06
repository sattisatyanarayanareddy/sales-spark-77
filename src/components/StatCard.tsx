import { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type StatCardVariant = "indigo" | "amber" | "emerald" | "rose" | "violet" | "default";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
  variant?: StatCardVariant;
}

const variantClasses = {
  indigo: {
    border: "hover:border-indigo-500/40 hover:shadow-indigo-500/[0.04] dark:hover:border-indigo-400/30",
    icon: "bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 ring-indigo-500/20",
    glow: "from-indigo-500/[0.03] to-transparent",
    borderLeft: "border-l-4 border-l-indigo-500"
  },
  amber: {
    border: "hover:border-amber-500/40 hover:shadow-amber-500/[0.04] dark:hover:border-amber-400/30",
    icon: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 ring-amber-500/20",
    glow: "from-amber-500/[0.03] to-transparent",
    borderLeft: "border-l-4 border-l-amber-500"
  },
  emerald: {
    border: "hover:border-emerald-500/40 hover:shadow-emerald-500/[0.04] dark:hover:border-emerald-400/30",
    icon: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 ring-emerald-500/20",
    glow: "from-emerald-500/[0.03] to-transparent",
    borderLeft: "border-l-4 border-l-emerald-500"
  },
  rose: {
    border: "hover:border-rose-500/40 hover:shadow-rose-500/[0.04] dark:hover:border-rose-400/30",
    icon: "bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 ring-rose-500/20",
    glow: "from-rose-500/[0.03] to-transparent",
    borderLeft: "border-l-4 border-l-rose-500"
  },
  violet: {
    border: "hover:border-violet-500/40 hover:shadow-violet-500/[0.04] dark:hover:border-violet-400/30",
    icon: "bg-violet-500/10 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400 ring-violet-500/20",
    glow: "from-violet-500/[0.03] to-transparent",
    borderLeft: "border-l-4 border-l-violet-500"
  },
  default: {
    border: "hover:border-primary/40 hover:shadow-primary/[0.04] dark:hover:border-primary/30",
    icon: "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-foreground ring-primary/20",
    glow: "from-primary/[0.03] to-transparent",
    borderLeft: "border-l-4 border-l-primary"
  }
};

const StatCard = ({ title, value, description, icon: Icon, trend, variant = "default" }: StatCardProps) => {
  const styles = variantClasses[variant] || variantClasses.default;

  return (
    <Card className={cn(
      "stat-card p-0 overflow-hidden bg-card/90 backdrop-blur-md border border-border/70 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 ease-out relative group",
      styles.border,
      styles.borderLeft
    )}>
      {/* Background radial soft glow gradient */}
      <div className={cn("absolute -right-12 -top-12 w-36 h-36 rounded-full blur-2xl bg-gradient-to-br transition-opacity duration-500 group-hover:opacity-100 opacity-50 pointer-events-none", styles.glow)} />
      
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-5 pb-1.5 relative z-10">
        <CardTitle className="text-[11px] font-bold tracking-wider text-muted-foreground/80 uppercase">{title}</CardTitle>
        <div className={cn("p-2 rounded-xl transition-all duration-300 ring-4 ring-transparent group-hover:scale-105", styles.icon)}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      
      <CardContent className="p-5 pt-0 relative z-10">
        <div className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/85 bg-clip-text text-transparent">{value}</div>
        {description && (
          <p className="text-[11px] text-muted-foreground/90 mt-1.5 font-medium">{description}</p>
        )}
      </CardContent>
    </Card>
  );
};

export default StatCard;
