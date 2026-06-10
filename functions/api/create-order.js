const PRICE_PER_ITEM = 70000; // ₹700 in paise

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();

    const registrationId = crypto.randomUUID();

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

    const razorpayKeyId = String(env.RAZORPAY_KEY_ID || "").trim();
    const razorpayKeySecret = String(env.RAZORPAY_KEY_SECRET || "").trim();

    if (!razorpayKeyId || !razorpayKeySecret) {
      return jsonResponse({
        success: false,
        error: "Razorpay keys missing in Cloudflare environment variables."
      }, 500);
    }

    const razorpayAuth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);

    const orderRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": Basic ${razorpayAuth}`
      },
      body: JSON.stringify({
        amount,
        currency: "INR",
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

    return jsonResponse({
      success: true,
      registration_id: registrationId,
      razorpay_key_id: razorpayKeyId,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      cart_count: cartItems.length,
      cart_items: cartItems
    });

  } catch (error) {
    return jsonResponse({
      success: false,
      error: "Server error while creating order.",
      details: error.message
    }, 500);
  }
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
