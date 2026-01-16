/**
 * Product Details Component
 * Displays detailed product specifications in a card-based layout
 */

import { Copy, Info, Sparkles, Wrench, Gem } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/hooks/use-toast";
import type { Product } from "@/components/types";
import { cn } from "@/components/lib/utils";

interface ProductDetailsProps {
  product: Product;
  className?: string;
}

export function ProductDetails({ product, className }: ProductDetailsProps) {
  const { toast } = useToast();

  const handleCopySKU = () => {
    if (product.sku) {
      navigator.clipboard.writeText(product.sku);
      toast({
        title: "SKU copied",
        description: "SKU copied to clipboard",
      });
    }
  };

  const formatMetalType = (type: string) => {
    return type
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const formatPurity = (purity: string) => {
    if (purity.includes("k")) {
      return purity.toUpperCase();
    }
    return purity;
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Product Details</h2>
        
        {/* SKU */}
        {product.sku && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-primary font-medium">SKU {product.sku}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleCopySKU}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Short Description */}
        {product.short_description && (
          <p className="text-sm text-muted-foreground mb-4">
            {product.short_description}
          </p>
        )}
      </div>

      {/* Details Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* GOLD Section */}
        <div className="rounded-lg bg-purple-50 dark:bg-purple-950/20 p-4 space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <h3 className="text-sm font-semibold uppercase text-purple-600 dark:text-purple-400">
              GOLD
            </h3>
            <Info className="h-3 w-3 text-muted-foreground" />
          </div>
          <div className="space-y-1 text-sm">
            <p>{formatPurity(product.metal_purity)}</p>
            <p className="capitalize">{formatMetalType(product.metal_type)}</p>
            <p>{product.weight_grams} g (Net wt)</p>
          </div>
        </div>

        {/* Dimensions Section */}
        {(product.width_mm !== undefined || product.height_mm !== undefined || product.length_mm !== undefined || product.gross_weight_grams !== undefined) && (
          <div className="rounded-lg bg-purple-50 dark:bg-purple-950/20 p-4 space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <Wrench className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <h3 className="text-sm font-semibold uppercase text-purple-600 dark:text-purple-400">
                Dimensions
              </h3>
              <Info className="h-3 w-3 text-muted-foreground" />
            </div>
            <div className="space-y-1 text-sm">
              {product.width_mm !== undefined && <p>{product.width_mm} (Width)</p>}
              {product.height_mm !== undefined && <p>{product.height_mm} mm (Height)</p>}
              {product.gross_weight_grams !== undefined && (
                <p>{product.gross_weight_grams} g (Gross wt)</p>
              )}
              {product.length_mm !== undefined && <p>{product.length_mm} (Length)</p>}
            </div>
          </div>
        )}

        {/* DIAMOND Section */}
        {((product.stone_weight && product.stone_weight > 0) || product.stone_quality || product.stone_grade || product.stone_setting || (product.stone_count && product.stone_count > 0)) && (
          <div className="rounded-lg bg-purple-50 dark:bg-purple-950/20 p-4 space-y-2 md:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <Gem className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <h3 className="text-sm font-semibold uppercase text-purple-600 dark:text-purple-400">
                DIAMOND
              </h3>
              <Info className="h-3 w-3 text-muted-foreground" />
            </div>
            <div className="space-y-1 text-sm">
              {product.stone_quality && <p>{product.stone_quality}</p>}
              {product.stone_weight && (
                <p>{product.stone_weight} ct (Total wt)</p>
              )}
              {product.stone_setting && <p>{product.stone_setting}</p>}
              {product.stone_count !== undefined && product.stone_count !== null && (
                <p>{product.stone_count} diamond{product.stone_count > 1 ? 's' : ''}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
