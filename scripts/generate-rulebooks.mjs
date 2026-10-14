import { chromium } from "@playwright/test";
import { resolve } from "node:path";
import { NTH_S2, SPORTS } from "../src/data/sports.js";

// Run after catalogue changes: node scripts/generate-rulebooks.mjs badminton table-tennis
const slugs = process.argv.slice(2);
if (!slugs.length || slugs.some(slug => !Object.hasOwn(SPORTS, slug))) {
  throw new Error("Provide one or more sport slugs from src/data/sports.js.");
}
const escape = value => String(value).replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[char]);
const browser = await chromium.launch();
try {
  for (const slug of slugs) {
    const sport = SPORTS[slug];
    const page = await browser.newPage();
    await page.setContent(`<!doctype html><html lang="en"><head><meta charset="utf-8">
      <title>${escape(sport.title)} Rulebook</title><style>
      @page { size: A4; margin: 14mm; }
      * { box-sizing: border-box; }
      body { margin: 0; color: #172b21; font: 9.5pt/1.3 Arial, sans-serif; }
      header { border-top: 5px solid #296243; padding-top: 14px; }
      .eyebrow { font-size: 8pt; text-transform: uppercase; letter-spacing: 2px; color: #296243; }
      h1 { font-size: 28pt; margin: 8px 0 2px; letter-spacing: -1px; }
      .subtitle { margin: 0 0 18px; color: #526557; }
      h2 { font-size: 10pt; color: #296243; margin: 14px 0 8px; text-transform: uppercase; letter-spacing: 1px; }
      .details { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 20px; padding: 14px; background: #f1f5ef; }
      .details strong { display: block; font-size: 8pt; text-transform: uppercase; color: #526557; }
      ul, ol { margin: 0; padding-left: 18px; }
      li { padding: 2px 0; break-inside: avoid; }
      .categories { columns: 2; column-gap: 28px; font-size: 9pt; }
      .benefits { columns: 2; }
      footer { margin-top: 18px; padding-top: 10px; border-top: 1px solid #cbd5c9; font-size: 9pt; color: #526557; }
      a { color: #296243; }
      </style></head><body>
      <header><div class="eyebrow">${escape(NTH_S2.displayName)} · October 2026 edition</div>
      <h1>${escape(sport.title)} Rulebook</h1><p class="subtitle">In association with Prometheus School</p></header>
      <div class="details"><div><strong>Dates</strong>${escape(sport.dates)}</div><div><strong>Venue</strong>${escape(sport.venue)}</div>
      <div><strong>Entry fee</strong>${escape(sport.fee)}</div><div><strong>Registration</strong>${escape(sport.lastDay)}</div></div>
      <h2>Categories and events</h2><ul class="categories">${sport.fields.flatMap(field => field.options || []).map(option => `<li>${escape(option)}</li>`).join("")}</ul>
      <h2>Rules and regulations</h2><ol>${sport.rules.map(rule => `<li>${escape(rule)}</li>`).join("")}</ol>
      <h2>What every participant gets</h2><ul class="benefits">${sport.benefits.map(benefit => `<li>${escape(benefit)}</li>`).join("")}</ul>
      <h2>Organiser contacts</h2><p>${sport.contacts.map(escape).join("<br>")}</p>
      <p>After payment, join the official <a href="${escape(sport.whatsapp)}">${escape(sport.title)} WhatsApp group</a> from your confirmation screen for the final schedule, reporting times and category updates.</p>
      <footer>Presented by Gauri Shiksha Foundation · Noida Talent Hunt S2</footer>
      </body></html>`);
    await page.pdf({ path: resolve("public", "rulebooks", `${slug}-rulebook.pdf`), printBackground: true, preferCSSPageSize: true });
    await page.close();
    console.log(`Updated ${slug} rulebook from sports.js`);
  }
} finally {
  await browser.close();
}
