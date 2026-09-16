import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPost as createOrder } from "../functions/api/create-order.js";
import { onRequestPost as verifyPayment } from "../functions/api/verify-payment.js";
import { onRequestPost as razorpayWebhook } from "../functions/api/razorpay-webhook.js";
import { csvEscape } from "../functions/api/_organiser-auth.js";

const env = {
  RAZORPAY_KEY_ID: "rzp_test_local",
  RAZORPAY_KEY_SECRET: "local-secret",
  RAZORPAY_WEBHOOK_SECRET: "local-webhook-secret",
  SUPABASE_URL: "https://supabase.example.test",
  SUPABASE_SERVICE_ROLE_KEY: "local-service-role"
};

function context(path, body, headers = {}) {
  return {
    env,
    request: new Request(`https://example.test/api/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body)
    })
  };
}

async function signed(message, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Buffer.from(digest).toString("hex");
}

async function withFetch(mock, run) {
  const original = globalThis.fetch;
  globalThis.fetch = mock;
  try { await run(); } finally { globalThis.fetch = original; }
}

test("order amount is server-calculated and pending row is saved before checkout", async () => {
  let orderAmount;
  let savedRow;
  await withFetch(async (url, options = {}) => {
    const address = String(url);
    if (address.includes("select=") && address.includes("registrations_october_2026")) return Response.json([]);
    if (address.endsWith("/v1/orders")) {
      orderAmount = JSON.parse(options.body).amount;
      return Response.json({ id: "order_local", amount: orderAmount, currency: "INR" });
    }
    if (address.endsWith("/rest/v1/registrations_october_2026") && options.method === "POST") {
      savedRow = JSON.parse(options.body);
      return Response.json([savedRow]);
    }
    throw new Error(`Unexpected fetch: ${address}`);
  }, async () => {
    const response = await createOrder(context("create-order", {
      participant_name: "Local Test", event: "Badminton", category_slug: "badminton",
      address: "Noida", contact: "9876543210", amount: 1,
      cart_items: [{ label: "Singles" }, { label: "Doubles" }]
    }));
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.amount, 20000);
    assert.equal(orderAmount, 20000);
    assert.equal(savedRow.amount, 20000);
    assert.equal(savedRow.payment_status, "PENDING_PAYMENT");
    assert.equal(savedRow.razorpay_order_id, "order_local");
  });
});

test("valid captured payment confirms only the matching amount and order", async () => {
  let savedPatch;
  await withFetch(async (url, options = {}) => {
    const address = String(url);
    if (address.endsWith("/v1/payments/pay_local")) {
      return Response.json({ id: "pay_local", order_id: "order_local", amount: 10000, currency: "INR", status: "captured", method: "upi" });
    }
    if (address.includes("/rest/v1/registrations_october_2026?") && options.method === "GET") {
      return Response.json([{ id: "reg_local", amount: 10000, currency: "INR", contact: "9876543210", category_slug: "badminton", payment_status: "PENDING_PAYMENT" }]);
    }
    if (address.includes("/rest/v1/registrations_october_2026?") && options.method === "PATCH") {
      savedPatch = JSON.parse(options.body);
      return Response.json([{ ...savedPatch, category_slug: "badminton" }]);
    }
    throw new Error(`Unexpected fetch: ${address}`);
  }, async () => {
    const signature = await signed("order_local|pay_local", env.RAZORPAY_KEY_SECRET);
    const response = await verifyPayment(context("verify-payment", {
      registration_id: "reg_local", razorpay_order_id: "order_local",
      razorpay_payment_id: "pay_local", razorpay_signature: signature
    }));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).success, true);
    assert.equal(savedPatch.payment_status, "PAID_CONFIRMED");
    assert.equal(savedPatch.razorpay_payment_id, "pay_local");
  });
});

test("invalid checkout signature is rejected without contacting payment or database APIs", async () => {
  await withFetch(() => { throw new Error("Fetch must not be called"); }, async () => {
    const response = await verifyPayment(context("verify-payment", {
      registration_id: "reg_local", razorpay_order_id: "order_local",
      razorpay_payment_id: "pay_local", razorpay_signature: "invalid"
    }));
    assert.equal(response.status, 400);
    assert.equal((await response.json()).success, false);
  });
});

test("signed webhook rejects an amount mismatch without confirming the registration", async () => {
  const body = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: {
    id: "pay_local", order_id: "order_local", amount: 5000, currency: "INR", method: "upi"
  } } } });
  const signature = await signed(body, env.RAZORPAY_WEBHOOK_SECRET);
  await withFetch(async (url, options = {}) => {
    assert.equal(options.method, "GET");
    assert.match(String(url), /registrations_october_2026/);
    return Response.json([{ id: "reg_local", amount: 10000, currency: "INR", payment_status: "PENDING_PAYMENT" }]);
  }, async () => {
    const response = await razorpayWebhook(context("razorpay-webhook", body, { "x-razorpay-signature": signature }));
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /amount or currency/);
  });
});

test("CSV exports render user-provided formula prefixes as literal text", () => {
  for (const value of ["=SUM(A1:A2)", "+cmd", "-1+1", "@HYPERLINK()", " \t=SUM(A1:A2)"]) {
    assert.match(csvEscape(value), /^'/);
  }
  assert.equal(csvEscape("Aaryan, Noida"), '"Aaryan, Noida"');
});
