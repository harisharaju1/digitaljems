/**
 * Admin Products Management - CRUD operations
 */

import { useState, useEffect } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Search,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/hooks/use-toast";
import { productService, adminLogService } from "@/components/lib/sdk";
import type { Product, ProductFormData, ProductCategory, MetalType, MetalPurity } from "@/components/types";

const categories: ProductCategory[] = [
  "ring", "necklace", "earring", "bracelet", "pendant", "chain", "bangle", "anklet"
];

const metalTypes: MetalType[] = ["gold", "silver", "platinum", "white_gold", "rose_gold"];

const metalPurities: MetalPurity[] = ["24k", "22k", "18k", "14k", "925_silver", "950_platinum"];

const emptyForm: ProductFormData = {
  name: "",
  description: "",
  category: "ring",
  metal_type: "gold",
  metal_purity: "22k",
  weight_grams: 0,
  price: 0,
  mrp: 0,
  making_charges_saved: 0,
  images: [],
  stock_quantity: 0,
  is_active: "active",
};

export function AdminProducts() {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Dialog states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<ProductFormData>(emptyForm);
  const [imageUrls, setImageUrls] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const data = await productService.getAllProducts();
      setProducts(data);
    } catch (error) {
      console.error("Failed to load products:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openCreateDialog = () => {
    setEditingProduct(null);
    setFormData(emptyForm);
    setImageUrls("");
    setIsFormOpen(true);
  };

  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description,
      category: product.category,
      metal_type: product.metal_type,
      metal_purity: product.metal_purity,
      weight_grams: product.weight_grams,
      price: product.price,
      mrp: product.mrp,
      making_charges_saved: product.making_charges_saved,
      images: product.images,
      stock_quantity: product.stock_quantity,
      is_active: product.is_active,
    });
    setImageUrls(product.images.join("\n"));
    setIsFormOpen(true);
  };

  const openDeleteDialog = (product: Product) => {
    setDeletingProduct(product);
    setIsDeleteOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.price) {
      toast({
        title: "Validation error",
        description: "Name and price are required",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      const images = imageUrls
        .split("\n")
        .map((url) => url.trim())
        .filter((url) => url);

      const dataToSave = {
        ...formData,
        images,
        making_charges_saved: formData.mrp - formData.price,
      };

      if (editingProduct) {
        await productService.updateProduct(editingProduct.id, dataToSave);
        await adminLogService.logAction("product_updated", "product", editingProduct.id, {
          name: formData.name,
        });
        toast({ title: "Product updated successfully" });
      } else {
        const newProduct = await productService.createProduct(dataToSave);
        await adminLogService.logAction("product_created", "product", newProduct.id, {
          name: formData.name,
        });
        toast({ title: "Product created successfully" });
      }

      setIsFormOpen(false);
      loadProducts();
    } catch (error) {
      toast({
        title: "Failed to save product",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingProduct) return;

    setIsSaving(true);

    try {
      await productService.deleteProduct(deletingProduct.id);
      await adminLogService.logAction("product_deleted", "product", deletingProduct.id, {
        name: deletingProduct.name,
      });
      toast({ title: "Product deleted successfully" });
      setIsDeleteOpen(false);
      loadProducts();
    } catch (error) {
      toast({
        title: "Failed to delete product",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const formatCurrency = (amount: number) => `₹${amount.toLocaleString("en-IN")}`;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold md:text-3xl">Products</h1>
        <Button onClick={openCreateDialog} size="sm" className="md:size-default">
          <Plus className="mr-1 h-4 w-4 md:mr-2" />
          <span className="hidden sm:inline">Add Product</span>
          <span className="sm:hidden">Add</span>
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search products..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <p className="mb-4 text-sm text-muted-foreground">{filteredProducts.length} products</p>

      {/* Mobile: Product Cards */}
      <div className="space-y-3 md:hidden">
        {filteredProducts.map((product) => (
          <Card key={product.id} className="overflow-hidden">
            <CardContent className="p-0">
              <div className="flex gap-3 p-3">
                <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
                  {product.images[0] && (
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{product.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {product.weight_grams}g • {product.metal_purity.toUpperCase()} • {product.category}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="font-semibold text-sm">{formatCurrency(product.price)}</span>
                    <Badge variant={product.is_active === "active" ? "default" : "secondary"} className="text-xs">
                      {product.is_active}
                    </Badge>
                    <span className="text-xs text-muted-foreground">Stock: {product.stock_quantity}</span>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEditDialog(product)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => openDeleteDialog(product)}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop: Products Table */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 overflow-hidden rounded-lg bg-muted">
                        {product.images[0] && (
                          <img
                            src={product.images[0]}
                            alt={product.name}
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {product.weight_grams}g • {product.metal_purity.toUpperCase()}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="capitalize">{product.category}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{formatCurrency(product.price)}</p>
                      {product.mrp > product.price && (
                        <p className="text-sm text-muted-foreground line-through">
                          {formatCurrency(product.mrp)}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{product.stock_quantity}</TableCell>
                  <TableCell>
                    <Badge
                      variant={product.is_active === "active" ? "default" : "secondary"}
                    >
                      {product.is_active}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(product)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => openDeleteDialog(product)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-h-[85vh] w-[95vw] max-w-2xl overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-lg sm:text-xl">
              {editingProduct ? "Edit Product" : "Add New Product"}
            </DialogTitle>
            <DialogDescription className="text-sm">
              Fill in the product details below
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-2 sm:gap-4 sm:py-4">
            <div className="grid gap-1.5 sm:gap-2">
              <Label htmlFor="name" className="text-sm">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-9 sm:h-10"
              />
            </div>

            <div className="grid gap-1.5 sm:gap-2">
              <Label htmlFor="description" className="text-sm">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                className="text-sm"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
              <div className="grid gap-1.5 sm:gap-2">
                <Label className="text-sm">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) => setFormData({ ...formData, category: v as ProductCategory })}
                >
                  <SelectTrigger className="h-9 sm:h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c} className="capitalize">
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5 sm:gap-2">
                <Label className="text-sm">Metal Type</Label>
                <Select
                  value={formData.metal_type}
                  onValueChange={(v) => setFormData({ ...formData, metal_type: v as MetalType })}
                >
                  <SelectTrigger className="h-9 sm:h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {metalTypes.map((m) => (
                      <SelectItem key={m} value={m} className="capitalize">
                        {m.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5 sm:gap-2">
                <Label className="text-sm">Purity</Label>
                <Select
                  value={formData.metal_purity}
                  onValueChange={(v) => setFormData({ ...formData, metal_purity: v as MetalPurity })}
                >
                  <SelectTrigger className="h-9 sm:h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {metalPurities.map((p) => (
                      <SelectItem key={p} value={p} className="uppercase">
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="grid gap-1.5 sm:gap-2">
                <Label htmlFor="weight" className="text-sm">Weight (g)</Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.01"
                  value={formData.weight_grams}
                  onChange={(e) => setFormData({ ...formData, weight_grams: parseFloat(e.target.value) || 0 })}
                  className="h-9 sm:h-10"
                />
              </div>

              <div className="grid gap-1.5 sm:gap-2">
                <Label htmlFor="stock" className="text-sm">Stock</Label>
                <Input
                  id="stock"
                  type="number"
                  value={formData.stock_quantity}
                  onChange={(e) => setFormData({ ...formData, stock_quantity: parseInt(e.target.value) || 0 })}
                  className="h-9 sm:h-10"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="grid gap-1.5 sm:gap-2">
                <Label htmlFor="price" className="text-sm">Price (₹) *</Label>
                <Input
                  id="price"
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                  className="h-9 sm:h-10"
                />
              </div>

              <div className="grid gap-1.5 sm:gap-2">
                <Label htmlFor="mrp" className="text-sm">MRP (₹)</Label>
                <Input
                  id="mrp"
                  type="number"
                  value={formData.mrp}
                  onChange={(e) => setFormData({ ...formData, mrp: parseFloat(e.target.value) || 0 })}
                  className="h-9 sm:h-10"
                />
              </div>
            </div>

            <div className="grid gap-1.5 sm:gap-2">
              <Label htmlFor="images" className="text-sm">Image URLs (one per line)</Label>
              <Textarea
                id="images"
                value={imageUrls}
                onChange={(e) => setImageUrls(e.target.value)}
                placeholder="https://example.com/image1.jpg"
                rows={2}
                className="text-sm"
              />
            </div>

            <div className="grid gap-1.5 sm:gap-2">
              <Label className="text-sm">Status</Label>
              <Select
                value={formData.is_active}
                onValueChange={(v) => setFormData({ ...formData, is_active: v as "active" | "inactive" })}
              >
                <SelectTrigger className="h-9 sm:h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:gap-0 pt-2">
            <Button variant="outline" onClick={() => setIsFormOpen(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto">
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingProduct ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Product</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deletingProduct?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
