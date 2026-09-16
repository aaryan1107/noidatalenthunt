import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import AvailabilityManager from "./components/AvailabilityManager";
import "./organiser.css";

const SPORTS = ["", "badminton", "table-tennis", "chess", "swimming", "gymnastics", "shooting"];
const SPORT_LABELS = { "": "All sports", badminton: "Badminton", "table-tennis": "Table Tennis", chess: "Chess", swimming: "Swimming", gymnastics: "Gymnastics", shooting: "Shooting" };

function Login({ onLogin }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const submit = async event => {
    event.preventDefault(); setError("");
    const response = await fetch("/api/organiser-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    const result = await response.json();
    if (!response.ok) return setError(result.error || "Sign-in failed.");
    onLogin();
  };
  return <main className="auth-shell"><div className="auth-card"><span className="portal-mark">NTH / 26</span><p className="kicker">Private organiser access</p><h1>October starts<br /><em>here.</em></h1><p className="auth-copy">Sign in to manage paid registrations and prepare the event-day check-in list.</p><form onSubmit={submit}><label>Password<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoFocus required /></label>{error && <p className="error">{error}</p>}<button type="submit">Enter portal <span>↗</span></button></form></div></main>;
}

function Portal({ onLogout }) {
  const [rows, setRows] = useState([]); const [q, setQ] = useState(""); const [sport, setSport] = useState(""); const [status, setStatus] = useState("confirmed"); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const load = async () => { setLoading(true); setError(""); const params = new URLSearchParams({ q, sport, status }); const response = await fetch(`/api/organiser-registrations?${params}`); if (response.status === 401) return onLogout(); const result = await response.json(); if (!response.ok) setError(result.error || "Could not load registrations."); else setRows(result.rows || []); setLoading(false); };
  useEffect(() => { load(); }, [sport, status]);
  const paid = useMemo(() => rows.filter(row => row.payment_status.startsWith("PAID")).length, [rows]);
  const exportCsv = async () => { const response = await fetch(`/api/organiser-registrations?${new URLSearchParams({ q, sport, status, format: "csv" })}`); if (response.status === 401) return onLogout(); const blob = await response.blob(); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "october-2026-check-in.csv"; link.click(); URL.revokeObjectURL(link.href); };
  return <main className="portal-shell"><header className="portal-header"><div><span className="kicker">NOIDA TALENT HUNT · ORGANISER PORTAL</span><h1>October <em>2026</em></h1><p>Registration control room · live payment ledger</p></div><button className="quiet-button" onClick={async () => { await fetch("/api/organiser-logout", { method: "POST" }); onLogout(); }}>Sign out</button></header><section className="metric-grid"><div><span>Showing</span><strong>{rows.length}</strong><small>event entries</small></div><div><span>Confirmed here</span><strong>{paid}</strong><small>ready for check-in</small></div><div><span>Session</span><strong>OCT</strong><small>October 2026</small></div></section><AvailabilityManager onUnauthorised={onLogout} /><section className="controls"><label className="search"><span>⌕</span><input value={q} onChange={event => setQ(event.target.value)} onKeyDown={event => event.key === "Enter" && load()} placeholder="Search participant, phone, school, Razorpay ID…" /></label><select value={sport} onChange={event => setSport(event.target.value)}>{SPORTS.map(value => <option key={value} value={value}>{SPORT_LABELS[value]}</option>)}</select><select value={status} onChange={event => setStatus(event.target.value)}><option value="confirmed">Confirmed only</option><option value="all">All payment states</option><option value="pending">Pending / authorised</option></select><button className="export-button" onClick={exportCsv}>Export check-in CSV <span>↓</span></button></section>{error && <p className="error portal-error">{error}</p>}<section className="table-card"><div className="table-heading"><div><span className="kicker">EVENT-DAY REGISTER</span><h2>{loading ? "Loading registrations…" : `${rows.length} ${rows.length === 1 ? "entry" : "entries"}`}</h2></div><button className="refresh" onClick={load}>↻ Refresh</button></div><div className="table-wrap">{!loading && !rows.length ? <div className="empty">No registrations match these filters.</div> : <table><thead><tr><th>Participant</th><th>Sport / category</th><th>Address</th><th>Payment</th><th>Razorpay IDs</th></tr></thead><tbody>{rows.map(row => <tr key={`${row.registration_id}-${row.selected_category_or_event}`}><td><strong>{row.participant_name}</strong><span>{row.phone} · {row.school}</span></td><td><strong>{row.event}</strong><span>{row.selected_category_or_event}</span></td><td>{row.address}</td><td><span className={`status status-${row.payment_status.toLowerCase().replaceAll("_", "-")}`}>{row.payment_status.replaceAll("_", " ")}</span><span>₹{row.amount_inr}</span></td><td className="ids"><span>O · {row.razorpay_order_id || "—"}</span><span>P · {row.razorpay_payment_id || "—"}</span></td></tr>)}</tbody></table>}</div></section><footer>Server-side Supabase view · filtered at the organiser API · {new Date().getFullYear()} Noida Talent Hunt</footer></main>;
}

function App() {
  const [signedIn, setSignedIn] = useState(null);
  useEffect(() => {
    fetch("/api/organiser-registrations?limit=1")
      .then(async response => {
        const result = await response.json().catch(() => null);
        setSignedIn(response.ok && result?.success === true);
      })
      .catch(() => setSignedIn(false));
  }, []);
  if (signedIn === null) return null;
  return signedIn ? <Portal onLogout={() => setSignedIn(false)} /> : <Login onLogin={() => setSignedIn(true)} />;
}

createRoot(document.getElementById("organiser-root")).render(<App />);
