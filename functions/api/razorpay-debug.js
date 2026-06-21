export async function onRequestGet(context) {
  const { request, env } = context;

  if (!isAdminRequest(request, env)) {
    return jsonResponse({
      success: false,
      error: "Not found."
    }, 404);
  }

  const keyId = String(env.RAZORPAY_KEY_ID || "").trim();
  const keySecret = String(env.RAZORPAY_KEY_SECRET || "").trim();

  if (!keyId || !keySecret) {
    return jsonResponse({
      success: false,
      error: "Missing Razorpay environment variables.",
      has_key_id: Boolean(keyId),
      has_key_secret: Boolean(keySecret)
    }, 500);
  }

  try {
    const auth = btoa(`${keyId}:${keySecret}`);

    const res = await fetch("https://api.razorpay.com/v1/orders?count=1", {
      method: "GET",
      headers: {
        "Authorization": `Basic ${auth}`
      }
    });

    return jsonResponse({
      success: res.ok,
      status: res.status,
      message: res.ok
        ? "Razorpay authentication is working."
        : "Razorpay authentication failed."
    }, res.ok ? 200 : 502);

  } catch {
    return jsonResponse({
      success: false,
      error: "Unable to reach Razorpay."
    }, 502);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
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
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-admin-token"
  };
}

function isAdminRequest(request, env) {
  const token = String(env.ADMIN_API_TOKEN || "").trim();
  return Boolean(token) && request.headers.get("x-admin-token") === token;
}
