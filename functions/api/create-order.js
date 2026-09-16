const PRICE_PER_ITEM = 10000; // Rs. 100 in paise
const REGISTRATION_TABLE = "registrations_october_2026";
const REGISTRATION_SESSION = "October 2026";
const OPEN_SPORTS_EVENTS = new Set([
  "badminton",
  "table-tennis",
  "chess",
  "swimming",
  "gymnastics",
  "shooting"
]);
const TRACKING_COLUMNS = [
  "id",
  "session_name",
  "participant_name",
  "dob",
  "age",
  "school",
  "address",
  "contact",
  "email",
  "id_number",
  "age_group",
  "gender",
  "arena",
  "event",
  "category_slug",
  "selected_events",
  "entry_type",
  "partner_name",
  "fide_id",
  "fide_rating",
  "swimming_group",
  "academy_name",
  "shooting_age_category",
  "shooting_entry_type",
  "team_member_names",
  "performance_requirement_details",
  "amount",
  "currency",
  "razorpay_order_id",
  "razorpay_payment_id",
  "payment_status",
  "payment_method",
  "created_at"
];

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();

    const participantName =
      body.participant_name ||
      body.participantName ||
      body.name ||
      "";

    const arena = body.arena || "";
    const eventName = body.event || "";
    const categorySlug = slugify(body.category_slug || body.categorySlug || eventName);

    if (!participantName || !eventName) {
      return jsonResponse({
        success: false,
        error: "Missing participant name or event."
      }, 400);
    }

    if (!OPEN_SPORTS_EVENTS.has(categorySlug)) {
      return jsonResponse({
        success: false,
        error: "Only sports registrations are open for the October 2026 session."
      }, 400);
    }

    const mobileNumber = normalizeMobileNumber(body.contact);
    if (!mobileNumber) {
      return jsonResponse({
        success: false,
        error: "Please enter a valid 10-digit mobile number."
      }, 400);
    }
    body.contact = mobileNumber;

    if (!String(body.address || "").trim()) {
      return jsonResponse({
        success: false,
        error: "Please enter the participant address."
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

    const cartItems = normalizeCartItems(body);

    if (cartItems.length === 0) {
      return jsonResponse({
        success: false,
        error: "Please select at least one event/category."
      }, 400);
    }

    if (eventName.toLowerCase().includes("table tennis") && cartItems.length > 2) {
      return jsonResponse({
        success: false,
        error: "Table Tennis allows a maximum of 2 categories only."
      }, 400);
    }

    const amount = cartItems.length * PRICE_PER_ITEM;
    const currency = "INR";
    const registrationId = crypto.randomUUID();

    const trackingReady = await assertRegistrationTrackingReady(env);
    if (!trackingReady.ok) {
      return jsonResponse({
        success: false,
        error: "Registration tracking is temporarily unavailable. Please try again shortly or contact the organiser.",
        details: trackingReady.details,
        supabase_status: trackingReady.status
      }, 500);
    }

    const razorpayKeyId = String(env.RAZORPAY_KEY_ID || "").trim();
    const razorpayKeySecret = String(env.RAZORPAY_KEY_SECRET || "").trim();
    const razorpayAuth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);

    const orderRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${razorpayAuth}`
      },
      body: JSON.stringify({
        amount,
        currency,
        receipt: registrationId,
        notes: {
          registration_id: registrationId,
          participant_name: razorpayNoteValue(participantName),
          arena: razorpayNoteValue(arena),
          event: razorpayNoteValue(eventName),
          cart_count: String(cartItems.length),
          cart_items: razorpayNoteValue(cartItems.map(item => item.label).join(" | "))
        }
      })
    });

    const order = await orderRes.json();

    if (!orderRes.ok) {
      return jsonResponse({
        success: false,
        error: "Failed to create Razorpay order."
      }, 500);
    }

    const pendingRow = buildPendingRegistrationRow({
      registrationId,
      body,
      cartItems,
      amount,
      currency,
      orderId: order.id
    });

    const insertRes = await fetch(supabaseRestUrl(env, REGISTRATION_TABLE), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Prefer": "return=representation"
      },
      body: JSON.stringify(pendingRow)
    });

    const insertText = await insertRes.text();

    if (!insertRes.ok) {
      console.error("Registration tracking insert failed", { status: insertRes.status, registrationId, orderId: order.id, details: insertText });
      return jsonResponse({
        success: false,
        error: "Razorpay order created, but pending registration tracking failed.",
        reference: registrationId
      }, 500);
    }

    return jsonResponse({
      success: true,
      registration_id: registrationId,
      razorpay_key_id: razorpayKeyId,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      cart_count: cartItems.length,
      cart_items: cartItems,
      tracking_status: "PENDING_PAYMENT"
    });

  } catch (error) {
    console.error("create-order failed", error);
    return jsonResponse({
      success: false,
      error: "Server error while creating order."
    }, 500);
  }
}

function buildPendingRegistrationRow({ registrationId, body, cartItems, amount, currency, orderId }) {
  const categorySlug = slugify(body.category_slug || body.categorySlug || body.event || "");

  return {
    id: registrationId,
    session_name: REGISTRATION_SESSION,

    participant_name: body.participant_name || body.participantName || body.name || "",
    dob: body.dob || null,
    age: body.age || null,
    school: body.school || "",
    address: String(body.address || "").trim(),
    contact: body.contact || "",
    email: body.email || "",
    id_number: body.id_number || "",
    age_group: body.age_group || "",
    gender: body.gender || "",

    arena: body.arena || "",
    event: body.event || "",
    category_slug: categorySlug,
    selected_events: cartItems.map(item => item.label),
    entry_type: entryTypeFor(categorySlug, cartItems, body),
    partner_name: categorySlug === "badminton" ? valueOrNA(body.partner_name) : "NA",
    fide_id: categorySlug === "chess" ? valueOrNA(body.fide_id) : "NA",
    fide_rating: categorySlug === "chess" ? valueOrNA(body.fide_rating) : "NA",
    swimming_group: categorySlug === "swimming" ? valueOrNA(body.swimming_group) : "NA",
    academy_name: categorySlug === "gymnastics" ? valueOrNA(body.academy_name) : "NA",
    shooting_age_category: categorySlug === "shooting" ? valueOrNA(body.shooting_age_category) : "NA",
    shooting_entry_type: categorySlug === "shooting" ? valueOrNA(body.shooting_entry_type) : "NA",
    team_member_names: categorySlug === "shooting" ? valueOrNA(body.team_member_names) : "NA",
    performance_requirement_details: performanceDetailsFor(categorySlug, body),

    amount,
    currency,
    razorpay_order_id: orderId,
    razorpay_payment_id: null,
    payment_status: "PENDING_PAYMENT",
    payment_method: "",
    created_at: new Date().toISOString()
  };
}

function valueOrNA(value) {
  const text = String(value || "").trim();
  return text || "NA";
}

function entryTypeFor(categorySlug, cartItems, body) {
  if (categorySlug === "badminton") {
    const labels = cartItems.map(item => item.label);
    const hasSingles = labels.some(label => /singles/i.test(label));
    const hasDoubles = labels.some(label => /doubles/i.test(label));
    if (hasSingles && hasDoubles) return "Singles and Doubles";
    return hasDoubles ? "Doubles" : "Singles";
  }
  if (categorySlug === "shooting") return valueOrNA(body.shooting_entry_type);
  if (["table-tennis", "chess", "swimming", "gymnastics"].includes(categorySlug)) return "Individual Entry";
  return "NA";
}

function performanceDetailsFor(categorySlug, body) {
  if (categorySlug !== "shooting") return "NA";
  return body.shooting_entry_type === "Team Entry"
    ? valueOrNA(body.team_member_names)
    : "NA";
}

async function assertRegistrationTrackingReady(env) {
  const res = await fetch(supabaseRestUrl(env, `${REGISTRATION_TABLE}?select=${TRACKING_COLUMNS.join(",")}&limit=1`), {
    method: "GET",
    headers: {
      "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
    }
  });

  const text = await res.text();

  return {
    ok: res.ok,
    status: res.status,
    details: res.ok ? "" : text
  };
}

function normalizeCartItems(body) {
  if (Array.isArray(body.cart_items) && body.cart_items.length > 0) {
    return body.cart_items
      .map(item => {
        if (typeof item === "string") {
          return { label: item, amount: PRICE_PER_ITEM };
        }

        return {
          label: item.label || item.name || item.event || item.category || "Selected Event",
          amount: PRICE_PER_ITEM
        };
      })
      .filter(item => item.label);
  }

  const possibleArrayFields = [
    "badminton_events",
    "badmintonEvents",
    "shooting_events",
    "shootingEvents",
    "team_entry_events",
    "shooting_team_events",
    "shootingTeamEvents",
    "table_tennis_categories",
    "tableTennisCategories",
    "tt_categories",
    "ttCategories",
    "chess_age_categories",
    "chessAgeCategories"
  ];

  const items = [];

  for (const field of possibleArrayFields) {
    if (Array.isArray(body[field])) {
      body[field].forEach(value => {
        items.push({
          label: String(value),
          amount: PRICE_PER_ITEM
        });
      });
    }
  }

  return items;
}

function normalizeMobileNumber(value) {
  let digits = String(value || "").replace(/\D/g, "");

  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  }

  if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  return /^[6-9]\d{9}$/.test(digits) ? digits : "";
}

function razorpayNoteValue(value) {
  return String(value || "").slice(0, 256);
}

function requiredEnv(env) {
  const missing = [];
  if (!env.RAZORPAY_KEY_ID) missing.push("RAZORPAY_KEY_ID");
  if (!env.RAZORPAY_KEY_SECRET) missing.push("RAZORPAY_KEY_SECRET");
  if (!env.SUPABASE_URL) missing.push("SUPABASE_URL");
  if (!env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  return missing;
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
