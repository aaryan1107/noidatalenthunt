import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { NTH_S2, SPORT_ORDER, SPORTS } from "../src/data/sports.js";

const siteUrl = "https://noidatalenthunt.gaurishiksha.com";
const escape = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

function page(slug, sport) {
  const url = `${siteUrl}/sports/${slug}/`;
  const image = `${siteUrl}${sport.seo.ogImage}`;
  const title = `${sport.title} Registration | ${NTH_S2.displayName}`;
  const description = sport.seo.description;
  const categories = sport.fields.flatMap((field) => field.options || []).slice(0, 12);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(title)}</title><meta name="description" content="${escape(description)}"><link rel="canonical" href="${url}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Noida Talent Hunt"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${image}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${image}">
<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "SportsEvent", name: `${NTH_S2.displayName} — ${sport.title}`, startDate: NTH_S2.startDate, endDate: NTH_S2.endDate, location: { "@type": "Place", name: sport.venue }, description, organizer: { "@type": "Organization", name: "Noida Talent Hunt" }, url })}</script>
<style>body{margin:0;background:#101210;color:#f5f1e4;font:16px/1.6 system-ui,sans-serif}main{max-width:900px;margin:auto;padding:72px 24px}a{color:#9eea72}.tag{color:#9eea72;text-transform:uppercase;letter-spacing:.12em;font-size:12px}h1{font-size:clamp(44px,10vw,92px);line-height:.92;margin:.35em 0}.cta{display:inline-block;background:#9eea72;color:#101210;padding:14px 20px;border-radius:6px;font-weight:800;text-decoration:none}section{margin-top:50px;border-top:1px solid #445047;padding-top:26px}</style></head>
<body><main><span class="tag">${escape(NTH_S2.displayName)} · ${escape(NTH_S2.dates)} · Noida</span><h1>${escape(sport.title)}</h1><p>${escape(description)}</p><p><strong>${escape(sport.dates)}</strong><br><a href="${siteUrl}/contact/#venue">${escape(sport.venue)}</a><br>${escape(sport.fee)}</p><a class="cta" href="${siteUrl}/#register-${slug}">Register for ${escape(sport.title)}</a><section><h2>Categories and event details</h2><ul>${categories.map((category) => `<li>${escape(category)}</li>`).join("")}</ul></section><section><h2>What participants receive</h2><ul>${sport.benefits.map((benefit) => `<li>${escape(benefit)}</li>`).join("")}</ul></section><p><a href="${siteUrl}/">Back to Noida Talent Hunt</a></p></main></body></html>`;
}

const dist = resolve("dist");
await copyFile(resolve("_headers"), resolve(dist, "_headers"));
await Promise.all(SPORT_ORDER.map(async (slug) => {
  const directory = resolve(dist, "sports", slug);
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, "index.html"), page(slug, SPORTS[slug]));
}));
await writeFile(resolve(dist, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${siteUrl}/</loc></url>${SPORT_ORDER.map((slug) => `<url><loc>${siteUrl}/sports/${slug}/</loc></url>`).join("")}</urlset>`);
await writeFile(resolve(dist, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`);
