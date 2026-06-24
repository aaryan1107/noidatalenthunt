export async function onRequestGet(context) {
  const { request, env } = context;

  if (!isAdminRequest(request, env)) {
    return jsonResponse({
      success: false,
      error: "Not found."
    }, 404);
  }

  const required = [
    "RAZORPAY_KEY_ID",
    "RAZORPAY_KEY_SECRET",
    "RAZORPAY_WEBHOOK_SECRET",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY"
  ];

  const bindings = {};
  for (const name of required) {
    bindings[name] = Boolean(String(env[name] || "").trim());
  }

  return jsonResponse({
    success: true,
    runtime: "cloudflare-pages-functions",
    service: "noida-talent-hunt",
    checked_at: new Date().toISOString(),
    bindings,
    missing: required.filter(name => !bindings[name])
  });
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
  const token = String(env.ADMIN_API_TOKEN || env.ADMIN_TOKEN || "").trim();
  return Boolean(token) && request.headers.get("x-admin-token") === token;
}
