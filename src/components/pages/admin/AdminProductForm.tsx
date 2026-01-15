/**
 * Admin Product Form - Create/Edit Product Page
 */

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/hooks/use-toast";
import { productService, adminLogService, storageService } from "@/components/lib/sdk";
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

export function AdminProductForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isEditing = !!id;

  const [isLoading, setIsLoading] = useState(isEditing);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState<ProductFormData>(emptyForm);
  const [imageUrls, setImageUrls] = useState("");
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);

  useEffect(() => {
    if (isEditing && id) {
      loadProduct(id);
    }
  }, [id, isEditing]);

  const loadProduct = async (productId: string) => {
    try {
      const products = await productService.getAllProducts();
      const product = products.find((p) => p.id === productId);
      if (product) {
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
        setUploadedImages(product.images);
      } else {
        toast({ title: "Product not found", variant: "destructive" });
        navigate("/admin/products");
      }
    } catch (error) {
      toast({ title: "Failed to load product", variant: "destructive" });
      navigate("/admin/products");
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newUrls: string[] = [];

    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) {
          toast({
            title: "Invalid file",
            description: `${file.name} is not an image`,
            variant: "destructive",
          });
          continue;
        }

        if (file.size > 5 * 1024 * 1024) {
          toast({
            title: "File too large",
            description: `${file.name} exceeds 5MB limit`,
            variant: "destructive",
          });
          continue;
        }

        const url = await storageService.uploadProductImage(file);
        newUrls.push(url);
      }

      if (newUrls.length > 0) {
        setUploadedImages(prev => [...prev, ...newUrls]);
        setImageUrls(prev => prev ? `${prev}\n${newUrls.join('\n')}` : newUrls.join('\n'));
        toast({ title: `${newUrls.length} image(s) uploaded` });
      }
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const removeUploadedImage = (urlToRemove: string) => {
    setUploadedImages(prev => prev.filter(url => url !== urlToRemove));
    setImageUrls(prev => 
      prev.split('\n').filter(url => url.trim() !== urlToRemove).join('\n')
    );
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

      if (isEditing && id) {
        await productService.updateProduct(id, dataToSave);
        await adminLogService.logAction("product_updated", "product", id, {
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

      navigate("/admin/products");
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate("/admin/products")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Products
        </Button>
        <h1 className="text-2xl font-bold">
          {isEditing ? "Edit Product" : "Add New Product"}
        </h1>
      </div>

      <Card>
        <CardContent className="p-6 space-y-6">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          {/* Category, Metal Type, Purity */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={formData.category}
                onValueChange={(v) => setFormData({ ...formData, category: v as ProductCategory })}
              >
                <SelectTrigger>
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

            <div className="space-y-2">
              <Label>Metal Type</Label>
              <Select
                value={formData.metal_type}
                onValueChange={(v) => setFormData({ ...formData, metal_type: v as MetalType })}
              >
                <SelectTrigger>
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

            <div className="space-y-2">
              <Label>Purity</Label>
              <Select
                value={formData.metal_purity}
                onValueChange={(v) => setFormData({ ...formData, metal_purity: v as MetalPurity })}
              >
                <SelectTrigger>
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

          {/* Weight and Stock */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="weight">Weight (g)</Label>
              <Input
                id="weight"
                type="number"
                step="0.01"
                value={formData.weight_grams}
                onChange={(e) => setFormData({ ...formData, weight_grams: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="stock">Stock</Label>
              <Input
                id="stock"
                type="number"
                value={formData.stock_quantity}
                onChange={(e) => setFormData({ ...formData, stock_quantity: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>

          {/* Price and MRP */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Price (₹) *</Label>
              <Input
                id="price"
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mrp">MRP (₹)</Label>
              <Input
                id="mrp"
                type="number"
                value={formData.mrp}
                onChange={(e) => setFormData({ ...formData, mrp: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>

          {/* Images */}
          <div className="space-y-2">
            <Label>Product Images</Label>
            
            <div className="flex flex-wrap gap-2 mb-2">
              {uploadedImages.map((url, index) => (
                <div key={index} className="relative h-20 w-20 rounded-lg overflow-hidden border bg-muted">
                  <img src={url} alt={`Product ${index + 1}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeUploadedImage(url)}
                    className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              
              <label className="h-20 w-20 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center cursor-pointer hover:border-muted-foreground/50 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={isUploading}
                />
                {isUploading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <Upload className="h-5 w-5 text-muted-foreground" />
                )}
              </label>
            </div>
            
            <p className="text-xs text-muted-foreground mb-2">
              Click + to upload images (max 5MB each) or add URLs below
            </p>
            
            <Textarea
              value={imageUrls}
              onChange={(e) => setImageUrls(e.target.value)}
              placeholder="https://example.com/image1.jpg"
              rows={2}
            />
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={formData.is_active}
              onValueChange={(v) => setFormData({ ...formData, is_active: v as "active" | "inactive" })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button variant="outline" onClick={() => navigate("/admin/products")} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto">
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Update Product" : "Create Product"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
