/**
 * Seed script to add sample products to Supabase database
 * Run with: npx tsx scripts/seed-products.ts
 *
 * Reads from .env file in project root
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env file
const envPath = resolve(process.cwd(), ".env");
try {
  const envContent = readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const [key, ...valueParts] = line.split("=");
    if (key && !key.startsWith("#")) {
      process.env[key.trim()] = valueParts.join("=").trim();
    }
  });
} catch {
  console.error("❌ Could not read .env file");
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || "";

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    "❌ Please set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const sampleProducts = [
  {
    name: "Eternal Rose Gold Diamond Ring",
    description:
      "Stunning 18K rose gold ring featuring a brilliant-cut diamond centerpiece surrounded by delicate pavé diamonds. Perfect for engagements or special occasions.",
    category: "ring",
    metal_type: "rose_gold",
    metal_purity: "18k",
    weight_grams: 4.5,
    price: 85000,
    mrp: 102000,
    making_charges_saved: 17000,
    images: JSON.stringify([
      "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=800",
      "https://images.unsplash.com/photo-1603561591411-07134e71a2a9?w=800",
    ]),
    stock_quantity: 5,
    is_active: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    name: "Classic Gold Chain Necklace",
    description:
      "Elegant 22K gold chain necklace with intricate link pattern. A timeless piece that complements any outfit.",
    category: "chain",
    metal_type: "gold",
    metal_purity: "22k",
    weight_grams: 15.0,
    price: 125000,
    mrp: 150000,
    making_charges_saved: 25000,
    images: JSON.stringify([
      "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=800",
      "https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=800",
    ]),
    stock_quantity: 8,
    is_active: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    name: "Pearl Drop Earrings",
    description:
      "Exquisite 18K gold earrings featuring lustrous freshwater pearls with diamond accents. Perfect for evening wear.",
    category: "earring",
    metal_type: "gold",
    metal_purity: "18k",
    weight_grams: 6.2,
    price: 45000,
    mrp: 54000,
    making_charges_saved: 9000,
    images: JSON.stringify([
      "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800",
      "https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?w=800",
    ]),
    stock_quantity: 12,
    is_active: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    name: "Diamond Tennis Bracelet",
    description:
      "Stunning platinum bracelet featuring 40 round brilliant diamonds in a classic tennis style. A statement piece for any occasion.",
    category: "bracelet",
    metal_type: "platinum",
    metal_purity: "950_platinum",
    weight_grams: 18.5,
    price: 350000,
    mrp: 420000,
    making_charges_saved: 70000,
    images: JSON.stringify([
      "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=800",
      "https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=800",
    ]),
    stock_quantity: 3,
    is_active: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    name: "Floral Gold Pendant",
    description:
      "Delicate 22K gold pendant with intricate floral design and tiny diamond accents. Comes with matching chain.",
    category: "pendant",
    metal_type: "gold",
    metal_purity: "22k",
    weight_grams: 8.0,
    price: 72000,
    mrp: 86400,
    making_charges_saved: 14400,
    images: JSON.stringify([
      "https://images.unsplash.com/photo-1599459183200-59c3a0e2b4d7?w=800",
      "https://images.unsplash.com/photo-1602173574767-37ac01994b2a?w=800",
    ]),
    stock_quantity: 7,
    is_active: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    name: "Traditional Gold Bangles Set",
    description:
      "Set of 4 stunning 22K gold bangles with traditional Indian design patterns. Perfect for weddings and festivals.",
    category: "bangle",
    metal_type: "gold",
    metal_purity: "22k",
    weight_grams: 48.0,
    price: 380000,
    mrp: 456000,
    making_charges_saved: 76000,
    images: JSON.stringify([
      "https://images.unsplash.com/photo-1601121141461-9d6647bca1ed?w=800",
      "https://images.unsplash.com/photo-1535632787350-4e68ef0ac584?w=800",
    ]),
    stock_quantity: 4,
    is_active: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    name: "Silver Anklet with Bells",
    description:
      "Beautiful 925 sterling silver anklet with tiny bells and charm accents. Adjustable length for perfect fit.",
    category: "anklet",
    metal_type: "silver",
    metal_purity: "925_silver",
    weight_grams: 12.0,
    price: 4500,
    mrp: 5400,
    making_charges_saved: 900,
    images: JSON.stringify([
      "https://images.unsplash.com/photo-1611085583191-a3b181a88401?w=800",
    ]),
    stock_quantity: 20,
    is_active: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    name: "White Gold Solitaire Ring",
    description:
      "Elegant 18K white gold ring featuring a 0.5 carat round brilliant solitaire diamond in a classic six-prong setting.",
    category: "ring",
    metal_type: "white_gold",
    metal_purity: "18k",
    weight_grams: 3.8,
    price: 95000,
    mrp: 114000,
    making_charges_saved: 19000,
    images: JSON.stringify([
      "https://images.unsplash.com/photo-1588444837495-c6cfeb53f32d?w=800",
      "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=800",
    ]),
    stock_quantity: 6,
    is_active: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    name: "Layered Gold Necklace",
    description:
      "Modern 18K gold layered necklace with three delicate chains of varying lengths. Minimalist elegance for everyday wear.",
    category: "necklace",
    metal_type: "gold",
    metal_purity: "18k",
    weight_grams: 10.5,
    price: 88000,
    mrp: 105600,
    making_charges_saved: 17600,
    images: JSON.stringify([
      "https://images.unsplash.com/photo-1599643477877-530eb83abc8e?w=800",
      "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800",
    ]),
    stock_quantity: 9,
    is_active: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    name: "Diamond Stud Earrings",
    description:
      "Classic platinum diamond studs featuring 0.25 carat diamonds each. Timeless elegance for any occasion.",
    category: "earring",
    metal_type: "platinum",
    metal_purity: "950_platinum",
    weight_grams: 2.5,
    price: 65000,
    mrp: 78000,
    making_charges_saved: 13000,
    images: JSON.stringify([
      "https://images.unsplash.com/photo-1635767798638-3e25273a8236?w=800",
      "https://images.unsplash.com/photo-1629224316810-9d8805b95e76?w=800",
    ]),
    stock_quantity: 15,
    is_active: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

async function seedProducts() {
  console.log("🌱 Seeding products to Supabase database...\n");

  const { data, error } = await supabase
    .from("products")
    .insert(sampleProducts)
    .select();

  if (error) {
    console.error("❌ Failed to seed products:", error.message);
    process.exit(1);
  }

  console.log(`✅ Successfully added ${data.length} products!\n`);
  data.forEach((p) => console.log(`  - ${p.name}`));
  console.log("\n🎉 Seeding complete!");
}

seedProducts();
