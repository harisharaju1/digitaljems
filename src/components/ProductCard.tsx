/**
 * Product Card Component
 * Displays product in grid with hover effects
 */

import { ShoppingCart, Sparkles, Heart, Share2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProductImage } from "@/components/ui/product-image";
import type { Product } from "@/components/types";
import { useCartStore } from "@/components/store/cart-store";
import { useWishlistStore } from "@/components/store/wishlist-store";
import { useToast } from "@/components/hooks/use-toast";
import { cn } from "@/components/lib/utils";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const navigate = useNavigate();
  const addItem = useCartStore((state) => state.addItem);
  const { isInWishlist, toggleItem } = useWishlistStore();
  const { toast } = useToast();
  const inWishlist = isInWishlist(product.id);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    addItem(product);
    toast({
      title: "Added to cart",
      description: `${product.name} has been added to your cart.`,
    });
  };

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleItem(product);
    toast({
      title: inWishlist ? "Removed from wishlist" : "Added to wishlist",
      description: inWishlist
        ? `${product.name} removed from your wishlist.`
        : `${product.name} added to your wishlist.`,
    });
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/product/${product.id}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: product.name,
          text: `Check out this ${product.name} - ₹${product.price.toLocaleString("en-IN")}`,
          url,
        });
      } catch (err) {
        // User cancelled or share failed
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast({
        title: "Link copied",
        description: "Product link copied to clipboard",
      });
    }
  };

  const savings = product.making_charges_saved;
  const savingsPercent = Math.round((savings / product.mrp) * 100);

  return (
    <Card
      className="product-card group cursor-pointer overflow-hidden border-border/50"
      onClick={() => navigate(`/product/${product.id}`)}
    >
      {/* Image Container */}
      <div className="relative aspect-square overflow-hidden bg-muted">
        <ProductImage
          src={product.images[0]}
          alt={product.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
        />

        {/* Savings Badge */}
        {savings > 0 && (
          <div className="absolute left-3 top-3">
            <div className="savings-badge">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Save ₹{savings.toLocaleString("en-IN")}</span>
            </div>
          </div>
        )}

        {/* Wishlist & Share Buttons */}
        <div className="absolute right-3 top-3 flex flex-col gap-2">
          <Button
            variant="secondary"
            size="icon"
            className={cn(
              "h-8 w-8 rounded-full bg-white/90 backdrop-blur-sm shadow-sm hover:bg-white",
              inWishlist && "text-red-500"
            )}
            onClick={handleToggleWishlist}
          >
            <Heart className={cn("h-4 w-4", inWishlist && "fill-current")} />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8 rounded-full bg-white/90 backdrop-blur-sm shadow-sm hover:bg-white"
            onClick={handleShare}
          >
            <Share2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Quick Add Button - Shows on hover */}
        <div className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-black/60 to-transparent p-4 transition-transform duration-300 group-hover:translate-y-0">
          <Button
            size="sm"
            className="btn-premium w-full"
            onClick={handleAddToCart}
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            Add to Cart
          </Button>
        </div>

        {/* Out of Stock Overlay */}
        {product.stock_quantity === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <Badge variant="secondary" className="text-base">
              Out of Stock
            </Badge>
          </div>
        )}
      </div>

      <CardContent className="p-4">
        {/* Metal & Category Info */}
        <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="capitalize">
            {product.metal_type.replace("_", " ")}
          </span>
          <span>•</span>
          <span className="uppercase">{product.metal_purity}</span>
          <span>•</span>
          <span>{product.weight_grams}g</span>
        </div>

        {/* Product Name */}
        <h3 className="mb-1 line-clamp-1 font-semibold text-foreground">
          {product.name}
        </h3>

        {/* Description */}
        <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">
          {product.description}
        </p>

        {/* Pricing */}
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold text-foreground">
            ₹{product.price.toLocaleString("en-IN")}
          </span>
          {product.mrp > product.price && (
            <>
              <span className="text-sm text-muted-foreground line-through">
                ₹{product.mrp.toLocaleString("en-IN")}
              </span>
              <span className="text-sm font-medium text-accent">
                {savingsPercent}% off
              </span>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
