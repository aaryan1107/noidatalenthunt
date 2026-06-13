const PRICE_PER_ITEM = 70000; // Rs. 700 in paise

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();

    const {
      registration_id,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      registration
    } = body;

    if (
      !registration_id ||
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return jsonResponse({
        success: false,
        error: "Missing payment verification data."
      }, 400);
    }

    const missing = requiredEnv(env);
    if (missing.length > 0) {
      return jsonResponse({
        success: false,
        error: "Missing payment tracking environment variables.",
        missing
      }, 500);
    }

    const expectedSignature = await hmacSha256Hex(
      `${razorpay_order_id}|${razorpay_payment_id}`,
      env.RAZORPAY_KEY_SECRET
    );

    if (!timingSafeEqual(expectedSignature, razorpay_signature)) {
      return jsonResponse({
        success: false,
        error: "Invalid Razorpay signature. Payment not verified."
      }, 400);
    }

    let payment = await fetchRazorpayPayment(env, razorpay_payment_id);

    if (payment.order_id !== razorpay_order_id) {
      return jsonResponse({
        success: false,
        error: "Payment order mismatch."
      }, 400);
    }

    const existing = await findExistingRegistration(env, registration_id, razorpay_order_id, razorpay_payment_id);
    const pending = existing.find(row => row.id === registration_id) || existing[0] || null;
    const fallbackRegistration = registration || {};
    const expectedAmount = expectedAmountFor(pending, fallbackRegistration);
    const expectedCurrency = (pending?.currency || fallbackRegistration.currency || "INR").toUpperCase();

    if (payment.amount !== expectedAmount || payment.currency !== expectedCurrency) {
      return jsonResponse({
        success: false,
        error: "Invalid payment amount or currency.",
        expected_amount: expectedAmount,
        actual_amount: payment.amount,
        expected_currency: expectedCurrency,
        actual_currency: payment.currency
      }, 400);
    }

    if (pending?.payment_status === "PAID_CONFIRMED" && pending?.razorpay_payment_id === razorpay_payment_id) {
      return jsonResponse({
        success: true,
        already_confirmed: true,
        message: "Payment already verified and registration already stored.",
        registration_id: pending.id
      });
    }

    if (payment.status === "authorized") {
      payment = await captureRazorpayPayment(env, razorpay_payment_id, expectedAmount);
    }

    if (payment.status !== "captured") {
      return jsonResponse({
        success: false,
        error: `Payment is not captured. Current status: ${payment.status}`
      }, 400);
    }

    const row = buildPaidRegistrationRow({
      registration_id,
      razorpay_order_id,
      razorpay_payment_id,
      registration: pending?.form_data || fallbackRegistration,
      payment,
      pending
    });

    const saved = pending
      ? await updateRegistration(env, pending.id, row)
      : await insertRegistration(env, row);

    return jsonResponse({
      success: true,
      message: "Payment verified and registration stored successfully.",
      registration: saved
    });

  } catch (error) {
    return jsonResponse({
      success: false,
      error: "Verification server error.",
      details: error.message
    }, 500);
  }
}

function buildPaidRegistrationRow({ registration_id, razorpay_order_id, razorpay_payment_id, registration, payment, pending }) {
  const selectedOptions = pending?.selected_options || {};

  for (const [key, value] of Object.entries(registration || {})) {
    if (Array.isArray(value)) {
      selectedOptions[key] = value;
    }
  }

  return {
    id: registration_id,

    participant_name: registration.participant_name || pending?.participant_name || "",
    dob: registration.dob || pending?.dob || null,
    age: registration.age || pending?.age || null,
    school: registration.school || pending?.school || "",
    contact: registration.contact || pending?.contact || "",
    email: registration.email || pending?.email || "",
    id_number: registration.id_number || pending?.id_number || "",
    age_group: registration.age_group || pending?.age_group || "",
    gender: registration.gender || pending?.gender || "",

    arena: registration.arena || pending?.arena || "",
    event: registration.event || pending?.event || "",
    category_slug: pending?.category_slug || slugify(registration.event || pending?.event || ""),
    selected_options: selectedOptions,
    form_data: {
      ...(pending?.form_data || {}),
      ...(registration || {}),
      amount: payment.amount,
      currency: payment.currency,
      registration_id,
      razorpay_order_id,
      razorpay_payment_id
    },

    amount: payment.amount,
    currency: payment.currency,
    razorpay_order_id,
    razorpay_payment_id,
    payment_status: "PAID_CONFIRMED",
    payment_method: payment.method || "",
    payment_captured_at: new Date().toISOString()
  };
}

function expectedAmountFor(pending, registration) {
  if (Number.isFinite(Number(pending?.amount)) && Number(pending.amount) > 0) {
    return Number(pending.amount);
  }

  if (Number.isFinite(Number(registration?.amount)) && Number(registration.amount) > 0) {
    return Number(registration.amount);
  }

  if (Number.isFinite(Number(registration?.cart_count)) && Number(registration.cart_count) > 0) {
    return Number(registration.cart_count) * PRICE_PER_ITEM;
  }

  if (Array.isArray(registration?.cart_items) && registration.cart_items.length > 0) {
    return registration.cart_items.length * PRICE_PER_ITEM;
  }

  return PRICE_PER_ITEM;
}

async function fetchRazorpayPayment(env, paymentId) {
  const razorpayAuth = btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`);

  const res = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
    method: "GET",
    headers: {
      "Authorization": `Basic ${razorpayAuth}`
    }
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(`Unable to fetch Razorpay payment: ${JSON.stringify(data)}`);
  }

  return data;
}

async function captureRazorpayPayment(env, paymentId, amount) {
  const razorpayAuth = btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`);

  const res = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/capture`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Basic ${razorpayAuth}`
    },
    body: JSON.stringify({
      amount,
      currency: "INR"
    })
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(`Unable to capture Razorpay payment: ${JSON.stringify(data)}`);
  }

  return data;
}

async function findExistingRegistration(env, registrationId, orderId, paymentId) {
  const url = supabaseRestUrl(env, `registrations?select=*&or=(id.eq.${encodeURIComponent(registrationId)},razorpay_order_id.eq.${encodeURIComponent(orderId)},razorpay_payment_id.eq.${encodeURIComponent(paymentId)})`);

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
    }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase registration lookup failed: ${text}`);
  }

  return await res.json();
}

async function updateRegistration(env, id, row) {
  const res = await fetch(supabaseRestUrl(env, `registrations?id=eq.${encodeURIComponent(id)}`), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Prefer": "return=representation"
    },
    body: JSON.stringify(row)
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Supabase update failed: ${text}`);
  }

  return JSON.parse(text)[0];
}

async function insertRegistration(env, row) {
  const res = await fetch(supabaseRestUrl(env, "registrations"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Prefer": "return=representation"
    },
    body: JSON.stringify(row)
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Supabase insert failed: ${text}`);
  }

  return JSON.parse(text)[0];
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

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function requiredEnv(env) {
  const missing = [];
  if (!env.RAZORPAY_KEY_ID) missing.push("RAZORPAY_KEY_ID");
  if (!env.RAZORPAY_KEY_SECRET) missing.push("RAZORPAY_KEY_SECRET");
  if (!env.SUPABASE_URL) missing.push("SUPABASE_URL");
  if (!env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  return missing;
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
    "Access-Control-Allow-Headers": "Content-Type"
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
