const SESSION_COOKIE = "nth_organiser_session";
const SESSION_TTL_SECONDS = 8 * 60 * 60;

export async function requireOrganiser(request, env) {
  const session = parseCookie(request.headers.get("Cookie") || "", SESSION_COOKIE);
  if (!session) return null;

  const [expires, nonce, signature] = session.split(".");
  if (!expires || !nonce || !signature || Number(expires) < Math.floor(Date.now() / 1000)) return null;

  const secret = organiserSessionSecret(env);
  if (!secret) return null;
  const expected = await hmacSha256Hex(`${expires}.${nonce}`, secret);
  return timingSafeEqual(expected, signature) ? { expires: Number(expires) } : null;
}

export async function loginOrganiser(request, env) {
  const body = await request.json().catch(() => ({}));
  const password = String(body.password || "");
  const configuredPassword = String(env.ORGANISER_PORTAL_PASSWORD || "");
  const secret = organiserSessionSecret(env);

  if (!configuredPassword || !secret) {
    return { ok: false, status: 503, error: "Organiser portal authentication is not configured." };
  }

  const passwordMatches = timingSafeEqual(
    await hmacSha256Hex(password, secret),
    await hmacSha256Hex(configuredPassword, secret)
  );
  if (!passwordMatches) return { ok: false, status: 401, error: "Incorrect organiser password." };

  const expires = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const signature = await hmacSha256Hex(`${expires}.${nonce}`, secret);
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";

  return {
    ok: true,
    cookie: `${SESSION_COOKIE}=${expires}.${nonce}.${signature}; Max-Age=${SESSION_TTL_SECONDS}; Path=/api; HttpOnly; SameSite=Strict${secure}`
  };
}

export function clearOrganiserCookie(request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Max-Age=0; Path=/api; HttpOnly; SameSite=Strict${secure}`;
}

function organiserSessionSecret(env) {
  return String(env.ORGANISER_PORTAL_SESSION_SECRET || "").trim();
}

function parseCookie(header, name) {
  const match = header.split(";").map(value => value.trim()).find(value => value.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
}

async function hmacSha256Hex(message, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(signature)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return result === 0;
}

export function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers }
  });
}

export function supabaseRestUrl(env, path) {
  const baseUrl = String(env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  return `${baseUrl}/rest/v1/${String(path || "").replace(/^\/+/, "")}`;
}

export const ORGANISER_COLUMNS = [
  "registration_id", "event", "category_slug", "participant_name", "phone", "email",
  "school", "address", "dob", "age", "gender", "age_group", "selected_category_or_event",
  "payment_status", "payment_method", "amount_inr", "submitted_at", "payment_captured_at",
  "razorpay_order_id", "razorpay_payment_id"
];

export function csvEscape(value) {
  const raw = value == null ? "" : String(value);
  const text = /^[\t\r\n ]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
