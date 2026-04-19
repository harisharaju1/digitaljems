/**
 * Supabase Edge Function: MTO Quote
 *
 * Given a product_id and qty, returns pricing and lead-time for a made-to-order request.
 * Deploy with: supabase functions deploy mto-quote
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_DEPOSIT_PCT = 50;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { product_id, qty = 1 } = await req.json();

    if (!product_id) {
      return new Response(JSON.stringify({ error: "product_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // CONCEPT: resolve_mto_deposit_pct RPC — uses product-level override, falling back to app_settings global default
    const [{ data: product, error: pErr }, { data: pctRow }] = await Promise.all([
      supabase.from("products").select("price, mto_lead_time_weeks, mto_deposit_pct, allow_mto").eq("id", product_id).single(),
      supabase.from("app_settings").select("value").eq("key", "mto_default_deposit_pct").single(),
    ]);

    if (pErr || !product) {
      return new Response(JSON.stringify({ error: "Product not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!product.allow_mto) {
      return new Response(JSON.stringify({ error: "Product does not support MTO" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const depositPct: number = product.mto_deposit_pct
      ?? (pctRow ? Number(pctRow.value) : DEFAULT_DEPOSIT_PCT);

    const unitPrice: number = product.price;
    const totalPrice = unitPrice * qty;
    const depositAmount = Math.round(totalPrice * depositPct / 100);
    const finalAmount = totalPrice - depositAmount;
    const leadWeeks: number = product.mto_lead_time_weeks ?? 4;

    return new Response(
      JSON.stringify({ unit_price: unitPrice, total_price: totalPrice, deposit_amount: depositAmount, final_amount: finalAmount, lead_weeks: leadWeeks, deposit_pct: depositPct }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
