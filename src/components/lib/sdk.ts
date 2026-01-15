/**
 * SDK Integration Layer
 * Uses Supabase for database, auth, and storage
 * Uses Resend for email notifications
 */

import { supabase, RESEND_API_KEY } from "./supabase";
import type {
  Product,
  Order,
  CustomRequest,
  UserProfile,
  AdminLog,
  ProductFormData,
  CheckoutFormData,
  OrderItem,
  ShippingAddress,
} from "@/components/types";

// ============= Dev Mode Test Users =============
const DEV_USERS: Record<string, { password: string; name: string; isAdmin: boolean }> = {
  "admin@test.com": { password: "admin123", name: "Admin User", isAdmin: true },
  "user1@test.com": { password: "user123", name: "Test User 1", isAdmin: false },
  "user2@test.com": { password: "user123", name: "Test User 2", isAdmin: false },
};

const isDev = import.meta.env.DEV;

// ============= Auth Service =============
export const authService = {
  /**
   * Send OTP to email (in dev mode, accepts test user emails)
   */
  async sendOTP(email: string): Promise<void> {
    // Dev mode: skip OTP for test users
    if (isDev && DEV_USERS[email.toLowerCase()]) {
      console.log(`[DEV] Test user detected: ${email}. Use password login.`);
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) throw error;
  },

  /**
   * Verify OTP and login (in dev mode, accepts password for test users)
   */
  async verifyOTP(email: string, code: string) {
    const lowerEmail = email.toLowerCase();

    // Dev mode: check if it's a test user with password
    if (isDev && DEV_USERS[lowerEmail]) {
      const testUser = DEV_USERS[lowerEmail];
      if (code === testUser.password) {
        // Generate a fake user ID for dev
        const fakeId = `dev-${lowerEmail.replace(/[@.]/g, "-")}`;
        this.storeUserInfo(fakeId, lowerEmail, testUser.name);
        
        return {
          user: {
            id: fakeId,
            email: lowerEmail,
          },
          session: null,
        };
      } else {
        throw new Error("Invalid password");
      }
    }

    // Production: use Supabase OTP
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });
    if (error) throw error;
    return data;
  },

  /**
   * Check if email is a dev test user
   */
  isDevUser(email: string): boolean {
    return isDev && !!DEV_USERS[email.toLowerCase()];
  },

  /**
   * Get dev user info
   */
  getDevUserInfo(email: string): { name: string; isAdmin: boolean } | null {
    if (!isDev) return null;
    return DEV_USERS[email.toLowerCase()] || null;
  },

  /**
   * Sign up with email and password
   */
  async signUpWithPassword(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) throw error;
    return data;
  },

  /**
   * Sign in with email and password
   */
  async signInWithPassword(email: string, password: string) {
    const lowerEmail = email.toLowerCase();

    // Dev mode: check if it's a test user
    if (isDev && DEV_USERS[lowerEmail]) {
      const testUser = DEV_USERS[lowerEmail];
      if (password === testUser.password) {
        const fakeId = `dev-${lowerEmail.replace(/[@.]/g, "-")}`;
        this.storeUserInfo(fakeId, lowerEmail, testUser.name);
        return {
          user: { id: fakeId, email: lowerEmail },
          session: null,
        };
      } else {
        throw new Error("Invalid password");
      }
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  },

  /**
   * Update user password
   */
  async updatePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) throw error;
  },

  /**
   * Check if user has a password set (vs magic link only)
   */
  async hasPassword(): Promise<boolean> {
    const { data } = await supabase.auth.getUser();
    // Users who signed up with password have identities with provider 'email'
    return data.user?.app_metadata?.provider === 'email' || 
           data.user?.identities?.some(i => i.provider === 'email') || false;
  },

  /**
   * Logout current user
   */
  async logout(): Promise<void> {
    await supabase.auth.signOut();
    this.clearUserInfo();
  },

  /**
   * Check if user is logged in
   */
  isLoggedIn(): boolean {
    return !!localStorage.getItem("JEWELS_USER_ID");
  },

  /**
   * Get current user ID from session
   */
  getCurrentUserId(): string | null {
    return localStorage.getItem("JEWELS_USER_ID");
  },

  /**
   * Get current user email from session
   */
  getCurrentUserEmail(): string | null {
    return localStorage.getItem("JEWELS_USER_EMAIL");
  },

  /**
   * Store user info after login
   */
  storeUserInfo(uid: string, email: string, name: string): void {
    localStorage.setItem("JEWELS_USER_ID", uid);
    localStorage.setItem("JEWELS_USER_EMAIL", email);
    localStorage.setItem("JEWELS_USER_NAME", name);
  },

  /**
   * Clear user info on logout
   */
  clearUserInfo(): void {
    localStorage.removeItem("JEWELS_USER_ID");
    localStorage.removeItem("JEWELS_USER_EMAIL");
    localStorage.removeItem("JEWELS_USER_NAME");
  },

  /**
   * Get current session
   */
  async getSession() {
    const { data } = await supabase.auth.getSession();
    return data.session;
  },
};

// ============= Storage Service =============
export const storageService = {
  /**
   * Upload a product image to Supabase Storage
   */
  async uploadProductImage(file: File): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `products/${fileName}`;

    const { error } = await supabase.storage
      .from('product-images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) throw error;

    // Get public URL
    const { data } = supabase.storage
      .from('product-images')
      .getPublicUrl(filePath);

    return data.publicUrl;
  },

  /**
   * Delete a product image from Supabase Storage
   */
  async deleteProductImage(url: string): Promise<void> {
    // Extract path from URL
    const match = url.match(/product-images\/(.+)$/);
    if (!match) return;

    const filePath = match[1];
    const { error } = await supabase.storage
      .from('product-images')
      .remove([filePath]);

    if (error) console.error('Failed to delete image:', error);
  },
};

// ============= Product Service =============
export const productService = {
  /**
   * Get all active products (public access)
   */
  async getAllProducts(limit = 100): Promise<Product[]> {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("is_active", "active")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data || []).map((item) => ({
      ...item,
      images:
        typeof item.images === "string" ? JSON.parse(item.images) : item.images,
    })) as Product[];
  },

  /**
   * Get products by category
   */
  async getProductsByCategory(
    category: string,
    limit = 50
  ): Promise<Product[]> {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("category", category)
      .eq("is_active", "active")
      .limit(limit);

    if (error) throw error;

    return (data || []).map((item) => ({
      ...item,
      images:
        typeof item.images === "string" ? JSON.parse(item.images) : item.images,
    })) as Product[];
  },

  /**
   * Get single product by ID
   */
  async getProductById(productId: string): Promise<Product | null> {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .single();

    if (error) return null;

    return {
      ...data,
      images:
        typeof data.images === "string" ? JSON.parse(data.images) : data.images,
    } as Product;
  },

  /**
   * Create new product (admin only)
   */
  async createProduct(productData: ProductFormData): Promise<Product> {
    const now = new Date().toISOString();
    const product = {
      ...productData,
      images: JSON.stringify(productData.images),
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from("products")
      .insert(product)
      .select()
      .single();

    if (error) throw error;

    return {
      ...data,
      images: productData.images,
    } as Product;
  },

  /**
   * Update product (admin only)
   */
  async updateProduct(
    productId: string,
    updates: Partial<ProductFormData>
  ): Promise<void> {
    const updateData: any = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    if (updates.images) {
      updateData.images = JSON.stringify(updates.images);
    }

    const { error } = await supabase
      .from("products")
      .update(updateData)
      .eq("id", productId);

    if (error) throw error;
  },

  /**
   * Delete product (admin only)
   */
  async deleteProduct(productId: string): Promise<void> {
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", productId);

    if (error) throw error;
  },

  /**
   * Search products (client-side filtering)
   */
  async searchProducts(query: string): Promise<Product[]> {
    const products = await this.getAllProducts();
    const lowerQuery = query.toLowerCase();

    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(lowerQuery) ||
        p.description.toLowerCase().includes(lowerQuery) ||
        p.category.toLowerCase().includes(lowerQuery)
    );
  },
};

// ============= Order Service =============
export const orderService = {
  /**
   * Generate unique order number
   */
  generateOrderNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `ORD-${timestamp}-${random}`;
  },

  /**
   * Create new order (guest or authenticated)
   */
  async createOrder(
    checkoutData: CheckoutFormData,
    items: OrderItem[],
    totals: {
      subtotal: number;
      totalSavings: number;
      shippingCost: number;
      totalAmount: number;
    }
  ): Promise<Order> {
    const orderNumber = this.generateOrderNumber();
    const now = new Date().toISOString();

    const order = {
      order_number: orderNumber,
      customer_email: checkoutData.customer_email,
      customer_phone: checkoutData.customer_phone,
      customer_name: checkoutData.customer_name,
      shipping_address: JSON.stringify(checkoutData.shipping_address),
      items: JSON.stringify(items),
      subtotal: totals.subtotal,
      total_savings: totals.totalSavings,
      shipping_cost: totals.shippingCost,
      total_amount: totals.totalAmount,
      payment_status: "pending",
      order_status: "placed",
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from("orders")
      .insert(order)
      .select()
      .single();

    if (error) throw error;

    return {
      ...data,
      shipping_address: checkoutData.shipping_address,
      items,
    } as Order;
  },

  /**
   * Get all orders (admin only)
   */
  async getAllOrders(limit = 100): Promise<Order[]> {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data || []).map((item) => ({
      ...item,
      shipping_address:
        typeof item.shipping_address === "string"
          ? JSON.parse(item.shipping_address)
          : item.shipping_address,
      items:
        typeof item.items === "string" ? JSON.parse(item.items) : item.items,
    })) as Order[];
  },

  /**
   * Get orders by email
   */
  async getOrdersByEmail(email: string): Promise<Order[]> {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("customer_email", email)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    return (data || []).map((item) => ({
      ...item,
      shipping_address:
        typeof item.shipping_address === "string"
          ? JSON.parse(item.shipping_address)
          : item.shipping_address,
      items:
        typeof item.items === "string" ? JSON.parse(item.items) : item.items,
    })) as Order[];
  },

  /**
   * Get single order by order number
   */
  async getOrderByNumber(orderNumber: string): Promise<Order | null> {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("order_number", orderNumber)
      .single();

    if (error) return null;

    return {
      ...data,
      shipping_address:
        typeof data.shipping_address === "string"
          ? JSON.parse(data.shipping_address)
          : data.shipping_address,
      items:
        typeof data.items === "string" ? JSON.parse(data.items) : data.items,
    } as Order;
  },

  /**
   * Update order status (admin or simple status update)
   */
  async updateOrderStatus(
    orderId: string,
    statusOrUpdates: Order["order_status"] | {
      order_status?: Order["order_status"];
      payment_status?: Order["payment_status"];
      tracking_number?: string;
      shipping_provider?: string;
      notes?: string;
    }
  ): Promise<void> {
    const updates = typeof statusOrUpdates === "string" 
      ? { order_status: statusOrUpdates }
      : statusOrUpdates;

    const { error } = await supabase
      .from("orders")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (error) throw error;
  },

  /**
   * Update payment status after payment gateway callback
   */
  async updatePaymentStatus(
    orderId: string,
    paymentId: string,
    status: Order["payment_status"]
  ): Promise<void> {
    const { error } = await supabase
      .from("orders")
      .update({
        payment_id: paymentId,
        payment_status: status,
        order_status: status === "completed" ? "confirmed" : "placed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (error) throw error;
  },

  /**
   * Update order with payment details (after successful payment)
   */
  async updateOrderPayment(
    orderId: string,
    paymentDetails: {
      payment_status: Order["payment_status"];
      payment_id: string;
      payment_method?: string;
    }
  ): Promise<void> {
    const { error } = await supabase
      .from("orders")
      .update({
        payment_status: paymentDetails.payment_status,
        payment_id: paymentDetails.payment_id,
        payment_method: paymentDetails.payment_method || "razorpay",
        order_status: paymentDetails.payment_status === "paid" ? "confirmed" : "placed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (error) throw error;
  },
};

// ============= Custom Request Service =============
export const customRequestService = {
  /**
   * Upload image to Supabase Storage
   */
  async uploadImage(file: File): Promise<string> {
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random()
      .toString(36)
      .substring(2)}.${fileExt}`;
    const filePath = `custom-requests/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("images")
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from("images").getPublicUrl(filePath);
    return data.publicUrl;
  },

  /**
   * Submit custom product request with image
   */
  async submitRequest(
    imageFile: File,
    description: string
  ): Promise<CustomRequest> {
    const email = authService.getCurrentUserEmail();
    if (!email) throw new Error("Authentication required");

    // Upload image first
    const imageUrl = await this.uploadImage(imageFile);

    const now = new Date().toISOString();
    const request = {
      customer_email: email,
      image_url: imageUrl,
      description,
      status: "pending",
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from("custom_requests")
      .insert(request)
      .select()
      .single();

    if (error) throw error;
    return data as CustomRequest;
  },

  /**
   * Get all custom requests (admin only)
   */
  async getAllRequests(limit = 100): Promise<CustomRequest[]> {
    const { data, error } = await supabase
      .from("custom_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data as CustomRequest[];
  },

  /**
   * Get user's custom requests
   */
  async getMyRequests(email: string): Promise<CustomRequest[]> {
    const { data, error } = await supabase
      .from("custom_requests")
      .select("*")
      .eq("customer_email", email)
      .limit(50);

    if (error) throw error;
    return data as CustomRequest[];
  },

  /**
   * Respond to custom request (admin only)
   */
  async respondToRequest(
    requestId: string,
    response: string,
    estimatedPrice?: number,
    status: CustomRequest["status"] = "quoted"
  ): Promise<void> {
    const updates: any = {
      admin_response: response,
      status,
      updated_at: new Date().toISOString(),
    };

    if (estimatedPrice !== undefined) {
      updates.estimated_price = estimatedPrice;
    }

    const { error } = await supabase
      .from("custom_requests")
      .update(updates)
      .eq("id", requestId);

    if (error) throw error;
  },
};

// ============= User Profile Service =============
export const userProfileService = {
  /**
   * Create or update user profile
   */
  async upsertProfile(
    email: string,
    name: string,
    phone: string
  ): Promise<UserProfile> {
    const existing = await this.getProfile(email);

    if (existing) {
      const { error } = await supabase
        .from("user_profiles")
        .update({
          name,
          phone,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (error) throw error;
      return { ...existing, name, phone };
    } else {
      const profile = {
        email,
        name,
        phone,
        saved_addresses: JSON.stringify([]),
        role: "customer",
        is_admin: "false",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("user_profiles")
        .insert(profile)
        .select()
        .single();

      if (error) throw error;
      return {
        ...data,
        saved_addresses: [],
      } as UserProfile;
    }
  },

  /**
   * Get user profile by email
   */
  async getProfile(email: string): Promise<UserProfile | null> {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("email", email)
      .single();

    if (error) return null;

    return {
      ...data,
      saved_addresses:
        typeof data.saved_addresses === "string"
          ? JSON.parse(data.saved_addresses)
          : data.saved_addresses,
    } as UserProfile;
  },

  /**
   * Add saved address
   */
  async addSavedAddress(
    email: string,
    address: ShippingAddress
  ): Promise<void> {
    const profile = await this.getProfile(email);
    if (!profile) throw new Error("Profile not found");

    const addresses = [...profile.saved_addresses, address];

    const { error } = await supabase
      .from("user_profiles")
      .update({
        saved_addresses: JSON.stringify(addresses),
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);

    if (error) throw error;
  },

  /**
   * Check if user is admin
   */
  async isAdmin(email: string): Promise<boolean> {
    const profile = await this.getProfile(email);
    return profile?.is_admin === "true";
  },
};

// ============= Email Notification Service =============
export const emailNotificationService = {
  /**
   * Send email via Resend API
   */
  async sendEmail(to: string[], subject: string, html: string): Promise<void> {
    if (!RESEND_API_KEY) {
      console.warn("Resend API key not configured, skipping email");
      return;
    }

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "orders@yourstore.com",
          to,
          subject,
          html,
        }),
      });

      if (!response.ok) {
        throw new Error(`Email send failed: ${response.statusText}`);
      }
    } catch (error) {
      console.error("Failed to send email:", error);
    }
  },

  /**
   * Send order confirmation email
   */
  async sendOrderConfirmation(order: Order): Promise<void> {
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%); color: white; padding: 30px; text-align: center; }
            .content { background: #f9f9f9; padding: 30px; }
            .order-details { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; }
            .item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
            .total { font-size: 18px; font-weight: bold; padding: 15px 0; }
            .savings { background: #fff4e6; padding: 15px; border-left: 4px solid #d4a24e; margin: 15px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Order Confirmation</h1>
              <p>Order #${order.order_number}</p>
            </div>
            
            <div class="content">
              <p>Dear ${order.customer_name},</p>
              <p>Thank you for your order! We've received your order and are processing it.</p>
              
              <div class="order-details">
                <h2>Order Details</h2>
                ${order.items
                  .map(
                    (item) => `
                  <div class="item">
                    <span>${item.name} (x${item.quantity})</span>
                    <span>₹${item.price.toLocaleString("en-IN")}</span>
                  </div>
                `
                  )
                  .join("")}
                
                <div class="total">
                  <div style="display: flex; justify-content: space-between;">
                    <span>Subtotal:</span>
                    <span>₹${order.subtotal.toLocaleString("en-IN")}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between;">
                    <span>Shipping:</span>
                    <span>₹${order.shipping_cost.toLocaleString("en-IN")}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; color: #d4a24e;">
                    <span>Total:</span>
                    <span>₹${order.total_amount.toLocaleString("en-IN")}</span>
                  </div>
                </div>
              </div>
              
              <div class="savings">
                <strong>🎉 You saved ₹${order.total_savings.toLocaleString(
                  "en-IN"
                )} on making charges!</strong>
                <p style="margin: 5px 0 0 0; font-size: 14px;">By shopping online, you avoided showroom making charges.</p>
              </div>
              
              <div class="order-details">
                <h3>Shipping Address</h3>
                <p>
                  ${order.shipping_address.line1}<br>
                  ${
                    order.shipping_address.line2
                      ? order.shipping_address.line2 + "<br>"
                      : ""
                  }
                  ${order.shipping_address.city}, ${
      order.shipping_address.state
    }<br>
                  ${order.shipping_address.pincode}, ${
      order.shipping_address.country
    }
                </p>
              </div>
              
              <p>We'll send you another email when your order ships.</p>
            </div>
            
            <div class="footer">
              <p>Questions? Contact us at support@yourstore.com</p>
              <p>&copy; ${new Date().getFullYear()} Your Jewellery Store. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    await this.sendEmail(
      [order.customer_email],
      `Order Confirmation - ${order.order_number}`,
      emailHtml
    );
  },

  /**
   * Send order status update email
   */
  async sendOrderStatusUpdate(
    order: Order,
    statusMessage: string
  ): Promise<void> {
    const statusEmoji: Record<string, string> = {
      confirmed: "✅",
      processing: "⚙️",
      shipped: "📦",
      delivered: "🎉",
      cancelled: "❌",
    };

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%); color: white; padding: 30px; text-align: center;">
              <h1>${statusEmoji[order.order_status] || "📋"} Order Update</h1>
              <p>Order #${order.order_number}</p>
            </div>
            
            <div style="background: #f9f9f9; padding: 30px;">
              <p>Dear ${order.customer_name},</p>
              <p>${statusMessage}</p>
              
              ${
                order.tracking_number
                  ? `
                <div style="background: white; padding: 20px; margin: 20px 0; border-radius: 8px;">
                  <h3>Tracking Information</h3>
                  <p><strong>Tracking Number:</strong> ${
                    order.tracking_number
                  }</p>
                  ${
                    order.shipping_provider
                      ? `<p><strong>Carrier:</strong> ${order.shipping_provider}</p>`
                      : ""
                  }
                </div>
              `
                  : ""
              }
              
              <p>Thank you for shopping with us!</p>
            </div>
            
            <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
              <p>Questions? Contact us at support@yourstore.com</p>
            </div>
          </div>
        </body>
      </html>
    `;

    await this.sendEmail(
      [order.customer_email],
      `Order Update - ${order.order_number}`,
      emailHtml
    );
  },
};

// ============= Admin Log Service =============
export const adminLogService = {
  /**
   * Log admin action
   */
  async logAction(
    actionType: AdminLog["action_type"],
    entityType: AdminLog["entity_type"],
    entityId: string,
    details: Record<string, any>
  ): Promise<void> {
    const email = authService.getCurrentUserEmail();
    if (!email) return;

    try {
      await supabase.from("admin_logs").insert({
        admin_email: email,
        action_type: actionType,
        entity_type: entityType,
        entity_id: entityId,
        details: JSON.stringify(details),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Failed to log admin action:", error);
    }
  },

  /**
   * Get recent admin logs
   */
  async getRecentLogs(limit = 50): Promise<AdminLog[]> {
    const { data, error } = await supabase
      .from("admin_logs")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data || []).map((item) => ({
      ...item,
      details:
        typeof item.details === "string"
          ? JSON.parse(item.details)
          : item.details,
    })) as AdminLog[];
  },
};
