import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { subscribeToProducts, subscribeToAllUsers, updateProductStatus, createProduct, updateProduct, fetchUnits, createUnit, UnitItem } from "../lib/firestore-service";
import { CRMUser, Product } from "../types/crm";
import { Plus, Lock, Unlock, Pencil, Search, AlertCircle, CheckCircle2, X, Image as ImageIcon, Loader2 } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";

const ItemsPage = () => {
  const { crmUser } = useAuth();
  const [users, setUsers] = useState<CRMUser[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    type: "Goods" as "Goods" | "Service",
    name: "",
    unit: "pcs" as Product["unit"],
    saleAccount: "",
    value: "",
    description: "",
    salesDescription: "",
    modelNumber: "",
    imageFile: null as File | null,
  });

  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string>("");

  const [units, setUnits] = useState<UnitItem[]>([]);
  const [isAddingUnit, setIsAddingUnit] = useState(false);
  const [showUnitSuggestions, setShowUnitSuggestions] = useState(false);
  const [unitSuggestions, setUnitSuggestions] = useState<UnitItem[]>([]);

  const handleUnitInputChange = (val: string) => {
    setFormData((prev) => ({ ...prev, unit: val }));
    const query = val.toLowerCase().trim();
    const matches = units.filter((u) =>
      u.name.toLowerCase().includes(query)
    );
    setUnitSuggestions(matches);
    setShowUnitSuggestions(true);
  };

  const allowedProductCreators = useMemo(() => {
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

  const visibleProducts = useMemo(() => {
    if (!allowedProductCreators) return products;
    return products.filter((product) => allowedProductCreators.includes(product.createdBy));
  }, [allowedProductCreators, products]);

  const handleUnitKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = formData.unit.trim();
      if (!val) return;

      const existing = units.find(u => u.name.toLowerCase() === val.toLowerCase());
      if (!existing) {
        setIsAddingUnit(true);
        try {
          const added = await createUnit(val);
          const updatedUnits = await fetchUnits();
          setUnits(updatedUnits);
          setFormData(prev => ({ ...prev, unit: added.name }));
          toast.success(`Unit "${added.name}" added to database!`);
        } catch (err) {
          console.error("Error creating unit on Enter:", err);
          toast.error("Failed to add unit.");
        } finally {
          setIsAddingUnit(false);
          setShowUnitSuggestions(false);
        }
      } else {
        setFormData(prev => ({ ...prev, unit: existing.name }));
        setShowUnitSuggestions(false);
        toast.info(`Unit "${existing.name}" already exists.`);
      }
    }
  };

  const loadUnits = async () => {
    try {
      const data = await fetchUnits();
      setUnits(data);
    } catch (error) {
      console.error("Error loading units:", error);
    }
  };

  useEffect(() => {
    if (!crmUser) return;
    setLoading(true);

    const unsubscribeProducts = subscribeToProducts(crmUser.id, crmUser.role, crmUser.department, (data) => {
      setProducts(data);
      setLoading(false);
    });

    const unsubscribeUsers = subscribeToAllUsers((allUsers) => {
      setUsers(allUsers);
    });

    loadUnits();
    return () => {
      unsubscribeProducts();
      unsubscribeUsers();
    };
  }, [crmUser]);

  const handleNameChange = (val: string) => {
    setFormData((prev) => ({ ...prev, name: val }));
    if (editingProduct) return;
    if (val.trim()) {
      const query = val.toLowerCase().trim();
      const matches = visibleProducts.filter((p) =>
        p.name.toLowerCase().includes(query)
      );
      setSuggestions(matches);

      // Check for exact match
      const exact = visibleProducts.find(
        (p) => p.name.toLowerCase().trim() === query
      );
      if (exact) {
        setSelectedProduct(exact);
      } else {
        setSelectedProduct(null);
      }
    } else {
      setSuggestions([]);
      setSelectedProduct(null);
    }
  };

  const handleSelectSuggestion = (product: Product) => {
    setSelectedProduct(product);
    setFormData({
      type: product.type,
      name: product.name,
      unit: product.unit,
      saleAccount: product.saleAccount,
      value: product.value.toString(),
      description: product.description || "",
      salesDescription: product.salesDescription || "",
      modelNumber: product.modelNumber || "",
      imageFile: null,
    });
    setSuggestions([]);
  };

  const handleEditProductClick = (product: Product) => {
    setEditingProduct(product);
    setExistingImageUrl(product.imageUrl || "");
    setFormData({
      type: product.type,
      name: product.name,
      unit: product.unit,
      saleAccount: product.saleAccount,
      value: product.value.toString(),
      description: product.description || "",
      salesDescription: product.salesDescription || "",
      modelNumber: product.modelNumber || "",
      imageFile: null,
    });
    setOpen(true);
  };

  const handleClearSelected = () => {
    setSelectedProduct(null);
    setEditingProduct(null);
    setExistingImageUrl("");
    const defaultUnit = units.find(u => u.name === "pcs")?.name || units[0]?.name || "pcs";
    setFormData({
      type: "Goods",
      name: "",
      unit: defaultUnit,
      saleAccount: "",
      value: "",
      description: "",
      salesDescription: "",
      modelNumber: "",
      imageFile: null,
    });
    setSuggestions([]);
    setShowUnitSuggestions(false);
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!crmUser || !formData.name || !formData.value) {
      toast.error("Please fill all required fields (Name, Selling Price)");
      return;
    }

    setSaving(true);
    try {
      // 1. Auto-create unit if not exists in database
      let finalUnit = formData.unit.trim() || "pcs";
      const existingUnit = units.find(u => u.name.toLowerCase() === finalUnit.toLowerCase());
      if (!existingUnit && finalUnit) {
        try {
          const added = await createUnit(finalUnit);
          finalUnit = added.name;
          const updatedUnits = await fetchUnits();
          setUnits(updatedUnits);
        } catch (err) {
          console.error("Failed to auto-create unit:", err);
        }
      } else if (existingUnit) {
        finalUnit = existingUnit.name;
      }

      if (editingProduct) {
        // Edit existing product
        await updateProduct(editingProduct.id, {
          type: formData.type,
          name: formData.name,
          unit: finalUnit,
          description: formData.description,
          salesDescription: formData.salesDescription,
          modelNumber: formData.modelNumber,
          value: parseFloat(formData.value),
          saleAccount: formData.saleAccount || "",
          imageFile: formData.imageFile,
          imageUrl: existingImageUrl,
          userEmail: crmUser.email,
          department: crmUser.department,
        });
        toast.success("Item updated successfully!");
      } else {
        // Auto-generate a unique SKU
        const generatedSku = `SKU-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

        await createProduct({
          type: formData.type,
          name: formData.name,
          sku: generatedSku,
          unit: finalUnit,
          description: formData.description,
          salesDescription: formData.salesDescription,
          purchaseDescription: "",
          modelNumber: formData.modelNumber,
          partNumber: "",
          value: parseFloat(formData.value),
          costPrice: 0, // removed purchase info
          quantity: 0,  // removed quantity
          isSellable: true,
          saleAccount: formData.saleAccount || "",
          purchaseAccount: formData.saleAccount || "Default Purchase Account", // default same as sales account
          imageFile: formData.imageFile || undefined,
          createdBy: crmUser.id,
          userEmail: crmUser.email,
          department: crmUser.department,
        });
        toast.success("Item added successfully!");
      }

      handleClearSelected();
      setOpen(false);
    } catch (error) {
      console.error("Error saving product:", error);
      toast.error("Failed to save item.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (productId: string, currentDisabled: boolean) => {
    const newStatus = !currentDisabled;
    const actionText = newStatus ? "disable" : "enable";
    if (!confirm(`Are you sure you want to ${actionText} this item?`)) return;
    try {
      await updateProductStatus(productId, newStatus);
      toast.success(`Item ${newStatus ? "disabled" : "enabled"} successfully.`);
    } catch (error) {
      console.error("Error updating item status:", error);
      toast.error(`Failed to ${actionText} item.`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="page-container space-y-6">
      <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="section-title">Items</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage your product catalog · {visibleProducts.filter(p => !p.disabled).length} active</p>
          </div>
        <Dialog open={open} onOpenChange={(val) => {
          setOpen(val);
          if (!val) {
            handleClearSelected();
          } else if (!editingProduct) {
            const defaultUnit = units.find(u => u.name === "pcs")?.name || units[0]?.name || "pcs";
            setFormData(prev => ({ ...prev, unit: defaultUnit }));
          }
        }}>
          <DialogTrigger asChild>
            <Button className="h-9 rounded-xl gap-1.5 btn-gradient text-sm">
              <Plus className="w-3.5 h-3.5" />
              Add Item
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[550px] rounded-xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold tracking-tight">
                {selectedProduct ? "Item Details" : editingProduct ? "Edit Item" : "Add New Item"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddProduct} className="space-y-4 pt-2">

              {/* Type and Unit */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="type" className="text-xs font-semibold">Type</Label>
                  <select
                    id="type"
                    value={formData.type}
                    disabled={!!selectedProduct}
                    className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/85 focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200"
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as "Goods" | "Service" })}
                  >
                    <option value="Goods">Goods</option>
                    <option value="Service">Service</option>
                  </select>
                </div>

                <div className="relative space-y-1">
                  <Label htmlFor="unit" className="text-xs font-semibold">Unit</Label>
                  <div className="relative">
                    <Input
                      id="unit"
                      disabled={!!selectedProduct}
                      value={formData.unit}
                      onChange={(e) => handleUnitInputChange(e.target.value)}
                      onKeyDown={handleUnitKeyDown}
                      onFocus={() => {
                        const matches = units.filter((u) =>
                          u.name.toLowerCase().includes(formData.unit.toLowerCase().trim())
                        );
                        setUnitSuggestions(matches.length > 0 ? matches : units);
                        setShowUnitSuggestions(true);
                      }}
                      onBlur={() => {
                        // Delay so that selection click goes through before blur hides the popup
                        setTimeout(() => setShowUnitSuggestions(false), 200);
                      }}
                      placeholder="Type unit (e.g. pcs, box)..."
                      className="focus-visible:ring-1 pr-8"
                    />
                    {isAddingUnit && (
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-muted-foreground">
                        <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>

                  {/* Unit Suggestions Dropdown */}
                  {showUnitSuggestions && unitSuggestions.length > 0 && !selectedProduct && (
                    <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-xl max-h-40 overflow-y-auto divide-y divide-border/60 animate-in fade-in slide-in-from-top-1 duration-150">
                      {unitSuggestions.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent/80 transition-colors text-foreground"
                          onClick={() => {
                            setFormData((prev) => ({ ...prev, unit: u.name }));
                            setShowUnitSuggestions(false);
                          }}
                        >
                          {u.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Item Name (Search & Autocomplete) */}
              <div className="relative space-y-1">
                <Label htmlFor="name" className="text-xs font-semibold">Item Name *</Label>
                <div className="relative">
                  <Input
                    id="name"
                    required
                    value={formData.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="Enter item Name..."
                    className="pr-10 focus-visible:ring-1"
                  />
                </div>

                {/* Suggestions List */}
                {suggestions.length > 0 && !selectedProduct && (
                  <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-xl max-h-48 overflow-y-auto divide-y divide-border/60 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/40 sticky top-0 backdrop-blur-sm">
                      Existing Items Found
                    </div>
                    {suggestions.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent/80 transition-colors flex justify-between items-center"
                        onClick={() => handleSelectSuggestion(p)}
                      >
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{p.name}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {p.modelNumber ? `Model: ${p.modelNumber} • ` : ""}Unit: {p.unit}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                            {p.type}
                          </span>
                          <span className="text-xs font-semibold text-green-600">
                            ${p.value}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Existing Product Banner */}
              {selectedProduct && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3 animate-in zoom-in-95 duration-200">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 text-primary">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="font-semibold text-sm">Existing Item Loaded</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleClearSelected}
                      className="h-7 px-2 text-muted-foreground hover:text-foreground hover:bg-transparent"
                    >
                      <X className="w-4 h-4 mr-1" /> Clear / New
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Type:</span>{" "}
                      <span className="font-medium text-foreground">{selectedProduct.type}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">SKU:</span>{" "}
                      <span className="font-medium text-foreground">{selectedProduct.sku}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Unit:</span>{" "}
                      <span className="font-medium text-foreground">{selectedProduct.unit}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Selling Price:</span>{" "}
                      <span className="font-medium text-green-600 font-semibold">${selectedProduct.value}</span>
                    </div>
                    {selectedProduct.modelNumber && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Model Number:</span>{" "}
                        <span className="font-medium text-foreground">{selectedProduct.modelNumber}</span>
                      </div>
                    )}
                    {selectedProduct.description && (
                      <div className="col-span-2 border-t border-border/60 pt-1.5 mt-1">
                        <span className="text-muted-foreground block mb-0.5">Description:</span>
                        <p className="text-foreground text-xs leading-relaxed italic">{selectedProduct.description}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!selectedProduct && (
                <>
                  {/* Model Number */}
                  <div className="space-y-1">
                    <Label htmlFor="model" className="text-xs font-semibold">Model Number</Label>
                    <Input
                      id="model"
                      value={formData.modelNumber}
                      onChange={(e) => setFormData({ ...formData, modelNumber: e.target.value })}
                      placeholder="e.g., M-123"
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-1">
                    <Label htmlFor="description" className="text-xs font-semibold">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Enter item description..."
                      rows={3}
                      className="resize-none"
                    />
                  </div>

                  {/* Select Image */}
                  <div className="space-y-1">
                    <Label htmlFor="image" className="text-xs font-semibold">Select Image</Label>
                    <div className="flex gap-4 items-center">
                      <div className="flex-1">
                        <Input
                          id="image"
                          type="file"
                          accept="image/*"
                          onChange={(e) => setFormData({ ...formData, imageFile: e.target.files?.[0] || null })}
                          className="cursor-pointer file:bg-primary file:text-primary-foreground file:border-none file:mr-2 file:px-2 file:py-1 file:rounded-md file:text-xs hover:file:opacity-90"
                        />
                      </div>
                      {formData.imageFile ? (
                        <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-border flex-shrink-0 bg-muted">
                          <img
                            src={URL.createObjectURL(formData.imageFile)}
                            alt="Preview"
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, imageFile: null })}
                            className="absolute top-0.5 right-0.5 bg-background/80 hover:bg-background rounded-full p-0.5 text-foreground transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : existingImageUrl ? (
                        <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-border flex-shrink-0 bg-muted">
                          <img
                            src={existingImageUrl}
                            alt="Existing"
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => setExistingImageUrl("")}
                            className="absolute top-0.5 right-0.5 bg-background/80 hover:bg-background rounded-full p-0.5 text-foreground transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-lg border border-dashed border-border flex items-center justify-center text-muted-foreground flex-shrink-0 bg-muted/20">
                          <ImageIcon className="w-5 h-5 text-muted-foreground/65" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sales Information */}
                  <div className="rounded-xl border border-primary/10 p-4 space-y-4 shadow-sm bg-gradient-to-br from-secondary/30 to-background">
                    <div className="flex items-center justify-between border-b border-border/50 pb-2">
                      <h3 className="text-sm font-bold text-foreground">Sales Information</h3>
                      <span className="text-[10px] bg-green-500/10 text-green-700 px-2 py-0.5 rounded-full font-medium">Active</span>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-1">
                        <Label htmlFor="value" className="text-xs font-semibold">Selling Price *</Label>
                        <Input
                          id="value"
                          required
                          type="number"
                          step="0.01"
                          value={formData.value}
                          onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="salesDescription" className="text-xs font-semibold">Sales Description</Label>
                      <Input
                        id="salesDescription"
                        value={formData.salesDescription}
                        onChange={(e) => setFormData({ ...formData, salesDescription: e.target.value })}
                        placeholder="Sales terms/notes..."
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Form Buttons */}
              <div className="pt-2">
                {selectedProduct ? (
                  <Button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      handleClearSelected();
                    }}
                    className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border shadow-sm transition-all"
                  >
                    Close (Item Already Exists)
                  </Button>
                ) : editingProduct ? (
                  <Button
                    type="submit"
                    className="w-full shadow-lg shadow-primary/15 hover:shadow-primary/25 transition-all bg-primary text-primary-foreground hover:bg-primary/90"
                    disabled={saving}
                  >
                    {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    {saving ? "Saving Changes..." : "Save Changes"}
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    className="w-full shadow-lg shadow-primary/15 hover:shadow-primary/25 transition-all"
                    disabled={saving}
                  >
                    {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    {saving ? "Creating Item..." : "Create & Add New Item"}
                  </Button>
                )}
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="dashboard-panel">
        {visibleProducts.length === 0 ? (
          <div className="text-center py-16 rounded-xl border border-dashed border-border bg-card/50">
            <p className="text-muted-foreground font-medium">No items in your catalog yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Click "Add Item" above to create your first item.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {visibleProducts.map((product, idx) => {
              const isProductDisabled = !!product.disabled;
              return (
                <div
                  key={idx}
                  className={`border border-border/70 rounded-2xl p-5 hover:bg-card hover:shadow-[0_20px_40px_-15px_rgba(99,102,241,0.06)] hover:-translate-y-1 hover:border-primary/45 transition-all duration-300 bg-card/80 backdrop-blur-md flex flex-col justify-between group ${isProductDisabled ? "opacity-60 bg-muted/10" : ""}`}
                >
                  <div>
                    {product.imageUrl ? (
                      <div className="w-full h-44 rounded-xl overflow-hidden mb-4 border border-border/50 bg-muted/30 relative">
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        {isProductDisabled && (
                          <div className="absolute top-2 left-2 z-10">
                            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 font-semibold text-[10px] rounded-lg">
                              Disabled
                            </Badge>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-full h-44 rounded-xl mb-4 border border-dashed border-border/80 bg-gradient-to-br from-primary/5 via-primary/0 to-accent/5 flex flex-col items-center justify-center text-muted-foreground gap-2 relative">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shadow-sm border border-primary/10">
                          {product.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs font-semibold text-muted-foreground/70">No image provided</span>
                        {isProductDisabled && (
                          <div className="absolute top-2 left-2 z-10">
                            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 font-semibold text-[10px] rounded-lg">
                              Disabled
                            </Badge>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-bold text-lg leading-snug text-foreground group-hover:text-primary transition-colors">
                        {product.name}
                      </h3>
                      <span className="text-[10px] bg-primary/10 text-primary px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0 mt-0.5">
                        {product.type}
                      </span>
                    </div>

                    {product.description && (
                      <p className="text-xs text-muted-foreground mb-4 line-clamp-2 leading-relaxed italic">
                        {product.description}
                      </p>
                    )}

                    <div className="space-y-2 mb-4 pt-3 border-t border-border/50 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground font-medium">SKU:</span>
                        <span className="font-semibold font-mono text-[10px] bg-muted px-2 py-0.5 rounded-lg border border-border/40 text-foreground">{product.sku}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground font-medium">Unit:</span>
                        <span className="font-medium text-foreground">{product.unit}</span>
                      </div>
                      {product.modelNumber && (
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground font-medium">Model:</span>
                          <span className="font-medium text-foreground">{product.modelNumber}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-border/50 pt-4 mt-2 flex items-center justify-between gap-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Selling Price</span>
                      <span className="font-extrabold text-xl text-emerald-600">
                        ${Number(product.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditProductClick(product)}
                        className="text-muted-foreground hover:bg-accent hover:text-foreground transition-colors rounded-lg px-3"
                        disabled={isProductDisabled}
                        title={isProductDisabled ? "Cannot edit disabled item" : "Edit Item"}
                      >
                        <Pencil className="w-4 h-4 mr-1.5" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleStatus(product.id, isProductDisabled)}
                        className={`transition-colors rounded-lg px-3 ${isProductDisabled ? "text-success hover:bg-success/10 hover:text-success" : "text-amber-500 hover:bg-amber-500/10 hover:text-amber-500"}`}
                        title={isProductDisabled ? "Enable Item" : "Disable Item"}
                      >
                        {isProductDisabled ? (
                          <>
                            <Unlock className="w-4 h-4 mr-1.5" />
                            Enable
                          </>
                        ) : (
                          <>
                            <Lock className="w-4 h-4 mr-1.5" />
                            Disable
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ItemsPage;
