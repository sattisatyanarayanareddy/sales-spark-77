import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { UserRole } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

const ProfileSetupPage: React.FC = () => {
  const { firebaseUser, crmUser, completeProfile } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("sales");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [department, setDepartment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!firebaseUser) return;
    if (crmUser) {
      navigate("/dashboard", { replace: true });
      return;
    }

    setRole(firebaseUser.email === "admin@gmail.com" ? "administrator" : "sales");
  }, [firebaseUser, crmUser, navigate]);

  if (!firebaseUser) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !role || !department) {
      toast.error("Name, role, and department are required.");
      return;
    }

    setSubmitting(true);
    try {
      await completeProfile(name, role, phone, address, department);
      toast.success("Profile created successfully. Redirecting to dashboard...");
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to complete profile.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Complete your profile</h1>
          <p className="text-muted-foreground mt-2">
            Please provide your details so you can access the dashboard and start managing users.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
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
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={firebaseUser.email || ""} disabled />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="role">Role *</Label>
              <Select value={role} onValueChange={(val) => setRole(val as UserRole)}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">Sales Person</SelectItem>
                  <SelectItem value="sub_manager">Sub Manager</SelectItem>
                  <SelectItem value="general_manager">General Manager</SelectItem>
                  <SelectItem value="administrator">Administrator</SelectItem>
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
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="123 456 7890"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Main St, City, Country"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="submit" className="ml-auto" disabled={submitting}>
              {submitting ? "Saving..." : "Save Profile"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default ProfileSetupPage;
