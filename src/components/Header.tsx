/**
 * Main Navigation Header
 * Shows logo, navigation, cart, and auth controls
 */

import { ShoppingCart, User, Search, Menu, X, LayoutDashboard, Store, Heart } from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/components/store/auth-store";
import { useCartStore } from "@/components/store/cart-store";
import { useWishlistStore } from "@/components/store/wishlist-store";
import { useProductsStore } from "@/components/store/products-store";
import { cn } from "@/components/lib/utils";

export function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user, isAdmin, logout } = useAuthStore();
  const isOnAdminPage = location.pathname.startsWith("/admin");
  const { itemCount } = useCartStore();
  const wishlistCount = useWishlistStore((state) => state.items.length);
  const { searchQuery, setSearchQuery } = useProductsStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const handleLogout = () => {
    logout();
    localStorage.clear();
    window.location.href = "/";
  };

  const categories = [
    { label: "Rings", value: "ring" },
    { label: "Necklaces", value: "necklace" },
    { label: "Earrings", value: "earring" },
    { label: "Bracelets", value: "bracelet" },
    { label: "Pendants", value: "pendant" },
    { label: "Chains", value: "chain" },
    { label: "Bangles", value: "bangle" },
    { label: "Anklets", value: "anklet" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="container mx-auto px-4">
        {/* Top Bar */}
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <Logo size="md" showText className="hidden sm:flex" />
            <Logo size="sm" showText={false} className="sm:hidden" />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden items-center space-x-6 md:flex">
            <Link
              to="/"
              className="text-sm font-medium transition-colors hover:text-accent"
            >
              Shop
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger className="text-sm font-medium transition-colors hover:text-accent">
                Categories
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {categories.map((cat) => (
                  <DropdownMenuItem
                    key={cat.value}
                    onClick={() => {
                      navigate(`/?category=${cat.value}`);
                    }}
                  >
                    {cat.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {isAuthenticated && (
              <Link
                to="/custom-request"
                className="text-sm font-medium transition-colors hover:text-accent"
              >
                Custom Order
              </Link>
            )}
          </nav>

          {/* Actions */}
          <div className="flex items-center space-x-2">
            {/* Search Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSearchOpen(!searchOpen)}
              className={cn(searchOpen && "bg-muted")}
            >
              <Search className="h-5 w-5" />
            </Button>

            {/* Wishlist */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/wishlist")}
              className="relative"
            >
              <Heart className="h-5 w-5" />
              {wishlistCount > 0 && (
                <Badge
                  variant="default"
                  className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 text-xs bg-red-500"
                >
                  {wishlistCount}
                </Badge>
              )}
            </Button>

            {/* Cart */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/cart")}
              className="relative"
            >
              <ShoppingCart className="h-5 w-5" />
              {itemCount > 0 && (
                <Badge
                  variant="default"
                  className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 text-xs"
                >
                  {itemCount}
                </Badge>
              )}
            </Button>

            {/* Admin/Store Toggle - Desktop */}
            {isAuthenticated && isAdmin && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(isOnAdminPage ? "/" : "/admin")}
                title={isOnAdminPage ? "Go to Store" : "Go to Admin"}
                className="hidden md:flex"
              >
                {isOnAdminPage ? (
                  <Store className="h-5 w-5" />
                ) : (
                  <LayoutDashboard className="h-5 w-5" />
                )}
              </Button>
            )}

            {/* User Menu */}
            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <User className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{user?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/profile")}>
                    My Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/orders")}>
                    My Orders
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/wishlist")}>
                    My Wishlist {wishlistCount > 0 && `(${wishlistCount})`}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/custom-request")}>
                    Custom Requests
                  </DropdownMenuItem>
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => navigate("/admin")}>
                        Admin Dashboard
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="ghost" onClick={() => navigate("/login")}>
                Sign In
              </Button>
            )}

            {/* Admin/Store Toggle - Mobile (visible next to hamburger) */}
            {isAuthenticated && isAdmin && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(isOnAdminPage ? "/" : "/admin")}
                title={isOnAdminPage ? "Go to Store" : "Go to Admin"}
                className="md:hidden"
              >
                {isOnAdminPage ? (
                  <Store className="h-5 w-5" />
                ) : (
                  <LayoutDashboard className="h-5 w-5" />
                )}
              </Button>
            )}

            {/* Mobile Menu */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right">
                <SheetHeader>
                  <SheetTitle>Menu</SheetTitle>
                </SheetHeader>
                <nav className="mt-6 flex flex-col space-y-4">
                  <Link
                    to="/"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-sm font-medium"
                  >
                    Shop
                  </Link>
                  <div className="border-t pt-4">
                    <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                      Categories
                    </p>
                    {categories.map((cat) => (
                      <Link
                        key={cat.value}
                        to={`/?category=${cat.value}`}
                        onClick={() => setMobileMenuOpen(false)}
                        className="block py-2 text-sm"
                      >
                        {cat.label}
                      </Link>
                    ))}
                  </div>
                  {isAuthenticated && (
                    <Link
                      to="/custom-request"
                      onClick={() => setMobileMenuOpen(false)}
                      className="border-t pt-4 text-sm font-medium"
                    >
                      Custom Order
                    </Link>
                  )}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Search Bar */}
        {searchOpen && (
          <div className="border-t py-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search jewellery..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
