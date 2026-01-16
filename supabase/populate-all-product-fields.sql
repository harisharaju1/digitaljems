-- SQL Query: Populate ALL product fields with sample values for testing
-- Run this in Supabase SQL Editor to add sample data to ALL existing products

-- Step 1: Add columns if they don't exist
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

-- Step 2: Update ALL products with sample values for ALL fields in one query
UPDATE products
SET 
  -- Dimensions based on product category
  width_mm = COALESCE(width_mm, CASE 
    WHEN category = 'ring' THEN 2.0
    WHEN category = 'necklace' THEN 45.0
    WHEN category = 'earring' THEN 8.0
    WHEN category = 'bracelet' THEN 60.0
    WHEN category = 'pendant' THEN 25.0
    WHEN category = 'chain' THEN 50.0
    WHEN category = 'bangle' THEN 70.0
    WHEN category = 'anklet' THEN 30.0
    ELSE 2.0
  END),
  
  height_mm = COALESCE(height_mm, CASE 
    WHEN category = 'ring' THEN 1.7
    WHEN category = 'necklace' THEN 3.0
    WHEN category = 'earring' THEN 12.0
    WHEN category = 'bracelet' THEN 2.5
    WHEN category = 'pendant' THEN 35.0
    WHEN category = 'chain' THEN 2.0
    WHEN category = 'bangle' THEN 2.5
    WHEN category = 'anklet' THEN 2.0
    ELSE 1.7
  END),
  
  length_mm = COALESCE(length_mm, 0),
  
  -- Gross weight is 15% more than net weight
  gross_weight_grams = COALESCE(gross_weight_grams, ROUND((weight_grams * 1.15)::numeric, 2)),
  
  -- Stone data: Add to 80% of products for testing (ensures Diamond section shows)
  stone_weight = COALESCE(stone_weight, 
    CASE 
      WHEN (ABS(HASHTEXT(id::text)) % 10) < 8 THEN 
        ROUND((0.01 + (ABS(HASHTEXT(id::text)) % 50) * 0.01)::numeric, 3)
      ELSE NULL
    END
  ),
  
  stone_quality = COALESCE(stone_quality,
    CASE 
      WHEN stone_weight IS NOT NULL AND stone_weight > 0 THEN 'FG-SI'
      WHEN (ABS(HASHTEXT(id::text)) % 10) < 8 THEN 'FG-SI'
      ELSE NULL
    END
  ),
  
  stone_grade = COALESCE(stone_grade,
    CASE 
      WHEN stone_quality IS NOT NULL THEN 'SI'
      ELSE NULL
    END
  ),
  
  stone_setting = COALESCE(stone_setting,
    CASE 
      WHEN stone_quality IS NOT NULL THEN 'Hand Setting'
      ELSE NULL
    END
  ),
  
  stone_count = COALESCE(stone_count,
    CASE 
      WHEN stone_weight IS NOT NULL AND stone_weight > 0 THEN 
        CASE 
          WHEN stone_weight < 0.1 THEN 1
          WHEN stone_weight < 0.3 THEN 3
          WHEN stone_weight < 0.5 THEN 5
          ELSE 7
        END
      WHEN stone_quality IS NOT NULL THEN 
        (1 + (ABS(HASHTEXT(id::text)) % 5))
      ELSE NULL
    END
  ),
  
  -- Generate SKU (format: JR#####-C###)
  sku = COALESCE(sku, 
    'JR' || 
    LPAD((ABS(HASHTEXT(id::text)) % 99999)::text, 5, '0') || 
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
    LPAD((ABS(HASHTEXT(id::text)) % 999)::text, 3, '0')
  ),
  
  -- Generate short description
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
  );

-- Step 3: Verify the update - show sample results
SELECT 
  id,
  name,
  category,
  -- Dimensions
  width_mm,
  height_mm,
  length_mm,
  gross_weight_grams,
  -- Stone fields
  stone_weight,
  stone_quality,
  stone_grade,
  stone_setting,
  stone_count,
  -- Other fields
  sku,
  short_description
FROM products 
ORDER BY created_at DESC
LIMIT 10;

-- Step 4: Show statistics
SELECT 
  COUNT(*) as total_products,
  COUNT(width_mm) as has_width,
  COUNT(height_mm) as has_height,
  COUNT(gross_weight_grams) as has_gross_weight,
  COUNT(stone_quality) as has_stones,
  COUNT(sku) as has_sku,
  COUNT(short_description) as has_short_desc
FROM products;
