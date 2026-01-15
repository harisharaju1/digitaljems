# DigitalJems

A modern e-commerce platform for selling digital products and jewelry, built with React and Supabase.

## Tech Stack

### Frontend
- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Radix UI based component library
- **React Router** - Client-side routing
- **Zustand** - State management
- **React Hook Form + Zod** - Form handling and validation
- **Recharts** - Data visualization

### Backend & Database
- **Supabase** - Backend-as-a-Service
  - PostgreSQL database
  - Authentication
  - Edge Functions (serverless)
  - Row Level Security (RLS)

### Integrations
- **Razorpay** - Payment gateway (India)
- **Resend** - Transactional emails
- **Sentry** - Error tracking and monitoring
- **Google Analytics 4** - Analytics

## Features

- Product catalog with categories
- Shopping cart
- Secure checkout with Razorpay
- Order confirmation emails
- Responsive design
- SEO optimized (React Helmet)

## Getting Started

### Prerequisites
- Node.js 18+
- Supabase account
- Razorpay account

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp env.example.txt .env

# Update .env with your credentials

# Start development server
npm run dev
```

### Environment Variables

See `env.example.txt` for required environment variables.

## Deployment

This app is configured for deployment on **Vercel**:

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

## License

MIT
