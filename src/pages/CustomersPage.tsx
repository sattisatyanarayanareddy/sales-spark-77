import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { fetchCustomers, updateCustomerStatus, createCustomer } from "../lib/firestore-service";
import { Customer } from "../types/crm";
import { Plus, Lock, Unlock } from "lucide-react";
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
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    companyName: "",
    email: "",
    phone: "",
    department: "",
  });

  const loadCustomers = useCallback(async () => {
    if (!crmUser) return;
    try {
      setLoading(true);
      const data = await fetchCustomers(crmUser.id, crmUser.role);
      setCustomers(data);
    } catch (error) {
      console.error("Error fetching customers:", error);
      toast.error("Failed to load customers list");
    } finally {
      setLoading(false);
    }
  }, [crmUser]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!crmUser || !formData.name || !formData.companyName || !formData.email || !formData.phone) {
      toast.error("Name, Company Name, Email, and Phone are required");
      return;
    }

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
      await loadCustomers();
    } catch (error) {
      console.error("Error adding customer:", error);
      toast.error("Failed to add customer");
    }
  };

  const handleToggleStatus = async (id: string, currentDisabled: boolean) => {
    const newStatus = !currentDisabled;
    const actionText = newStatus ? "disable" : "enable";
    if (!confirm(`Are you sure you want to ${actionText} this customer?`)) return;
    try {
      await updateCustomerStatus(id, newStatus);
      toast.success(`Customer ${newStatus ? "disabled" : "enabled"} successfully`);
      await loadCustomers();
    } catch (error) {
      console.error("Error updating customer status:", error);
      toast.error(`Failed to ${actionText} customer`);
    }
  };

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
              <Button type="submit" className="w-full">
                Add Customer
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
        {customers.length === 0 ? (
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
                {customers.map((customer) => {
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
                        <Button
                          variant="ghost"
                          size="icon"
                          className={isCustomerDisabled ? "text-success hover:bg-success/10 hover:text-success" : "text-amber-500 hover:bg-amber-500/10 hover:text-amber-500"}
                          onClick={() => handleToggleStatus(customer.id, isCustomerDisabled)}
                          title={isCustomerDisabled ? "Enable Customer" : "Disable Customer"}
                        >
                          {isCustomerDisabled ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                        </Button>
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
