const PRICE_PER_ITEM = 70000; // Rs. 700 in paise

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

    if (!participantName || !eventName) {
      return jsonResponse({
        success: false,
        error: "Missing participant name or event."
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
          participant_name: participantName,
          arena,
          event: eventName,
          cart_count: String(cartItems.length),
          cart_items: cartItems.map(item => item.label).join(" | ")
        }
      })
    });

    const order = await orderRes.json();

    if (!orderRes.ok) {
      return jsonResponse({
        success: false,
        error: "Failed to create Razorpay order.",
        details: order
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

    const insertRes = await fetch(supabaseRestUrl(env, "registrations"), {
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
      return jsonResponse({
        success: false,
        error: "Razorpay order created, but pending registration tracking failed.",
        order_id: order.id,
        registration_id: registrationId,
        details: insertText
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
    return jsonResponse({
      success: false,
      error: "Server error while creating order.",
      details: error.message
    }, 500);
  }
}

function buildPendingRegistrationRow({ registrationId, body, cartItems, amount, currency, orderId }) {
  const selectedOptions = {};

  for (const [key, value] of Object.entries(body)) {
    if (Array.isArray(value)) {
      selectedOptions[key] = value;
    }
  }

  selectedOptions.cart_items = cartItems;

  return {
    id: registrationId,

    participant_name: body.participant_name || body.participantName || body.name || "",
    dob: body.dob || null,
    age: body.age || null,
    school: body.school || "",
    contact: body.contact || "",
    email: body.email || "",
    id_number: body.id_number || "",
    age_group: body.age_group || "",
    gender: body.gender || "",

    arena: body.arena || "",
    event: body.event || "",
    category_slug: slugify(body.event || ""),
    selected_options: selectedOptions,
    form_data: {
      ...body,
      cart_items: cartItems,
      cart_count: cartItems.length,
      amount,
      currency,
      registration_id: registrationId,
      razorpay_order_id: orderId
    },

    amount,
    currency,
    razorpay_order_id: orderId,
    razorpay_payment_id: null,
    payment_status: "PENDING_PAYMENT",
    payment_method: "",
    created_at: new Date().toISOString()
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
    "selected_options",
    "selectedOptions"
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
