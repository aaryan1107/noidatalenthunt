export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();

    const registrationId = crypto.randomUUID();
    const amount = 70000; // ₹700 in paise

    const eventName = body.event || "";
    const arena = body.arena || "";
    const participantName = body.participant_name || "";

    if (!eventName || !arena || !participantName) {
      return jsonResponse({
        success: false,
        error: "Missing required registration details."
      }, 400);
    }

    const razorpayAuth = btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`);

    const orderRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${razorpayAuth}`
      },
      body: JSON.stringify({
        amount,
        currency: "INR",
        receipt: registrationId,
        notes: {
          registration_id: registrationId,
          arena,
          event: eventName
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
      razorpay_key_id: env.RAZORPAY_KEY_ID,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency
    });

  } catch (error) {
    return jsonResponse({
      success: false,
      error: "Server error while creating order.",
      details: error.message
    }, 500);
  }
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