export async function onRequestGet(context) {
  const { env } = context;

  try {
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

    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/registrations?select=id&limit=1`, {
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
        error: "Supabase connection failed.",
        details: text
      }, 500);
    }

    return jsonResponse({
      success: true,
      message: "Cloudflare Function and Supabase connection are working.",
      supabase_response: text ? JSON.parse(text) : []
    });

  } catch (error) {
    return jsonResponse({
      success: false,
      error: "Test failed.",
      details: error.message
    }, 500);
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}