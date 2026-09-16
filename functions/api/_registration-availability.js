import { NTH_S2, SPORT_ORDER } from "../../src/data/sports.js";

const AVAILABILITY_TABLE = "registration_event_availability";

export const DEFAULT_EVENT_AVAILABILITY = Object.freeze(
  SPORT_ORDER.map((category_slug) => ({ category_slug, is_open: true, slots_available: null })),
);

export async function getRegistrationAvailability(env, { forceLive = false } = {}) {
  if (!forceLive && String(env.ENABLE_DYNAMIC_AVAILABILITY || "").toLowerCase() !== "true") {
    return { ok: true, source: "default", events: DEFAULT_EVENT_AVAILABILITY };
  }

  const baseUrl = String(env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const serviceRoleKey = String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!baseUrl || !serviceRoleKey) return { ok: false, events: [] };

  try {
    const response = await fetch(
      `${baseUrl}/rest/v1/${AVAILABILITY_TABLE}?select=category_slug,is_open,slots_available&session_name=eq.${encodeURIComponent(NTH_S2.sessionName)}`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      },
    );

    if (!response.ok) {
      console.error("Dynamic registration availability lookup failed", { status: response.status });
      return { ok: false, events: [] };
    }

    const rows = await response.json();
    const bySlug = new Map(rows.map((row) => [row.category_slug, row]));
    return {
      ok: true,
      source: "live",
      events: DEFAULT_EVENT_AVAILABILITY.map((fallback) => {
        const row = bySlug.get(fallback.category_slug);
        return row
          ? {
              category_slug: row.category_slug,
              is_open: Boolean(row.is_open) && (row.slots_available == null || row.slots_available > 0),
              slots_available: row.slots_available,
            }
          : { ...fallback, is_open: false };
      }),
    };
  } catch (error) {
    console.error("Dynamic registration availability lookup failed", { error: String(error) });
    return { ok: false, events: [] };
  }
}

export function eventIsOpen(events, categorySlug) {
  return events.some((event) => event.category_slug === categorySlug && event.is_open);
}
