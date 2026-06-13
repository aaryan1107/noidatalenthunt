export async function onRequestGet(context) {
  const { env } = context;

  const rawKeyId = env.RAZORPAY_KEY_ID || "";
  const rawKeySecret = env.RAZORPAY_KEY_SECRET || "";

  const keyId = String(rawKeyId).trim();
  const keySecret = String(rawKeySecret).trim();

  const debug = {
    has_key_id: Boolean(keyId),
    has_key_secret: Boolean(keySecret),
    key_id_prefix: keyId.slice(0, 9),
    key_id_last4: keyId.slice(-4),
    key_id_length: keyId.length,
    secret_length: keySecret.length,
    key_id_was_trimmed: rawKeyId !== keyId,
    secret_was_trimmed: rawKeySecret !== keySecret
  };

  if (!keyId || !keySecret) {
    return jsonResponse({
      success: false,
      error: "Missing Razorpay key or secret in Cloudflare.",
      debug
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

    const text = await res.text();

    let razorpay_response;
    try {
      razorpay_response = JSON.parse(text);
    } catch {
      razorpay_response = text;
    }

    return jsonResponse({
      success: res.ok,
      status: res.status,
      message: res.ok
        ? "Razorpay authentication is working."
        : "Razorpay authentication failed.",
      debug,
      razorpay_response
    });

  } catch (error) {
    return jsonResponse({
      success: false,
      error: error.message,
      debug
    }, 500);
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
