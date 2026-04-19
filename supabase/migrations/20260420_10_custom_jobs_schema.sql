-- Feature 2, Phase 1: Schema for custom jobs pipeline, vendor registry, and atomic stock

-- ============= Vendors =============
CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  specialties TEXT[] NOT NULL DEFAULT '{}',
  reliability_score DECIMAL(3,2) DEFAULT 5.00,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  address JSONB,
  notes TEXT,
  auth_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vendors_active ON vendors(active);

-- ============= Custom Jobs =============
CREATE SEQUENCE IF NOT EXISTS custom_job_seq START 1;

CREATE TABLE IF NOT EXISTS custom_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_number TEXT UNIQUE NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('custom_request','mto','admin_manual')),
  custom_request_id UUID REFERENCES custom_requests(id),
  product_id UUID REFERENCES products(id),
  order_id UUID REFERENCES orders(id),
  customer_email TEXT NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  vendor_id UUID REFERENCES vendors(id),
  title TEXT NOT NULL,
  specification JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'intake' CHECK (status IN (
    'intake','design','quoted','approved','deposit_pending','in_production',
    'qc','ready_for_dispatch','dispatched','delivered','cancelled','on_hold'
  )),
  deposit_amount DECIMAL(12,2) DEFAULT 0,
  deposit_paid BOOLEAN DEFAULT FALSE,
  final_amount DECIMAL(12,2) DEFAULT 0,
  final_paid BOOLEAN DEFAULT FALSE,
  estimated_ready_date DATE,
  actual_ready_date DATE,
  tracking_token TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_custom_jobs_status ON custom_jobs(status);
CREATE INDEX IF NOT EXISTS idx_custom_jobs_vendor ON custom_jobs(vendor_id);
CREATE INDEX IF NOT EXISTS idx_custom_jobs_customer ON custom_jobs(customer_email);

-- Auto-generate job_number on INSERT
CREATE OR REPLACE FUNCTION generate_job_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.job_number := 'CJ-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('custom_job_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_job_number ON custom_jobs;
CREATE TRIGGER trg_job_number
  BEFORE INSERT ON custom_jobs
  FOR EACH ROW
  WHEN (NEW.job_number IS NULL OR NEW.job_number = '')
  EXECUTE FUNCTION generate_job_number();

-- ============= Milestones =============
CREATE TABLE IF NOT EXISTS custom_job_milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES custom_jobs(id) ON DELETE CASCADE,
  milestone TEXT NOT NULL CHECK (milestone IN (
    'design_approved','cad_ready','wax_model','casting',
    'stone_setting','finishing','qc','ready'
  )),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','done','skipped')),
  photos JSONB NOT NULL DEFAULT '[]',
  note TEXT,
  completed_at TIMESTAMPTZ,
  completed_by TEXT,
  UNIQUE(job_id, milestone)
);
CREATE INDEX IF NOT EXISTS idx_milestones_job ON custom_job_milestones(job_id);

-- ============= App Settings =============
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO app_settings VALUES ('mto_default_deposit_pct', '50', NULL, NOW())
  ON CONFLICT (key) DO NOTHING;

-- ============= Extend orders =============
ALTER TABLE orders ADD COLUMN IF NOT EXISTS custom_job_id UUID REFERENCES custom_jobs(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_split JSONB;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_order_status_check CHECK (order_status IN (
  'placed','confirmed','processing','shipped','delivered','cancelled','payment_failed',
  'mto_awaiting_deposit','mto_in_production','mto_ready_for_dispatch'
));

-- ============= Extend products for MTO =============
ALTER TABLE products ADD COLUMN IF NOT EXISTS allow_mto BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS mto_lead_time_weeks INTEGER DEFAULT 4;
ALTER TABLE products ADD COLUMN IF NOT EXISTS mto_deposit_pct DECIMAL(5,2);

-- ============= Atomic stock RPCs =============
CREATE OR REPLACE FUNCTION reserve_product_stock(p_product_id UUID, p_qty INT)
RETURNS TABLE(reserved INT, remaining INT, mto_required BOOLEAN) AS $$
DECLARE
  v_stock INT;
  v_allow_mto BOOLEAN;
BEGIN
  SELECT stock_quantity, allow_mto INTO v_stock, v_allow_mto
  FROM products WHERE id = p_product_id FOR UPDATE;

  IF v_stock >= p_qty THEN
    UPDATE products SET stock_quantity = stock_quantity - p_qty WHERE id = p_product_id;
    RETURN QUERY SELECT p_qty, v_stock - p_qty, FALSE;
  ELSIF v_allow_mto THEN
    RETURN QUERY SELECT 0, v_stock, TRUE;
  ELSE
    RAISE EXCEPTION 'Insufficient stock and MTO not allowed';
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION release_product_stock(p_product_id UUID, p_qty INT)
RETURNS VOID AS $$
BEGIN
  UPDATE products SET stock_quantity = stock_quantity + p_qty WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION resolve_mto_deposit_pct(p_product_id UUID)
RETURNS DECIMAL AS $$
DECLARE v_pct DECIMAL;
BEGIN
  SELECT mto_deposit_pct INTO v_pct FROM products WHERE id = p_product_id;
  IF v_pct IS NULL THEN
    SELECT (value::text)::decimal INTO v_pct FROM app_settings WHERE key = 'mto_default_deposit_pct';
  END IF;
  RETURN COALESCE(v_pct, 50);
END;
$$ LANGUAGE plpgsql;
