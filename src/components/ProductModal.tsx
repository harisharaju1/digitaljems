/**
 * Product Modal with Image Zoom
 * Shows 80% images with zoom, 20% details and CTA
 * On mobile: Image shrinks on scroll for better content viewing
 */

import { useState, useRef, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  Sparkles,
  X,
  ZoomIn,
  Package,
  Ruler,
  Scale,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { Product } from "@/components/types";
import { useCartStore } from "@/components/store/cart-store";
import { useToast } from "@/components/hooks/use-toast";
import { cn } from "@/components/lib/utils";
import { ProductImage } from "@/components/ui/product-image";

interface ProductModalProps {
  product: Product | null;
  open: boolean;
  onClose: () => void;
}

export function ProductModal({ product, open, onClose }: ProductModalProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [imageScale, setImageScale] = useState(1);
  const [mobileFullscreen, setMobileFullscreen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const addItem = useCartStore((state) => state.addItem);
  const { toast } = useToast();

  // Handle scroll to shrink image on mobile
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    // Scale from 1 to 0.25 over 300px scroll (70vh down to ~17vh)
    const newScale = Math.max(0.25, 1 - scrollTop / 300);
    setImageScale(newScale);
  }, []);

  if (!product) return null;

  const handlePrevImage = () => {
    setCurrentImageIndex((prev) =>
      prev === 0 ? product.images.length - 1 : prev - 1
    );
    setIsZoomed(false);
  };

  const handleNextImage = () => {
    setCurrentImageIndex((prev) =>
      prev === product.images.length - 1 ? 0 : prev + 1
    );
    setIsZoomed(false);
  };

  const handleAddToCart = () => {
    addItem(product, quantity);
    toast({
      title: "Added to cart",
      description: `${quantity}x ${product.name} added to cart.`,
    });
    onClose();
  };

  const savings = product.making_charges_saved * quantity;
  const savingsPercent = Math.round(
    (product.making_charges_saved / product.mrp) * 100
  );
  const totalPrice = product.price * quantity;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-6xl overflow-hidden p-0">
        {/* Desktop: Side by side layout */}
        <div className="hidden md:grid max-h-[90vh] md:grid-cols-[3fr_1.3fr]">
          {/* Left Side: Images (80%) */}
          <div className="relative flex flex-col bg-muted">
            {/* Main Image Container - Fixed height */}
            <div className="relative h-[500px] w-full overflow-hidden">
              {/* Image wrapper for centering */}
              <div className="flex h-full w-full items-center justify-center">
                <ProductImage
                  src={product.images[currentImageIndex]}
                  alt={`${product.name} - Image ${currentImageIndex + 1}`}
                  className={cn(
                    "max-h-full max-w-full object-contain transition-transform duration-300",
                    isZoomed
                      ? "cursor-zoom-out scale-150"
                      : "cursor-zoom-in scale-100"
                  )}
                  onClick={() => setIsZoomed(!isZoomed)}
                />
              </div>

              {/* Zoom Indicator */}
              {!isZoomed && (
                <div className="absolute bottom-4 right-4 flex items-center gap-2 rounded-lg bg-black/60 px-3 py-2 text-sm text-white backdrop-blur">
                  <ZoomIn className="h-4 w-4" />
                  <span>Click to zoom</span>
                </div>
              )}

              {/* Navigation Arrows - Fixed position relative to container */}
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
            </div>

            {/* Thumbnail Strip */}
            {product.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto border-t bg-background p-4">
                {product.images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setCurrentImageIndex(index);
                      setIsZoomed(false);
                    }}
                    className={cn(
                      "h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border-2 transition-all",
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

          {/* Right Side: Details (20%) - Desktop */}
          <div className="flex max-h-[90vh] flex-col overflow-y-auto bg-background">
            <DialogHeader className="border-b p-6 pb-4">
              <div className="flex items-start justify-between">
                <DialogTitle className="text-xl">{product.name}</DialogTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <span className="capitalize">
                  {product.metal_type.replace("_", " ")}
                </span>
                <span>•</span>
                <span className="uppercase">{product.metal_purity}</span>
              </div>
            </DialogHeader>

            <div className="flex-1 space-y-6 p-6">
              {/* Pricing */}
              <div>
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-bold">
                    ₹{product.price.toLocaleString("en-IN")}
                  </span>
                  {product.mrp > product.price && (
                    <>
                      <span className="text-lg text-muted-foreground line-through">
                        ₹{product.mrp.toLocaleString("en-IN")}
                      </span>
                      <Badge variant="secondary">{savingsPercent}% off</Badge>
                    </>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Inclusive of all taxes
                </p>
              </div>

              {/* Savings Highlight */}
              <div className="savings-badge w-full justify-between p-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  <div>
                    <p className="font-semibold">
                      You Save ₹{savings.toLocaleString("en-IN")}
                    </p>
                    <p className="text-xs opacity-80">on making charges</p>
                  </div>
                </div>
              </div>

              {/* Product Details */}
              <div className="space-y-3">
                <h4 className="font-semibold">Product Details</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-3">
                    <Scale className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Weight:</span>
                    <span className="font-medium">{product.weight_grams}g</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Ruler className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Purity:</span>
                    <span className="font-medium uppercase">
                      {product.metal_purity}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Stock:</span>
                    <span className="font-medium">
                      {product.stock_quantity > 0
                        ? `${product.stock_quantity} available`
                        : "Out of stock"}
                    </span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Description */}
              <div>
                <h4 className="mb-2 font-semibold">Description</h4>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {product.description}
                </p>
              </div>

              {/* Quantity Selector */}
              {product.stock_quantity > 0 && (
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Quantity
                  </label>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    >
                      -
                    </Button>
                    <span className="w-12 text-center font-semibold">
                      {quantity}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        setQuantity(
                          Math.min(product.stock_quantity, quantity + 1)
                        )
                      }
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
                  <span className="text-sm font-medium">
                    Total ({quantity} items)
                  </span>
                  <span className="text-lg font-bold">
                    ₹{totalPrice.toLocaleString("en-IN")}
                  </span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="border-t p-6">
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
        </div>

        {/* Mobile: Stacked layout with collapsible image */}
        <div 
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="md:hidden flex flex-col max-h-[90vh] overflow-y-auto"
        >
          {/* Close button - Fixed */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="absolute right-2 top-2 z-20 h-8 w-8 bg-background/80 backdrop-blur"
          >
            <X className="h-4 w-4" />
          </Button>

          {/* Collapsible Image Section - starts at 70vh, shrinks to 120px */}
          <div 
            className="sticky top-0 z-0 bg-muted transition-all duration-200 ease-out overflow-hidden"
            style={{ 
              height: `${Math.max(120, 70 * imageScale)}vh`,
              minHeight: '120px'
            }}
          >
            <div className="relative h-full w-full">
              <button 
                className="flex h-full w-full items-center justify-center p-4"
                onClick={() => setMobileFullscreen(true)}
              >
                <ProductImage
                  src={product.images[currentImageIndex]}
                  alt={`${product.name} - Image ${currentImageIndex + 1}`}
                  className="max-h-full max-w-full object-contain"
                />
              </button>

              {/* Scroll hint at bottom */}
              {imageScale > 0.8 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center text-muted-foreground animate-bounce">
                  <span className="text-xs mb-1">Swipe up for details</span>
                  <ChevronLeft className="h-4 w-4 rotate-[-90deg]" />
                </div>
              )}

              {/* Navigation Arrows */}
              {product.images.length > 1 && (
                <>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 opacity-80"
                    onClick={(e) => { e.stopPropagation(); handlePrevImage(); }}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 opacity-80"
                    onClick={(e) => { e.stopPropagation(); handleNextImage(); }}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </>
              )}

              {/* Image Counter & Zoom hint */}
              <div className="absolute left-2 top-2 rounded bg-black/60 px-2 py-1 text-xs text-white flex items-center gap-2">
                {product.images.length > 1 && (
                  <span>{currentImageIndex + 1} / {product.images.length}</span>
                )}
                <span className="flex items-center gap-1">
                  <ZoomIn className="h-3 w-3" /> Tap
                </span>
              </div>
            </div>
          </div>

          {/* Thumbnail Strip - Mobile (only show when image is shrunk) */}
          {product.images.length > 1 && imageScale < 0.7 && (
            <div className="flex gap-2 overflow-x-auto border-b bg-background px-4 py-2 scrollbar-hide">
              {product.images.map((image, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentImageIndex(index)}
                  className={cn(
                    "h-10 w-10 flex-shrink-0 overflow-hidden rounded border-2 transition-all",
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

          {/* Product Details - Mobile */}
          <div className="flex-1 bg-background p-4 space-y-4">
            {/* Title & Metal */}
            <div>
              <h2 className="text-lg font-semibold">{product.name}</h2>
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
              <div className="rounded-lg bg-muted p-2">
                <Scale className="mx-auto h-4 w-4 text-muted-foreground mb-1" />
                <p className="font-medium">{product.weight_grams}g</p>
                <p className="text-xs text-muted-foreground">Weight</p>
              </div>
              <div className="rounded-lg bg-muted p-2">
                <Ruler className="mx-auto h-4 w-4 text-muted-foreground mb-1" />
                <p className="font-medium uppercase">{product.metal_purity}</p>
                <p className="text-xs text-muted-foreground">Purity</p>
              </div>
              <div className="rounded-lg bg-muted p-2">
                <Package className="mx-auto h-4 w-4 text-muted-foreground mb-1" />
                <p className="font-medium">{product.stock_quantity}</p>
                <p className="text-xs text-muted-foreground">In Stock</p>
              </div>
            </div>

            <Separator />

            {/* Description */}
            <div>
              <h4 className="font-semibold mb-2">Description</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {product.description}
              </p>
            </div>

            {/* Quantity Selector - Mobile */}
            {product.stock_quantity > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Quantity</span>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  >
                    -
                  </Button>
                  <span className="w-8 text-center font-semibold">{quantity}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setQuantity(Math.min(product.stock_quantity, quantity + 1))}
                    disabled={quantity >= product.stock_quantity}
                  >
                    +
                  </Button>
                </div>
              </div>
            )}

            {/* Total - Mobile */}
            {quantity > 1 && (
              <div className="flex items-center justify-between rounded-lg bg-muted p-3">
                <span className="text-sm font-medium">Total ({quantity} items)</span>
                <span className="text-lg font-bold">₹{totalPrice.toLocaleString("en-IN")}</span>
              </div>
            )}
          </div>

          {/* Sticky Add to Cart - Mobile */}
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

          {/* Mobile Fullscreen Image Viewer */}
          {mobileFullscreen && (
            <div className="fixed inset-0 z-50 bg-black flex flex-col">
              <div className="flex items-center justify-between p-4">
                <span className="text-white text-sm">
                  {currentImageIndex + 1} / {product.images.length}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileFullscreen(false)}
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
      </DialogContent>
    </Dialog>
  );
}
