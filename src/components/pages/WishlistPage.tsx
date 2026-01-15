/**
 * Wishlist Page
 * Shows all items user has added to their wishlist
 */

import { Heart, ShoppingCart, Trash2, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ProductImage } from "@/components/ui/product-image";
import { useWishlistStore } from "@/components/store/wishlist-store";
import { useCartStore } from "@/components/store/cart-store";
import { useToast } from "@/components/hooks/use-toast";

export function WishlistPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { items, removeItem, clearWishlist } = useWishlistStore();
  const addToCart = useCartStore((state) => state.addItem);

  const handleAddToCart = (product: typeof items[0]) => {
    addToCart(product);
    toast({
      title: "Added to cart",
      description: `${product.name} has been added to your cart.`,
    });
  };

  const handleRemove = (productId: string, productName: string) => {
    removeItem(productId);
    toast({
      title: "Removed from wishlist",
      description: `${productName} has been removed from your wishlist.`,
    });
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Heart className="h-8 w-8 text-red-500" />
              My Wishlist
            </h1>
            <p className="mt-1 text-muted-foreground">
              {items.length} {items.length === 1 ? "item" : "items"} saved
            </p>
          </div>
          {items.length > 0 && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                clearWishlist();
                toast({
                  title: "Wishlist cleared",
                  description: "All items have been removed from your wishlist.",
                });
              }}
            >
              Clear All
            </Button>
          )}
        </div>
      </div>

      {/* Empty State */}
      {items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Heart className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Your wishlist is empty</h2>
            <p className="text-muted-foreground text-center mb-6">
              Save items you love by clicking the heart icon on products
            </p>
            <Button onClick={() => navigate("/")} className="btn-premium">
              Browse Products
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((product) => (
            <Card key={product.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="flex gap-4 p-4">
                  {/* Image */}
                  <div 
                    className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-muted cursor-pointer"
                    onClick={() => navigate(`/product/${product.id}`)}
                  >
                    <ProductImage
                      src={product.images[0]}
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <h3 
                      className="font-semibold truncate cursor-pointer hover:text-primary"
                      onClick={() => navigate(`/product/${product.id}`)}
                    >
                      {product.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      <span className="capitalize">{product.metal_type.replace("_", " ")}</span>
                      {" • "}
                      <span className="uppercase">{product.metal_purity}</span>
                      {" • "}
                      {product.weight_grams}g
                    </p>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-lg font-bold">
                        ₹{product.price.toLocaleString("en-IN")}
                      </span>
                      {product.mrp > product.price && (
                        <span className="text-sm text-muted-foreground line-through">
                          ₹{product.mrp.toLocaleString("en-IN")}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => handleAddToCart(product)}
                      disabled={product.stock_quantity === 0}
                      title={product.stock_quantity === 0 ? "Out of Stock" : "Add to Cart"}
                    >
                      <ShoppingCart className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleRemove(product.id, product.name)}
                      title="Remove from wishlist"
                      className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
