/**
 * Product Detail Page
 * Full page product view with images and details
 */

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  Sparkles,
  ArrowLeft,
  ZoomIn,
  Package,
  Ruler,
  Scale,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { Product } from "@/components/types";
import { useCartStore } from "@/components/store/cart-store";
import { useProductsStore } from "@/components/store/products-store";
import { useToast } from "@/components/hooks/use-toast";
import { cn } from "@/components/lib/utils";
import { ProductImage } from "@/components/ui/product-image";
import { Loader2 } from "lucide-react";

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const addItem = useCartStore((state) => state.addItem);
  const { products, loadProducts, isLoading } = useProductsStore();
  
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [fullscreenImage, setFullscreenImage] = useState(false);

  useEffect(() => {
    // Ensure scroll to top on mount
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [id]);

  useEffect(() => {
    if (products.length === 0) {
      loadProducts();
    }
  }, [products.length, loadProducts]);

  const product = products.find((p) => p.id === id);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Product not found</h1>
        <Button onClick={() => navigate("/")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Shop
        </Button>
      </div>
    );
  }

  const handlePrevImage = () => {
    setCurrentImageIndex((prev) =>
      prev === 0 ? product.images.length - 1 : prev - 1
    );
  };

  const handleNextImage = () => {
    setCurrentImageIndex((prev) =>
      prev === product.images.length - 1 ? 0 : prev + 1
    );
  };

  const handleAddToCart = () => {
    addItem(product, quantity);
    toast({
      title: "Added to cart",
      description: `${quantity}x ${product.name} added to cart.`,
    });
  };

  const savings = product.making_charges_saved * quantity;
  const savingsPercent = Math.round(
    (product.making_charges_saved / product.mrp) * 100
  );
  const totalPrice = product.price * quantity;

  return (
    <div className="min-h-screen bg-background">
      {/* Back Button */}
      <div className="container mx-auto px-4 py-4">
        <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:block container mx-auto px-4 pb-12">
        <div className="grid grid-cols-[1.2fr_1fr] gap-8 lg:gap-12">
          {/* Left: Images */}
          <div className="space-y-4">
            {/* Main Image */}
            <div className="relative aspect-square overflow-hidden rounded-xl bg-muted">
              <button
                className="flex h-full w-full items-center justify-center"
                onClick={() => setFullscreenImage(true)}
              >
                <ProductImage
                  src={product.images[currentImageIndex]}
                  alt={`${product.name} - Image ${currentImageIndex + 1}`}
                  className="max-h-full max-w-full object-contain cursor-zoom-in"
                />
              </button>

              {/* Navigation Arrows */}
              {product.images.length > 1 && (
                <>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute left-4 top-1/2 -translate-y-1/2 opacity-70 hover:opacity-100"
                    onClick={handlePrevImage}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute right-4 top-1/2 -translate-y-1/2 opacity-70 hover:opacity-100"
                    onClick={handleNextImage}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </>
              )}

              {/* Image Counter */}
              {product.images.length > 1 && (
                <div className="absolute left-4 top-4 rounded-lg bg-black/60 px-3 py-1 text-sm text-white backdrop-blur">
                  {currentImageIndex + 1} / {product.images.length}
                </div>
              )}

              {/* Zoom hint */}
              <div className="absolute bottom-4 right-4 flex items-center gap-2 rounded-lg bg-black/60 px-3 py-2 text-sm text-white backdrop-blur">
                <ZoomIn className="h-4 w-4" />
                <span>Click to zoom</span>
              </div>
            </div>

            {/* Thumbnails */}
            {product.images.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {product.images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentImageIndex(index)}
                    className={cn(
                      "h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-all",
                      currentImageIndex === index
                        ? "border-primary shadow-md"
                        : "border-transparent opacity-60 hover:opacity-100"
                    )}
                  >
                    <img
                      src={image}
                      alt={`Thumbnail ${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Details */}
          <div className="space-y-6">
            {/* Title */}
            <div>
              <h1 className="text-3xl font-bold">{product.name}</h1>
              <p className="mt-1 text-muted-foreground">
                <span className="capitalize">{product.metal_type.replace("_", " ")}</span>
                {" • "}
                <span className="uppercase">{product.metal_purity}</span>
              </p>
            </div>

            {/* Pricing */}
            <div>
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-bold">
                  ₹{product.price.toLocaleString("en-IN")}
                </span>
                {product.mrp > product.price && (
                  <>
                    <span className="text-xl text-muted-foreground line-through">
                      ₹{product.mrp.toLocaleString("en-IN")}
                    </span>
                    <Badge variant="secondary" className="text-sm">{savingsPercent}% off</Badge>
                  </>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Inclusive of all taxes
              </p>
            </div>

            {/* Savings Highlight */}
            <div className="savings-badge w-full p-4">
              <div className="flex items-center gap-3">
                <Sparkles className="h-6 w-6" />
                <div>
                  <p className="text-lg font-semibold">
                    You Save ₹{savings.toLocaleString("en-IN")}
                  </p>
                  <p className="text-sm opacity-80">on making charges</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Product Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Product Details</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg bg-muted p-4 text-center">
                  <Scale className="mx-auto h-5 w-5 text-muted-foreground mb-2" />
                  <p className="font-semibold">{product.weight_grams}g</p>
                  <p className="text-sm text-muted-foreground">Weight</p>
                </div>
                <div className="rounded-lg bg-muted p-4 text-center">
                  <Ruler className="mx-auto h-5 w-5 text-muted-foreground mb-2" />
                  <p className="font-semibold uppercase">{product.metal_purity}</p>
                  <p className="text-sm text-muted-foreground">Purity</p>
                </div>
                <div className="rounded-lg bg-muted p-4 text-center">
                  <Package className="mx-auto h-5 w-5 text-muted-foreground mb-2" />
                  <p className="font-semibold">{product.stock_quantity}</p>
                  <p className="text-sm text-muted-foreground">In Stock</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Description */}
            <div>
              <h3 className="text-lg font-semibold mb-2">Description</h3>
              <p className="text-muted-foreground leading-relaxed">
                {product.description}
              </p>
            </div>

            <Separator />

            {/* Quantity & Add to Cart */}
            {product.stock_quantity > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <span className="font-medium">Quantity:</span>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    >
                      -
                    </Button>
                    <span className="w-12 text-center text-lg font-semibold">
                      {quantity}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        setQuantity(Math.min(product.stock_quantity, quantity + 1))
                      }
                      disabled={quantity >= product.stock_quantity}
                    >
                      +
                    </Button>
                  </div>
                </div>

                {quantity > 1 && (
                  <div className="flex items-center justify-between rounded-lg bg-muted p-4">
                    <span className="font-medium">Total ({quantity} items)</span>
                    <span className="text-xl font-bold">
                      ₹{totalPrice.toLocaleString("en-IN")}
                    </span>
                  </div>
                )}

                <Button
                  className="btn-premium w-full"
                  size="lg"
                  onClick={handleAddToCart}
                >
                  <ShoppingCart className="mr-2 h-5 w-5" />
                  Add to Cart
                </Button>
              </div>
            ) : (
              <Button className="w-full" size="lg" disabled>
                Out of Stock
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden">
        {/* Image Gallery */}
        <div className="relative aspect-square bg-muted">
          <button
            className="flex h-full w-full items-center justify-center p-4"
            onClick={() => setFullscreenImage(true)}
          >
            <ProductImage
              src={product.images[currentImageIndex]}
              alt={`${product.name} - Image ${currentImageIndex + 1}`}
              className="max-h-full max-w-full object-contain"
            />
          </button>

          {/* Navigation Arrows */}
          {product.images.length > 1 && (
            <>
              <Button
                variant="secondary"
                size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10"
                onClick={handlePrevImage}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10"
                onClick={handleNextImage}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </>
          )}

          {/* Image Counter */}
          {product.images.length > 1 && (
            <div className="absolute left-2 top-2 rounded bg-black/60 px-2 py-1 text-xs text-white">
              {currentImageIndex + 1} / {product.images.length}
            </div>
          )}
        </div>

        {/* Thumbnails */}
        {product.images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto bg-background px-4 py-3 scrollbar-hide">
            {product.images.map((image, index) => (
              <button
                key={index}
                onClick={() => setCurrentImageIndex(index)}
                className={cn(
                  "h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg border-2",
                  currentImageIndex === index
                    ? "border-primary"
                    : "border-transparent opacity-60"
                )}
              >
                <img
                  src={image}
                  alt={`Thumbnail ${index + 1}`}
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        )}

        {/* Product Info */}
        <div className="px-4 py-6 space-y-5">
          {/* Title */}
          <div>
            <h1 className="text-xl font-bold">{product.name}</h1>
            <p className="text-sm text-muted-foreground">
              <span className="capitalize">{product.metal_type.replace("_", " ")}</span>
              {" • "}
              <span className="uppercase">{product.metal_purity}</span>
            </p>
          </div>

          {/* Pricing */}
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">
                ₹{product.price.toLocaleString("en-IN")}
              </span>
              {product.mrp > product.price && (
                <>
                  <span className="text-sm text-muted-foreground line-through">
                    ₹{product.mrp.toLocaleString("en-IN")}
                  </span>
                  <Badge variant="secondary" className="text-xs">{savingsPercent}% off</Badge>
                </>
              )}
            </div>
          </div>

          {/* Savings */}
          <div className="savings-badge w-full p-3">
            <Sparkles className="h-4 w-4" />
            <span className="font-medium">Save ₹{savings.toLocaleString("en-IN")} on making charges</span>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-lg bg-muted p-3">
              <Scale className="mx-auto h-4 w-4 text-muted-foreground mb-1" />
              <p className="font-medium">{product.weight_grams}g</p>
              <p className="text-xs text-muted-foreground">Weight</p>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <Ruler className="mx-auto h-4 w-4 text-muted-foreground mb-1" />
              <p className="font-medium uppercase">{product.metal_purity}</p>
              <p className="text-xs text-muted-foreground">Purity</p>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <Package className="mx-auto h-4 w-4 text-muted-foreground mb-1" />
              <p className="font-medium">{product.stock_quantity}</p>
              <p className="text-xs text-muted-foreground">In Stock</p>
            </div>
          </div>

          <Separator />

          {/* Description */}
          <div>
            <h3 className="font-semibold mb-2">Description</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {product.description}
            </p>
          </div>

          {/* Quantity Selector */}
          {product.stock_quantity > 0 && (
            <div className="flex items-center justify-between">
              <span className="font-medium">Quantity</span>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                >
                  -
                </Button>
                <span className="w-8 text-center font-semibold">{quantity}</span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setQuantity(Math.min(product.stock_quantity, quantity + 1))}
                  disabled={quantity >= product.stock_quantity}
                >
                  +
                </Button>
              </div>
            </div>
          )}

          {/* Total */}
          {quantity > 1 && (
            <div className="flex items-center justify-between rounded-lg bg-muted p-3">
              <span className="text-sm font-medium">Total ({quantity} items)</span>
              <span className="text-lg font-bold">₹{totalPrice.toLocaleString("en-IN")}</span>
            </div>
          )}
        </div>

        {/* Sticky Add to Cart */}
        <div className="sticky bottom-0 border-t bg-background p-4 safe-area-bottom">
          <Button
            className="btn-premium w-full"
            size="lg"
            onClick={handleAddToCart}
            disabled={product.stock_quantity === 0}
          >
            <ShoppingCart className="mr-2 h-5 w-5" />
            {product.stock_quantity === 0 ? "Out of Stock" : "Add to Cart"}
          </Button>
        </div>
      </div>

      {/* Fullscreen Image Viewer */}
      {fullscreenImage && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="flex items-center justify-between p-4">
            <span className="text-white text-sm">
              {currentImageIndex + 1} / {product.images.length}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setFullscreenImage(false)}
              className="text-white hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex-1 flex items-center justify-center relative overflow-hidden">
            <img
              src={product.images[currentImageIndex]}
              alt={product.name}
              className="max-h-full max-w-full object-contain"
            />

            {product.images.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-2 text-white hover:bg-white/20"
                  onClick={handlePrevImage}
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 text-white hover:bg-white/20"
                  onClick={handleNextImage}
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </>
            )}
          </div>

          {/* Fullscreen Thumbnails */}
          {product.images.length > 1 && (
            <div className="flex justify-center gap-2 p-4">
              {product.images.map((image, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentImageIndex(index)}
                  className={cn(
                    "h-12 w-12 rounded overflow-hidden border-2",
                    currentImageIndex === index
                      ? "border-white"
                      : "border-transparent opacity-50"
                  )}
                >
                  <img src={image} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
