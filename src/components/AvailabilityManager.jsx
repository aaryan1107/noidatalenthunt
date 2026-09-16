import { useEffect, useState } from "react";
import { SPORT_ORDER, SPORTS } from "../data/sports";

function initialState() {
  return Object.fromEntries(SPORT_ORDER.map((slug) => [slug, { category_slug: slug, is_open: true, slots_available: null }]));
}

export default function AvailabilityManager({ onUnauthorised }) {
  const [events, setEvents] = useState(initialState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const response = await fetch("/api/organiser-availability");
    if (response.status === 401) return onUnauthorised();
    const result = await response.json().catch(() => ({}));
    if (!response.ok) setError(result.error || "Could not load registration availability.");
    else setEvents(Object.fromEntries(result.events.map((event) => [event.category_slug, event])));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function edit(slug, patch) {
    setEvents((current) => ({ ...current, [slug]: { ...current[slug], ...patch } }));
  }

  async function save(slug) {
    const event = events[slug];
    setSaving(slug);
    setError("");
    const response = await fetch("/api/organiser-availability", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
    if (response.status === 401) return onUnauthorised();
    const result = await response.json().catch(() => ({}));
    if (!response.ok) setError(result.error || "Could not save registration availability.");
    else edit(slug, result.event);
    setSaving("");
  }

  return (
    <section className="availability-panel" aria-labelledby="availability-heading">
      <div className="availability-heading">
        <div><span className="kicker">REGISTRATION CONTROL</span><h2 id="availability-heading">Live availability</h2></div>
        <button className="refresh" type="button" onClick={load} disabled={loading}>↻ Refresh</button>
      </div>
      <p>These settings decide whether the server creates a Razorpay order. “Unlimited” keeps capacity uncapped; zero closes a sport.</p>
      {error && <p className="error portal-error">{error}</p>}
      <div className="availability-grid">
        {SPORT_ORDER.map((slug) => {
          const event = events[slug];
          return <div className="availability-row" key={slug}>
            <strong>{SPORTS[slug].title}</strong>
            <label className="availability-toggle"><input type="checkbox" checked={event.is_open} onChange={(input) => edit(slug, { is_open: input.target.checked })} /> <span>{event.is_open ? "Open" : "Closed"}</span></label>
            <label className="availability-capacity"><span>Capacity</span><input type="number" min="0" value={event.slots_available ?? ""} placeholder="Unlimited" onChange={(input) => edit(slug, { slots_available: input.target.value === "" ? null : Number(input.target.value) })} /></label>
            <button type="button" onClick={() => save(slug)} disabled={loading || saving === slug}>{saving === slug ? "Saving…" : "Save"}</button>
          </div>;
        })}
      </div>
    </section>
  );
}
