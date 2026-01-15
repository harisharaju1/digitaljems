/**
 * Supabase Edge Function: Create Razorpay Order
 * 
 * This function creates a Razorpay order on the server side.
 * Deploy with: supabase functions deploy create-razorpay-order
 * 
 * Required secrets (set in Supabase dashboard):
 * - RAZORPAY_KEY_ID
 * - RAZORPAY_KEY_SECRET
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { amount, orderId } = await req.json();

    if (!amount || !orderId) {
      throw new Error("Missing required fields: amount, orderId");
    }

    const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID");
    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");

    if (!razorpayKeyId || !razorpayKeySecret) {
      throw new Error("Razorpay credentials not configured");
    }

    // Create Razorpay order using their API
    const authHeader = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
    
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${authHeader}`,
      },
      body: JSON.stringify({
        amount: amount, // Amount in paise
        currency: "INR",
        receipt: orderId,
        notes: {
          order_id: orderId,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.description || "Failed to create Razorpay order");
    }

    const razorpayOrder = await response.json();

    return new Response(
      JSON.stringify({ razorpayOrderId: razorpayOrder.id }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
