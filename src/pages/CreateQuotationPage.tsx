import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useParams } from "react-router-dom";
import {
  createQuotationDoc,
  fetchCustomers,
  fetchProducts,
  fetchQuotationById,
  updateQuotationDoc,
  fetchSalesFunnelByQuotationId,
  createSalesFunnelDoc,
  updateSalesFunnelDoc,
  getSafePendingPayment,
  requestQuotationApproval,
  fetchAllUsers,
} from "@/lib/firestore-service";
import { getQuotationStatusForApprovalRequest } from "@/lib/quotation-status";
import { Product, Customer, Quotation, QuotationStatus, CRMUser } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Trash2, Plus, Check, ChevronsUpDown, AlertCircle } from "lucide-react";
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
  const { id: quotationId } = useParams<{ id: string }>();
  const isEditMode = Boolean(quotationId);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<CRMUser[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<QuotationStatus>("Created");
  const [originalQuotation, setOriginalQuotation] = useState<Quotation | null>(null);
  // Salesperson sees Ask for Approve, Managers/Admins see Approved instead.
  const quotationStatusOptions = useMemo(() => {
    if (!crmUser) return ["Draft", "Created"];
    const isSalesperson = crmUser.role === "sales";
    if (isSalesperson) {
      return ["Draft", "Created", "Ask for Approve", "Sent Mail"] as QuotationStatus[];
    } else {
      return ["Draft", "Created", "Approved", "Sent Mail"] as QuotationStatus[];
    }
  }, [crmUser]);

  // Selected data
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<Array<{product: Product, quantity: number}>>([]);
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");

  useEffect(() => {
    const loadData = async () => {
      if (!crmUser) return;
      try {
        setLoadingData(true);
        const [customersData, productsData, usersData] = await Promise.all([
          fetchCustomers(crmUser.id, crmUser.role),
          fetchProducts(crmUser.id, crmUser.role, crmUser.department),
          fetchAllUsers(),
        ]);

        setUsers(usersData);
        setCustomers(customersData.filter((c) => !c.disabled));
        setAvailableProducts(productsData.filter((p) => !p.disabled));

        if (quotationId) {
          const quotation = await fetchQuotationById(quotationId);
          if (!quotation) {
            toast.error("Quotation not found");
            navigate("/quotations");
            return;
          }

          setOriginalQuotation(quotation);
          setStatus(quotation.status);
          setSubject(quotation.subject);

          const matchedCustomer = customersData.find(
            (customer) =>
              customer.email === quotation.customerEmail ||
              customer.companyName === quotation.companyName ||
              customer.name === quotation.customerName
          );

          if (matchedCustomer) {
            setSelectedCustomer(matchedCustomer);
          } else {
            setSelectedCustomer({
              id: quotation.customerEmail || quotation.companyName || quotation.customerName,
              name: quotation.customerName,
              email: quotation.customerEmail,
              phone: quotation.customerPhone,
              companyName: quotation.companyName,
              department: "",
              createdBy: "",
              userEmail: "",
            });
          }

          const loadedProducts = quotation.products.map((product) => ({
            product,
            quantity: product.quantity || 1,
          }));
          setSelectedProducts(loadedProducts);
          setTableQuantityStrings(
            loadedProducts.reduce((acc, item) => {
              acc[item.product.id] = String(item.quantity);
              return acc;
            }, {} as Record<string, string>)
          );
        }
      } catch (error) {
        console.error("Error loading data:", error);
        toast.error("Failed to load customers and items");
      } finally {
        setLoadingData(false);
      }
    };
    loadData();
  }, [crmUser, quotationId, navigate]);

  if (!crmUser) return null;

  const allowedCreators = useMemo(() => {
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

  const filteredCustomers = useMemo(() => {
    if (!allowedCreators) return customers;
    return customers.filter((c) => allowedCreators.includes(c.createdBy));
  }, [customers, allowedCreators]);

  const filteredProducts = useMemo(() => {
    if (!allowedCreators) return availableProducts;
    return availableProducts.filter((p) => allowedCreators.includes(p.createdBy));
  }, [availableProducts, allowedCreators]);

  const handleSelectCustomer = (customerId: string) => {
    const customer = filteredCustomers.find((c) => c.id === customerId);
    setSelectedCustomer(customer || null);
  };

  const handleSelectProductDirectly = (product: Product) => {
    setSelectedProducts((prev) => {
      const existingIdx = prev.findIndex((item) => item.product.id === product.id);
      if (existingIdx > -1) {
        const updated = [...prev];
        const newQty = updated[existingIdx].quantity + 1;
        updated[existingIdx] = { ...updated[existingIdx], quantity: newQty };
        setTableQuantityStrings((prevStrings) => ({ ...prevStrings, [product.id]: String(newQty) }));
        toast.success(`Incremented quantity of ${product.name} to ${newQty}`);
        return updated;
      } else {
        setTableQuantityStrings((prevStrings) => ({ ...prevStrings, [product.id]: "1" }));
        toast.success(`Added ${product.name} to quotation`);
        return [...prev, { product, quantity: 1 }];
      }
    });
    setOpen(false);
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

    // Check if user has a signature set
    if (!crmUser.signature) {
      toast.error("Please add your signature in your profile before creating quotations");
      navigate("/profile");
      return;
    }

    setSubmitting(true);
    try {
      const products = selectedProducts.map((item) => ({
        ...item.product,
        quantity: item.quantity,
        totalValue: item.product.value * item.quantity,
      }));

      if (isEditMode && quotationId && originalQuotation) {
        const statusToSave = status;
        const isSalesperson = crmUser.role === "sales";
        const requestApproval = isSalesperson && statusToSave === "Ask for Approve" && originalQuotation.status !== "Ask for Approve";

        await updateQuotationDoc(quotationId, {
          customerName: selectedCustomer.name,
          companyName: selectedCustomer.companyName,
          customerEmail: selectedCustomer.email,
          customerPhone: selectedCustomer.phone,
          subject,
          products,
          totalValue,
          status: statusToSave,
          poNumber: originalQuotation.poNumber,
          poValue: originalQuotation.poValue,
          invoiceValue: originalQuotation.invoiceValue,
          followUpDate: originalQuotation.followUpDate,
          followUpNotes: originalQuotation.followUpNotes,
          deliveryStatus: originalQuotation.deliveryStatus,
        });

        if (requestApproval) {
          await requestQuotationApproval({
            ...originalQuotation,
            customerName: selectedCustomer.name,
            companyName: selectedCustomer.companyName,
            customerEmail: selectedCustomer.email,
            customerPhone: selectedCustomer.phone,
            subject,
            products,
            totalValue,
            status: statusToSave,
          });
          toast.success("Quotation submitted for manager approval");
        } else {
          if (statusToSave === "Approved") {
            const existingFunnel = await fetchSalesFunnelByQuotationId(quotationId);
            const safePendingPayment = getSafePendingPayment(
              originalQuotation.paymentStatus ?? "Pending",
              originalQuotation.invoiceValue || 0,
              originalQuotation.pendingPayment ?? 0
            );

            if (!existingFunnel) {
              await createSalesFunnelDoc({
                quotationId,
                quotationNumber: originalQuotation.quotationNumber,
                companyName: selectedCustomer.companyName,
                subject,
                quotationValue: totalValue,
                followUpDate: originalQuotation.followUpDate,
                remarks: originalQuotation.followUpNotes || "",
                status: "Cold",
                poValue: originalQuotation.poValue || 0,
                deliveryStatus: originalQuotation.deliveryStatus || "Pending",
                invoiceValue: originalQuotation.invoiceValue || 0,
                pendingPayment: safePendingPayment,
                paymentStatus: originalQuotation.paymentStatus ?? "Pending",
                closingMonth: null,
                closingYear: null,
                closingDate: null,
                salesPersonId: originalQuotation.salesPersonId,
              });
            } else {
              await updateSalesFunnelDoc(existingFunnel.id, {
                companyName: selectedCustomer.companyName,
                subject,
                quotationValue: totalValue,
                followUpDate: originalQuotation.followUpDate,
                remarks: originalQuotation.followUpNotes || "",
                poValue: originalQuotation.poValue || 0,
                deliveryStatus: originalQuotation.deliveryStatus || "Pending",
                invoiceValue: originalQuotation.invoiceValue || 0,
                pendingPayment: safePendingPayment,
                paymentStatus: originalQuotation.paymentStatus ?? "Pending",
              });
            }
          }
          toast.success("Quotation updated successfully!");
        }
      } else {
        await createQuotationDoc({
          customerName: selectedCustomer.name,
          companyName: selectedCustomer.companyName,
          customerEmail: selectedCustomer.email,
          customerPhone: selectedCustomer.phone,
          subject,
          salesPersonId: crmUser.id,
          salesPersonName: crmUser.name,
          salesPersonSignature: crmUser.signature,
          salesPersonDesignation: crmUser.designation || "",
          salesPersonCompany: crmUser.companyName || "",
          managerId: crmUser.managerId || "",
          products,
          totalValue,
          status: "Created",
          poNumber: "",
          poValue: 0,
          invoiceValue: 0,
          pendingPayment: totalValue,
          paymentStatus: "Pending",
          followUpDate: null,
          followUpNotes: "",
          deliveryStatus: "Pending",
        });

        toast.success("Quotation created successfully!");
      }

      navigate("/quotations");
    } catch (error) {
      console.error("Error saving quotation:", error);
      toast.error("Failed to save quotation");
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
    <div className="page-container max-w-4xl">
      <h2 className="section-title mb-6">{isEditMode ? "Edit Quotation" : "Create New Quotation"}</h2>

      {!crmUser.signature && (
        <Card className="p-4 mb-6 border-amber-200 bg-amber-50">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-900">Signature Required</p>
              <p className="text-sm text-amber-800 mt-1">
                Please add your signature in your profile before creating quotations. This will be included in all quotation documents.
              </p>
              <Button 
                type="button"
                size="sm"
                onClick={() => navigate("/profile")}
                className="mt-3 bg-amber-600 hover:bg-amber-700 text-white"
              >
                Add Signature
              </Button>
            </div>
          </div>
        </Card>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer Selection */}
        <Card className="p-6 shadow-sm border border-border/80">
          <h3 className="font-display font-semibold mb-4 text-lg">Select Customer</h3>
          <div className="space-y-2">
            <Label>Customer *</Label>
            <Select value={selectedCustomer?.id ?? ""} onValueChange={handleSelectCustomer}>
              <SelectTrigger>
                <SelectValue placeholder="Select a customer..." />
              </SelectTrigger>
              <SelectContent>
                 {filteredCustomers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name} ({customer.companyName})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedCustomer && (
            <div className="mt-4 p-4 bg-muted/40 rounded-xl space-y-2 border border-border/60">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Name</p>
                  <p className="font-medium text-sm mt-0.5">{selectedCustomer.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Company</p>
                  <p className="font-medium text-sm mt-0.5">{selectedCustomer.companyName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Email</p>
                  <p className="font-medium text-sm text-primary mt-0.5">{selectedCustomer.email}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Phone</p>
                  <p className="font-medium text-sm mt-0.5">{selectedCustomer.phone || "—"}</p>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Subject */}
        <Card className="p-6 shadow-sm border border-border/80">
          <div className="space-y-2">
            <Label>Subject *</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g., Equipment Supply Order"
              required
            />
          </div>
          {isEditMode && (
            <div className="mt-6 space-y-2">
              <Label>Status *</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as QuotationStatus)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {quotationStatusOptions.map((statusOption) => (
                    <SelectItem key={statusOption} value={statusOption}>
                      {statusOption}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </Card>

        {/* Product Selection */}
        <Card className="p-6 shadow-sm border border-border/80">
          <h3 className="font-display font-semibold mb-4 text-lg">Add Items</h3>
          
          <div className="space-y-2 mb-6">
            <Label>Select Items *</Label>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="w-full justify-between rounded-xl h-10 border border-input shadow-none hover:bg-accent/40"
                >
                  <span className="text-muted-foreground font-normal">Select items to add...</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search items..." />
                  <CommandList>
                    <CommandEmpty>No items found.</CommandEmpty>
                    <CommandGroup>
                      {filteredProducts.map((product) => (
                        <CommandItem
                          key={product.id}
                          onSelect={() => handleSelectProductDirectly(product)}
                          className="flex justify-between items-center py-2 px-3 hover:bg-accent cursor-pointer"
                        >
                          <div className="flex flex-col">
                            <span className="font-semibold text-foreground text-sm">{product.name}</span>
                            <span className="text-xs text-muted-foreground mt-0.5">Model: {product.modelNumber || "—"}</span>
                          </div>
                          <span className="font-bold text-sm text-green-600">${product.value.toLocaleString()}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Selected Products List */}
          {selectedProducts.length > 0 ? (
            <div className="space-y-5">
              <div className="overflow-x-auto rounded-xl border border-border/70">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/80 bg-muted/30">
                      <th className="text-left py-3 px-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Item</th>
                      <th className="text-left py-3 px-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Model</th>
                      <th className="text-center py-3 px-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground w-36">Qty</th>
                      <th className="text-right py-3 px-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Unit Price</th>
                      <th className="text-right py-3 px-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Total</th>
                      <th className="text-center py-3 px-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground w-16">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedProducts.map((item, idx) => (
                      <tr key={idx} className="border-b border-border/40 hover:bg-accent/20 transition-colors">
                        <td className="py-3 px-3 font-medium">{item.product.name}</td>
                        <td className="py-3 px-3 text-muted-foreground font-medium">{item.product.modelNumber || "—"}</td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5 mx-auto">
                            <Button
                              variant="outline"
                              size="sm"
                              type="button"
                              onClick={() => {
                                const cur = item.quantity;
                                if (cur > 1) {
                                  handleUpdateQuantity(idx, String(cur - 1));
                                  setTableQuantityStrings((prev) => ({ ...prev, [item.product.id]: String(cur - 1) }));
                                }
                              }}
                              disabled={item.quantity <= 1}
                              className="h-7 w-7 p-0 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors border-border/80"
                            >
                              -
                            </Button>
                            <Input
                              type="text"
                              inputMode="numeric"
                              value={tableQuantityStrings[item.product.id] ?? String(item.quantity)}
                              onChange={(e) => handleTableQuantityChange(item.product.id, e.target.value.replace(/[^0-9]/g, ""))}
                              onBlur={() => handleTableQuantityBlur(idx, item.product.id)}
                              className="w-12 h-7 text-center p-0 text-xs font-semibold focus:outline-none focus:border-primary/80 focus:ring-4 focus:ring-primary/10 rounded-lg border-border"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              type="button"
                              onClick={() => {
                                const cur = item.quantity;
                                handleUpdateQuantity(idx, String(cur + 1));
                                setTableQuantityStrings((prev) => ({ ...prev, [item.product.id]: String(cur + 1) }));
                              }}
                              className="h-7 w-7 p-0 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors border-border/80"
                            >
                              +
                            </Button>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right text-muted-foreground font-semibold">${item.product.value.toLocaleString()}</td>
                        <td className="py-3 px-3 text-right font-bold text-foreground">${(item.product.value * item.quantity).toLocaleString()}</td>
                        <td className="py-3 px-3 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveProduct(idx, item.product.id)}
                            className="h-8 w-8 p-0 rounded-lg hover:bg-destructive/10 text-destructive hover:text-destructive transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="pt-3 text-right flex items-center justify-between px-2">
                <span className="text-sm font-semibold text-muted-foreground">{selectedProducts.length} unique item{selectedProducts.length > 1 ? 's' : ''} added</span>
                <p className="text-xl font-extrabold bg-gradient-to-r from-foreground to-foreground/85 bg-clip-text text-transparent">Total Value: ${totalValue.toLocaleString()}</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 rounded-xl border border-dashed border-border/80 bg-muted/10">
              <p className="text-sm text-muted-foreground font-medium">No items selected yet</p>
              <p className="text-xs text-muted-foreground mt-0.5">Use the search box above to add items directly</p>
            </div>
          )}
        </Card>

        {/* Submit Button */}
        <div className="flex gap-3">
          <Button type="submit" disabled={submitting} className="flex-1">
            {submitting ? (originalQuotation ? "Updating..." : "Creating...") : (originalQuotation ? "Update Quotation" : "Create Quotation")}
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
