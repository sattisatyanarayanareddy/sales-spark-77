import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchTeamUsers, fetchQuotations, computeTeamMembers } from "@/lib/firestore-service";
import { CRMUser } from "@/types/crm";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
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
  const [teamUsers, setTeamUsers] = useState<CRMUser[]>([]);
  const [teamStats, setTeamStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!crmUser) return;
    const load = async () => {
      setLoading(true);
      try {
        const [users, quotations] = await Promise.all([
          fetchTeamUsers(crmUser.id, crmUser.role),
          fetchQuotations(crmUser.id, crmUser.role),
        ]);
        setTeamUsers(users);
        setTeamStats(computeTeamMembers(users, quotations));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [crmUser]);

  if (!crmUser) return null;

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

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
              {teamUsers.map((user) => {
                const stats = teamStats.find((t: any) => t.id === user.id);
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
              {teamUsers.length === 0 && (
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
