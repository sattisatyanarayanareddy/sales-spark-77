import React from "react";
import { motion, Variants } from "framer-motion";
import { Users } from "lucide-react";
import { CRMUser } from "@/types/crm";
import StatCard from "../StatCard";

interface AdminDashboardProps {
  users: CRMUser[];
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } }
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ users }) => {
  const sortedUsers = [...users].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });
  const recentUsers = sortedUsers.slice(0, 5);

  return (
    <div className="space-y-6">
      <motion.div variants={itemVariants} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Users"
          value={users.filter((u) => u.role !== "administrator").length.toString()}
          icon={Users}
          description="Registered users in the CRM (excluding admins)"
          variant="default"
        />
      </motion.div>

      <motion.div variants={itemVariants} className="dashboard-panel">
        <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
        {recentUsers.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No user activity available yet.
          </p>
        ) : (
          <div className="space-y-3">
            {recentUsers.map((user) => (
              <div
                key={user.id}
                className="p-3.5 rounded-xl border border-border/40 hover:bg-accent/40 transition-all duration-300"
              >
                <p className="font-semibold text-sm">{user.name || user.email}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Role: {user.role.replace("_", " ")} • {user.department}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Joined: {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "Unknown"}
                </p>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};
