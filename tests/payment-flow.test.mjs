import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPost as createOrder } from "../functions/api/create-order.js";
import { onRequestPost as verifyPayment } from "../functions/api/verify-payment.js";
import { onRequestPost as razorpayWebhook } from "../functions/api/razorpay-webhook.js";
import { csvEscape } from "../functions/api/_organiser-auth.js";
import { onRequestGet as registrationStatus } from "../functions/api/registration-status.js";
import { onRequestPatch as updateAvailability } from "../functions/api/organiser-availability.js";

const env = {
  RAZORPAY_KEY_ID: "rzp_test_local",
  RAZORPAY_KEY_SECRET: "local-secret",
  RAZORPAY_WEBHOOK_SECRET: "local-webhook-secret",
  SUPABASE_URL: "https://supabase.example.test",
  SUPABASE_SERVICE_ROLE_KEY: "local-service-role",
  ORGANISER_PORTAL_PASSWORD: "local-organiser-password",
  ORGANISER_PORTAL_SESSION_SECRET: "local-organiser-session-secret",
};

function context(path, body, headers = {}, contextEnv = env) {
  return {
    env: contextEnv,
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
    const body = await response.json();
    assert.equal(body.success, false);
    assert.equal(body.status, 400);
    assert.equal(body.error_code, "BAD_REQUEST");
  });
});

test("malformed API request bodies return a documented 400 response", async () => {
  for (const [handler, path] of [[createOrder, "create-order"], [verifyPayment, "verify-payment"]]) {
    const response = await handler(context(path, "{not-json"));
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.equal(body.status, 400);
    assert.equal(body.error_code, "BAD_REQUEST");
  }

  const rawWebhookBody = "{not-json";
  const signature = await signed(rawWebhookBody, env.RAZORPAY_WEBHOOK_SECRET);
  const webhookResponse = await razorpayWebhook(context("razorpay-webhook", rawWebhookBody, { "x-razorpay-signature": signature }));
  const webhookBody = await webhookResponse.json();
  assert.equal(webhookResponse.status, 400);
  assert.equal(webhookBody.status, 400);
  assert.equal(webhookBody.error_code, "BAD_REQUEST");
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

test("availability is uncached and creates no order when a live sport is closed", async () => {
  const response = await registrationStatus({ env, request: new Request("https://example.test/api/registration-status") });
  assert.equal(response.headers.get("Cache-Control"), "no-store, max-age=0, must-revalidate");
  assert.equal((await response.json()).events.find((event) => event.category_slug === "chess").is_open, true);

  const dynamicEnv = { ...env, ENABLE_DYNAMIC_AVAILABILITY: "true" };
  await withFetch(async (url) => {
    assert.match(String(url), /registration_event_availability/);
    return Response.json([{ category_slug: "chess", is_open: false, slots_available: 0 }]);
  }, async () => {
    const closed = await createOrder(context("create-order", {
      participant_name: "Local Test", event: "Chess", category_slug: "chess",
      address: "Noida", contact: "9876543210", cart_items: [{ label: "Under-11" }]
    }, {}, dynamicEnv));
    assert.equal(closed.status, 409);
    assert.match((await closed.json()).error, /closed/);
  });
});

test("availability changes require an organiser session and update only an approved sport", async () => {
  const unauthorised = await updateAvailability(context("organiser-availability", {
    category_slug: "chess", is_open: false, slots_available: 0,
  }));
  assert.equal(unauthorised.status, 401);
  assert.equal((await unauthorised.json()).error_code, "UNAUTHENTICATED");

  const expires = Math.floor(Date.now() / 1000) + 3600;
  const nonce = "localnonce";
  const signature = await signed(`${expires}.${nonce}`, env.ORGANISER_PORTAL_SESSION_SECRET);
  let patch;
  await withFetch(async (url, options = {}) => {
    assert.match(String(url), /registration_event_availability/);
    assert.equal(options.method, "PATCH");
    patch = JSON.parse(options.body);
    return Response.json([{ category_slug: "chess", ...patch }]);
  }, async () => {
    const response = await updateAvailability(context("organiser-availability", {
      category_slug: "chess", is_open: false, slots_available: 0,
    }, { Cookie: `nth_organiser_session=${expires}.${nonce}.${signature}` }));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).success, true);
  });
  assert.equal(patch.is_open, false);
  assert.equal(patch.slots_available, 0);
});
