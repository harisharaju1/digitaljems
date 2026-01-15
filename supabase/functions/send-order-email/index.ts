/**
 * Supabase Edge Function: Send Order Email
 * 
 * This function sends order confirmation emails via Resend.
 * Deploy with: supabase functions deploy send-order-email
 * 
 * Required secrets (set in Supabase dashboard):
 * - RESEND_API_KEY
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OrderEmailData {
  to: string;
  customerName: string;
  orderNumber: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  subtotal: number;
  shipping: number;
  total: number;
  shippingAddress: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const data: OrderEmailData = await req.json();

    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      throw new Error("Resend API key not configured");
    }

    // Generate order items HTML
    const itemsHtml = data.items
      .map(
        (item) => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #eee;">${item.name}</td>
          <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
          <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">₹${item.price.toLocaleString("en-IN")}</td>
        </tr>
      `
      )
      .join("");

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Order Confirmation</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #D4A84B; margin-bottom: 5px;">DJewel Boutique</h1>
          <p style="color: #666; margin: 0;">Premium Jewellery at Factory Prices</p>
        </div>
        
        <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="margin-top: 0; color: #333;">Thank you for your order, ${data.customerName}!</h2>
          <p>Your order <strong>#${data.orderNumber}</strong> has been confirmed.</p>
        </div>
        
        <h3>Order Details</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr style="background: #f5f5f5;">
              <th style="padding: 12px; text-align: left;">Item</th>
              <th style="padding: 12px; text-align: center;">Qty</th>
              <th style="padding: 12px; text-align: right;">Price</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2" style="padding: 12px; text-align: right;">Subtotal:</td>
              <td style="padding: 12px; text-align: right;">₹${data.subtotal.toLocaleString("en-IN")}</td>
            </tr>
            <tr>
              <td colspan="2" style="padding: 12px; text-align: right;">Shipping:</td>
              <td style="padding: 12px; text-align: right;">₹${data.shipping.toLocaleString("en-IN")}</td>
            </tr>
            <tr style="font-weight: bold; font-size: 1.1em;">
              <td colspan="2" style="padding: 12px; text-align: right;">Total:</td>
              <td style="padding: 12px; text-align: right; color: #D4A84B;">₹${data.total.toLocaleString("en-IN")}</td>
            </tr>
          </tfoot>
        </table>
        
        <h3>Shipping Address</h3>
        <p style="background: #f9f9f9; padding: 15px; border-radius: 8px;">
          ${data.shippingAddress.line1}<br>
          ${data.shippingAddress.line2 ? data.shippingAddress.line2 + "<br>" : ""}
          ${data.shippingAddress.city}, ${data.shippingAddress.state} ${data.shippingAddress.pincode}
        </p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #666; font-size: 0.9em;">
          <p>Questions? Contact us at support@djewelboutique.com</p>
          <p>&copy; ${new Date().getFullYear()} DJewel Boutique. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "DJewel Boutique <orders@djewelboutique.com>",
        to: data.to,
        subject: `Order Confirmed - #${data.orderNumber}`,
        html: emailHtml,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to send email");
    }

    const result = await response.json();

    return new Response(
      JSON.stringify({ success: true, id: result.id }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
