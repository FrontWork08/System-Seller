import { createClient } from "npm:@supabase/supabase-js@2.116.0";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const auth = req.headers.get("authorization");
  if (!auth) return json({ error: "authentication_required" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const publishable = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}").default;
  const secret = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default;
  if (!publishable || !secret) return json({ error: "supabase_keys_unavailable" }, 500);

  const userClient = createClient(url, publishable, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const admin = createClient(url, secret, { auth: { persistSession: false } });

  let body: { outbox_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  if (!body.outbox_id) return json({ error: "outbox_id_required" }, 400);

  const { data: row, error: readError } = await userClient
    .from("email_outbox")
    .select("*")
    .eq("id", body.outbox_id)
    .single();
  if (readError || !row) return json({ error: "email_not_found_or_forbidden" }, 404);
  if (row.status === "sent") {
    return json({ status: "sent", id: row.id, provider_message_id: row.provider_message_id });
  }

  const apiKey = Deno.env.get("BREVO_API_KEY");
  if (!apiKey) {
    await admin.from("email_outbox").update({
      status: "failed",
      attempts: Number(row.attempts || 0) + 1,
      last_error: "BREVO_API_KEY not configured",
      updated_at: new Date().toISOString(),
    }).eq("id", row.id);
    return json({ error: "email_provider_not_configured" }, 503);
  }

  const senderEmail = Deno.env.get("BREVO_SENDER_EMAIL") || "frontwork08@gmail.com";
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "content-type": "application/json", "api-key": apiKey, accept: "application/json" },
    body: JSON.stringify({
      sender: { name: "System Seller", email: senderEmail },
      to: [{ email: row.recipient }],
      subject: row.subject,
      textContent: row.body,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorText = String(payload?.message || `Brevo HTTP ${response.status}`).slice(0, 1000);
    await admin.from("email_outbox").update({
      status: "failed",
      attempts: Number(row.attempts || 0) + 1,
      last_error: errorText,
      updated_at: new Date().toISOString(),
    }).eq("id", row.id);
    await admin.from("notifications").upsert({
      organization_id: row.organization_id,
      event_type: "failed_email",
      entity_type: row.related_type || "email",
      entity_id: row.related_id ? String(row.related_id) : String(row.id),
      dedupe_key: `failed-email:${row.id}:${Number(row.attempts || 0) + 1}`,
      title: "Falha no envio de e-mail",
      body: errorText,
      severity: "danger",
    }, { onConflict: "organization_id,dedupe_key" });
    return json({ error: "provider_error", detail: errorText }, 502);
  }

  await admin.from("email_outbox").update({
    status: "sent",
    attempts: Number(row.attempts || 0) + 1,
    last_error: null,
    provider_message_id: payload?.messageId || null,
    sent_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", row.id);

  return json({ status: "sent", id: row.id, provider_message_id: payload?.messageId || null });
});
