/**
 * Site Footer
 * Consistent footer across all pages with contact, links, and trust signals
 */

import { Link } from "react-router-dom";
import { Phone, Mail, MapPin, Shield, Award, Truck } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Logo } from "@/components/Logo";

const WHATSAPP_NUMBER = "919876543210"; // Replace with actual number

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-secondary/30">
      {/* Trust Signals Bar */}
      <div className="border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 text-center">
            <div className="flex flex-col items-center gap-2">
              <Award className="h-6 w-6 text-accent" />
              <div>
                <p className="font-medium text-sm">BIS Hallmarked</p>
                <p className="text-xs text-muted-foreground">
                  Certified Gold & Silver
                </p>
              </div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Shield className="h-6 w-6 text-accent" />
              <div>
                <p className="font-medium text-sm">Secure Payments</p>
                <p className="text-xs text-muted-foreground">
                  100% Safe Checkout
                </p>
              </div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Truck className="h-6 w-6 text-accent" />
              <div>
                <p className="font-medium text-sm">Insured Shipping</p>
                <p className="text-xs text-muted-foreground">
                  Pan India Delivery
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <Logo size="sm" className="mb-3" />
            <p className="text-sm text-muted-foreground mb-4">
              Premium jewellery at factory prices. Save on making charges
              without compromising on quality.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold mb-3">Shop</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  to="/?category=ring"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Rings
                </Link>
              </li>
              <li>
                <Link
                  to="/?category=necklace"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Necklaces
                </Link>
              </li>
              <li>
                <Link
                  to="/?category=earring"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Earrings
                </Link>
              </li>
              <li>
                <Link
                  to="/?category=bracelet"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Bracelets
                </Link>
              </li>
              <li>
                <Link
                  to="/custom-request"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Custom Orders
                </Link>
              </li>
            </ul>
          </div>

          {/* Account */}
          <div>
            <h4 className="font-semibold mb-3">Account</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  to="/profile"
                  className="text-muted-foreground hover:text-foreground"
                >
                  My Profile
                </Link>
              </li>
              <li>
                <Link
                  to="/orders"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Order History
                </Link>
              </li>
              <li>
                <Link
                  to="/cart"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Shopping Cart
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold mb-3">Contact Us</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <a
                  href={`https://wa.me/${WHATSAPP_NUMBER}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
                >
                  <Phone className="h-4 w-4" />
                  WhatsApp Support
                </a>
              </li>
              <li>
                <a
                  href="mailto:support@djewelboutique.com"
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
                >
                  <Mail className="h-4 w-4" />
                  support@djewelboutique.com
                </a>
              </li>
              <li>
                <div className="flex items-start gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4 mt-0.5" />
                  <span>Bengaluru, Karnataka, India</span>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
            <p>&copy; {currentYear} DJewel Boutique. All rights reserved.</p>
            <div className="flex gap-4">
              <Link to="/privacy" className="hover:text-foreground">
                Privacy Policy
              </Link>
              <Link to="/terms" className="hover:text-foreground">
                Terms of Service
              </Link>
              <Link to="/returns" className="hover:text-foreground">
                Returns & Refunds
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
