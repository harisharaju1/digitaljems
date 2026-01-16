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
import { cn } from "@/components/lib/utils";
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
  stone_weight: undefined,
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
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [formData, setFormData] = useState<ProductFormData>(emptyForm);
  const [imageUrls, setImageUrls] = useState("");
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [videoUrls, setVideoUrls] = useState("");
  const [uploadedVideos, setUploadedVideos] = useState<string[]>([]);

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
          stone_weight: product.stone_weight,
          price: product.price,
          mrp: product.mrp,
          making_charges_saved: product.making_charges_saved,
          images: product.images,
          videos: product.videos || [],
          stock_quantity: product.stock_quantity,
          is_active: product.is_active,
          sku: product.sku,
          short_description: product.short_description,
          width_mm: product.width_mm,
          height_mm: product.height_mm,
          length_mm: product.length_mm,
          gross_weight_grams: product.gross_weight_grams,
          stone_quality: product.stone_quality,
          stone_grade: product.stone_grade,
          stone_setting: product.stone_setting,
          stone_count: product.stone_count,
        });
        setImageUrls(product.images.join("\n"));
        setUploadedImages(product.images);
        setVideoUrls((product.videos || []).join("\n"));
        setUploadedVideos(product.videos || []);
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

    // Check if adding these files would exceed the limit
    const currentCount = uploadedImages.length;
    const newFilesCount = files.length;
    const maxImages = 10;

    if (currentCount + newFilesCount > maxImages) {
      toast({
        title: "Image limit exceeded",
        description: `Maximum ${maxImages} images allowed. You have ${currentCount} and tried to add ${newFilesCount}.`,
        variant: "destructive",
      });
      e.target.value = '';
      return;
    }

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

  const checkVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        resolve(video.duration);
      };
      
      video.onerror = () => {
        window.URL.revokeObjectURL(video.src);
        reject(new Error('Failed to load video metadata'));
      };
      
      video.src = URL.createObjectURL(file);
    });
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Check if adding these files would exceed the limit
    const currentCount = uploadedVideos.length;
    const newFilesCount = files.length;
    const maxVideos = 10;

    if (currentCount + newFilesCount > maxVideos) {
      toast({
        title: "Video limit exceeded",
        description: `Maximum ${maxVideos} videos allowed. You have ${currentCount} and tried to add ${newFilesCount}.`,
        variant: "destructive",
      });
      e.target.value = '';
      return;
    }

    setIsUploadingVideo(true);
    const newUrls: string[] = [];

    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('video/')) {
          toast({
            title: "Invalid file",
            description: `${file.name} is not a video`,
            variant: "destructive",
          });
          continue;
        }

        if (file.size > 50 * 1024 * 1024) {
          toast({
            title: "File too large",
            description: `${file.name} exceeds 50MB limit`,
            variant: "destructive",
          });
          continue;
        }

        // Check video duration (max 10 seconds)
        try {
          const duration = await checkVideoDuration(file);
          if (duration > 10) {
            toast({
              title: "Video too long",
              description: `${file.name} is ${duration.toFixed(1)}s. Maximum duration is 10 seconds.`,
              variant: "destructive",
            });
            continue;
          }
        } catch (error) {
          toast({
            title: "Video validation failed",
            description: `Could not validate ${file.name}. Please try another file.`,
            variant: "destructive",
          });
          continue;
        }

        const url = await storageService.uploadProductVideo(file);
        newUrls.push(url);
      }

      if (newUrls.length > 0) {
        setUploadedVideos(prev => [...prev, ...newUrls]);
        setVideoUrls(prev => prev ? `${prev}\n${newUrls.join('\n')}` : newUrls.join('\n'));
        toast({ title: `${newUrls.length} video(s) uploaded` });
      }
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsUploadingVideo(false);
      e.target.value = '';
    }
  };

  const removeUploadedVideo = (urlToRemove: string) => {
    setUploadedVideos(prev => prev.filter(url => url !== urlToRemove));
    setVideoUrls(prev => 
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

      const videos = videoUrls
        .split("\n")
        .map((url) => url.trim())
        .filter((url) => url);

      // Validate limits
      if (images.length > 10) {
        toast({
          title: "Validation error",
          description: `Maximum 10 images allowed. You have ${images.length}.`,
          variant: "destructive",
        });
        setIsSaving(false);
        return;
      }

      if (videos.length > 10) {
        toast({
          title: "Validation error",
          description: `Maximum 10 videos allowed. You have ${videos.length}.`,
          variant: "destructive",
        });
        setIsSaving(false);
        return;
      }

      const dataToSave = {
        ...formData,
        images,
        videos,
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
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="weight">Metal Weight (g)</Label>
              <Input
                id="weight"
                type="number"
                step="0.01"
                min="0"
                value={formData.weight_grams || ""}
                onChange={(e) => setFormData({ ...formData, weight_grams: e.target.value === "" ? 0 : parseFloat(e.target.value) })}
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="stone_weight">Stone Weight (ct)</Label>
              <Input
                id="stone_weight"
                type="number"
                step="0.01"
                min="0"
                value={formData.stone_weight ?? ""}
                onChange={(e) => setFormData({ ...formData, stone_weight: e.target.value === "" ? undefined : parseFloat(e.target.value) })}
                placeholder="Optional"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="stock">Stock</Label>
              <Input
                id="stock"
                type="number"
                min="0"
                value={formData.stock_quantity || ""}
                onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value === "" ? 0 : parseInt(e.target.value) })}
                placeholder="0"
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
                min="0"
                value={formData.price || ""}
                onChange={(e) => setFormData({ ...formData, price: e.target.value === "" ? 0 : parseFloat(e.target.value) })}
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mrp">MRP (₹)</Label>
              <Input
                id="mrp"
                type="number"
                min="0"
                value={formData.mrp || ""}
                onChange={(e) => setFormData({ ...formData, mrp: e.target.value === "" ? 0 : parseFloat(e.target.value) })}
                placeholder="0"
              />
            </div>
          </div>

          {/* Images */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Product Images</Label>
              <span className="text-xs text-muted-foreground">
                {uploadedImages.length} / 10
              </span>
            </div>
            
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
              
              {uploadedImages.length < 10 && (
                <label className={cn(
                  "h-20 w-20 rounded-lg border-2 border-dashed flex items-center justify-center transition-colors",
                  isUploading
                    ? "border-muted-foreground/30 cursor-not-allowed opacity-50"
                    : "border-muted-foreground/30 cursor-pointer hover:border-muted-foreground/50"
                )}>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={isUploading || uploadedImages.length >= 10}
                  />
                  {isUploading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : (
                    <Upload className="h-5 w-5 text-muted-foreground" />
                  )}
                </label>
              )}
            </div>
            
            <p className="text-xs text-muted-foreground mb-2">
              Click + to upload images (max 10 images, 5MB each) or add URLs below
            </p>
            
            <Textarea
              value={imageUrls}
              onChange={(e) => {
                setImageUrls(e.target.value);
                const urls = e.target.value.split("\n").map((url) => url.trim()).filter((url) => url);
                setUploadedImages(urls);
              }}
              onBlur={(e) => {
                const urls = e.target.value.split("\n").map((url) => url.trim()).filter((url) => url);
                if (urls.length > 10) {
                  toast({
                    title: "Image limit exceeded",
                    description: "Maximum 10 images allowed. Please remove some URLs.",
                    variant: "destructive",
                  });
                }
              }}
              placeholder="https://example.com/image1.jpg"
              rows={2}
            />
          </div>

          {/* Videos */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Product Videos</Label>
              <span className="text-xs text-muted-foreground">
                {uploadedVideos.length} / 10
              </span>
            </div>
            
            <div className="flex flex-wrap gap-2 mb-2">
              {uploadedVideos.map((url, index) => (
                <div key={index} className="relative h-20 w-20 rounded-lg overflow-hidden border bg-muted">
                  <video src={url} className="h-full w-full object-cover" muted />
                  <button
                    type="button"
                    onClick={() => removeUploadedVideo(url)}
                    className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              
              {uploadedVideos.length < 10 && (
                <label className={cn(
                  "h-20 w-20 rounded-lg border-2 border-dashed flex items-center justify-center transition-colors",
                  isUploadingVideo
                    ? "border-muted-foreground/30 cursor-not-allowed opacity-50"
                    : "border-muted-foreground/30 cursor-pointer hover:border-muted-foreground/50"
                )}>
                  <input
                    type="file"
                    accept="video/*"
                    multiple
                    onChange={handleVideoUpload}
                    className="hidden"
                    disabled={isUploadingVideo || uploadedVideos.length >= 10}
                  />
                  {isUploadingVideo ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : (
                    <Upload className="h-5 w-5 text-muted-foreground" />
                  )}
                </label>
              )}
            </div>
            
            <p className="text-xs text-muted-foreground mb-2">
              Click + to upload videos (max 10 videos, 10 seconds each, 50MB each) or add URLs below
            </p>
            
            <Textarea
              value={videoUrls}
              onChange={(e) => {
                setVideoUrls(e.target.value);
                const urls = e.target.value.split("\n").map((url) => url.trim()).filter((url) => url);
                setUploadedVideos(urls);
              }}
              onBlur={(e) => {
                const urls = e.target.value.split("\n").map((url) => url.trim()).filter((url) => url);
                if (urls.length > 10) {
                  toast({
                    title: "Video limit exceeded",
                    description: "Maximum 10 videos allowed. Please remove some URLs.",
                    variant: "destructive",
                  });
                }
              }}
              placeholder="https://example.com/video1.mp4"
              rows={2}
            />
          </div>

          {/* Product Details Fields */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-semibold">Additional Product Details</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sku">SKU</Label>
                <Input
                  id="sku"
                  value={formData.sku || ""}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  placeholder="JR07863-1YS300"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="short_description">Short Description</Label>
                <Input
                  id="short_description"
                  value={formData.short_description || ""}
                  onChange={(e) => setFormData({ ...formData, short_description: e.target.value })}
                  placeholder="Brief product summary"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="width_mm">Width (mm)</Label>
                <Input
                  id="width_mm"
                  type="number"
                  step="0.1"
                  min="0"
                  value={formData.width_mm ?? ""}
                  onChange={(e) => setFormData({ ...formData, width_mm: e.target.value === "" ? undefined : parseFloat(e.target.value) })}
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="height_mm">Height (mm)</Label>
                <Input
                  id="height_mm"
                  type="number"
                  step="0.1"
                  min="0"
                  value={formData.height_mm ?? ""}
                  onChange={(e) => setFormData({ ...formData, height_mm: e.target.value === "" ? undefined : parseFloat(e.target.value) })}
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="length_mm">Length (mm)</Label>
                <Input
                  id="length_mm"
                  type="number"
                  step="0.1"
                  min="0"
                  value={formData.length_mm ?? ""}
                  onChange={(e) => setFormData({ ...formData, length_mm: e.target.value === "" ? undefined : parseFloat(e.target.value) })}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gross_weight_grams">Gross Weight (g)</Label>
                <Input
                  id="gross_weight_grams"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.gross_weight_grams ?? ""}
                  onChange={(e) => setFormData({ ...formData, gross_weight_grams: e.target.value === "" ? undefined : parseFloat(e.target.value) })}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stone_quality">Stone Quality</Label>
                <Input
                  id="stone_quality"
                  value={formData.stone_quality || ""}
                  onChange={(e) => setFormData({ ...formData, stone_quality: e.target.value })}
                  placeholder="FG-SI"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="stone_grade">Stone Grade</Label>
                <Input
                  id="stone_grade"
                  value={formData.stone_grade || ""}
                  onChange={(e) => setFormData({ ...formData, stone_grade: e.target.value })}
                  placeholder="VS, VVS, SI, etc."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stone_setting">Type of Setting</Label>
                <Input
                  id="stone_setting"
                  value={formData.stone_setting || ""}
                  onChange={(e) => setFormData({ ...formData, stone_setting: e.target.value })}
                  placeholder="Hand Setting, Prong Setting, Bezel Setting"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="stone_count">Number of Diamonds</Label>
                <Input
                  id="stone_count"
                  type="number"
                  min="0"
                  value={formData.stone_count ?? ""}
                  onChange={(e) => setFormData({ ...formData, stone_count: e.target.value === "" ? undefined : parseInt(e.target.value) })}
                  placeholder="0"
                />
              </div>
            </div>
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
