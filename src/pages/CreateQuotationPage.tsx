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
  const [selectedProductQuantities, setSelectedProductQuantities] = useState<Record<string, number>>({});
  const [subject, setSubject] = useState("");

  useEffect(() => {
    const loadData = async () => {
      if (!crmUser) return;
      try {
        setLoadingData(true);
        const [customersData, productsData] = await Promise.all([
          fetchCustomers(crmUser.id, crmUser.role),
          fetchProducts(crmUser.id, crmUser.role),
        ]);
        setCustomers(customersData);
        setAvailableProducts(productsData);
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
          [productId]: 1
        }));
        return [...prev, productId];
      }
    });
  };

  const handleUpdateSelectedQuantity = (productId: string, quantity: number) => {
    if (quantity < 1) return; // Minimum quantity is 1
    setSelectedProductQuantities(prev => ({
      ...prev,
      [productId]: quantity
    }));
  };

  const handleAddSelectedProducts = () => {
    const newProducts = availableProducts
      .filter(product => selectedProductIds.includes(product.id))
      .filter(product => !selectedProducts.find(p => p.product.id === product.id))
      .map(product => ({
        product,
        quantity: selectedProductQuantities[product.id] || 1
      }));

    if (newProducts.length > 0) {
      setSelectedProducts([...selectedProducts, ...newProducts]);
      setSelectedProductIds([]);
      setSelectedProductQuantities({});
      setOpen(false);
    }
  };

  const handleRemoveProduct = (index: number) => {
    setSelectedProducts(selectedProducts.filter((_, i) => i !== index));
  };

  const handleUpdateQuantity = (index: number, quantity: number) => {
    const updated = [...selectedProducts];
    updated[index].quantity = quantity;
    setSelectedProducts(updated);
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
        managerId: crmUser.managerId || "",
        products: selectedProducts.map(item => ({
          ...item.product,
          quantity: item.quantity,
          totalValue: item.product.value * item.quantity
        })),
        totalValue,
        status: "Created",
        poNumber: "",
        invoiceValue: 0,
        followUpDate: null,
        followUpNotes: "",
        deliveryStatus: "",
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
                              onClick={() => handleUpdateSelectedQuantity(productId, (selectedProductQuantities[productId] || 1) - 1)}
                              disabled={(selectedProductQuantities[productId] || 1) <= 1}
                              className="h-7 w-7 p-0"
                            >
                              -
                            </Button>
                            <Input
                              type="number"
                              min="1"
                              max={product.quantity || undefined}
                              value={selectedProductQuantities[productId] || 1}
                              onChange={(e) => handleUpdateSelectedQuantity(productId, parseInt(e.target.value) || 1)}
                              className="w-16 h-7 text-center text-sm"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUpdateSelectedQuantity(productId, (selectedProductQuantities[productId] || 1) + 1)}
                              disabled={product.quantity && (selectedProductQuantities[productId] || 1) >= product.quantity}
                              className="h-7 w-7 p-0"
                            >
                              +
                            </Button>
                          </div>
                        </div>
                        <div className="mt-2 text-sm font-medium text-primary">
                          Total: ${(product.value * (selectedProductQuantities[productId] || 1)).toLocaleString()}
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
                    const quantity = selectedProductQuantities[productId] || 1;
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
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleUpdateQuantity(idx, parseInt(e.target.value) || 1)}
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
                            onClick={() => handleRemoveProduct(idx)}
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
