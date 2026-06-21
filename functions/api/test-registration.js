export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    if (!isAdminRequest(request, env)) {
      return jsonResponse({
        success: false,
        error: "Not found."
      }, 404);
    }

    const missing = [];

    if (!env.RAZORPAY_KEY_ID) missing.push("RAZORPAY_KEY_ID");
    if (!env.RAZORPAY_KEY_SECRET) missing.push("RAZORPAY_KEY_SECRET");
    if (!env.RAZORPAY_WEBHOOK_SECRET) missing.push("RAZORPAY_WEBHOOK_SECRET");
    if (!env.SUPABASE_URL) missing.push("SUPABASE_URL");
    if (!env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");

    if (missing.length > 0) {
      return jsonResponse({
        success: false,
        error: "Missing environment variables.",
        missing
      }, 500);
    }

    const checkedColumns = [
      "id",
      "amount",
      "currency",
      "payment_status",
      "razorpay_order_id",
      "razorpay_payment_id",
      "form_data",
      "selected_options"
    ];

    const res = await fetch(supabaseRestUrl(env, `registrations?select=${checkedColumns.join(",")}&limit=1`), {
      method: "GET",
      headers: {
        "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
      }
    });

    const text = await res.text();

    if (!res.ok) {
      return jsonResponse({
        success: false,
        error: "Supabase connection failed."
      }, 500);
    }

    return jsonResponse({
      success: true,
      message: "Cloudflare Function and Supabase connection are working.",
      checked_columns: checkedColumns,
      supabase_response: text ? JSON.parse(text) : []
    });

  } catch (error) {
    return jsonResponse({
      success: false,
      error: "Test failed."
    }, 500);
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, x-admin-token"
    }
  });
}

function supabaseRestUrl(env, path) {
  const baseUrl = String(env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const cleanPath = String(path || "").replace(/^\/+/, "");
  return `${baseUrl}/rest/v1/${cleanPath}`;
}

function isAdminRequest(request, env) {
  const token = String(env.ADMIN_API_TOKEN || "").trim();
  return Boolean(token) && request.headers.get("x-admin-token") === token;
}

function isAdminRequest(request, env) {
  const token = request.headers.get("x-admin-token");
  return Boolean(env.ADMIN_TOKEN && token && token === env.ADMIN_TOKEN);
}
