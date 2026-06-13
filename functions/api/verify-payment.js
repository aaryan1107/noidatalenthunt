const PRICE_PER_ITEM = 70000; // Rs. 700 in paise

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();

    const {
      registration_id,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      registration
    } = body;

    if (
      !registration_id ||
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return jsonResponse({
        success: false,
        error: "Missing payment verification data."
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

    const expectedSignature = await hmacSha256Hex(
      `${razorpay_order_id}|${razorpay_payment_id}`,
      env.RAZORPAY_KEY_SECRET
    );

    if (!timingSafeEqual(expectedSignature, razorpay_signature)) {
      return jsonResponse({
        success: false,
        error: "Invalid Razorpay signature. Payment not verified."
      }, 400);
    }

    let payment = await fetchRazorpayPayment(env, razorpay_payment_id);

    if (payment.order_id !== razorpay_order_id) {
      return jsonResponse({
        success: false,
        error: "Payment order mismatch."
      }, 400);
    }

    const existing = await findExistingRegistration(env, registration_id, razorpay_order_id, razorpay_payment_id);
    const pending = existing.find(row => row.id === registration_id) || existing[0] || null;
    const fallbackRegistration = registration || {};
    const expectedAmount = expectedAmountFor(pending, fallbackRegistration);
    const expectedCurrency = (pending?.currency || fallbackRegistration.currency || "INR").toUpperCase();

    if (payment.amount !== expectedAmount || payment.currency !== expectedCurrency) {
      return jsonResponse({
        success: false,
        error: "Invalid payment amount or currency.",
        expected_amount: expectedAmount,
        actual_amount: payment.amount,
        expected_currency: expectedCurrency,
        actual_currency: payment.currency
      }, 400);
    }

    if (pending?.payment_status === "PAID_CONFIRMED" && pending?.razorpay_payment_id === razorpay_payment_id) {
      return jsonResponse({
        success: true,
        already_confirmed: true,
        message: "Payment already verified and registration already stored.",
        registration_id: pending.id
      });
    }

    if (payment.status === "authorized") {
      payment = await captureRazorpayPayment(env, razorpay_payment_id, expectedAmount);
    }

    if (payment.status !== "captured") {
      return jsonResponse({
        success: false,
        error: `Payment is not captured. Current status: ${payment.status}`
      }, 400);
    }

    const row = buildPaidRegistrationRow({
      registration_id,
      razorpay_order_id,
      razorpay_payment_id,
      registration: pending?.form_data || fallbackRegistration
