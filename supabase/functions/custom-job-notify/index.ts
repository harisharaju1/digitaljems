/**
 * Supabase Edge Function: Custom Job Notify
 *
 * Sends a Resend email when a custom job status changes or a milestone is completed.
 * Invoked by Postgres AFTER UPDATE triggers via pg_net.http_post.
 *
 * Deploy with: supabase functions deploy custom-job-notify
 *
 * Required secrets (set in Supabase dashboard):
 * - RESEND_API_KEY
 * - SUPABASE_URL       (auto-provided)
 * - SUPABASE_SERVICE_ROLE_KEY (auto-provided)
 */

// CONCEPT: serve() — Deno's HTTP server entry point for Supabase Edge Functions
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CONCEPT: CORS preflight — browsers send OPTIONS before cross-origin POSTs
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifyPayload {
  job_id: string;
  event: "status_change" | "milestone_completed";
}

const JOB_STATUS_LABELS: Record<string, string> = {
  intake: "Intake",
  design: "In Design",
  quoted: "Quote Sent",
  approved: "Approved",
  deposit_pending: "Deposit Pending",
  in_production: "In Production",
  qc: "Quality Check",
  ready_for_dispatch: "Ready to Ship",
  dispatched: "Dispatched",
  delivered: "Delivered",
  cancelled: "Cancelled",
  on_hold: "On Hold",
};

const MILESTONE_LABELS: Record<string, string> = {
  design_approved: "Design Approved",
  cad_ready: "CAD Ready",
  wax_model: "Wax Model",
  casting: "Casting",
  stone_setting: "Stone Setting",
  finishing: "Finishing",
  qc: "Quality Check",
  ready: "Ready for Delivery",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload: NotifyPayload = await req.json();
    const { job_id, event } = payload;

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");

    // Use service role to bypass RLS — this runs server-side only
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Load job + milestones
    const { data: job, error: jobErr } = await supabase
      .from("custom_jobs")
      .select("*, custom_job_milestones(*)")
      .eq("id", job_id)
      .single();

    if (jobErr || !job) {
      console.error("Job not found:", job_id, jobErr);
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trackingUrl = `${Deno.env.get("SITE_URL") ?? supabaseUrl.replace("supabase.co", "vercel.app")}/track/${job.tracking_token}`;
    const customerEmail: string = job.customer_email;
    const customerName: string = job.customer_name ?? customerEmail;
    const jobStatus: string = JOB_STATUS_LABELS[job.status] ?? job.status;

    // Find the most recently completed milestone for photo embed
    const milestones: Array<{ milestone: string; status: string; photos: string[]; completed_at: string }> =
      (job.custom_job_milestones ?? []).sort(
        (a: { completed_at: string }, b: { completed_at: string }) =>
          (b.completed_at ?? "").localeCompare(a.completed_at ?? "")
      );

    const latestDone = milestones.find((m) => m.status === "done");
    const latestMilestoneLabel = latestDone ? MILESTONE_LABELS[latestDone.milestone] ?? latestDone.milestone : null;
    const photoUrl: string | null = latestDone?.photos?.[0] ?? null;

    const subject =
      event === "status_change"
        ? `Your order ${job.job_number} — status: ${jobStatus}`
        : `Update on ${job.job_number}: ${latestMilestoneLabel ?? "Milestone completed"}`;

    const photoHtml = photoUrl
      ? `<div style="margin: 20px 0;">
           <img src="${photoUrl}" alt="Milestone update photo"
                style="max-width: 100%; border-radius: 8px; border: 1px solid #eee;" />
         </div>`
      : "";

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>${subject}</title></head>
      <body style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #D4A84B; margin-bottom: 4px;">DJewel Boutique</h1>
          <p style="color: #666; margin: 0; font-size: 14px;">Premium Jewellery at Factory Prices</p>
        </div>

        <div style="background: #fafafa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <p style="margin: 0 0 8px;">Hi ${customerName},</p>
          ${
            event === "status_change"
              ? `<p style="margin: 0;">Your order <strong>${job.job_number}</strong> (${job.title}) has moved to <strong>${jobStatus}</strong>.</p>`
              : `<p style="margin: 0;">A new milestone has been completed on your order <strong>${job.job_number}</strong>: <strong>${latestMilestoneLabel}</strong>.</p>`
          }
        </div>

        ${photoHtml}

        ${
          job.estimated_ready_date
            ? `<p style="font-size: 14px; color: #555;">
                 Estimated ready date: <strong>${new Date(job.estimated_ready_date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</strong>
               </p>`
            : ""
        }

        <div style="margin: 24px 0; text-align: center;">
          <a href="${trackingUrl}"
             style="background: #D4A84B; color: white; padding: 12px 28px; border-radius: 6px;
                    text-decoration: none; font-weight: bold; display: inline-block;">
            Track Your Order
          </a>
        </div>

        <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #eee;
                    text-align: center; color: #999; font-size: 12px;">
          <p>Questions? Contact us at support@djewelboutique.com</p>
          <p>&copy; ${new Date().getFullYear()} DJewel Boutique. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "DJewel Boutique <orders@djewelboutique.com>",
        to: customerEmail,
        subject,
        html: emailHtml,
      }),
    });

    if (!resendResponse.ok) {
      const errData = await resendResponse.json();
      throw new Error(errData.message ?? "Resend error");
    }

    const result = await resendResponse.json();

    return new Response(JSON.stringify({ success: true, id: result.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("custom-job-notify error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
