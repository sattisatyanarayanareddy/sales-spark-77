import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { fetchProducts, deleteProduct, createProduct } from "../lib/firestore-service";
import { Product } from "../types/crm";
import { Plus, Trash2 } from "lucide-react";
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
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    type: "Goods" as "Goods" | "Service",
    name: "",
    sku: "",
    unit: "pcs" as
      | "box"
      | "cm"
      | "dz"
      | "ft"
      | "g"
      | "in"
      | "kg"
      | "km"
      | "lb"
      | "mg"
      | "ml"
      | "m"
      | "pcs"
      | "roll"
      | "pack"
      | "pack of 50"
      | "pack of 100"
      | "pack of 500",
    saleAccount: "",
    purchaseAccount: "",
    isSellable: false,
    salesEnabled: true,
    purchaseEnabled: true,
    value: "",
    costPrice: "",
    description: "",
    salesDescription: "",
    purchaseDescription: "",
    modelNumber: "",
    partNumber: "",
    quantity: "",
    imageFile: null as File | null,
  });

  const loadProducts = async () => {
    if (!crmUser) return;
    try {
      setLoading(true);
      const data = await fetchProducts(crmUser.id, crmUser.role);
      setProducts(data);
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [crmUser]);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !crmUser ||
      !formData.name ||
      !formData.sku ||
      !formData.value ||
      !formData.costPrice ||
      !formData.saleAccount ||
      !formData.purchaseAccount
    ) {
      toast.error("Please fill all required fields (Name, SKU, Selling Price, Cost Price, Account)");
      return;
    }

    try {
      await createProduct({
        type: formData.type,
        name: formData.name,
        sku: formData.sku,
        unit: formData.unit,
        description: formData.description,
        salesDescription: formData.salesDescription,
        purchaseDescription: formData.purchaseDescription,
        modelNumber: formData.modelNumber,
        partNumber: formData.partNumber,
        value: parseFloat(formData.value),
        costPrice: parseFloat(formData.costPrice),
        quantity: parseInt(formData.quantity || "0"),
        isSellable: formData.isSellable,
        saleAccount: formData.saleAccount,
        purchaseAccount: formData.purchaseAccount,
        imageFile: formData.imageFile || undefined,
        createdBy: crmUser.id,
        userEmail: crmUser.email,
      });

      setFormData({
        type: "Goods",
        name: "",
        sku: "",
        unit: "pcs",
        saleAccount: "",
        purchaseAccount: "",
        isSellable: false,
        salesEnabled: true,
        purchaseEnabled: true,
        value: "",
        costPrice: "",
        description: "",
        salesDescription: "",
        purchaseDescription: "",
        modelNumber: "",
        partNumber: "",
        quantity: "",
        imageFile: null,
      });
      setOpen(false);
      await loadProducts();
    } catch (error) {
      console.error("Error adding product:", error);
    }
  };

  const handleDelete = async (productId: string) => {
    if (!confirm("Are you sure you want to delete this item?")) return;
    try {
      await deleteProduct(productId);
      await loadProducts();
    } catch (error) {
      console.error("Error deleting product:", error);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Items</h1>
          <p className="text-muted-foreground mt-1">Manage your product catalog</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Item
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Item</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddProduct} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="type">Type</Label>
                  <select
                    id="type"
                    value={formData.type}
                    className="input"
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as "Goods" | "Service" })}
                  >
                    <option value="Goods">Goods</option>
                    <option value="Service">Service</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="sku">SKU *</Label>
                  <Input
                    id="sku"
                    required
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    placeholder="Enter SKU"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter item name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="unit">Unit</Label>
                  <select
                    id="unit"
                    className="input"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value as typeof formData.unit })}
                  >
                    <option value="box">box</option>
                    <option value="cm">cm</option>
                    <option value="dz">dz</option>
                    <option value="ft">ft</option>
                    <option value="g">g</option>
                    <option value="in">in</option>
                    <option value="kg">kg</option>
                    <option value="km">km</option>
                    <option value="lb">lb</option>
                    <option value="mg">mg</option>
                    <option value="ml">ml</option>
                    <option value="m">m</option>
                    <option value="pcs">pcs</option>
                    <option value="roll">roll</option>
                    <option value="pack">pack</option>
                    <option value="pack of 50">Pack of 50</option>
                    <option value="pack of 100">pack of 100</option>
                    <option value="pack of 500">pack of 500</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="image">Select Image</Label>
                  <Input
                    id="image"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFormData({ ...formData, imageFile: e.target.files?.[0] || null })}
                  />
                  {formData.imageFile && (
                    <img
                      src={URL.createObjectURL(formData.imageFile)}
                      alt="Selected product"
                      className="mt-2 w-full h-40 object-cover rounded-lg"
                    />
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-border p-4 bg-muted/40 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Sales Information</h3>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={formData.salesEnabled}
                      onChange={(e) => setFormData({ ...formData, salesEnabled: e.target.checked })}
                    />
                    Enable
                  </label>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="value">Selling Price *</Label>
                    <Input
                      id="value"
                      required
                      type="number"
                      step="0.01"
                      value={formData.value}
                      onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                      placeholder="0.00"
                      disabled={!formData.salesEnabled}
                    />
                  </div>
                  <div>
                    <Label htmlFor="saleAccount">Account *</Label>
                    <Input
                      id="saleAccount"
                      required
                      value={formData.saleAccount}
                      onChange={(e) => setFormData({ ...formData, saleAccount: e.target.value })}
                      placeholder="Sale account"
                      disabled={!formData.salesEnabled}
                    />
                  </div>
                  <div>
                    <Label htmlFor="salesDescription">Description</Label>
                    <Input
                      id="salesDescription"
                      value={formData.salesDescription}
                      onChange={(e) => setFormData({ ...formData, salesDescription: e.target.value })}
                      placeholder="Sales description"
                      disabled={!formData.salesEnabled}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border p-4 bg-muted/40 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Purchase Information</h3>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={formData.purchaseEnabled}
                      onChange={(e) => setFormData({ ...formData, purchaseEnabled: e.target.checked })}
                    />
                    Enable
                  </label>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="costPrice">Cost Price *</Label>
                    <Input
                      id="costPrice"
                      required
                      type="number"
                      step="0.01"
                      value={formData.costPrice}
                      onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                      placeholder="0.00"
                      disabled={!formData.purchaseEnabled}
                    />
                  </div>
                  <div>
                    <Label htmlFor="purchaseAccount">Account *</Label>
                    <Input
                      id="purchaseAccount"
                      required
                      value={formData.purchaseAccount}
                      onChange={(e) => setFormData({ ...formData, purchaseAccount: e.target.value })}
                      placeholder="Purchase account"
                      disabled={!formData.purchaseEnabled}
                    />
                  </div>
                  <div>
                    <Label htmlFor="purchaseDescription">Description</Label>
                    <Input
                      id="purchaseDescription"
                      value={formData.purchaseDescription}
                      onChange={(e) => setFormData({ ...formData, purchaseDescription: e.target.value })}
                      placeholder="Purchase description"
                      disabled={!formData.purchaseEnabled}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="model">Model Number</Label>
                  <Input
                    id="model"
                    value={formData.modelNumber}
                    onChange={(e) => setFormData({ ...formData, modelNumber: e.target.value })}
                    placeholder="e.g., M-123"
                  />
                </div>
                <div>
                  <Label htmlFor="part">Part Number</Label>
                  <Input
                    id="part"
                    value={formData.partNumber}
                    onChange={(e) => setFormData({ ...formData, partNumber: e.target.value })}
                    placeholder="e.g., P-456"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="0"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  placeholder="0"
                />
              </div>

              <Button type="submit" className="w-full">
                Add Item
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="dashboard-panel">
        {products.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No items yet. Add your first item!</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {products.map((product, idx) => (
              <div
                key={idx}
                className="border border-border rounded-lg p-4 hover:bg-accent/40 transition-colors"
              >
                {product.imageUrl && (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-40 object-cover rounded-lg mb-3"
                  />
                )}
                <h3 className="font-semibold text-lg mb-2">{product.name}</h3>
                {product.description && (
                  <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                    {product.description}
                  </p>
                )}
                <div className="space-y-1 mb-3 text-sm">
                  <p><span className="text-muted-foreground">Type:</span> {product.type}</p>
                  <p><span className="text-muted-foreground">SKU:</span> {product.sku}</p>
                  <p><span className="text-muted-foreground">Unit:</span> {product.unit}</p>
                  {product.modelNumber && (
                    <p><span className="text-muted-foreground">Model:</span> {product.modelNumber}</p>
                  )}
                  {product.partNumber && (
                    <p><span className="text-muted-foreground">Part:</span> {product.partNumber}</p>
                  )}
                  <p className="font-semibold text-green-600">Sell: ${Number(product.value || 0).toLocaleString()}</p>
                  <p className="text-sm"><span className="text-muted-foreground">Cost:</span> ${Number(product.costPrice || 0).toLocaleString()}</p>
                  <p className="text-sm"><span className="text-muted-foreground">Quantity:</span> {product.quantity ?? 0}</p>
                  <p className="text-sm"><span className="text-muted-foreground">Sellable:</span> {product.isSellable ? "Yes" : "No"}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(product.id)}
                  className="w-full text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ItemsPage;
