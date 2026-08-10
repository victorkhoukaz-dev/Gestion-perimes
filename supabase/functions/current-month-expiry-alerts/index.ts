import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type AlertSetting = {
  pharmacy_id: string;
  current_month_expiry_enabled: boolean;
  timezone: string;
};

type FlaggedProduct = {
  product: string;
  section: string;
  quantity: string;
};

type Pharmacy = { name: string };
type Profile = { email: string | null };

const corsHeaders = { "content-type": "application/json; charset=utf-8" };

function localDateParts(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "";
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour") };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;",
  }[character] || character));
}

function monthName(month: string) {
  return ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][Number(month)] || month;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: corsHeaders });
  }

  const jobSecret = Deno.env.get("ALERT_JOB_SECRET");
  if (!jobSecret || request.headers.get("x-alert-job-secret") !== jobSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const emailFrom = Deno.env.get("EMAIL_FROM");
  const appUrl = Deno.env.get("APP_URL");

  if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !emailFrom) {
    return new Response(JSON.stringify({ error: "Missing required Edge Function secrets" }), { status: 500, headers: corsHeaders });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: settings, error: settingsError } = await admin
    .from("email_alert_settings")
    .select("pharmacy_id, current_month_expiry_enabled, timezone")
    .eq("current_month_expiry_enabled", true);

  if (settingsError) throw settingsError;

  const result = { pharmaciesChecked: 0, emailsSent: 0, skipped: 0, failures: [] as string[] };

  for (const setting of (settings || []) as AlertSetting[]) {
    const local = localDateParts(setting.timezone);
    if (local.hour !== "08") {
      result.skipped++;
      continue;
    }

    result.pharmaciesChecked++;
    const monthKey = `${local.year}-${local.month}`;
    const localAlertDate = `${local.year}-${local.month}-${local.day}`;

    const [{ data: pharmacy, error: pharmacyError }, { data: products, error: productsError }, { data: owners, error: ownersError }] = await Promise.all([
      admin.from("pharmacies").select("name").eq("id", setting.pharmacy_id).single(),
      admin.from("flagged_products").select("product, section, quantity").eq("pharmacy_id", setting.pharmacy_id).eq("status", "active").eq("expiry_date", monthKey),
      admin.from("profiles").select("email").eq("pharmacy_id", setting.pharmacy_id).in("role", ["owner", "admin"]),
    ]);

    if (pharmacyError || productsError || ownersError) {
      result.failures.push(`Unable to load alert data for pharmacy ${setting.pharmacy_id}`);
      continue;
    }

    const activeProducts = (products || []) as FlaggedProduct[];
    if (activeProducts.length === 0) continue;

    const recipients = [...new Set(((owners || []) as Profile[]).map((owner) => owner.email?.trim().toLowerCase()).filter(Boolean))] as string[];
    if (recipients.length === 0) {
      result.failures.push(`No owner email found for pharmacy ${setting.pharmacy_id}`);
      continue;
    }

    const pharmacyName = escapeHtml((pharmacy as Pharmacy).name);
    const previewRows = activeProducts.slice(0, 20).map((product) => `<li><strong>${escapeHtml(product.product)}</strong> — ${escapeHtml(product.section)}${product.quantity ? ` (Qty: ${escapeHtml(product.quantity)})` : ""}</li>`).join("");
    const remaining = activeProducts.length - Math.min(activeProducts.length, 20);
    const emailHtml = `
      <h2>Action required: products expiring in ${monthName(local.month)} ${local.year}</h2>
      <p><strong>${activeProducts.length}</strong> active flagged product${activeProducts.length === 1 ? "" : "s"} still need to be removed from shelves for <strong>${pharmacyName}</strong>.</p>
      <ul>${previewRows}</ul>
      ${remaining > 0 ? `<p>Plus ${remaining} additional product${remaining === 1 ? "" : "s"} in PharmaOps.</p>` : ""}
      ${appUrl ? `<p><a href="${escapeHtml(appUrl)}">Open PharmaOps</a></p>` : ""}
    `;

    for (const recipientEmail of recipients) {
      const { data: alreadySent } = await admin
        .from("email_alert_deliveries")
        .select("id")
        .eq("pharmacy_id", setting.pharmacy_id)
        .eq("alert_type", "current_month_expiry")
        .eq("local_alert_date", localAlertDate)
        .eq("recipient_email", recipientEmail)
        .maybeSingle();

      if (alreadySent) {
        result.skipped++;
        continue;
      }

      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendApiKey}` },
        body: JSON.stringify({
          from: emailFrom,
          to: [recipientEmail],
          subject: `[PharmaOps] ${activeProducts.length} product${activeProducts.length === 1 ? "" : "s"} expiring this month`,
          html: emailHtml,
        }),
      });

      if (!resendResponse.ok) {
        result.failures.push(`Email provider rejected delivery to ${recipientEmail}`);
        continue;
      }

      const providerData = await resendResponse.json().catch(() => ({}));
      const { error: deliveryError } = await admin.from("email_alert_deliveries").insert({
        pharmacy_id: setting.pharmacy_id,
        alert_type: "current_month_expiry",
        local_alert_date: localAlertDate,
        recipient_email: recipientEmail,
        provider_message_id: providerData.id || null,
      });

      if (deliveryError) {
        result.failures.push(`Email sent but delivery log failed for ${recipientEmail}`);
        continue;
      }

      result.emailsSent++;
    }
  }

  return new Response(JSON.stringify(result), { headers: corsHeaders });
});
