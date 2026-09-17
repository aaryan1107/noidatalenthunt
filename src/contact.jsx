import { useState } from "react";
import { createRoot } from "react-dom/client";
import { CONTACT, MAP_DIRECTIONS_URL, MAP_EMBED_URL, whatsappUrl } from "./data/contact";
import WhatsAppButton from "./components/WhatsAppButton";
import "./tailwind.css";
import "./styles.css";

function Arrow() {
  return <span aria-hidden="true">↗</span>;
}

function ContactCard({ label, value, href, external = false }) {
  return (
    <a className="contact-card" href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>
      <span>{label}</span>
      <strong>{value}</strong>
      <Arrow />
    </a>
  );
}

function ContactPage() {
  const [sent, setSent] = useState(false);

  function sendMessage(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") || "").trim();
    const phone = String(data.get("phone") || "").trim();
    const message = String(data.get("message") || "").trim();
    const note = [
      "Hi Noida Talent Hunt,",
      name && `My name is ${name}.`,
      phone && `My contact number is ${phone}.`,
      message || "I have a question about NTH S2.",
    ].filter(Boolean).join("\n");
    window.open(whatsappUrl(note), "_blank", "noopener,noreferrer");
    setSent(true);
  }

  return (
    <div className="contact-page">
      <header className="contact-nav">
        <a className="contact-brand" href="/">
          <img className="contact-brand-mark" src="/nth-mark.png" alt="Noida Talent Hunt" width="128" height="128" />
          <span>Noida Talent Hunt</span>
        </a>
        <a href="/#sports">Register <Arrow /></a>
      </header>
      <main>
        <section className="contact-hero">
          <span className="eyebrow">NTH S2 · 31 October &amp; 1 November 2026</span>
          <h1>Let’s get every young athlete to the right starting line.</h1>
          <p>For registration help, category guidance, venue questions or event-day information, reach the Noida Talent Hunt team directly.</p>
        </section>
        <section className="contact-content">
          <aside className="contact-details">
            <ContactCard label="Email" value={CONTACT.email} href={`mailto:${CONTACT.email}`} />
            <ContactCard label="Call" value={CONTACT.phoneDisplay} href={`tel:${CONTACT.phoneHref}`} />
            <ContactCard label="WhatsApp" value="Start a conversation" href={whatsappUrl("Hi Noida Talent Hunt, I have a question about NTH S2.")} external />
            <a className="contact-card" href="#venue">
              <span>Venue</span><strong>{CONTACT.venue}</strong><Arrow />
            </a>
            <a className="contact-instagram" href={CONTACT.instagram} target="_blank" rel="noreferrer">Follow @prometheussportsacademy <Arrow /></a>
          </aside>
          <section className="contact-form-panel" aria-labelledby="contact-form-heading">
            {sent ? (
              <div className="contact-sent"><span>Message ready</span><h2>WhatsApp has opened with your note.</h2><p>Our team will take it from here.</p><button onClick={() => setSent(false)}>Send another message</button></div>
            ) : (
              <form onSubmit={sendMessage}>
                <span className="eyebrow">Start here</span>
                <h2 id="contact-form-heading">Tell us how we can help.</h2>
                <label>Your name<input name="name" required placeholder="Parent, participant or coach" /></label>
                <label>Phone number<input name="phone" type="tel" inputMode="numeric" placeholder="10-digit mobile number" /></label>
                <label>Your question<textarea name="message" required rows="5" placeholder="Registration, category, venue or event-day question…" /></label>
                <button type="submit">Send via WhatsApp <Arrow /></button>
              </form>
            )}
          </section>
        </section>
        <section className="venue-section" id="venue">
          <div className="venue-copy"><span className="eyebrow">The venue</span><h2>Prometheus School, Noida.</h2><p>{CONTACT.address}</p><a href={MAP_DIRECTIONS_URL} target="_blank" rel="noreferrer">Get directions <Arrow /></a></div>
          <div className="venue-map"><iframe title="Prometheus School, Noida" src={MAP_EMBED_URL} loading="lazy" referrerPolicy="no-referrer-when-downgrade" /></div>
        </section>
      </main>
      <footer className="contact-footer"><span>Noida Talent Hunt S2</span><span>{CONTACT.venue}</span><a href="/">Back to NTH <Arrow /></a></footer>
      <WhatsAppButton />
    </div>
  );
}

createRoot(document.getElementById("contact-root")).render(<ContactPage />);
