# Search, sharing, and live registration availability

The standard Pages build now emits static sport pages at `/sports/<sport>/`.
Each page includes crawlable sport/category copy, a canonical URL, JSON-LD, and
a sport-specific OpenGraph image. These are static build artifacts; the React
registration experience and Razorpay remain on the main site.

`dist/sitemap.xml` and `dist/robots.txt` are also generated on every build.

## Enable live availability

1. Apply `20260916215635_add_registration_event_availability.sql` to Supabase.
2. Add the encrypted Cloudflare Pages variable `ENABLE_DYNAMIC_AVAILABILITY=true`.
3. Redeploy Pages.

When enabled, `/api/registration-status` is explicitly `no-store`; the public
cards refresh their state on page load, and `/api/create-order` checks the same
table immediately before it creates a Razorpay order. A closed event therefore
cannot be purchased even from a stale tab.

The private organiser portal includes a **Live availability** panel. It uses a
server-side, organiser-session-protected API to update the corresponding
`October 2026` row. A value of `0` for `slots_available` closes the sport.
The table has no public grants or RLS policies; direct browser access remains
denied.
