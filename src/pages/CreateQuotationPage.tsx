import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { createQuotationDoc, fetchCustomers, fetchProducts } from "@/lib/firestore-service";
import { Product, Customer } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Trash2, Plus, Check, ChevronsUpDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

const CreateQuotationPage: React.FC = () => {
  const { crmUser } = useAuth();
  const navigate = useNavigate();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Selected data
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<Array<{product: Product, quantity: number}>>([]);
  const [open, setOpen] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  // Use string state for in-flight quantity editing to allow clearing the field
  const [selectedProductQuantities, setSelectedProductQuantities] = useState<Record<string, string>>({});
  const [subject, setSubject] = useState("");

  useEffect(() => {
    const loadData = async () => {
      if (!crmUser) return;
      try {
        setLoadingData(true);
        const [customersData, productsData] = await Promise.all([
          fetchCustomers(crmUser.id, crmUser.role),
          fetchProducts(crmUser.id, crmUser.role, crmUser.department),
        ]);
        setCustomers(customersData.filter((c) => !c.disabled));
        setAvailableProducts(productsData.filter((p) => !p.disabled));
      } catch (error) {
        console.error("Error loading data:", error);
        toast.error("Failed to load customers and items");
      } finally {
        setLoadingData(false);
      }
    };
    loadData();
  }, [crmUser]);

  if (!crmUser) return null;

  const handleSelectCustomer = (customerId: string) => {
    const customer = customers.find((c) => c.id === customerId);
    setSelectedCustomer(customer || null);
  };

  const handleToggleProduct = (productId: string) => {
    setSelectedProductIds(prev => {
      const isSelected = prev.includes(productId);
      if (isSelected) {
        // Remove from selection and clear quantity
        const newIds = prev.filter(id => id !== productId);
        setSelectedProductQuantities(prevQuantities => {
          const newQuantities = { ...prevQuantities };
          delete newQuantities[productId];
          return newQuantities;
        });
        return newIds;
      } else {
        // Add to selection with default quantity of 1
        setSelectedProductQuantities(prevQuantities => ({
          ...prevQuantities,
          [productId]: "1"
        }));
        return [...prev, productId];
      }
    });
  };

  const handleUpdateSelectedQuantity = (productId: string, rawValue: string) => {
    // Allow free-form typing — store raw string, parse on blur/submit
    setSelectedProductQuantities((prev) => ({ ...prev, [productId]: rawValue }));
  };

  const handleSelectedQuantityBlur = (productId: string) => {
    // On blur, clamp to minimum 1
    setSelectedProductQuantities((prev) => {
      const num = parseInt(prev[productId] || "1", 10);
      return { ...prev, [productId]: isNaN(num) || num < 1 ? "1" : String(num) };
    });
  };

  const handleAddSelectedProducts = () => {
    const newProducts = availableProducts
      .filter((product) => selectedProductIds.includes(product.id))
      .filter((product) => !selectedProducts.find((p) => p.product.id === product.id))
      .map((product) => {
        const qty = parseInt(selectedProductQuantities[product.id] || "1", 10);
        return { product, quantity: isNaN(qty) || qty < 1 ? 1 : qty };
      });

    if (newProducts.length > 0) {
      setSelectedProducts([...selectedProducts, ...newProducts]);
      setSelectedProductIds([]);
      setSelectedProductQuantities({});
      setOpen(false);
    }
  };

  const handleRemoveProduct = (index: number, productId: string) => {
    setSelectedProducts(selectedProducts.filter((_, i) => i !== index));
    setTableQuantityStrings((prev) => {
      const copy = { ...prev };
      delete copy[productId];
      return copy;
    });
  };

  const handleUpdateQuantity = (index: number, rawValue: string) => {
    // Allow free typing — store as string and parse only when needed
    const updated = [...selectedProducts];
    const num = parseInt(rawValue, 10);
    updated[index] = { ...updated[index], quantity: isNaN(num) || num < 1 ? 1 : num };
    setSelectedProducts(updated);
  };

  // String state for the bottom table quantity inputs to allow clearing, keyed by product.id
  const [tableQuantityStrings, setTableQuantityStrings] = useState<Record<string, string>>({});

  const handleTableQuantityChange = (productId: string, rawValue: string) => {
    setTableQuantityStrings((prev) => ({ ...prev, [productId]: rawValue }));
  };

  const handleTableQuantityBlur = (index: number, productId: string) => {
    const raw = tableQuantityStrings[productId] ?? String(selectedProducts[index]?.quantity ?? 1);
    const num = parseInt(raw, 10);
    const clamped = isNaN(num) || num < 1 ? 1 : num;
    handleUpdateQuantity(index, String(clamped));
    setTableQuantityStrings((prev) => ({ ...prev, [productId]: String(clamped) }));
  };

  const totalValue = selectedProducts.reduce((sum, item) => sum + (item.product.value * item.quantity), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCustomer || selectedProducts.length === 0 || !subject) {
      toast.error("Please select a customer, add products, and enter a subject");
      return;
    }

    setSubmitting(true);
    try {
      await createQuotationDoc({
        customerName: selectedCustomer.name,
        companyName: selectedCustomer.companyName,
        customerEmail: selectedCustomer.email,
        customerPhone: selectedCustomer.phone,
        subject,
        salesPersonId: crmUser.id,
        salesPersonName: crmUser.name,
        salesPersonSignature: crmUser.signature || "",
        salesPersonDesignation: crmUser.designation || "",
        salesPersonCompany: crmUser.companyName || "",
        managerId: crmUser.managerId || "",
        products: selectedProducts.map(item => ({
          ...item.product,
          quantity: item.quantity,
          totalValue: item.product.value * item.quantity
        })),
        totalValue,
        status: "Created",
        poNumber: "",
        poValue: 0,
        invoiceValue: 0,
        followUpDate: null,
        followUpNotes: "",
        deliveryStatus: "Pending",
      });

      toast.success("Quotation created successfully!");
      navigate("/quotations");
    } catch (error) {
      console.error("Error creating quotation:", error);
      toast.error("Failed to create quotation");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="page-container max-w-2xl">
      <h2 className="section-title mb-6">Create New Quotation</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer Selection */}
        <Card className="p-6">
          <h3 className="font-display font-semibold mb-4">Select Customer</h3>
          <div className="space-y-2">
            <Label>Customer *</Label>
            <Select onValueChange={handleSelectCustomer}>
              <SelectTrigger>
                <SelectValue placeholder="Select a customer..." />
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name} ({customer.companyName})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedCustomer && (
            <div className="mt-4 p-4 bg-accent/40 rounded-lg space-y-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{selectedCustomer.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Company</p>
                  <p className="font-medium">{selectedCustomer.companyName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium text-blue-600">{selectedCustomer.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{selectedCustomer.phone || "—"}</p>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Subject */}
        <Card className="p-6">
          <div className="space-y-2">
            <Label>Subject *</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g., Equipment Supply Order"
              required
            />
          </div>
        </Card>

        {/* Product Selection */}
        <Card className="p-6">
          <h3 className="font-display font-semibold mb-4">Add Items</h3>
          
          <div className="space-y-2 mb-4">
            <Label>Select Items *</Label>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="w-full justify-between"
                >
                  {selectedProductIds.length === 0
                    ? "Select items to add..."
                    : `${selectedProductIds.length} item${selectedProductIds.length > 1 ? 's' : ''} selected`}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Search items..." />
                  <CommandList>
                    <CommandEmpty>No items found.</CommandEmpty>
                    <CommandGroup>
                      {availableProducts.map((product) => (
                        <CommandItem
                          key={product.id}
                          onSelect={() => handleToggleProduct(product.id)}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedProductIds.includes(product.id) ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {product.name} - ${product.value.toLocaleString()}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Selected Items Preview */}
          {selectedProductIds.length > 0 && (
            <div className="space-y-3">
              <Label className="text-base font-medium">Selected Items (Ready to Add)</Label>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {selectedProductIds.map((productId) => {
                  const product = availableProducts.find(p => p.id === productId);
                  return product ? (
                    <Card key={productId} className="relative overflow-hidden border-2 border-primary/20">
                      <div className="absolute top-2 right-2 z-10">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleToggleProduct(productId)}
                          className="h-6 w-6 p-0"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="p-4">
                        <div className="flex gap-3">
                          {product.imageUrl && (
                            <div className="flex-shrink-0">
                              <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="w-16 h-16 object-cover rounded-lg border"
                              />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm truncate">{product.name}</h4>
                            <p className="text-xs text-muted-foreground mt-1">
                              Model: {product.modelNumber}
                            </p>
                            {product.partNumber && (
                              <p className="text-xs text-muted-foreground">
                                Part: {product.partNumber}
                              </p>
                            )}
                            {product.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {product.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <div className="text-lg font-bold text-primary">
                            ${product.value.toLocaleString()}
                          </div>
                          {product.quantity && (
                            <div className="text-xs text-muted-foreground">
                              Stock: {product.quantity}
                            </div>
                          )}
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <Label className="text-xs font-medium">Qty:</Label>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              type="button"
                              onClick={() => {
                                const cur = parseInt(selectedProductQuantities[productId] || "1", 10);
                                handleUpdateSelectedQuantity(productId, String(Math.max(1, cur - 1)));
                              }}
                              disabled={parseInt(selectedProductQuantities[productId] || "1", 10) <= 1}
                              className="h-7 w-7 p-0"
                            >
                              -
                            </Button>
                            <Input
                              type="text"
                              inputMode="numeric"
                              value={selectedProductQuantities[productId] ?? "1"}
                              onChange={(e) => handleUpdateSelectedQuantity(productId, e.target.value.replace(/[^0-9]/g, ""))}
                              onBlur={() => handleSelectedQuantityBlur(productId)}
                              className="w-16 h-7 text-center text-sm"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              type="button"
                              onClick={() => {
                                const cur = parseInt(selectedProductQuantities[productId] || "1", 10);
                                handleUpdateSelectedQuantity(productId, String(cur + 1));
                              }}
                              disabled={!!(product.quantity && parseInt(selectedProductQuantities[productId] || "1", 10) >= product.quantity)}
                              className="h-7 w-7 p-0"
                            >
                              +
                            </Button>
                          </div>
                        </div>
                        <div className="mt-2 text-sm font-medium text-primary">
                          Total: ${(product.value * (parseInt(selectedProductQuantities[productId] || "1", 10) || 1)).toLocaleString()}
                        </div>
                      </div>
                    </Card>
                  ) : null;
                })}
              </div>
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="text-sm text-muted-foreground">
                  {selectedProductIds.length} item{selectedProductIds.length > 1 ? 's' : ''} selected •
                  Total: ${selectedProductIds.reduce((total, productId) => {
                    const product = availableProducts.find(p => p.id === productId);
                    const quantity = parseInt(selectedProductQuantities[productId] || "1", 10) || 1;
                    return total + (product ? product.value * quantity : 0);
                  }, 0).toLocaleString()}
                </div>
                <Button
                  onClick={handleAddSelectedProducts}
                  size="sm"
                  className="px-6"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add to Quotation
                </Button>
              </div>
            </div>
          )}

          {/* Selected Products List */}
          {selectedProducts.length > 0 ? (
            <div className="space-y-3">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-2 font-medium">Item</th>
                      <th className="text-left py-2 px-2 font-medium">Model</th>
                      <th className="text-center py-2 px-2 font-medium">Qty</th>
                      <th className="text-right py-2 px-2 font-medium">Unit Price</th>
                      <th className="text-right py-2 px-2 font-medium">Total</th>
                      <th className="text-center py-2 px-2 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedProducts.map((item, idx) => (
                      <tr key={idx} className="border-b border-border/40 hover:bg-accent/20">
                        <td className="py-2 px-2">{item.product.name}</td>
                        <td className="py-2 px-2 text-muted-foreground">{item.product.modelNumber || "—"}</td>
                        <td className="py-2 px-2 text-center">
                          <Input
                            type="text"
                            inputMode="numeric"
                            value={tableQuantityStrings[item.product.id] ?? String(item.quantity)}
                            onChange={(e) => handleTableQuantityChange(item.product.id, e.target.value.replace(/[^0-9]/g, ""))}
                            onBlur={() => handleTableQuantityBlur(idx, item.product.id)}
                            className="w-16 h-8 text-center"
                          />
                        </td>
                        <td className="py-2 px-2 text-right">${item.product.value.toLocaleString()}</td>
                        <td className="py-2 px-2 text-right font-medium">${(item.product.value * item.quantity).toLocaleString()}</td>
                        <td className="py-2 px-2 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveProduct(idx, item.product.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="pt-2 text-right border-t border-border">
                <p className="text-lg font-semibold">Total Value: ${totalValue.toLocaleString()}</p>
              </div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">No items selected yet</p>
          )}
        </Card>

        {/* Submit Button */}
        <div className="flex gap-3">
          <Button type="submit" disabled={submitting} className="flex-1">
            {submitting ? "Creating..." : "Create Quotation"}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate("/quotations")}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
};

export default CreateQuotationPage;
