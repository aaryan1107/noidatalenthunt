export async function onRequestGet(context) {
  const { env } = context;
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
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}
