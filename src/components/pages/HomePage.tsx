/**
 * Home Page - Product Grid
 * Main shop page with filterable product grid
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Package } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { ProductModal } from "@/components/ProductModal";
import { Button } from "@/components/ui/button";
import { ProductGridSkeleton } from "@/components/ui/product-skeleton";
import { useProductsStore } from "@/components/store/products-store";
import { PageSEO } from "@/components/SEO";
import type { Product, ProductCategory } from "@/components/types";

const categories: { label: string; value: ProductCategory | "all" }[] = [
  { label: "All Jewellery", value: "all" },
  { label: "Rings", value: "ring" },
  { label: "Necklaces", value: "necklace" },
  { label: "Earrings", value: "earring" },
  { label: "Bracelets", value: "bracelet" },
  { label: "Pendants", value: "pendant" },
  { label: "Chains", value: "chain" },
  { label: "Bangles", value: "bangle" },
  { label: "Anklets", value: "anklet" },
];

export function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const {
    isLoading,
    error,
    selectedCategory,
    filterByCategory,
    loadProducts,
    filteredProducts,
  } = useProductsStore();

  // Load products on mount
  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Handle category from URL
  useEffect(() => {
    const category = searchParams.get("category");
    if (category) {
      filterByCategory(category as ProductCategory);
    }
  }, [searchParams, filterByCategory]);

  const handleCategoryChange = (category: ProductCategory | "all") => {
    filterByCategory(category);
    if (category === "all") {
      searchParams.delete("category");
    } else {
      searchParams.set("category", category);
    }
    setSearchParams(searchParams);
  };

  const products = filteredProducts();

  return (
    <div className="min-h-screen bg-background">
      <PageSEO.Home />
      {/* Hero Section */}
      <section className="border-b bg-gradient-to-b from-secondary/30 to-transparent">
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Luxury Jewellery at{" "}
            <span className="text-accent">Unbeatable Prices</span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Save on making charges by shopping online. Premium gold, silver, and
            diamond jewellery delivered across India.
          </p>
        </div>
      </section>

      {/* Category Filter */}
      <section className="border-b bg-card">
        <div className="container mx-auto px-4">
          <div className="flex gap-2 overflow-x-auto py-4 scrollbar-hide">
            {categories.map((category) => (
              <Button
                key={category.value}
                variant={
                  selectedCategory === category.value ? "default" : "outline"
                }
                size="sm"
                onClick={() => handleCategoryChange(category.value)}
                className="whitespace-nowrap"
              >
                {category.label}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {/* Product Grid */}
      <section className="container mx-auto px-4 py-12">
        {/* Loading State */}
        {isLoading && (
          <div className="min-h-[400px]">
            <div className="mb-6 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Loading products...</p>
            </div>
            <ProductGridSkeleton count={8} />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="flex min-h-[400px] items-center justify-center">
            <div className="text-center">
              <Package className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-lg font-medium">
                Failed to load products
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              <Button onClick={loadProducts} className="mt-4">
                Try Again
              </Button>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && products.length === 0 && (
          <div className="flex min-h-[400px] items-center justify-center">
            <div className="text-center">
              <Package className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-lg font-medium">No products found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try adjusting your filters or search query
              </p>
            </div>
          </div>
        )}

        {/* Products Grid */}
        {!isLoading && !error && products.length > 0 && (
          <>
            <div className="mb-6 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {products.length} product{products.length !== 1 ? "s" : ""}{" "}
                found
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onClick={() => setSelectedProduct(product)}
                />
              ))}
            </div>
          </>
        )}
      </section>

      {/* Product Modal */}
      <ProductModal
        product={selectedProduct}
        open={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />
    </div>
  );
}
