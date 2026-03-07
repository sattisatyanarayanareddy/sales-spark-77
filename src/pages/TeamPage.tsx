import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchTeamUsers, fetchQuotations, computeTeamMembers, updateUserDoc, deleteUserDoc } from "@/lib/firestore-service";
import { CRMUser, UserRole } from "@/types/crm";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, AlertCircle, Pencil, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

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
  const { crmUser, createUser } = useAuth();
  const [teamUsers, setTeamUsers] = useState<CRMUser[]>([]);
  const [teamStats, setTeamStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingUser, setEditingUser] = useState<CRMUser | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("sales");
  const [department, setDepartment] = useState("");
  const [defaultPassword] = useState("Welcome@123");

  const loadData = async () => {
    if (!crmUser) return;
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
      toast.error("Failed to load team data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [crmUser]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !role || !department) {
      toast.error("Please fill all fields");
      return;
    }

    setSubmitting(true);
    try {
      const managerId = crmUser!.id;
      await createUser(
        email,
        defaultPassword,
        name,
        role,
        department,
        managerId
      );
      toast.success(`Team member added! Default password: ${defaultPassword}`);
      setShowAddDialog(false);
      setName("");
      setEmail("");
      setRole("sales");
      setDepartment("");
      await loadData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to add team member");
    } finally {
      setSubmitting(false);
    }
  };

  const openEditUser = (user: CRMUser) => {
    setEditingUser(user);
    setName(user.name);
    setEmail(user.email);
    setRole(user.role);
    setDepartment(user.department);
    setShowEditDialog(true);
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || !name || !role || !department) {
      toast.error("Please fill all fields");
      return;
    }

    if (crmUser.role !== "general_manager" && role === "general_manager") {
      toast.error("Sub manager cannot assign General Manager role");
      return;
    }

    setSubmitting(true);
    try {
      await updateUserDoc(editingUser.id, {
        name,
        role,
        department,
        managerId: editingUser.managerId,
      });
      toast.success("User updated successfully");
      setShowEditDialog(false);
      setEditingUser(null);
      await loadData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to update user");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (user: CRMUser) => {
    if (user.id === crmUser.id) {
      toast.error("You cannot delete your own account");
      return;
    }

    const confirmed = window.confirm(`Delete user ${user.name}? This will remove the user profile from Firestore.`);
    if (!confirmed) return;

    try {
      await deleteUserDoc(user.id);
      toast.success("User deleted from team");
      await loadData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to delete user");
    }
  };

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
      <div className="flex items-center justify-between">
        <h2 className="section-title">Team Management</h2>
        {(crmUser.role === "general_manager" || crmUser.role === "sub_manager") && (
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Team Member
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add Team Member</DialogTitle>
                <DialogDescription>
                  Create a new team member. Default password: <strong>{defaultPassword}</strong>. They can reset it via "Forgot password" on login.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleAddMember} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john@company.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Role *</Label>
                  <Select value={role} onValueChange={(val) => setRole(val as UserRole)}>
                    <SelectTrigger id="role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sales">Sales Person</SelectItem>
                      <SelectItem value="sub_manager">Sub Manager</SelectItem>
                      {crmUser.role === "general_manager" && (
                        <SelectItem value="general_manager">General Manager</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="department">Department *</Label>
                  <Input
                    id="department"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Sales"
                    required
                  />
                </div>

                <div className="flex items-start gap-2 p-3 rounded-lg bg-info/5 border border-info/20">
                  <AlertCircle className="w-4 h-4 text-info shrink-0 mt-0.5" />
                  <p className="text-xs text-info">
                    User can reset password via "Forgot password?" link on the login page.
                  </p>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setShowAddDialog(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1" disabled={submitting}>
                    {submitting ? "Adding..." : "Add Member"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

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
                <TableHead className="text-right">Actions</TableHead>
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
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="action-btn" onClick={() => openEditUser(user)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="action-btn action-btn-danger" onClick={() => handleDeleteUser(user)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {teamUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No team members</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </motion.div>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Team Member</DialogTitle>
            <DialogDescription>
              Update user role and profile details.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditUser} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Full Name *</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input id="edit-email" value={email} disabled />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-role">Role *</Label>
              <Select value={role} onValueChange={(val) => setRole(val as UserRole)}>
                <SelectTrigger id="edit-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">Sales Person</SelectItem>
                  <SelectItem value="sub_manager">Sub Manager</SelectItem>
                  {crmUser.role === "general_manager" && (
                    <SelectItem value="general_manager">General Manager</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-department">Department *</Label>
              <Input
                id="edit-department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                required
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={submitting}>
                {submitting ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeamPage;
