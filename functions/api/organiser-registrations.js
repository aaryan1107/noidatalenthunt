import {
  ORGANISER_COLUMNS,
  csvEscape,
  jsonResponse,
  requireOrganiser,
  supabaseRestUrl
} from "./_organiser-auth.js";

const TABLE = "registrations_october_2026_event_rows";
const CSV_HEADERS = [
  ["event", "Sport"], ["selected_category_or_event", "Category / Event"], ["participant_name", "Participant Name"],
  ["phone", "Phone"], ["email", "Email"], ["school", "School / Academy"], ["address", "Address"],
  ["dob", "Date of Birth"], ["age", "Age"], ["gender", "Gender"], ["age_group", "Age Group"],
  ["payment_status", "Payment Status"], ["amount_inr", "Amount (INR)"], ["razorpay_order_id", "Razorpay Order ID"],
  ["razorpay_payment_id", "Razorpay Payment ID"], ["registration_id", "Registration ID"]
];

export async function onRequestGet(context) {
  if (!await requireOrganiser(context.request, context.env)) return jsonResponse({ success: false, error: "Unauthorised." }, 401);

  const url = new URL(context.request.url);
  const search = String(url.searchParams.get("q") || "").trim().toLowerCase();
  const sport = String(url.searchParams.get("sport") || "").trim();
  const status = String(url.searchParams.get("status") || "confirmed").trim();
  const format = url.searchParams.get("format") === "csv" ? "csv" : "json";
  const requestedLimit = Number(url.searchParams.get("limit"));
  const rowLimit = Number.isInteger(requestedLimit) && requestedLimit > 0
    ? Math.min(requestedLimit, 5000)
    : 5000;
  const query = new URLSearchParams({
    select: ORGANISER_COLUMNS.join(","),
    order: "submitted_at.desc",
    limit: String(rowLimit)
  });
  if (sport) query.set("category_slug", `eq.${sport}`);
  if (status === "confirmed") {
    query.set("payment_status", "in.(PAID_CONFIRMED,PAID_CONFIRMED_MANUAL)");
    query.set("canonical_rank", "eq.1");
  }
  if (status === "pending") query.set("payment_status", "in.(PENDING_PAYMENT,AUTHORIZED)");

  const response = await fetch(supabaseRestUrl(context.env, `${TABLE}?${query}`), {
    headers: { apikey: context.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${context.env.SUPABASE_SERVICE_ROLE_KEY}` }
  });
  if (!response.ok) return jsonResponse({ success: false, error: "Could not load October registrations." }, 502);

  let rows = await response.json();
  if (search) rows = rows.filter(row => Object.values(row).some(value => String(value || "").toLowerCase().includes(search)));

  if (format === "csv") {
    const csv = [CSV_HEADERS.map(([, label]) => csvEscape(label)).join(","), ...rows.map(row => CSV_HEADERS.map(([key]) => csvEscape(row[key])).join(","))].join("\r\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="october-2026-check-in-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "no-store"
      }
    });
  }

  return jsonResponse({ success: true, rows, count: rows.length, generated_at: new Date().toISOString() });
}
