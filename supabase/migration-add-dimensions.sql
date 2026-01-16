-- Migration: Add dimensions and stone fields to products table
-- Run this in Supabase SQL Editor if you already have the products table

-- 1. Alter table to add columns (if they don't exist)
ALTER TABLE products ADD COLUMN IF NOT EXISTS width_mm DECIMAL(10,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS height_mm DECIMAL(10,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS length_mm DECIMAL(10,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS gross_weight_grams DECIMAL(10,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS stone_quality TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS stone_grade TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS stone_setting TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS stone_count INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS short_description TEXT;

-- 2. Add sample values to all existing products
-- This will add realistic sample data based on product category and existing weight
UPDATE products
SET 
  -- Dimensions based on category
  width_mm = CASE 
    WHEN category = 'ring' THEN 2.0
    WHEN category = 'necklace' THEN 45.0
    WHEN category = 'earring' THEN 8.0
    WHEN category = 'bracelet' THEN 60.0
    WHEN category = 'pendant' THEN 25.0
    WHEN category = 'chain' THEN 50.0
    WHEN category = 'bangle' THEN 70.0
    WHEN category = 'anklet' THEN 30.0
    ELSE 2.0
  END,
  height_mm = CASE 
    WHEN category = 'ring' THEN 1.7
    WHEN category = 'necklace' THEN 3.0
    WHEN category = 'earring' THEN 12.0
    WHEN category = 'bracelet' THEN 2.5
    WHEN category = 'pendant' THEN 35.0
    WHEN category = 'chain' THEN 2.0
    WHEN category = 'bangle' THEN 2.5
    WHEN category = 'anklet' THEN 2.0
    ELSE 1.7
  END,
  length_mm = CASE 
    WHEN category = 'ring' THEN 0
    WHEN category = 'necklace' THEN 0
    WHEN category = 'earring' THEN 0
    WHEN category = 'bracelet' THEN 0
    WHEN category = 'pendant' THEN 0
    WHEN category = 'chain' THEN 0
    WHEN category = 'bangle' THEN 0
    WHEN category = 'anklet' THEN 0
    ELSE 0
  END,
  -- Gross weight is typically 15-20% more than net weight
  gross_weight_grams = ROUND((weight_grams * 1.15)::numeric, 2),
  -- Stone quality and grade (only if stone_weight exists)
  stone_quality = CASE 
    WHEN stone_weight IS NOT NULL AND stone_weight > 0 THEN 'FG-SI'
    ELSE NULL
  END,
  stone_grade = CASE 
    WHEN stone_weight IS NOT NULL AND stone_weight > 0 THEN 'SI'
    ELSE NULL
  END,
  -- Stone setting (only if stone_weight exists)
  stone_setting = CASE 
    WHEN stone_weight IS NOT NULL AND stone_weight > 0 THEN 'Hand Setting'
    ELSE NULL
  END,
  -- Stone count (estimate based on stone_weight)
  stone_count = CASE 
    WHEN stone_weight IS NOT NULL AND stone_weight > 0 THEN 
      CASE 
        WHEN stone_weight < 0.1 THEN 1
        WHEN stone_weight < 0.5 THEN 3
        WHEN stone_weight < 1.0 THEN 5
        ELSE 7
      END
    ELSE NULL
  END,
  -- Generate SKU if not exists (format: JR + random 5 digits + category code)
  sku = COALESCE(sku, 
    'JR' || 
    LPAD(FLOOR(RANDOM() * 99999)::text, 5, '0') || 
    '-' ||
    CASE category
      WHEN 'ring' THEN 'R'
      WHEN 'necklace' THEN 'N'
      WHEN 'earring' THEN 'E'
      WHEN 'bracelet' THEN 'B'
      WHEN 'pendant' THEN 'P'
      WHEN 'chain' THEN 'C'
      WHEN 'bangle' THEN 'BG'
      WHEN 'anklet' THEN 'A'
      ELSE 'X'
    END ||
    LPAD(FLOOR(RANDOM() * 999)::text, 3, '0')
  ),
  -- Short description based on product details
  short_description = COALESCE(short_description,
    'Set in ' || 
    CASE 
      WHEN metal_purity LIKE '%k' THEN UPPER(REPLACE(metal_purity, 'k', ' KT'))
      ELSE UPPER(metal_purity)
    END || 
    ' ' || 
    INITCAP(REPLACE(metal_type, '_', ' ')) || 
    ' (' || weight_grams || ' g)' ||
    CASE 
      WHEN stone_weight IS NOT NULL AND stone_weight > 0 THEN 
        ' with diamonds (' || stone_weight || ' ct, ' || COALESCE(stone_quality, 'FG-SI') || ')'
      ELSE ''
    END
  )
WHERE 
  width_mm IS NULL 
  OR height_mm IS NULL 
  OR gross_weight_grams IS NULL
  OR (stone_weight IS NOT NULL AND stone_weight > 0 AND (stone_quality IS NULL OR stone_setting IS NULL OR stone_count IS NULL))
  OR sku IS NULL;

-- Verify the update
SELECT 
  id, 
  name, 
  width_mm, 
  height_mm, 
  length_mm, 
  gross_weight_grams, 
  stone_quality, 
  stone_grade, 
  stone_setting, 
  stone_count,
  sku,
  short_description
FROM products 
LIMIT 5;
