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

    const mobileNumber = normalizeMobileNumber(body.contact);
    if (!mobileNumber) {
      return jsonResponse({
        success: false,
        error: "Please enter a valid 10-digit mobile number."
      }, 400);
    }
    body.contact = mobileNumber;

    const missing = requiredEnv(env);
    if (missing.length > 0) {
      return jsonResponse({
        success: false,
        error: "Missing payment tracking environment variables.",
        missing
      }, 500);
    }

    const cartResult = buildTrustedCartItems(body);
    if (cartResult.error) {
      return jsonResponse({
        success: false,
        error: cartResult.error
      }, cartResult.status || 400);
    }

    const cartItems = cartResult.items;

    if (cartItems.length === 0) {
      return jsonResponse({
        success: false,
        error: "Please select at least one event/category."
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
        registration_id: registrationId
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
      error: "Server error while creating order."
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

function buildTrustedCartItems(body) {
  const slug = slugify(body.event || "");
  const eventName = String(body.event || "Registration").trim() || "Registration";
  const oneItem = (label = `${eventName} Registration`) => ok([makeCartItem(eventName, label, 0)]);

  if (slug === "badminton") {
    return fromArrayFields(body, eventName, ["badminton_events", "badmintonEvents"], {
      required: true,
      emptyError: "Please select at least one badminton event."
    });
  }

  if (slug === "table-tennis") {
    return fromArrayFields(body, eventName, ["tt_categories", "ttCategories", "table_tennis_categories", "tableTennisCategories"], {
      required: true,
      max: 2,
      emptyError: "Please select at least one table tennis category.",
      maxError: "Table Tennis allows a maximum of 2 categories only."
    });
  }

  if (slug === "chess") {
    return fromArrayFields(body, eventName, ["chess_age_categories", "chessAgeCategories"], {
      required: true,
      max: 3,
      emptyError: "Please select at least one chess age category.",
      maxError: "Chess allows a maximum of 3 age categories only."
    });
  }

  if (slug === "shooting") {
    const selected = valuesFromFields(body, ["shooting_events", "shootingEvents"]);
    const entryType = String(body.shooting_entry_type || "").trim();
    const teamEvents = entryType === "Team Entry"
      ? valuesFromFields(body, ["team_entry_events", "shooting_team_events", "shootingTeamEvents"])
      : [];

    if (entryType === "Team Entry" && teamEvents.length === 0) {
      return fail("Please select at least one shooting team entry event.");
    }

    const allSelected = [...selected, ...teamEvents];
    if (allSelected.length === 0) {
      return fail("Please select at least one shooting event.");
    }

    return ok(allSelected.map((label, index) => makeCartItem(eventName, label, index)));
  }

  if (slug === "swimming") {
    const group = String(body.swimming_group || "").trim();
    const events = valuesFromFields(body, ["swimming_events", "swimmingEvents"]);

    if (!group) return fail("Please select a swimming age group.");
    if (events.length === 0) return fail("Please select at least one swimming event.");
    if (events.length > 3) return fail("Swimming allows a maximum of 3 events only.");

    return oneItem(`${group} - ${events.join(", ")}`);
  }

  if (slug === "dance") {
    return participantCountItems(body, eventName, "number_of_participants", "Group", "participation_type");
  }

  if (slug === "business-plan") {
    return participantCountItems(body, eventName, "number_of_team_members", "Team", "participation_type");
  }

  return oneItem();
}

function participantCountItems(body, eventName, countField, groupedValue, typeField) {
  const participationType = String(body[typeField] || "").trim();
  const isGrouped = participationType.toLowerCase() === groupedValue.toLowerCase();

  if (!isGrouped) {
    return ok([makeCartItem(eventName, `${eventName} Registration`, 0)]);
  }

  const count = Number(body[countField]);
  if (!Number.isInteger(count) || count < 2 || count > 100) {
    return fail(`Please enter a valid ${groupedValue.toLowerCase()} participant count.`);
  }

  const items = Array.from({ length: count }, (_, index) =>
    makeCartItem(eventName, `${eventName} ${groupedValue} Participant ${index + 1}`, index)
  );

  return ok(items);
}

function fromArrayFields(body, eventName, fields, options = {}) {
  const values = valuesFromFields(body, fields);

  if (options.required && values.length === 0) {
    return fail(options.emptyError || "Please select at least one option.");
  }

  if (options.max && values.length > options.max) {
    return fail(options.maxError || `Please select at most ${options.max} options.`);
  }

  return ok(values.map((label, index) => makeCartItem(eventName, label, index)));
}

function valuesFromFields(body, fields) {
  return fields.flatMap(field => normalizeToArray(body[field])).map(value => String(value).trim()).filter(Boolean);
}

function normalizeToArray(value) {
  if (Array.isArray(value)) return value.filter(value => value !== null && value !== undefined && value !== "");
  if (value) return [value];
  return [];
}

function makeCartItem(eventName, label, index) {
  return {
    item_no: index + 1,
    event: eventName,
    label,
    amount: PRICE_PER_ITEM,
    currency: "INR"
  };
}

function ok(items) {
  return { items };
}

function fail(error, status = 400) {
  return { items: [], error, status };
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
