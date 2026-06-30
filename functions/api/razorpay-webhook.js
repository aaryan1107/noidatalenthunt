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

    const pending = await findRegistrationByOrderId(env, razorpayOrderId);
    if (!pending) {
      return jsonResponse({
        success: true,
        handled: true,
        matched: false,
        event: eventType,
        razorpay_order_id: razorpayOrderId,
        message: "Webhook processed, but no matching registration row was found."
      });
    }

    if (
      (pending.payment_status === "PAID_CONFIRMED" || pending.payment_status === "PAID_CONFIRMED_MANUAL") &&
      patch.payment_status !== "PAID_CONFIRMED"
    ) {
      return jsonResponse({
        success: true,
        handled: true,
        matched: true,
        event: eventType,
        razorpay_order_id: razorpayOrderId,
        message: "Webhook ignored because registration is already confirmed."
      });
    }

    const guard = validatePaymentPatch(patch, pending);
    if (!guard.valid) {
      return jsonResponse({
        success: false,
        error: guard.error,
        expected_amount: guard.expected_amount,
        actual_amount: guard.actual_amount,
        expected_currency: guard.expected_currency,
        actual_currency: guard.actual_currency
      }, 400);
    }

    const rows = await updateRegistration(env, pending.id, patch);

    return jsonResponse({
      success: true,
      handled: true,
      matched: rows.length > 0,
      event: eventType,
      razorpay_order_id: razorpayOrderId,
      message: "Webhook processed and registration updated."
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

function validatePaymentPatch(patch, pending) {
  const hasPaymentAmount = patch.amount !== undefined || patch.currency !== undefined;
  if (!hasPaymentAmount) return { valid: true };

  const expectedAmount = Number(pending.amount);
  const actualAmount = Number(patch.amount);
  const expectedCurrency = String(pending.currency || "INR").toUpperCase();
  const actualCurrency = String(patch.currency || "").toUpperCase();

  if (
    !Number.isFinite(expectedAmount) ||
    !Number.isFinite(actualAmount) ||
    actualAmount !== expectedAmount ||
    actualCurrency !== expectedCurrency
  ) {
    return {
      valid: false,
      error: "Webhook payment amount or currency does not match pending registration.",
      expected_amount: expectedAmount,
      actual_amount: actualAmount,
      expected_currency: expectedCurrency,
      actual_currency: actualCurrency
    };
  }

  return { valid: true };
}

async function findRegistrationByOrderId(env, razorpayOrderId) {
  const res = await fetch(supabaseRestUrl(env, `registrations?select=*&razorpay_order_id=eq.${encodeURIComponent(razorpayOrderId)}&limit=1`), {
    method: "GET",
    headers: {
      "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
    }
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Supabase webhook lookup failed: ${text}`);
  }

  const rows = text ? JSON.parse(text) : [];
  return rows[0] || null;
}

async function updateRegistration(env, registrationId, data) {
  const res = await fetch(supabaseRestUrl(env, `registrations?id=eq.${encodeURIComponent(registrationId)}`), {
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
