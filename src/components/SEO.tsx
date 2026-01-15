/**
 * SEO Component using react-helmet-async
 * Provides per-page meta tags for better search engine optimization
 */

import { Helmet } from "react-helmet-async";

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: "website" | "product" | "article";
  product?: {
    price: number;
    currency?: string;
    availability?: "in stock" | "out of stock";
  };
}

const SITE_NAME = "DJewel Boutique";
const DEFAULT_DESCRIPTION = "Premium jewellery at factory prices. Save on making charges without compromising on quality. Gold, Silver, and Diamond jewellery delivered across India.";
const DEFAULT_IMAGE = "/og-image.jpg"; // Add this image to public folder

export function SEO({
  title,
  description = DEFAULT_DESCRIPTION,
  image = DEFAULT_IMAGE,
  url,
  type = "website",
  product,
}: SEOProps) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} - Premium Jewellery at Factory Prices`;
  const currentUrl = url || (typeof window !== "undefined" ? window.location.href : "");

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:url" content={currentUrl} />
      <meta property="og:site_name" content={SITE_NAME} />
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      
      {/* Product-specific meta (for product pages) */}
      {product && (
        <>
          <meta property="product:price:amount" content={product.price.toString()} />
          <meta property="product:price:currency" content={product.currency || "INR"} />
          <meta property="product:availability" content={product.availability || "in stock"} />
        </>
      )}
      
      {/* Additional SEO */}
      <meta name="robots" content="index, follow" />
      <link rel="canonical" href={currentUrl} />
    </Helmet>
  );
}

// Pre-configured SEO for common pages
export const PageSEO = {
  Home: () => (
    <SEO 
      title="Shop Premium Jewellery"
      description="Discover exquisite gold, silver, and diamond jewellery at factory prices. Save up to 30% on making charges. Free insured shipping across India."
    />
  ),
  
  Cart: () => (
    <SEO 
      title="Shopping Cart"
      description="Review your selected jewellery items and proceed to checkout."
    />
  ),
  
  Checkout: () => (
    <SEO 
      title="Checkout"
      description="Complete your jewellery purchase securely."
    />
  ),
  
  Login: () => (
    <SEO 
      title="Sign In"
      description="Sign in to your DJewel Boutique account to track orders and manage your profile."
    />
  ),
  
  Profile: () => (
    <SEO 
      title="My Account"
      description="Manage your profile, addresses, and account settings."
    />
  ),
  
  Orders: () => (
    <SEO 
      title="Order History"
      description="View your past orders and track current deliveries."
    />
  ),
  
  CustomRequest: () => (
    <SEO 
      title="Custom Jewellery Request"
      description="Request custom-made jewellery designed to your specifications. Upload your design and get a quote."
    />
  ),
};
