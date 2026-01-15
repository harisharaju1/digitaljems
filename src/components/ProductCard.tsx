/**
 * Product Card Component
 * Displays product in grid with hover effects
 */

import { ShoppingCart, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProductImage } from "@/components/ui/product-image";
import type { Product } from "@/components/types";
import { useCartStore } from "@/components/store/cart-store";
import { useToast } from "@/components/hooks/use-toast";

interface ProductCardProps {
  product: Product;
  onClick: () => void;
}

export function ProductCard({ product, onClick }: ProductCardProps) {
  const addItem = useCartStore((state) => state.addItem);
  const { toast } = useToast();

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    addItem(product);
    toast({
      title: "Added to cart",
      description: `${product.name} has been added to your cart.`,
    });
  };

  const savings = product.making_charges_saved;
  const savingsPercent = Math.round((savings / product.mrp) * 100);

  return (
    <Card
      className="product-card group cursor-pointer overflow-hidden border-border/50"
      onClick={onClick}
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

        {/* Low Stock Badge */}
        {product.stock_quantity > 0 && product.stock_quantity <= 5 && (
          <Badge variant="destructive" className="absolute right-3 top-3">
            Only {product.stock_quantity} left
          </Badge>
        )}

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
