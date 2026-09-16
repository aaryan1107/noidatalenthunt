import { getRegistrationAvailability } from "./_registration-availability.js";
import { withErrorStatus } from "./_http-errors.js";

export async function onRequestGet(context) {
  const availability = await getRegistrationAvailability(context.env);
  if (!availability.ok) {
    return response({ success: false, error: "Registration availability is temporarily unavailable." }, 503);
  }

  return response({ success: true, source: availability.source, events: availability.events });
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: { Allow: "GET, OPTIONS" } });
}

function response(data, status = 200) {
  return new Response(JSON.stringify(withErrorStatus(data, status)), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, max-age=0, must-revalidate",
    },
  });
}
