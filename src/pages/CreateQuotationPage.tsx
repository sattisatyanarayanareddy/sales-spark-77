import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { createQuotation } from "@/lib/demo-data";
import { Product } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, ImagePlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";

const emptyProduct = (): Product => ({
  name: "",
  description: "",
  modelNumber: "",
  partNumber: "",
  value: 0,
  imageUrl: "",
});

const CreateQuotationPage: React.FC = () => {
  const { crmUser } = useAuth();
  const navigate = useNavigate();

  const [customerName, setCustomerName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [subject, setSubject] = useState("");
  const [products, setProducts] = useState<Product[]>([emptyProduct()]);

  if (!crmUser) return null;

  const totalValue = products.reduce((s, p) => s + (p.value || 0), 0);

  const updateProduct = (index: number, field: keyof Product, value: string | number) => {
    const updated = [...products];
    (updated[index] as any)[field] = value;
    setProducts(updated);
  };

  const handleImageUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      updateProduct(index, "imageUrl", url);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !companyName || !subject || products.some((p) => !p.name || !p.value)) {
      toast.error("Please fill in all required fields");
      return;
    }

    createQuotation({
      customerName,
      companyName,
      customerEmail,
      customerPhone,
      subject,
      salesPersonId: crmUser.id,
      salesPersonName: crmUser.name,
      managerId: crmUser.managerId || "",
      products,
      totalValue,
      stage: "quotation_created",
      poNumber: "",
      invoiceValue: 0,
      followUpDate: null,
      followUpNotes: "",
      deliveryStatus: "",
    });

    toast.success("Quotation created successfully!");
    navigate("/quotations");
  };

  return (
    <div className="page-container max-w-3xl">
      <h2 className="section-title mb-6">Create New Quotation</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer Details */}
        <Card className="p-6">
          <h3 className="font-display font-semibold mb-4">Customer Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Customer Name *</Label>
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="John Smith" required />
            </div>
            <div className="space-y-2">
              <Label>Company *</Label>
              <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Corp" required />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="john@acme.com" />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="+1-555-0100" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <Label>Subject *</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Equipment Supply Order" required />
          </div>
        </Card>

        {/* Products */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold">Products</h3>
            <Button type="button" variant="outline" size="sm" onClick={() => setProducts([...products, emptyProduct()])}>
              <Plus className="w-4 h-4 mr-1" /> Add Product
            </Button>
          </div>

          <div className="space-y-6">
            {products.map((product, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-lg border border-border bg-secondary/30 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Product {i + 1}</span>
                  {products.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => setProducts(products.filter((_, idx) => idx !== i))}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Product Name *</Label>
                    <Input value={product.name} onChange={(e) => updateProduct(i, "name", e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Value ($) *</Label>
                    <Input type="number" min={0} value={product.value || ""} onChange={(e) => updateProduct(i, "value", Number(e.target.value))} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Model Number</Label>
                    <Input value={product.modelNumber} onChange={(e) => updateProduct(i, "modelNumber", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Part Number</Label>
                    <Input value={product.partNumber} onChange={(e) => updateProduct(i, "partNumber", e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={product.description} onChange={(e) => updateProduct(i, "description", e.target.value)} rows={2} />
                </div>

                {/* Image upload */}
                <div className="space-y-2">
                  <Label>Product Image</Label>
                  <div className="flex items-center gap-4">
                    <div className="w-24 h-24 rounded-lg border-2 border-dashed border-border bg-muted/50 flex items-center justify-center overflow-hidden">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <ImagePlus className="w-6 h-6 text-muted-foreground" />
                      )}
                    </div>
                    <label className="cursor-pointer">
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(i, e)} />
                      <Button type="button" variant="outline" size="sm" asChild>
                        <span>Upload Image</span>
                      </Button>
                    </label>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </Card>

        {/* Summary */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Created by: <span className="font-medium text-foreground">{crmUser.name}</span></p>
              <p className="text-sm text-muted-foreground">Manager: <span className="font-medium text-foreground">{crmUser.managerId || "N/A"}</span></p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Total Value</p>
              <p className="text-2xl font-bold font-display">${totalValue.toLocaleString()}</p>
            </div>
          </div>
        </Card>

        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={() => navigate("/quotations")} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" className="flex-1">
            Create Quotation
          </Button>
        </div>
      </form>
    </div>
  );
};

export default CreateQuotationPage;
