# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server
npm run build     # TypeScript compile + Vite production build
npm run lint      # ESLint
npm run preview   # Preview production build locally
```

No test suite is configured.

## Architecture

**DigitalJems** is a React SPA e-commerce platform for jewelry, built with:
- **React 18 + TypeScript + Vite** — frontend framework and build tool
- **Tailwind CSS + shadcn/ui** — styling with Radix UI components
- **Zustand** — state management with localStorage persistence
- **Supabase** — backend: PostgreSQL, Auth, Edge Functions, Storage
- **Razorpay** — payment gateway (India)
- **Resend** — transactional email

Path alias: `@` → `./src`

## Key File Locations

- `src/components/lib/sdk.ts` — central API service layer; all Supabase interactions go through service objects here (`authService`, `productService`, `orderService`, `customRequestService`, `storageService`)
- `src/components/lib/supabase.ts` — Supabase client config
- `src/components/lib/payments.ts` — Razorpay integration
- `src/components/store/` — Zustand stores for auth, cart, products, wishlist
- `src/components/types/index.ts` — all shared TypeScript types
- `src/App.tsx` — routing setup and auth initialization
- `supabase/schema.sql` — full database schema
- `supabase/functions/` — Edge Functions: `create-razorpay-order`, `verify-razorpay-payment`, `send-order-email`

## Data Flow

```
React Components → Zustand Stores → sdk.ts services → Supabase client → Supabase backend
```

Payment flow: `CheckoutPage` → `orderService.createOrder()` → Razorpay modal → `verify-razorpay-payment` Edge Function → `send-order-email` Edge Function

## Database Tables

- `products` — jewelry catalog (metal_type, stone details, images JSONB, videos JSONB)
- `orders` — customer orders with items JSONB, payment status, shipping tracking
- `custom_requests` — customer design requests with admin workflow (pending → reviewed → quoted/declined)
- `custom_request_comments` — bidirectional admin/customer messaging on design requests
- `user_profiles` — extended user info with `is_admin` flag and `saved_addresses` JSONB
- `admin_logs` — audit trail for admin actions

## Authentication

Primary: Magic link/OTP via Supabase Auth. Secondary: password-based. Admin access checked via `user_profiles.is_admin`.

**Development mode** bypasses Supabase — use these test accounts locally:
- `admin@test.com` / `admin123` (admin)
- `user1@test.com` / `user123` (customer)

Dev mode is toggled via `VITE_DEV_MODE=true` in environment variables. See `env.example.txt` for all required env vars.

## Admin Panel

Routes at `/admin/*`, protected by admin check in `App.tsx`. Pages: Dashboard, Products (CRUD), Orders, Custom Requests, Logs.
