/**
 * Analytics Integration
 * Supports Google Analytics 4 and custom event tracking
 * In dev mode, events are logged to console
 */

const isDev = import.meta.env.DEV;
const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || "";

// Initialize GA4
export function initAnalytics() {
  if (isDev) {
    console.log("[Analytics] Dev mode - events will be logged to console");
    return;
  }

  if (!GA_MEASUREMENT_ID) {
    console.warn("[Analytics] GA_MEASUREMENT_ID not configured");
    return;
  }

  // Load gtag script
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  // Initialize gtag
  (window as any).dataLayer = (window as any).dataLayer || [];
  function gtag(...args: any[]) {
    (window as any).dataLayer.push(args);
  }
  (window as any).gtag = gtag;
  gtag("js", new Date());
  gtag("config", GA_MEASUREMENT_ID);
}

// Track page views
export function trackPageView(path: string, title?: string) {
  if (isDev) {
    console.log("[Analytics] Page view:", { path, title });
    return;
  }

  if ((window as any).gtag) {
    (window as any).gtag("event", "page_view", {
      page_path: path,
      page_title: title,
    });
  }
}

// E-commerce events
export const ecommerceEvents = {
  viewItem(item: { id: string; name: string; price: number; category: string }) {
    const event = {
      event: "view_item",
      currency: "INR",
      value: item.price,
      items: [{ item_id: item.id, item_name: item.name, price: item.price, item_category: item.category }],
    };

    if (isDev) {
      console.log("[Analytics] View item:", event);
      return;
    }

    if ((window as any).gtag) {
      (window as any).gtag("event", "view_item", event);
    }
  },

  addToCart(item: { id: string; name: string; price: number; quantity: number }) {
    const event = {
      event: "add_to_cart",
      currency: "INR",
      value: item.price * item.quantity,
      items: [{ item_id: item.id, item_name: item.name, price: item.price, quantity: item.quantity }],
    };

    if (isDev) {
      console.log("[Analytics] Add to cart:", event);
      return;
    }

    if ((window as any).gtag) {
      (window as any).gtag("event", "add_to_cart", event);
    }
  },

  beginCheckout(items: Array<{ id: string; name: string; price: number; quantity: number }>, total: number) {
    const event = {
      event: "begin_checkout",
      currency: "INR",
      value: total,
      items: items.map((i) => ({ item_id: i.id, item_name: i.name, price: i.price, quantity: i.quantity })),
    };

    if (isDev) {
      console.log("[Analytics] Begin checkout:", event);
      return;
    }

    if ((window as any).gtag) {
      (window as any).gtag("event", "begin_checkout", event);
    }
  },

  purchase(orderId: string, total: number, items: Array<{ id: string; name: string; price: number; quantity: number }>) {
    const event = {
      event: "purchase",
      transaction_id: orderId,
      currency: "INR",
      value: total,
      items: items.map((i) => ({ item_id: i.id, item_name: i.name, price: i.price, quantity: i.quantity })),
    };

    if (isDev) {
      console.log("[Analytics] Purchase:", event);
      return;
    }

    if ((window as any).gtag) {
      (window as any).gtag("event", "purchase", event);
    }
  },
};

// Custom events
export function trackEvent(eventName: string, params?: Record<string, any>) {
  if (isDev) {
    console.log(`[Analytics] Event "${eventName}":`, params);
    return;
  }

  if ((window as any).gtag) {
    (window as any).gtag("event", eventName, params);
  }
}
