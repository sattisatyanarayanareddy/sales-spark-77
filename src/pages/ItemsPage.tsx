import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { fetchProducts, deleteProduct, createProduct } from "../lib/firestore-service";
import { Product } from "../types/crm";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
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
    name: "",
    description: "",
    modelNumber: "",
    partNumber: "",
    value: "",
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
    if (!crmUser || !formData.name || !formData.value) return;

    try {
      await createProduct({
        name: formData.name,
        description: formData.description,
        modelNumber: formData.modelNumber,
        partNumber: formData.partNumber,
        value: parseFloat(formData.value),
        quantity: parseInt(formData.quantity),
        imageFile: formData.imageFile || undefined,
        createdBy: crmUser.id,
        userEmail: crmUser.email,
      });

      setFormData({
        name: "",
        description: "",
        modelNumber: "",
        partNumber: "",
        value: "",
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
              <div>
                <Label htmlFor="name">Product Name *</Label>
                <Input
                  id="name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter product name"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter product description"
                  rows={3}
                />
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
                <Label htmlFor="value">Value (USD) *</Label>
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
              <div>
                <Label htmlFor="quantity">Quantity *</Label>
                <Input
                  id="quantity"
                  required
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  placeholder="1"
                />
              </div>
              <div>
                <Label htmlFor="image">Product Image</Label>
                <Input
                  id="image"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFormData({ ...formData, imageFile: e.target.files?.[0] || null })}
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Optional: Upload a product image (max 5MB)
                </p>
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
                  {product.modelNumber && (
                    <p><span className="text-muted-foreground">Model:</span> {product.modelNumber}</p>
                  )}
                  {product.partNumber && (
                    <p><span className="text-muted-foreground">Part:</span> {product.partNumber}</p>
                  )}
                  <p className="font-semibold text-green-600">${product.value.toLocaleString()}</p>
                  <p className="text-sm"><span className="text-muted-foreground">Quantity:</span> {product.quantity || 1}</p>
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
