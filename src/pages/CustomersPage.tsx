import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { subscribeToCustomers, subscribeToAllUsers, updateCustomerStatus, createCustomer, updateCustomerDoc } from "../lib/firestore-service";
import { CRMUser, Customer } from "../types/crm";
import { Plus, Lock, Unlock, Loader2, Edit } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";

const CustomersPage = () => {
  const { crmUser } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<CRMUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    companyName: "",
    email: "",
    phone: "",
    department: "",
  });

  useEffect(() => {
    if (!crmUser) return;
    setLoading(true);

    const unsubscribeCustomers = subscribeToCustomers(crmUser.id, crmUser.role, (data) => {
      setCustomers(data);
      setLoading(false);
    });

    const unsubscribeUsers = subscribeToAllUsers((allUsers) => {
      setUsers(allUsers);
    });

    return () => {
      unsubscribeCustomers();
      unsubscribeUsers();
    };
  }, [crmUser]);

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!crmUser || !formData.name || !formData.companyName || !formData.email || !formData.phone) {
      toast.error("Name, Company Name, Email, and Phone are required");
      return;
    }

    setSubmitting(true);
    try {
      await createCustomer({
        name: formData.name,
        companyName: formData.companyName,
        email: formData.email,
        phone: formData.phone,
        department: formData.department,
        createdBy: crmUser.id,
        userEmail: crmUser.email,
      });

      setFormData({
        name: "",
        companyName: "",
        email: "",
        phone: "",
        department: "",
      });
      setOpen(false);
      toast.success("Customer added successfully");
    } catch (error) {
      console.error("Error adding customer:", error);
      toast.error("Failed to add customer");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (id: string, currentDisabled: boolean) => {
    const newStatus = !currentDisabled;
    const actionText = newStatus ? "disable" : "enable";
    if (!confirm(`Are you sure you want to ${actionText} this customer?`)) return;
    try {
      await updateCustomerStatus(id, newStatus);
      toast.success(`Customer ${newStatus ? "disabled" : "enabled"} successfully`);
    } catch (error) {
      console.error("Error updating customer status:", error);
      toast.error(`Failed to ${actionText} customer`);
    }
  };

  const openEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setEditOpen(true);
  };

  const handleEditCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;

    if (!editingCustomer.name || !editingCustomer.companyName || !editingCustomer.email || !editingCustomer.phone) {
      toast.error("Name, Company Name, Email, and Phone are required");
      return;
    }

    setSubmitting(true);
    try {
      await updateCustomerDoc(editingCustomer.id, {
        name: editingCustomer.name,
        companyName: editingCustomer.companyName,
        email: editingCustomer.email,
        phone: editingCustomer.phone,
        department: editingCustomer.department,
      });
      setEditOpen(false);
      setEditingCustomer(null);
      toast.success("Customer updated successfully");
    } catch (error) {
      console.error("Error updating customer:", error);
      toast.error("Failed to update customer");
    } finally {
      setSubmitting(false);
    }
  };

  const allowedCustomerCreators = useMemo(() => {
    if (!crmUser) return null;
    if (crmUser.role === "administrator" || crmUser.role === "general_manager") {
      return null;
    }

    if (crmUser.role === "sub_manager") {
      return [
        crmUser.id,
        ...users.filter((u) => u.managerId === crmUser.id && u.role === "sales").map((u) => u.id),
      ];
    }

    if (crmUser.role === "sales") {
      const teamSales = users.filter((u) => u.managerId === crmUser.managerId && u.role === "sales").map((u) => u.id);
      const managerIds = crmUser.managerId ? [crmUser.managerId] : [];
      return Array.from(new Set([crmUser.id, ...managerIds, ...teamSales]));
    }

    return [crmUser.id];
  }, [crmUser, users]);

  const visibleCustomers = useMemo(() => {
    if (!allowedCustomerCreators) return customers;
    return customers.filter((customer) => allowedCustomerCreators.includes(customer.createdBy));
  }, [allowedCustomerCreators, customers]);

  if (!crmUser) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="page-container space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground mt-1">Manage your customer list</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Customer
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Customer</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddCustomer} className="space-y-4">
              <div>
                <Label htmlFor="name">Customer Name *</Label>
                <Input
                  id="name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter customer name"
                />
              </div>
              <div>
                <Label htmlFor="company">Company Name *</Label>
                <Input
                  id="company"
                  required
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  placeholder="Enter company name"
                />
              </div>
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  required
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Enter email"
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone *</Label>
                <Input
                  id="phone"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="Enter phone number"
                />
              </div>
              <div>
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  placeholder="Enter department"
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {submitting ? "Adding Customer..." : "Add Customer"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        <Dialog open={editOpen} onOpenChange={(value) => {
          setEditOpen(value);
          if (!value) setEditingCustomer(null);
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Customer</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEditCustomer} className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Customer Name *</Label>
                <Input
                  id="edit-name"
                  required
                  value={editingCustomer?.name ?? ""}
                  onChange={(e) => editingCustomer && setEditingCustomer({ ...editingCustomer, name: e.target.value })}
                  placeholder="Enter customer name"
                />
              </div>
              <div>
                <Label htmlFor="edit-company">Company Name *</Label>
                <Input
                  id="edit-company"
                  required
                  value={editingCustomer?.companyName ?? ""}
                  onChange={(e) => editingCustomer && setEditingCustomer({ ...editingCustomer, companyName: e.target.value })}
                  placeholder="Enter company name"
                />
              </div>
              <div>
                <Label htmlFor="edit-email">Email *</Label>
                <Input
                  id="edit-email"
                  required
                  type="email"
                  value={editingCustomer?.email ?? ""}
                  onChange={(e) => editingCustomer && setEditingCustomer({ ...editingCustomer, email: e.target.value })}
                  placeholder="Enter email"
                />
              </div>
              <div>
                <Label htmlFor="edit-phone">Phone *</Label>
                <Input
                  id="edit-phone"
                  required
                  value={editingCustomer?.phone ?? ""}
                  onChange={(e) => editingCustomer && setEditingCustomer({ ...editingCustomer, phone: e.target.value })}
                  placeholder="Enter phone number"
                />
              </div>
              <div>
                <Label htmlFor="edit-department">Department</Label>
                <Input
                  id="edit-department"
                  value={editingCustomer?.department ?? ""}
                  onChange={(e) => editingCustomer && setEditingCustomer({ ...editingCustomer, department: e.target.value })}
                  placeholder="Enter department"
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting || !editingCustomer}>
                {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {submitting ? "Saving changes..." : "Save Changes"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="dashboard-panel"
      >
        {visibleCustomers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No customers yet. Add your first customer!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleCustomers.map((customer) => {
                  const isCustomerDisabled = !!customer.disabled;
                  return (
                    <TableRow key={customer.id} className={isCustomerDisabled ? "opacity-60 bg-muted/10" : ""}>
                      <TableCell className="font-medium flex items-center gap-2">
                        {customer.name}
                        {isCustomerDisabled && (
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-5 bg-destructive/10 text-destructive border-destructive/20 font-semibold">
                            Disabled
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{customer.companyName || "—"}</TableCell>
                      <TableCell className={isCustomerDisabled ? "text-muted-foreground font-medium" : "text-primary font-medium"}>
                        {customer.email}
                      </TableCell>
                      <TableCell>{customer.phone || "—"}</TableCell>
                      <TableCell>{customer.department || "—"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-primary hover:bg-primary/10 hover:text-primary"
                            onClick={() => openEditCustomer(customer)}
                            title="Edit Customer"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={isCustomerDisabled ? "text-success hover:bg-success/10 hover:text-success" : "text-amber-500 hover:bg-amber-500/10 hover:text-amber-500"}
                            onClick={() => handleToggleStatus(customer.id, isCustomerDisabled)}
                            title={isCustomerDisabled ? "Enable Customer" : "Disable Customer"}
                          >
                            {isCustomerDisabled ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default CustomersPage;
