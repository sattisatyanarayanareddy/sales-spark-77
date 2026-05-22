import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchTeamUsers, updateUserDoc, updateUserStatus } from "@/lib/firestore-service";
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
import { Loader2, Plus, AlertCircle, Pencil, Lock, Unlock } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

const roleBadge: Record<string, string> = {
  administrator: "bg-purple-100 text-purple-700",
  general_manager: "bg-success/10 text-success",
  sub_manager: "bg-info/10 text-info",
  sales: "bg-warning/10 text-warning",
};

const roleLabel: Record<string, string> = {
  administrator: "Admin",
  general_manager: "General Manager",
  sub_manager: "Manager",
  sales: "Salesperson",
};

const TeamPage: React.FC = () => {
  const { crmUser, createUser, resetPassword } = useAuth();
  const [teamUsers, setTeamUsers] = useState<CRMUser[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [userCount, setUserCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingUser, setEditingUser] = useState<CRMUser | null>(null);
  const [managerId, setManagerId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("sales");
  const [department, setDepartment] = useState("");
  const defaultPassword = "Welcome@123";
  const [password, setPassword] = useState(defaultPassword);

  const loadData = async () => {
    if (!crmUser) return;
    setLoading(true);
    try {
      const users = await fetchTeamUsers(crmUser.id, crmUser.role);
      setTeamUsers(users);
      const totalUsers = crmUser.role === "general_manager" || crmUser.role === "administrator" ? users.length + 1 : users.length;
      setUserCount(totalUsers);
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
    if (!name || !email || !role || !department || !password) {
      toast.error("Please fill all fields");
      return;
    }

    if (crmUser.role !== "general_manager" && crmUser.role !== "administrator" && role === "general_manager") {
      toast.error("Only General Manager or Administrator can assign the General Manager role");
      return;
    }

    setSubmitting(true);
    try {
      let finalManagerId: string | null = null;
      if (crmUser.role === "administrator") {
        if (role === "sub_manager" || role === "sales") {
          finalManagerId = managerId || null;
        }
      } else {
        finalManagerId = role === "general_manager" || role === "administrator" ? null : crmUser!.id;
      }

      await createUser(
        email,
        password,
        name,
        role,
        department,
        finalManagerId
      );
      toast.success(`Team member added! Temporary password: ${password}`);
      setShowAddDialog(false);
      setName("");
      setEmail("");
      setRole("sales");
      setDepartment("");
      setPassword(defaultPassword);
      setManagerId(null);
      await loadData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to add team member");
    } finally {
      setSubmitting(false);
    }
  };

  const pageTitle = crmUser?.role === "administrator" ? "Users" : "Team Management";
  const addButtonLabel = crmUser?.role === "administrator" ? "Add User" : "Add Team Member";
  const addDialogTitle = crmUser?.role === "administrator" ? "Add User" : "Add Team Member";
  const addDialogDescription = crmUser?.role === "administrator"
    ? "Create a new user and set the initial password here. They can still reset it later via \"Forgot password\"."
    : "Create a new team member with a password. They can reset it later via \"Forgot password\".";

  const filteredUsers = teamUsers.filter((user) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return [user.name, user.email, user.department, roleLabel[user.role]].join(" ").toLowerCase().includes(query);
  });

  const openEditUser = (user: CRMUser) => {
    setEditingUser(user);
    setName(user.name);
    setEmail(user.email);
    setRole(user.role);
    setDepartment(user.department);
    setManagerId(user.managerId);
    setShowEditDialog(true);
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || !name || !role || !department) {
      toast.error("Please fill all fields");
      return;
    }

    if (crmUser.role !== "general_manager" && crmUser.role !== "administrator" && role === "general_manager") {
      toast.error("Only General Manager or Administrator can assign the General Manager role");
      return;
    }

    setSubmitting(true);
    try {
      let finalManagerId: string | null = editingUser.managerId;
      if (crmUser.role === "administrator") {
        if (role === "sub_manager" || role === "sales") {
          finalManagerId = managerId;
        } else {
          finalManagerId = null;
        }
      }

      await updateUserDoc(editingUser.id, {
        name,
        role,
        department,
        managerId: finalManagerId,
      });
      toast.success("User updated successfully");
      setShowEditDialog(false);
      setEditingUser(null);
      setManagerId(null);
      await loadData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to update user");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendResetLink = async (email: string) => {
    setSubmitting(true);
    try {
      await resetPassword(email);
      toast.success(`Reset password link sent to ${email}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to send reset link");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (user: CRMUser) => {
    if (user.id === crmUser.id) {
      toast.error("You cannot disable your own account");
      return;
    }
    const currentDisabled = !!user.disabled;
    const newStatus = !currentDisabled;
    const actionText = newStatus ? "disable" : "enable";
    const confirmed = window.confirm(`Are you sure you want to ${actionText} user ${user.name}?`);
    if (!confirmed) return;

    try {
      await updateUserStatus(user.id, newStatus);
      toast.success(`User ${newStatus ? "disabled" : "enabled"} successfully`);
      await loadData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || `Failed to ${actionText} user`);
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
        <h2 className="section-title">{pageTitle}</h2>
        {(crmUser.role === "general_manager" || crmUser.role === "sub_manager" || crmUser.role === "administrator") && (
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                {addButtonLabel}
              </Button>
            </DialogTrigger>
            <DialogContent className="w-full max-w-md sm:max-w-md max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{addDialogTitle}</DialogTitle>
                <DialogDescription>{addDialogDescription}</DialogDescription>
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
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Set a password for the user"
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Admin can set the initial password here. If left blank, the default temporary password will be used.
                </p>

                <div className="space-y-2">
                  <Label htmlFor="role">Role *</Label>
                  <Select value={role} onValueChange={(val) => { setRole(val as UserRole); setManagerId(null); }}>
                    <SelectTrigger id="role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sales">Salesperson</SelectItem>
                      <SelectItem value="sub_manager">Manager</SelectItem>
                      {(crmUser.role === "general_manager" || crmUser.role === "administrator") && (
                        <SelectItem value="general_manager">General Manager</SelectItem>
                      )}
                      {crmUser.role === "administrator" && (
                        <SelectItem value="administrator">Admin</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {crmUser.role === "administrator" && role === "sub_manager" && (
                  <div className="space-y-2">
                    <Label htmlFor="gm-select">Assign General Manager</Label>
                    <Select value={managerId || "none"} onValueChange={(val) => setManagerId(val === "none" ? null : val)}>
                      <SelectTrigger id="gm-select">
                        <SelectValue placeholder="Select General Manager" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned / None</SelectItem>
                        {teamUsers.filter((u) => u.role === "general_manager").map((gm) => (
                          <SelectItem key={gm.id} value={gm.id}>{gm.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {crmUser.role === "administrator" && role === "sales" && (
                  <div className="space-y-2">
                    <Label htmlFor="manager-select">Assign Manager</Label>
                    <Select value={managerId || "none"} onValueChange={(val) => setManagerId(val === "none" ? null : val)}>
                      <SelectTrigger id="manager-select">
                        <SelectValue placeholder="Select Manager" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned / None</SelectItem>
                        {teamUsers.filter((u) => u.role === "sub_manager").map((m) => (
                          <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

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

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total users</p>
          <p className="text-3xl font-semibold">{userCount}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Admin controls</p>
          <p className="text-sm">
            {crmUser.role === "general_manager"
              ? "Create any user and send reset links when needed."
              : "Manage your team and send password reset links to team members."}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium">Search users</p>
          <Input
            type="search"
            placeholder="Search by name, email, role, department"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-md"
          />
        </div>
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
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => {
                const isUserDisabled = !!user.disabled;
                return (
                  <TableRow key={user.id} className={isUserDisabled ? "opacity-60 bg-muted/10" : ""}>
                    <TableCell className="font-medium flex items-center gap-2">
                      {user.name}
                      {isUserDisabled && (
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-5 bg-destructive/10 text-destructive border-destructive/20 font-semibold">
                          Disabled
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`border-0 ${roleBadge[user.role]}`}>
                        {roleLabel[user.role]}
                      </Badge>
                    </TableCell>
                    <TableCell>{user.department}</TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="action-btn"
                          onClick={() => handleSendResetLink(user.email)}
                          disabled={isUserDisabled}
                          title={isUserDisabled ? "Cannot reset password for disabled user" : "Send Reset Link"}
                        >
                          <AlertCircle className="w-4 h-4 text-primary" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="action-btn"
                          onClick={() => openEditUser(user)}
                          disabled={isUserDisabled}
                          title={isUserDisabled ? "Cannot edit disabled user" : "Edit"}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={isUserDisabled ? "text-success hover:bg-success/10 hover:text-success" : "text-amber-500 hover:bg-amber-500/10 hover:text-amber-500"}
                          onClick={() => handleToggleStatus(user)}
                          title={isUserDisabled ? "Enable User" : "Disable User"}
                        >
                          {isUserDisabled ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No team members</TableCell>
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
              <Select value={role} onValueChange={(val) => { setRole(val as UserRole); setManagerId(null); }}>
                <SelectTrigger id="edit-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">Salesperson</SelectItem>
                  <SelectItem value="sub_manager">Manager</SelectItem>
                  {(crmUser.role === "general_manager" || crmUser.role === "administrator") && (
                    <SelectItem value="general_manager">General Manager</SelectItem>
                  )}
                  {crmUser.role === "administrator" && (
                    <SelectItem value="administrator">Admin</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {crmUser.role === "administrator" && role === "sub_manager" && (
              <div className="space-y-2">
                <Label htmlFor="edit-gm-select">Assign General Manager</Label>
                <Select value={managerId || "none"} onValueChange={(val) => setManagerId(val === "none" ? null : val)}>
                  <SelectTrigger id="edit-gm-select">
                    <SelectValue placeholder="Select General Manager" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned / None</SelectItem>
                    {teamUsers.filter((u) => u.role === "general_manager").map((gm) => (
                      <SelectItem key={gm.id} value={gm.id}>{gm.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {crmUser.role === "administrator" && role === "sales" && (
              <div className="space-y-2">
                <Label htmlFor="edit-manager-select">Assign Manager</Label>
                <Select value={managerId || "none"} onValueChange={(val) => setManagerId(val === "none" ? null : val)}>
                  <SelectTrigger id="edit-manager-select">
                    <SelectValue placeholder="Select Manager" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned / None</SelectItem>
                    {teamUsers.filter((u) => u.role === "sub_manager").map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

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
