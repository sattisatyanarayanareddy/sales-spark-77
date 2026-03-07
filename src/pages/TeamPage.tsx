import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getTeamMembers, getUsers } from "@/lib/demo-data";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

const roleBadge: Record<string, string> = {
  general_manager: "bg-success/10 text-success",
  sub_manager: "bg-info/10 text-info",
  sales: "bg-warning/10 text-warning",
};

const roleLabel: Record<string, string> = {
  general_manager: "General Manager",
  sub_manager: "Sub Manager",
  sales: "Sales Person",
};

const TeamPage: React.FC = () => {
  const { crmUser } = useAuth();
  if (!crmUser) return null;

  const allUsers = getUsers();
  const teamMembers = crmUser.role === "general_manager"
    ? allUsers.filter((u) => u.id !== crmUser.id)
    : allUsers.filter((u) => u.managerId === crmUser.id);

  const teamStats = getTeamMembers(crmUser.id, crmUser.role);

  return (
    <div className="page-container space-y-6">
      <h2 className="section-title">Team Management</h2>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="stat-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Department</TableHead>
                <TableHead className="text-right">Active Deals</TableHead>
                <TableHead className="text-right">Sales Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamMembers.map((user) => {
                const stats = teamStats.find((t) => t.id === user.id);
                return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`border-0 ${roleBadge[user.role]}`}>
                        {roleLabel[user.role]}
                      </Badge>
                    </TableCell>
                    <TableCell>{user.department}</TableCell>
                    <TableCell className="text-right">{stats?.activeDeals ?? 0}</TableCell>
                    <TableCell className="text-right font-medium">${(stats?.totalSalesValue ?? 0).toLocaleString()}</TableCell>
                  </TableRow>
                );
              })}
              {teamMembers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No team members</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </motion.div>
    </div>
  );
};

export default TeamPage;
