/**
 * Validation Schemas and Utilities
 * Using Zod for type-safe form validation
 */

import { z } from "zod";

// ============ Input Sanitization ============

/**
 * Sanitize string input to prevent XSS
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, "") // Remove angle brackets
    .replace(/javascript:/gi, "") // Remove javascript: protocol
    .replace(/on\w+=/gi, "") // Remove event handlers
    .trim();
}

/**
 * Sanitize HTML content (more strict)
 */
export function sanitizeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ============ Common Validators ============

const phoneRegex = /^[+]?[0-9]{10,14}$/;
const pincodeRegex = /^[0-9]{6}$/;

// ============ Checkout Form Schema ============

export const checkoutFormSchema = z.object({
  customer_name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name is too long")
    .transform(sanitizeInput),
  customer_email: z
    .string()
    .email("Please enter a valid email address"),
  customer_phone: z
    .string()
    .regex(phoneRegex, "Please enter a valid phone number (10-14 digits)"),
  shipping_address: z.object({
    line1: z
      .string()
      .min(5, "Address must be at least 5 characters")
      .max(200, "Address is too long")
      .transform(sanitizeInput),
    line2: z
      .string()
      .max(200, "Address is too long")
      .transform(sanitizeInput)
      .optional()
      .or(z.literal("")),
    city: z
      .string()
      .min(2, "City is required")
      .max(50, "City name is too long")
      .transform(sanitizeInput),
    state: z
      .string()
      .min(2, "State is required")
      .max(50, "State name is too long")
      .transform(sanitizeInput),
    pincode: z
      .string()
      .regex(pincodeRegex, "Please enter a valid 6-digit pincode"),
    country: z.string().default("India"),
  }),
});

export type CheckoutFormValues = z.infer<typeof checkoutFormSchema>;

// ============ Login Form Schema ============

export const loginEmailSchema = z.object({
  email: z
    .string()
    .email("Please enter a valid email address"),
});

export const otpSchema = z.object({
  otp: z
    .string()
    .length(6, "OTP must be 6 digits")
    .regex(/^[0-9]+$/, "OTP must contain only numbers"),
});

export const passwordSchema = z.object({
  password: z
    .string()
    .min(1, "Password is required"),
});

// ============ Profile Form Schema ============

export const profileFormSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name is too long")
    .transform(sanitizeInput)
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .regex(phoneRegex, "Please enter a valid phone number")
    .optional()
    .or(z.literal("")),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;

// ============ Custom Request Schema ============

export const customRequestSchema = z.object({
  description: z
    .string()
    .min(20, "Please provide at least 20 characters describing your request")
    .max(2000, "Description is too long")
    .transform(sanitizeInput),
});

export type CustomRequestValues = z.infer<typeof customRequestSchema>;

// ============ Product Form Schema (Admin) ============

export const productFormSchema = z.object({
  name: z
    .string()
    .min(3, "Name must be at least 3 characters")
    .max(200, "Name is too long")
    .transform(sanitizeInput),
  description: z
    .string()
    .max(2000, "Description is too long")
    .transform(sanitizeInput)
    .optional()
    .or(z.literal("")),
  category: z.enum(["ring", "necklace", "earring", "bracelet", "pendant", "chain", "bangle", "anklet"]),
  metal_type: z.enum(["gold", "silver", "platinum", "white_gold", "rose_gold"]),
  metal_purity: z.enum(["24k", "22k", "18k", "14k", "925_silver", "950_platinum"]),
  weight_grams: z.number().min(0, "Weight cannot be negative").max(10000, "Weight is too high"),
  price: z.number().min(1, "Price is required").max(100000000, "Price is too high"),
  mrp: z.number().min(0, "MRP cannot be negative").max(100000000, "MRP is too high"),
  stock_quantity: z.number().int().min(0, "Stock cannot be negative"),
  is_active: z.enum(["active", "inactive"]),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;

// ============ Validation Helper ============

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: Record<string, string>;
}

/**
 * Validate form data and return field-level errors
 */
export function validateForm<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors: Record<string, string> = {};
  result.error.errors.forEach((err) => {
    const path = err.path.join(".");
    if (!errors[path]) {
      errors[path] = err.message;
    }
  });
  
  return { success: false, errors };
}
