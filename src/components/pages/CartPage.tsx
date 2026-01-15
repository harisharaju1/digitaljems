/**
 * Shopping Cart Page
 * Shows cart items, savings, and checkout CTA
 */

import { useNavigate } from "react-router-dom";
import { Trash2, ShoppingBag, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useCartStore } from "@/components/store/cart-store";

export function CartPage() {
  const navigate = useNavigate();
  const { items, subtotal, totalSavings, updateQuantity, removeItem } =
    useCartStore();

  const SHIPPING_COST = items.length > 0 ? 200 : 0; // ₹200 flat shipping
  const total = subtotal + SHIPPING_COST;

  if (items.length === 0) {
    return (
      <div className="container mx-auto min-h-[60vh] px-4 py-16">
        <div className="mx-auto max-w-md text-center">
          <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-muted">
            <ShoppingBag className="h-10 w-10 text-muted-foreground" />
          </div>
          <h2 className="mb-2 text-2xl font-bold">Your cart is empty</h2>
          <p className="mb-6 text-muted-foreground">
            Start adding beautiful jewellery to your collection
          </p>
          <Button onClick={() => navigate("/")} size="lg">
            Continue Shopping
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <h1 className="mb-8 text-3xl font-bold">Shopping Cart</h1>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Cart Items */}
          <div className="lg:col-span-2">
            <div className="space-y-4">
              {items.map((item) => (
                <Card key={item.product.id}>
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      {/* Product Image */}
                      <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-md bg-muted">
                        <img
                          src={item.product.images[0]}
                          alt={item.product.name}
                          className="h-full w-full object-cover"
                        />
                      </div>

                      {/* Product Details */}
                      <div className="flex flex-1 flex-col">
                        <div className="flex justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold">
                              {item.product.name}
                            </h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {item.product.metal_type.replace("_", " ")} •{" "}
                              {item.product.metal_purity.toUpperCase()} •{" "}
                              {item.product.weight_grams}g
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItem(item.product._id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="mt-auto flex items-center justify-between">
                          {/* Quantity Controls */}
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() =>
                                updateQuantity(
                                  item.product._id,
                                  item.quantity - 1
                                )
                              }
                            >
                              -
                            </Button>
                            <span className="w-8 text-center font-medium">
                              {item.quantity}
                            </span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() =>
                                updateQuantity(
                                  item.product._id,
                                  item.quantity + 1
                                )
                              }
                              disabled={
                                item.quantity >= item.product.stock_quantity
                              }
                            >
                              +
                            </Button>
                          </div>

                          {/* Price */}
                          <div className="text-right">
                            <p className="text-lg font-bold">
                              ₹
                              {(
                                item.product.price * item.quantity
                              ).toLocaleString("en-IN")}
                            </p>
                            {item.product.making_charges_saved > 0 && (
                              <p className="text-xs text-accent">
                                Save ₹
                                {(
                                  item.product.making_charges_saved *
                                  item.quantity
                                ).toLocaleString("en-IN")}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-20">
              <CardContent className="p-6">
                <h2 className="mb-4 text-xl font-bold">Order Summary</h2>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Subtotal (
                      {items.reduce((acc, item) => acc + item.quantity, 0)}{" "}
                      items)
                    </span>
                    <span className="font-medium">
                      ₹{subtotal.toLocaleString("en-IN")}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shipping</span>
                    <span className="font-medium">
                      ₹{SHIPPING_COST.toLocaleString("en-IN")}
                    </span>
                  </div>

                  <Separator />

                  <div className="flex justify-between text-base">
                    <span className="font-semibold">Total</span>
                    <span className="text-xl font-bold">
                      ₹{total.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                {/* Savings Highlight */}
                {totalSavings > 0 && (
                  <div className="savings-badge mt-4 w-full flex-col items-start p-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5" />
                      <span className="font-semibold">
                        Total Savings: ₹{totalSavings.toLocaleString("en-IN")}
                      </span>
                    </div>
                    <p className="mt-1 text-xs opacity-80">
                      You're saving on making charges by shopping online
                    </p>
                  </div>
                )}

                <Button
                  className="btn-premium mt-6 w-full"
                  size="lg"
                  onClick={() => navigate("/checkout")}
                >
                  Proceed to Checkout
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>

                <Button
                  variant="outline"
                  className="mt-3 w-full"
                  onClick={() => navigate("/")}
                >
                  Continue Shopping
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
