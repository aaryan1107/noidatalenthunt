import { clearOrganiserCookie, jsonResponse } from "./_organiser-auth.js";

export function onRequestPost(context) {
  return jsonResponse({ success: true }, 200, { "Set-Cookie": clearOrganiserCookie(context.request) });
}
