import { jsonResponse, loginOrganiser } from "./_organiser-auth.js";

export async function onRequestPost(context) {
  const result = await loginOrganiser(context.request, context.env);
  if (!result.ok) return jsonResponse({ success: false, error: result.error }, result.status);
  return jsonResponse({ success: true }, 200, { "Set-Cookie": result.cookie });
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: { Allow: "POST, OPTIONS" } });
}
