const PRICE_PER_ITEM = 70000; // ₹700 in paise

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

    if (!registration_id || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !registration) {
      return jsonResponse({ success: false, error: "Missing payment verification or registration data." }, 400);
    }

    const expectedAmount = getExpectedAmount(registration);

    if (!expectedAmount || expectedAmount < PRICE_PER_ITEM) {
      return jsonResponse({ success: false, error: "Could not calculate expected payment amount from cart data." }, 400);
    }

    // 1. Verify Razorpay checkout signature
    const expectedSignature = await hmacSha256Hex(
      `${razorpay_order_id}|${razorpay_payment_id}`,
      env.RAZORPAY_KEY_SECRET
    );

    if (!timingSafeEqual(expectedSignature, razorpay_signature)) {
      return jsonResponse({ success: false, error: "Invalid Razorpay signature. Payment not verified." }, 400);
    }

    // 2. Fetch payment from Razorpay to confirm real status and amount
    let payment = await fetchRazorpayPayment(env, razorpay_payment_id);

    if (payment.order_id !== razorpay_order_id) {
      return jsonResponse({ success: false, error: "Payment order mismatch." }, 400);
    }

    if (payment.amount !== expectedAmount || payment.currency !== "INR") {
      return jsonResponse({
        success: false,
        error: "Invalid payment amount or currency.",
        expected_amount: expectedAmount,
        actual_amount: payment.amount,
        currency: payment.currency
      }, 400);
    }

    // 3. If payment is authorized but not captured, capture exact dynamic amount
    if (payment.status === "authorized") {
      payment = await captureRazorpayPayment(env, razorpay_payment_id, expectedAmount);
    }

    if (payment.status !== "captured") {
      return jsonResponse({ success: false, error: `Payment is not captured. Current status: ${payment.status}` }, 400);
    }

    // 4. Prevent duplicate storage
    const existing = await findExistingRegistration(env, razorpay_order_id, razorpay_payment_id);

    if (existing.length > 0) {
      return jsonResponse({
        success: true,
        already_confirmed: true,
        message: "Payment already verified and registration already stored.",
        registration_id: existing[0].id
      });
    }

    // 5. Store participant data only after payment verification
    const row = buildRegistrationRow({
      registration_id,
      razorpay_order_id,
      razorpay_payment_id,
      registration,
      payment
    });

    const insertRes = await fetch(supabaseRestUrl(env, "registrations"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Prefer": "return=representation"
      },
      body: JSON.stringify(row)
    });

    const insertText = await insertRes.text();

    if (!insertRes.ok) {
      return jsonResponse({
        success: false,
        error: "Payment verified, but Supabase storage failed.",
        details: insertText
      }, 500);
    }

    return jsonResponse({
      success: true,
      message: "Payment verified and registration stored successfully.",
      registration: JSON.parse(insertText)[0]
    });
  } catch (error) {
    return jsonResponse({ success: false, error: "Verification server error.", details: error.message }, 500);
  }
}

function getExpectedAmount(registration) {
  if (Number.isFinite(Number(registration.amount)) && Number(registration.amount) > 0) {
    return Number(registration.amount);
  }

  if (Array.isArray(registration.cart_items) && registration.cart_items.length > 0) {
    return registration.cart_items.length * PRICE_PER_ITEM;
  }

  if (Number.isFinite(Number(registration.cart_count)) && Number(registration.cart_count) > 0) {
    return Number(registration.cart_count) * PRICE_PER_ITEM;
  }

  return 0;
}

function buildRegistrationRow({ registration_id, razorpay_order_id, razorpay_payment_id, registration, payment }) {
  const selectedOptions = {};

  for (const [key, value] of Object.entries(registration)) {
    if (Array.isArray(value)) {
      selectedOptions[key] = value;
    }
  }

  return {
    id: registration_id,
    participant_name: registration.participant_name || "",
    dob: registration.dob || null,
    age: registration.age || null,
    school: registration.school || "",
    contact: registration.contact || "",
    email: registration.email || "",
    id_number: registration.id_number || "",
    age_group: registration.age_group || "",
    gender: registration.gender || "",
    arena: registration.arena || "",
    event: registration.event || "",
    category_slug: slugify(registration.event || ""),
    selected_options: selectedOptions,
    form_data: registration,
    amount: payment.amount,
    currency: payment.currency,
    razorpay_order_id,
    razorpay_payment_id,
    payment_status: "PAID_CONFIRMED",
    payment_method: payment.method || "",
    payment_captured_at: new Date().toISOString(),
    created_at: new Date().toISOString()
  };
}

async function fetchRazorpayPayment(env, paymentId) {
  const razorpayAuth = btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`);

  const res = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
    method: "GET",
    headers: { "Authorization": `Basic ${razorpayAuth}` }
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
    body: JSON.stringify({ amount, currency: "INR" })
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(`Unable to capture Razorpay payment: ${JSON.stringify(data)}`);
  }

  return data;
}

async function findExistingRegistration(env, orderId, paymentId) {
  const url = supabaseRestUrl(
    env,
    `registrations?select=id,razorpay_order_id,razorpay_payment_id&or=(razorpay_order_id.eq.${encodeURIComponent(orderId)},razorpay_payment_id.eq.${encodeURIComponent(paymentId)})`
  );

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
    }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase duplicate check failed: ${text}`);
  }

  return await res.json();
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

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));

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

export async function onRequestOptions() {
  return corsPreflight();
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders() });
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
  return new Response(null, { status: 204, headers: corsHeaders() });
}

function supabaseRestUrl(env, path) {
  const baseUrl = String(env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const cleanPath = String(path || "").replace(/^\/+/, "");
  return `${baseUrl}/rest/v1/${cleanPath}`;
}
