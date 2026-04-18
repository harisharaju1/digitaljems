/**
 * SDK Integration Layer
 * Uses Supabase for database, auth, and storage
 * Uses Resend for email notifications
 */

import { supabase, RESEND_API_KEY } from "./supabase";
import { cache } from "./cache";
import { config } from "./config";
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

// ============= Dev Mode Mock Products =============
let DEV_PRODUCTS: Product[] = [
  {
    id: "dev-prod-001",
    name: "Eternal Rose Gold Diamond Ring",
    description: "Stunning 18K rose gold ring featuring a brilliant-cut diamond centerpiece surrounded by delicate pavé diamonds. Perfect for engagements or special occasions.",
    category: "ring",
    metal_type: "rose_gold",
    metal_purity: "18k",
    weight_grams: 4.5,
    price: 85000,
    mrp: 102000,
    making_charges_saved: 17000,
    images: [
      "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=800",
      "https://images.unsplash.com/photo-1603561591411-07134e71a2a9?w=800",
    ],
    videos: [],
    stock_quantity: 5,
    is_active: "active",
    created_at: "2025-01-15T10:00:00.000Z",
    updated_at: "2025-01-15T10:00:00.000Z",
  },
  {
    id: "dev-prod-002",
    name: "Classic Gold Chain Necklace",
    description: "Elegant 22K gold chain necklace with intricate link pattern. A timeless piece that complements any outfit.",
    category: "chain",
    metal_type: "gold",
    metal_purity: "22k",
    weight_grams: 15.0,
    price: 125000,
    mrp: 150000,
    making_charges_saved: 25000,
    images: [
      "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=800",
      "https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=800",
    ],
    videos: [],
    stock_quantity: 8,
    is_active: "active",
    created_at: "2025-01-14T10:00:00.000Z",
    updated_at: "2025-01-14T10:00:00.000Z",
  },
  {
    id: "dev-prod-003",
    name: "Pearl Drop Earrings",
    description: "Exquisite 18K gold earrings featuring lustrous freshwater pearls with diamond accents. Perfect for evening wear.",
    category: "earring",
    metal_type: "gold",
    metal_purity: "18k",
    weight_grams: 6.2,
    price: 45000,
    mrp: 54000,
    making_charges_saved: 9000,
    images: [
      "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800",
      "https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?w=800",
    ],
    videos: [],
    stock_quantity: 12,
    is_active: "active",
    created_at: "2025-01-13T10:00:00.000Z",
    updated_at: "2025-01-13T10:00:00.000Z",
  },
  {
    id: "dev-prod-004",
    name: "Diamond Tennis Bracelet",
    description: "Stunning platinum bracelet featuring 40 round brilliant diamonds in a classic tennis style. A statement piece for any occasion.",
    category: "bracelet",
    metal_type: "platinum",
    metal_purity: "950_platinum",
    weight_grams: 18.5,
    price: 350000,
    mrp: 420000,
    making_charges_saved: 70000,
    images: [
      "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=800",
      "https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=800",
    ],
    videos: [],
    stock_quantity: 3,
    is_active: "active",
    created_at: "2025-01-12T10:00:00.000Z",
    updated_at: "2025-01-12T10:00:00.000Z",
  },
  {
    id: "dev-prod-005",
    name: "Floral Gold Pendant",
    description: "Delicate 22K gold pendant with intricate floral design and tiny diamond accents. Comes with matching chain.",
    category: "pendant",
    metal_type: "gold",
    metal_purity: "22k",
    weight_grams: 8.0,
    price: 72000,
    mrp: 86400,
    making_charges_saved: 14400,
    images: [
      "https://images.unsplash.com/photo-1599459183200-59c3a0e2b4d7?w=800",
      "https://images.unsplash.com/photo-1602173574767-37ac01994b2a?w=800",
    ],
    videos: [],
    stock_quantity: 7,
    is_active: "active",
    created_at: "2025-01-11T10:00:00.000Z",
    updated_at: "2025-01-11T10:00:00.000Z",
  },
  {
    id: "dev-prod-006",
    name: "Traditional Gold Bangles Set",
    description: "Set of 4 stunning 22K gold bangles with traditional Indian design patterns. Perfect for weddings and festivals.",
    category: "bangle",
    metal_type: "gold",
    metal_purity: "22k",
    weight_grams: 48.0,
    price: 380000,
    mrp: 456000,
    making_charges_saved: 76000,
    images: [
      "https://images.unsplash.com/photo-1601121141461-9d6647bca1ed?w=800",
      "https://images.unsplash.com/photo-1535632787350-4e68ef0ac584?w=800",
    ],
    videos: [],
    stock_quantity: 4,
    is_active: "active",
    created_at: "2025-01-10T10:00:00.000Z",
    updated_at: "2025-01-10T10:00:00.000Z",
  },
  {
    id: "dev-prod-007",
    name: "Silver Anklet with Bells",
    description: "Beautiful 925 sterling silver anklet with tiny bells and charm accents. Adjustable length for perfect fit.",
    category: "anklet",
    metal_type: "silver",
    metal_purity: "925_silver",
    weight_grams: 12.0,
    price: 4500,
    mrp: 5400,
    making_charges_saved: 900,
    images: [
      "https://images.unsplash.com/photo-1611085583191-a3b181a88401?w=800",
    ],
    videos: [],
    stock_quantity: 20,
    is_active: "active",
    created_at: "2025-01-09T10:00:00.000Z",
    updated_at: "2025-01-09T10:00:00.000Z",
  },
  {
    id: "dev-prod-008",
    name: "White Gold Solitaire Ring",
    description: "Elegant 18K white gold ring featuring a 0.5 carat round brilliant solitaire diamond in a classic six-prong setting.",
    category: "ring",
    metal_type: "white_gold",
    metal_purity: "18k",
    weight_grams: 3.8,
    price: 95000,
    mrp: 114000,
    making_charges_saved: 19000,
    images: [
      "https://images.unsplash.com/photo-1588444837495-c6cfeb53f32d?w=800",
      "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=800",
    ],
    videos: [],
    stock_quantity: 6,
    is_active: "active",
    created_at: "2025-01-08T10:00:00.000Z",
    updated_at: "2025-01-08T10:00:00.000Z",
  },
  {
    id: "dev-prod-009",
    name: "Layered Gold Necklace",
    description: "Modern 18K gold layered necklace with three delicate chains of varying lengths. Minimalist elegance for everyday wear.",
    category: "necklace",
    metal_type: "gold",
    metal_purity: "18k",
    weight_grams: 10.5,
    price: 88000,
    mrp: 105600,
    making_charges_saved: 17600,
    images: [
      "https://images.unsplash.com/photo-1599643477877-530eb83abc8e?w=800",
      "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800",
    ],
    videos: [],
    stock_quantity: 9,
    is_active: "active",
    created_at: "2025-01-07T10:00:00.000Z",
    updated_at: "2025-01-07T10:00:00.000Z",
  },
  {
    id: "dev-prod-010",
    name: "Diamond Stud Earrings",
    description: "Classic platinum diamond studs featuring 0.25 carat diamonds each. Timeless elegance for any occasion.",
    category: "earring",
    metal_type: "platinum",
    metal_purity: "950_platinum",
    weight_grams: 2.5,
    price: 65000,
    mrp: 78000,
    making_charges_saved: 13000,
    images: [
      "https://images.unsplash.com/photo-1635767798638-3e25273a8236?w=800",
      "https://images.unsplash.com/photo-1629224316810-9d8805b95e76?w=800",
    ],
    videos: [],
    stock_quantity: 15,
    is_active: "active",
    created_at: "2025-01-06T10:00:00.000Z",
    updated_at: "2025-01-06T10:00:00.000Z",
  },
];

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
  async signUpWithPassword(email: string, password: string, phone?: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          phone: phone || "",
        },
      },
    });
    if (error) throw error;
    
    // Create user profile with phone if provided
    if (data.user && phone) {
      try {
        await supabase.from("user_profiles").upsert({
          email: email.toLowerCase(),
          phone,
          name: "",
          saved_addresses: JSON.stringify([]),
          role: "customer",
          is_admin: "false",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'email' });
      } catch (e) {
        console.error("Failed to create profile with phone:", e);
      }
    }
    
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
    if (isDev) return URL.createObjectURL(file);

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

  /**
   * Upload a product video to Supabase Storage
   */
  async uploadProductVideo(file: File): Promise<string> {
    if (isDev) return URL.createObjectURL(file);

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `products/videos/${fileName}`;

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
   * Delete a product video from Supabase Storage
   */
  async deleteProductVideo(url: string): Promise<void> {
    // Extract path from URL
    const match = url.match(/product-images\/(.+)$/);
    if (!match) return;

    const filePath = match[1];
    const { error } = await supabase.storage
      .from('product-images')
      .remove([filePath]);

    if (error) console.error('Failed to delete video:', error);
  },
};

// ============= Product Service =============
export const productService = {
  /**
   * Get all active products (public access)
   */
  async getAllProducts(limit = 100): Promise<Product[]> {
    if (isDev) return DEV_PRODUCTS.slice(0, limit);

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
      videos:
        typeof item.videos === "string" ? JSON.parse(item.videos) : (item.videos || []),
    })) as Product[];
  },

  /**
   * Get products with cursor-based pagination (Step 1 — system design learning)
   * Uses created_at as the cursor: WHERE created_at < cursor instead of OFFSET N
   */
  async getAllProductsPaginated(
    limit = 12,
    cursor?: string // created_at of the last product on the previous page
  ): Promise<{ products: Product[]; nextCursor: string | null; hasMore: boolean }> {
    if (isDev) {
      // In dev mode, simulate cursor pagination against the in-memory array.
      // Find where the cursor product sits, then slice forward from there.
      const start = cursor
        ? DEV_PRODUCTS.findIndex((p) => p.created_at === cursor) + 1
        : 0;
      const page = DEV_PRODUCTS.slice(start, start + limit);
      return {
        products: page,
        nextCursor: page.at(-1)?.created_at ?? null,
        hasMore: start + limit < DEV_PRODUCTS.length,
      };
    }

    // Fetch one extra row — if we get back more than `limit`, a next page exists.
    // This avoids a separate COUNT(*) query which is slow on large tables.
    let query = supabase
      .from("products")
      .select("*")
      .eq("is_active", "active")
      .order("created_at", { ascending: false })
      .limit(limit + 1);

    // Only add the cursor filter when we have one (not on the first page).
    // .lt("created_at", cursor) → WHERE created_at < cursor → "older than the bookmark"
    if (cursor) {
      query = query.lt("created_at", cursor);
    }

    const { data, error } = await query;
    if (error) throw error;

    const hasMore = (data || []).length > limit;
    // Discard the extra row we fetched — it was only used to detect hasMore.
    const products = (data || []).slice(0, limit).map((item) => ({
      ...item,
      images: typeof item.images === "string" ? JSON.parse(item.images) : item.images,
      videos: typeof item.videos === "string" ? JSON.parse(item.videos) : (item.videos || []),
    })) as Product[];

    return {
      products,
      // The last product's created_at becomes the cursor for the next call.
      nextCursor: products.at(-1)?.created_at ?? null,
      hasMore,
    };
  },

  /**
   * Get products by category
   */
  async getProductsByCategory(
    category: string,
    limit = 50
  ): Promise<Product[]> {
    if (isDev) return DEV_PRODUCTS.filter((p) => p.category === category).slice(0, limit);

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
      videos:
        typeof item.videos === "string" ? JSON.parse(item.videos) : (item.videos || []),
    })) as Product[];
  },

  /**
   * Get single product by ID — with per-product cache (Step 2 — SWR caching)
   * Individual products use a longer TTL (5 min) since they change less often than listings.
   */
  async getProductById(productId: string): Promise<Product | null> {
    // CONCEPT: template literal as dynamic cache key — each product gets its own entry
    const cacheKey = `product:${productId}`;
    const cached = cache.get<Product>(cacheKey);

    // CONCEPT: early return from cache — skip the network call if data is still fresh
    if (cached && !cache.isStale(cacheKey, config.cache.productDetailTtlMs)) {
      return cached;
    }

    if (isDev) return DEV_PRODUCTS.find((p) => p.id === productId) || null;

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .single();

    if (error) return null;

    const product = {
      ...data,
      images:
        typeof data.images === "string" ? JSON.parse(data.images) : data.images,
      videos:
        typeof data.videos === "string" ? JSON.parse(data.videos) : (data.videos || []),
    } as Product;

    cache.set(cacheKey, product); // cache for future lookups
    return product;
  },

  /**
   * Create new product (admin only)
   */
  async createProduct(productData: ProductFormData): Promise<Product> {
    if (isDev) {
      const now = new Date().toISOString();
      const newProduct: Product = {
        ...productData,
        id: `dev-prod-${Date.now()}`,
        videos: productData.videos || [],
        stock_quantity: productData.stock_quantity ?? 0,
        is_active: productData.is_active ?? "active",
        created_at: now,
        updated_at: now,
      };
      DEV_PRODUCTS.unshift(newProduct);
      console.log("[DEV] Product created:", newProduct.name);
      return newProduct;
    }

    const now = new Date().toISOString();
    const product = {
      ...productData,
      images: JSON.stringify(productData.images),
      videos: JSON.stringify(productData.videos || []),
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
    if (isDev) {
      const idx = DEV_PRODUCTS.findIndex((p) => p.id === productId);
      if (idx !== -1) {
        DEV_PRODUCTS[idx] = { ...DEV_PRODUCTS[idx], ...updates, updated_at: new Date().toISOString() };
        console.log("[DEV] Product updated:", DEV_PRODUCTS[idx].name);
      }
      return;
    }

    const updateData: any = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    if (updates.images) {
      updateData.images = JSON.stringify(updates.images);
    }
    if (updates.videos !== undefined) {
      updateData.videos = JSON.stringify(updates.videos);
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
    if (isDev) {
      DEV_PRODUCTS = DEV_PRODUCTS.filter((p) => p.id !== productId);
      console.log("[DEV] Product deleted:", productId);
      return;
    }

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
    description: string,
    phone: string,
    name?: string
  ): Promise<CustomRequest> {
    const email = authService.getCurrentUserEmail();
    if (!email) throw new Error("Authentication required");

    // Upload image first
    const imageUrl = await this.uploadImage(imageFile);

    const now = new Date().toISOString();
    const request = {
      customer_email: email,
      customer_phone: phone,
      customer_name: name || "",
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
        .eq("email", email);

      if (error) {
        console.error("Profile update error:", error);
        throw error;
      }
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
    if (isDev) {
      console.log(`[DEV] Admin log: ${actionType} ${entityType} ${entityId}`, details);
      return;
    }

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
