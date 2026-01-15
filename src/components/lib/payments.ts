/**
 * Payment Integration - Razorpay
 * Handles payment creation and verification
 * In dev mode, payments are simulated
 */

const isDev = import.meta.env.DEV;
const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID || "";

// Dev mode simulation delay
const DEV_PAYMENT_DELAY = 1500;

export interface PaymentOptions {
  orderId: string;
  amount: number; // in paise (INR * 100)
  currency?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  description?: string;
}

export interface PaymentResult {
  success: boolean;
  paymentId?: string;
  orderId?: string;
  signature?: string;
  error?: string;
}

/**
 * Load Razorpay script dynamically
 */
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/**
 * Create a Razorpay order (should call backend in production)
 * For now, this is a placeholder - you'll need a Supabase Edge Function
 */
export async function createPaymentOrder(amount: number, orderId: string): Promise<{ razorpayOrderId: string }> {
  // In production, call your Supabase Edge Function to create order
  // The Edge Function would use Razorpay's server SDK with your secret key
  
  if (isDev) {
    // Dev mode: return a fake order ID
    return { razorpayOrderId: `dev_order_${Date.now()}` };
  }

  // Production: Call Edge Function
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-razorpay-order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ amount, orderId }),
  });

  if (!response.ok) {
    throw new Error("Failed to create payment order");
  }

  return response.json();
}

/**
 * Open Razorpay checkout modal
 */
export async function initiatePayment(options: PaymentOptions): Promise<PaymentResult> {
  // Dev mode: simulate payment
  if (isDev) {
    console.log("[DEV] Simulating payment for:", options);
    
    return new Promise((resolve) => {
      // Show a confirm dialog in dev mode
      const confirmed = window.confirm(
        `[DEV MODE] Simulate payment?\n\n` +
        `Amount: ₹${(options.amount / 100).toLocaleString("en-IN")}\n` +
        `Order: ${options.orderId}\n\n` +
        `Click OK to simulate successful payment\n` +
        `Click Cancel to simulate failed payment`
      );

      setTimeout(() => {
        if (confirmed) {
          resolve({
            success: true,
            paymentId: `dev_pay_${Date.now()}`,
            orderId: options.orderId,
            signature: `dev_sig_${Date.now()}`,
          });
        } else {
          resolve({
            success: false,
            error: "Payment cancelled by user (dev mode)",
          });
        }
      }, DEV_PAYMENT_DELAY);
    });
  }

  // Production: Use actual Razorpay
  if (!RAZORPAY_KEY_ID) {
    throw new Error("Razorpay key not configured");
  }

  const scriptLoaded = await loadRazorpayScript();
  if (!scriptLoaded) {
    throw new Error("Failed to load Razorpay");
  }

  // Create order on backend first
  const { razorpayOrderId } = await createPaymentOrder(options.amount, options.orderId);

  return new Promise((resolve) => {
    const razorpayOptions = {
      key: RAZORPAY_KEY_ID,
      amount: options.amount,
      currency: options.currency || "INR",
      name: "DJewel Boutique",
      description: options.description || "Jewellery Purchase",
      order_id: razorpayOrderId,
      prefill: {
        name: options.customerName,
        email: options.customerEmail,
        contact: options.customerPhone,
      },
      theme: {
        color: "#D4A84B", // Gold accent color
      },
      handler: function (response: any) {
        resolve({
          success: true,
          paymentId: response.razorpay_payment_id,
          orderId: response.razorpay_order_id,
          signature: response.razorpay_signature,
        });
      },
      modal: {
        ondismiss: function () {
          resolve({
            success: false,
            error: "Payment cancelled by user",
          });
        },
      },
    };

    const rzp = new (window as any).Razorpay(razorpayOptions);
    rzp.on("payment.failed", function (response: any) {
      resolve({
        success: false,
        error: response.error.description || "Payment failed",
      });
    });
    rzp.open();
  });
}

/**
 * Verify payment signature (should be done on backend)
 */
export async function verifyPayment(
  paymentId: string,
  orderId: string,
  signature: string
): Promise<boolean> {
  if (isDev) {
    // Dev mode: always return true for dev payments
    if (paymentId.startsWith("dev_")) {
      return true;
    }
  }

  // Production: Call Edge Function to verify
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-razorpay-payment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ paymentId, orderId, signature }),
  });

  if (!response.ok) {
    return false;
  }

  const data = await response.json();
  return data.verified === true;
}
