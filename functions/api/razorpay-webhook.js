export async function onRequestPost(context) {
  const { request, env } = context;

  try {
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
    const razorpayPaymentId = payment?.id || "";

    if (!razorpayOrderId) {
      return jsonResponse({
        success: true,
        message: "Webhook ignored. No Razorpay order ID found."
      });
    }

    if (eventType === "payment.captured" || eventType === "order.paid") {
      await updateRegistrationIfExists(env, razorpayOrderId, {
        payment_status: "PAID_CONFIRMED",
        razorpay_payment_id: razorpayPaymentId || undefined,
        webhook_event: eventType,
        payment_captured_at: new Date().toISOString()
      });

      return jsonResponse({
        success: true,
        message: "Webhook processed."
      });
    }

    if (eventType === "payment.failed") {
      await updateRegistrationIfExists(env, razorpayOrderId, {
        payment_status: "FAILED",
        razorpay_payment_id: razorpayPaymentId || undefined,
        webhook_event: eventType
      });

      return jsonResponse({
        success: true,
        message: "Payment failure webhook processed."
      });
    }

    return jsonResponse({
      success: true,
      message: `Webhook event ignored: ${eventType}`
    });

  } catch (error) {
    return jsonResponse({
      success: false,
      error: "Webhook server error.",
      details: error.message
    }, 500);
  }
}

async function updateRegistrationIfExists(env, razorpayOrderId, data) {
  const cleanData = {};

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== "") {
      cleanData[key] = value;
    }
  }

  const res = await fetch(supabaseRestUrl(env, `registrations?razorpay_order_id=eq.${encodeURIComponent(razorpayOrderId)}`), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify(cleanData)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase webhook update failed: ${text}`);
  }
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
