export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const missing = requiredEnv(env, [
      "RAZORPAY_WEBHOOK_SECRET",
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY"
    ]);

    if (missing.length > 0) {
      return jsonResponse({
        success: false,
        error: "Missing environment variables.",
        missing
      }, 500);
    }

    const rawBody = await request.text();
    const razorpaySignature = request.headers.get("x-razorpay-signature");

    if (!razorpaySignature) {
      return jsonResponse({
        success: false,
        error: "Missing Razorpay webhook signature."
      }, 400);
    }

    const expectedSignature = await hmacSha256Hex(rawBody, env.RAZORPAY_WEBHOOK_SECRET);

    if (!timingSafeEqual(expectedSignature, razorpaySignature)) {
      return jsonResponse({
        success: false,
        error: "Invalid webhook signature."
      }, 400);
    }

    const event = JSON.parse(rawBody);
    const eventType = event.event;
    const payment = event.payload?.payment?.entity || null;
    const order = event.payload?.order?.entity || null;
    const razorpayOrderId = payment?.order_id || order?.id || "";

    if (!razorpayOrderId) {
      return jsonResponse({
        success: true,
        handled: false,
        message: "Webhook ignored. No Razorpay order ID found."
      });
    }

    const patch = buildRegistrationPatch(eventType, payment, order);

    if (!patch) {
      return jsonResponse({
        success: true,
        handled: false,
        event: eventType,
        message: `Webhook event ignored: ${eventType}`
      });
    }

    const rows = await updateRegistrationIfExists(env, razorpayOrderId, patch);

    return jsonResponse({
      success: true,
      handled: true,
      matched: rows.length > 0,
      event: eventType,
      razorpay_order_id: razorpayOrderId,
      message: rows.length > 0
        ? "Webhook processed and registration updated."
        : "Webhook processed, but no matching registration row was found."
    });

  } catch (error) {
    return jsonResponse({
      success: false,
      error: "Webhook server error."
    }, 500);
  }
}

function buildRegistrationPatch(eventType, payment, order) {
  const patch = {
    razorpay_payment_id: payment?.id || undefined,
    amount: typeof payment?.amount === "number" ? payment.amount : undefined,
    currency: payment?.currency ? String(payment.currency).toUpperCase() : undefined,
    payment_method: payment?.method || undefined
  };

  if (eventType === "payment.captured" || eventType === "order.paid") {
    if (eventType === "order.paid" && typeof order?.amount_paid === "number") {
      patch.amount = order.amount_paid;
      patch.currency = order.currency ? String(order.currency).toUpperCase() : patch.currency;
    }

    patch.payment_status = "PAID_CONFIRMED";
    patch.payment_captured_at = new Date().toISOString();
    return cleanPatch(patch);
  }

  if (eventType === "payment.authorized") {
    patch.payment_status = "AUTHORIZED";
    return cleanPatch(patch);
  }

  if (eventType === "payment.failed") {
    patch.payment_status = "FAILED";
    patch.amount = typeof payment?.amount === "number" ? payment.amount : undefined;
    patch.currency = payment?.currency ? String(payment.currency).toUpperCase() : undefined;
    return cleanPatch(patch);
  }

  return null;
}

function cleanPatch(data) {
  const cleanData = {};

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== "") {
      cleanData[key] = value;
    }
  }

  return cleanData;
}

async function updateRegistrationIfExists(env, razorpayOrderId, data) {
  const res = await fetch(supabaseRestUrl(env, `registrations?razorpay_order_id=eq.${encodeURIComponent(razorpayOrderId)}`), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Prefer": "return=representation"
    },
    body: JSON.stringify(data)
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Supabase webhook update failed: ${text}`);
  }

  return text ? JSON.parse(text) : [];
}

async function hmacSha256Hex(message, secret) {
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message)
  );

  return [...new Uint8Array(signature)]
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

function requiredEnv(env, names) {
  return names.filter(name => !String(env[name] || "").trim());
}

export async function onRequestOptions() {
  return corsPreflight();
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders()
  });
}

function corsHeaders() {
  return {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-razorpay-signature"
  };
}

function corsPreflight() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
}

function supabaseRestUrl(env, path) {
  const baseUrl = String(env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const cleanPath = String(path || "").replace(/^\/+/, "");
  return `${baseUrl}/rest/v1/${cleanPath}`;
}
