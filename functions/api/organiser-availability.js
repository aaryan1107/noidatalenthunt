import { NTH_S2, SPORT_ORDER } from "../../src/data/sports.js";
import { getRegistrationAvailability } from "./_registration-availability.js";
import { jsonResponse, requireOrganiser, supabaseRestUrl } from "./_organiser-auth.js";

const TABLE = "registration_event_availability";

export async function onRequestGet(context) {
  if (!await requireOrganiser(context.request, context.env)) {
    return jsonResponse({ success: false, error: "Unauthorised." }, 401);
  }

  const availability = await getRegistrationAvailability(context.env, { forceLive: true });
  if (!availability.ok) {
    return jsonResponse({ success: false, error: "Could not load live registration availability." }, 502);
  }

  return jsonResponse({ success: true, events: availability.events });
}

export async function onRequestPatch(context) {
  if (!await requireOrganiser(context.request, context.env)) {
    return jsonResponse({ success: false, error: "Unauthorised." }, 401);
  }

  const body = await context.request.json().catch(() => ({}));
  const categorySlug = String(body.category_slug || "").trim();
  const isOpen = body.is_open;
  const slotsAvailable = body.slots_available;

  if (!SPORT_ORDER.includes(categorySlug) || typeof isOpen !== "boolean") {
    return jsonResponse({ success: false, error: "Invalid sport availability update." }, 400);
  }
  if (slotsAvailable !== null && (!Number.isInteger(slotsAvailable) || slotsAvailable < 0)) {
    return jsonResponse({ success: false, error: "Capacity must be a whole number, zero, or unlimited." }, 400);
  }

  const query = new URLSearchParams({
    session_name: `eq.${NTH_S2.sessionName}`,
    category_slug: `eq.${categorySlug}`,
  });
  const response = await fetch(supabaseRestUrl(context.env, `${TABLE}?${query}`), {
    method: "PATCH",
    headers: {
      apikey: context.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${context.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ is_open: isOpen, slots_available: slotsAvailable, updated_at: new Date().toISOString() }),
  });

  if (!response.ok) {
    return jsonResponse({ success: false, error: "Could not update registration availability." }, 502);
  }

  const rows = await response.json();
  if (!rows.length) {
    return jsonResponse({ success: false, error: "Sport availability record was not found." }, 404);
  }

  return jsonResponse({ success: true, event: rows[0] });
}
