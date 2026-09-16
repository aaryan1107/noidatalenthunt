import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import OpportunitySplit from "./components/OpportunitySplit";
import ArchiveSequence from "./components/ArchiveSequence";
import Preloader from "./components/Preloader";
import Grainient from "./components/Grainient";
import { SPORTS, SPORT_ORDER } from "./data/sports";
import { useSiteMotion } from "./useSiteMotion";
import nthFavicon from "../NTH FAVICON.png";

const FEE_PER_ITEM = 10000;
const AGE_GROUPS = [
  "5–8 years",
  "9–12 years",
  "13–17 years",
  "18+ open category",
];

function Arrow({ diagonal = false }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={diagonal ? "M7 17 17 7M9 7h8v8" : "M5 12h14m-5-5 5 5-5 5"} />
    </svg>
  );
}

function BrandMark() {
  return (
    <span className="brand-mark">
      <img src={nthFavicon} alt="" />
    </span>
  );
}

function HeroField() {
  return (
    <div className="hero-field" aria-hidden="true">
      <Grainient
        className="hero-grainient"
        color1="#08200f"
        color2="#2c7f4a"
        color3="#d8b23f"
        timeSpeed={0.25}
        colorBalance={0.03}
        warpStrength={1.85}
        warpFrequency={5.9}
        warpSpeed={3}
        warpAmplitude={27}
        blendAngle={16}
        blendSoftness={0.05}
        rotationAmount={300}
        noiseScale={1.65}
        grainAmount={0.1}
        grainScale={1.3}
        grainAnimated={false}
        contrast={2.2}
        gamma={1.15}
        saturation={1.2}
        centerX={0}
        centerY={0}
        zoom={0.8}
      />
      <span className="hero-field-grain" />
      <span className="hero-field-veil" />
    </div>
  );
}

function ActionLink({ href, children, light = false, onClick }) {
  return (
    <a className={`action-link ${light ? "action-link-light" : ""}`} href={href} onClick={onClick}>
      <span>{children}</span>
      <span className="action-icon"><Arrow /></span>
    </a>
  );
}

function Navigation({ menuOpen, setMenuOpen }) {
  const close = () => setMenuOpen(false);
  const [collapsed, setCollapsed] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const onScroll = () => setCollapsed(window.scrollY > 90);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const shrink = collapsed && !hovered && !menuOpen;

  return (
    <>
      <div
        className={`nav-dock ${shrink ? "is-collapsed" : ""}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
      <nav className="nav-shell" aria-label="Main navigation">
        <a className="brand" href="#top" onClick={close}>
          <BrandMark />
          <span>Noida Sports Talent Hunt</span>
        </a>
        <div className="nav-links">
          <a href="#july">July edition</a>
          <a href="#gallery">Gallery</a>
          <a href="#sports">Sports</a>
          <a href="#pathway">Opportunity</a>
        </div>
        <a className="nav-register" href="#sports">
          Register
          <span><Arrow /></span>
        </a>
        <button
          className={`menu-toggle ${menuOpen ? "is-open" : ""}`}
          type="button"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((value) => !value)}
        >
          <i />
          <i />
        </button>
      </nav>
      </div>
      <div className={`menu-overlay ${menuOpen ? "is-open" : ""}`} aria-hidden={!menuOpen}>
        {[
          ["July edition", "#july"],
          ["Gallery", "#gallery"],
          ["Sports", "#sports"],
          ["Opportunity", "#pathway"],
          ["Register", "#sports"],
        ].map(([label, href], index) => (
          <a href={href} onClick={close} style={{ "--menu-delay": `${index * 40}ms` }} key={label}>
            <span>0{index + 1}</span>{label}
          </a>
        ))}
      </div>
    </>
  );
}

function Hero() {
  return (
    <header className="hero" id="top">
      <HeroField />
      <div className="hero-copy">
        <span className="hero-kicker">Noida’s biggest youth talent platform</span>
        <h1 aria-label="Noida Sports Talent Hunt">
          <span className="hero-line hero-line-noida"><span className="hero-line-text">Noida</span></span>
          <span className="hero-line hero-line-sports">
            <span className="hero-line-text"><span className="sports-word">Sports</span><i className="sports-wipe" aria-hidden="true" /></span>
          </span>
          <span className="hero-line hero-line-talent"><span className="hero-line-text">Talent Hunt</span></span>
        </h1>
        <p className="hero-association hero-support">
          <BrandMark />
          <span className="hero-association-lines">
            <span>Presented by <strong>Gauri Shiksha Foundation</strong></span>
            <span>in association with <strong>Prometheus School</strong></span>
          </span>
        </p>
        <p className="hero-intro hero-support">
          A city stage for young athletes to compete, be seen, and earn consideration for sports scholarships and high-performance training.
        </p>
        <div className="hero-action hero-support">
          <ActionLink href="#sports">Choose your sport</ActionLink>
        </div>
        <div className="hero-chips hero-support">
          <span className="hero-chip"><strong>OCT</strong> Registrations open · dates tentative</span>
          <span className="hero-chip"><strong>6</strong> sports on the October floor</span>
          <span className="hero-chip"><strong>₹100</strong> per selected event</span>
        </div>
      </div>
    </header>
  );
}

function splitChars(text) {
  return text.split("").map((char, index) => (
    <span className="type-char" key={index}>{char}</span>
  ));
}

const JULY_BODY_COPY =
  "The first edition brought together Badminton, Table Tennis, Chess, Swimming, Gymnastics and Shooting, alongside arts including Singing, Dance and Instrumental Music, and skills events such as Debate, Quiz and Business Plan. It was inspired by a simple gap in Noida: children from schools, academies, societies and independent entries deserved one serious platform to be seen. Its 2K+ registration records now give October’s sports-only chapter a credible foundation and a clearer athlete pathway.";

function JulyEdition() {
  const facts = [
    ["2K+", "registration records achieved across the July edition"],
    ["12", "disciplines across sports, arts and skills"],
    ["6", "sports on the first city-wide stage"],
  ];
  return (
    <section className="july-section" id="july">
      <div className="section-frame">
        <div className="july-heading">
          <span className="eyebrow">Established in Noida</span>
          <h2>Built on a real first edition.</h2>
        </div>
        <div className="july-story">
          <p className="lead">
            Noida Talent Hunt 2026 began in July as one city-wide stage for young people with sport, creativity and ideas to share.
          </p>
          <p className="body-copy">{splitChars(JULY_BODY_COPY)}</p>
        </div>
        <div className="fact-list">
          {facts.map(([value, label]) => (
            <div className="fact-row" key={label}>
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
        <div className="archive-note">
          <span className="archive-dot" />
          <p><strong>July data is preserved.</strong> October registrations enter a separate session database.</p>
        </div>
      </div>
    </section>
  );
}

function SportGlyph({ slug }) {
  const paths = {
    badminton: <><ellipse cx="28" cy="16" rx="8" ry="13" /><path d="m34 27 22 30M15 65l34-2M49 63l9 9" /></>,
    "table-tennis": <><path d="M20 16c17-10 35 8 26 25-7 13-26 12-33-1-5-9-1-19 7-24Z" /><path d="m40 42 21 28" /><circle cx="64" cy="19" r="5" /></>,
    chess: <><path d="M28 14h26l-5 20 9 13H23l9-13-4-20ZM20 57h41l5 13H15l5-13Z" /></>,
    swimming: <><path d="M13 26c12-13 24-13 36 0s24 13 36 0M13 46c12-13 24-13 36 0s24 13 36 0M13 66c12-13 24-13 36 0s24 13 36 0" /></>,
    gymnastics: <><circle cx="48" cy="15" r="8" /><path d="m45 25-9 21 17 12M36 46 16 58M53 58l20 13M36 34l27-4" /></>,
    shooting: <><circle cx="47" cy="43" r="28" /><circle cx="47" cy="43" r="16" /><circle cx="47" cy="43" r="5" /><path d="M10 76 34 52" /></>,
  };
  return <svg className="sport-glyph" viewBox="0 0 96 88" aria-hidden="true">{paths[slug]}</svg>;
}

function SportsGrid({ selectSport }) {
  return (
    <section className="sports-section" id="sports">
      <div className="section-frame">
        <div className="section-heading">
          <span className="eyebrow">October line-up</span>
          <h2>Pick the arena that feels like yours.</h2>
          <p>Every registration is ₹100 per selected event or category. Dates begin in October and remain tentative until the final schedule is released.</p>
        </div>
        <div className="sports-grid">
          {SPORT_ORDER.map((slug, index) => {
            const sport = SPORTS[slug];
            return (
              <div className={`sport-shell sport-${index + 1}`} key={slug}>
                <button className="sport-card" type="button" onClick={() => selectSport(slug)}>
                  <span className="sport-index">0{index + 1}</span>
                  <SportGlyph slug={slug} />
                  <span className="sport-name">{sport.title}</span>
                  <span className="sport-meta">October · ₹100</span>
                  <span className="sport-arrow"><Arrow diagonal /></span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Field({ field, error, onMaxError }) {
  if (field.type === "checkbox" || field.type === "radio") {
    const handleChange = (event) => {
      if (field.type !== "checkbox" || !field.max || !event.target.checked) return;
      const group = event.currentTarget.closest(".option-group");
      const count = group.querySelectorAll("input:checked").length;
      if (count > field.max) {
        event.target.checked = false;
        onMaxError(`Choose up to ${field.max} options for this field.`);
      }
    };
    return (
      <fieldset className={`option-group ${error ? "has-error" : ""}`} data-required={!field.optional}>
        <legend>{field.label}{!field.optional && <sup>*</sup>}</legend>
        {field.hint && <p className="field-hint">{field.hint}</p>}
        <div className="option-grid">
          {field.options.map((option) => (
            <label className="choice" key={option}>
              <input type={field.type} name={field.name} value={option} onChange={handleChange} />
              <span>{option}</span>
            </label>
          ))}
        </div>
        {error && <p className="field-error">{error}</p>}
      </fieldset>
    );
  }

  if (field.type === "select") {
    return (
      <label className="field">
        <span>{field.label}{!field.optional && <sup>*</sup>}</span>
        <select name={field.name} required={!field.optional} defaultValue="">
          <option value="" disabled>Select an option</option>
          {field.options.map((option) => <option value={option} key={option}>{option}</option>)}
        </select>
      </label>
    );
  }

  return (
    <label className="field">
      <span>{field.label}{!field.optional && <sup>*</sup>}</span>
      <input type={field.type || "text"} name={field.name} required={!field.optional} placeholder={field.placeholder || ""} />
    </label>
  );
}

function formDataObject(form) {
  const data = {};
  for (const [key, value] of new FormData(form).entries()) {
    if (data[key]) data[key] = Array.isArray(data[key]) ? [...data[key], value] : [data[key], value];
    else data[key] = value;
  }
  return data;
}

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : value ? [value] : [];
}

function buildCart(slug, data) {
  const make = (label, index) => ({
    item_no: index + 1,
    event: SPORTS[slug].title,
    arena: "Noida Sports Talent Hunt",
    label,
    amount: FEE_PER_ITEM,
    currency: "INR",
  });
  if (slug === "badminton") return asArray(data.badminton_events).map(make);
  if (slug === "table-tennis") return asArray(data.tt_categories).map(make);
  if (slug === "chess") return asArray(data.chess_age_categories).map(make);
  if (slug === "swimming") {
    const events = asArray(data.swimming_events);
    return data.swimming_group && events.length ? [make(`${data.swimming_group} — ${events.join(", ")}`, 0)] : [];
  }
  if (slug === "gymnastics") return data.gym_age_category ? [make(`${data.gym_age_category} registration`, 0)] : [];
  if (slug === "shooting") {
    const selected = [...asArray(data.shooting_events)];
    if (data.shooting_entry_type === "Team Entry") selected.push(...asArray(data.team_entry_events));
    return selected.map(make);
  }
  return [];
}

function RegistrationConfirmed({ onboarding, registrationId, onClose }) {
  return (
    <div className="confirm-panel">
      <span className="confirm-tick" aria-hidden="true">✓</span>
      <span className="eyebrow">Payment verified</span>
      <h3>You’re in. Two things left.</h3>
      <p>
        Your {onboarding.sport} registration for October 2026 is confirmed and saved. Reference{" "}
        <code>{String(registrationId || "").slice(0, 8)}</code>.
      </p>

      <ol className="confirm-steps">
        <li>
          <div>
            <strong>Join the {onboarding.sport} WhatsApp group</strong>
            <span>Schedule, reporting time and category updates are posted there first.</span>
          </div>
          <a
            className="confirm-action confirm-whatsapp"
            href={onboarding.whatsapp_url}
            target="_blank"
            rel="noreferrer"
          >
            Join group
            <span className="action-icon"><Arrow diagonal /></span>
          </a>
        </li>
        <li>
          <div>
            <strong>Download the {onboarding.sport} rulebook</strong>
            <span>Format, eligibility, protest fees and what every participant gets.</span>
          </div>
          <a className="confirm-action" href={onboarding.rulebook_url} download>
            Download PDF
            <span className="action-icon"><Arrow /></span>
          </a>
        </li>
      </ol>

      {onboarding.contacts?.length > 0 && (
        <p className="confirm-contacts">
          Questions? {onboarding.contacts.map((contact, index) => {
            const [number, name] = contact.split(" - ");
            return (
              <span key={contact}>
                {index > 0 && " · "}
                <a href={`tel:+91${number.trim()}`}>{name || number}</a>
              </span>
            );
          })}
        </p>
      )}

      <button className="confirm-close" type="button" onClick={onClose}>
        Register another sport
      </button>
    </div>
  );
}

function Registration({ slug, onClose }) {
  const sport = SPORTS[slug];
  const formRef = useRef(null);
  const sectionRef = useRef(null);
  const [cart, setCart] = useState([]);
  const [status, setStatus] = useState({ type: "", text: "" });
  const [groupErrors, setGroupErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(null);

  useEffect(() => {
    setCart([]);
    setStatus({ type: "", text: "" });
    setGroupErrors({});
    setConfirmed(null);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let secondFrame;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        const form = sectionRef.current;
        if (!form) return;
        const navOffset = 104;
        const top = form.getBoundingClientRect().top + window.scrollY - navOffset;
        window.scrollTo({ top, behavior: reduceMotion ? "auto" : "smooth" });
      });
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame) cancelAnimationFrame(secondFrame);
    };
  }, [slug]);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tween = gsap.fromTo(
      sectionRef.current,
      { autoAlpha: 0, x: reduceMotion ? 0 : 18, clipPath: reduceMotion ? "inset(0)" : "inset(0 100% 0 0)" },
      { autoAlpha: 1, x: 0, clipPath: "inset(0)", duration: reduceMotion ? 0 : 0.32, ease: "power3.out" },
    );
    return () => tween.kill();
  }, [slug]);

  const updateCart = () => {
    if (formRef.current) setCart(buildCart(slug, formDataObject(formRef.current)));
  };

  const validateGroups = (form) => {
    const errors = {};
    form.querySelectorAll(".option-group[data-required='true']").forEach((group) => {
      if (!group.querySelector("input:checked")) {
        const name = group.querySelector("input")?.name;
        if (name) errors[name] = "Choose at least one option.";
      }
    });
    setGroupErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    setStatus({ type: "", text: "" });
    if (!form.reportValidity() || !validateGroups(form)) return;

    const data = formDataObject(form);
    if (slug === "badminton" && asArray(data.badminton_events).some((item) => /Doubles/i.test(item)) && !String(data.partner_name || "").trim()) {
      setStatus({ type: "error", text: "Enter the doubles partner name for the selected doubles event." });
      return;
    }
    if (slug === "shooting" && data.shooting_entry_type === "Team Entry" && (!asArray(data.team_entry_events).length || !String(data.team_member_names || "").trim())) {
      setStatus({ type: "error", text: "For a team entry, add the team members and select at least one team event." });
      return;
    }

    const items = buildCart(slug, data);
    if (!items.length) {
      setStatus({ type: "error", text: "Choose at least one billable event or category." });
      return;
    }

    Object.assign(data, {
      event: sport.title,
      arena: "Noida Sports Talent Hunt",
      category_slug: slug,
      cart_items: items,
      cart_count: items.length,
      amount: items.length * FEE_PER_ITEM,
      currency: "INR",
      created_at: new Date().toISOString(),
    });

    try {
      setBusy(true);
      setStatus({ type: "info", text: "Creating your secure payment order…" });
      const response = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const order = await response.json();
      if (!response.ok || !order.success) throw new Error(order.error || "Could not create the payment order.");
      if (typeof window.Razorpay !== "function") throw new Error("Payment checkout did not load. Refresh and try again.");

      const checkout = new window.Razorpay({
        key: order.razorpay_key_id,
        amount: order.amount,
        currency: order.currency || "INR",
        name: "Noida Sports Talent Hunt 2026",
        description: `${sport.title} registration`,
        order_id: order.order_id,
        prefill: { name: data.participant_name, email: data.email, contact: data.contact },
        theme: { color: "#6DD243" },
        modal: {
          ondismiss: () => {
            setBusy(false);
            setStatus({ type: "info", text: "Payment window closed. Your registration remains unconfirmed until payment succeeds." });
          },
        },
        handler: async (payment) => {
          try {
            setStatus({ type: "info", text: "Verifying payment…" });
            const verifyResponse = await fetch("/api/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                registration_id: order.registration_id,
                razorpay_order_id: payment.razorpay_order_id,
                razorpay_payment_id: payment.razorpay_payment_id,
                razorpay_signature: payment.razorpay_signature,
                registration: data,
              }),
            });
            const verification = await verifyResponse.json();
            if (!verifyResponse.ok || !verification.success) throw new Error(verification.error || "Payment verification failed.");
            form.reset();
            setCart([]);
            setBusy(false);
            setStatus({ type: "", text: "" });
            const onboarding = verification.onboarding || {
              sport: sport.title,
              whatsapp_url: sport.whatsapp,
              rulebook_url: `/rulebooks/${slug}-rulebook.pdf`,
              contacts: sport.contacts,
            };
            setConfirmed({ onboarding, registrationId: order.registration_id });
            // Popup blockers can swallow this, so the button below stays the reliable path.
            window.open(onboarding.whatsapp_url, "_blank", "noopener,noreferrer");
          } catch (error) {
            setBusy(false);
            setStatus({ type: "error", text: error.message });
          }
        },
      });
      checkout.open();
    } catch (error) {
      setBusy(false);
      setStatus({ type: "error", text: error.message });
    }
  };

  return (
    <section ref={sectionRef} className="registration-section" id="registration-form">
      <div className="section-frame">
        <button className="close-form" type="button" onClick={onClose}>
          Close form <span>×</span>
        </button>
        <div className="registration-layout">
          <div className="registration-summary">
            <span className="eyebrow">October registration</span>
            <h2>{sport.title}</h2>
            <p>{sport.intro}</p>
            <dl>
              <div><dt>Dates</dt><dd>{sport.dates}</dd></div>
              <div><dt>Venue</dt><dd>{sport.venue}</dd></div>
              <div><dt>Fee</dt><dd>{sport.fee}</dd></div>
            </dl>
            <div className="rules-block">
              <h3>Before you register</h3>
              <ul>{sport.rules.map((rule) => <li key={rule}>{rule}</li>)}</ul>
            </div>
            <div className="organiser-block">
              <h3>Organiser contacts</h3>
              <ul>
                {sport.contacts.map((contact) => {
                  const [number, name] = contact.split(" - ");
                  return (
                    <li key={contact}>
                      <a href={`tel:+91${number.trim()}`}>{number.trim()}</a>
                      <span>{name}</span>
                    </li>
                  );
                })}
              </ul>
              <p className="whatsapp-note">
                <strong>{sport.title} WhatsApp group</strong> opens automatically once your payment is verified —
                every schedule and reporting-time update is posted there first.
              </p>
            </div>
          </div>
          <div className="form-bezel">
            {confirmed ? (
              <RegistrationConfirmed
                onboarding={confirmed.onboarding}
                registrationId={confirmed.registrationId}
                onClose={onClose}
              />
            ) : (
            <form className="registration-form" ref={formRef} onChange={updateCart} onSubmit={handleSubmit}>
              <div className="form-heading">
                <span>Participant details</span>
                <strong>Fields marked * are required</strong>
              </div>
              <div className="form-grid">
                <label className="field"><span>Participant’s name<sup>*</sup></span><input name="participant_name" required placeholder="Full name" /></label>
                <label className="field"><span>Date of birth<sup>*</sup></span><input name="dob" type="date" required /></label>
                <label className="field"><span>School or academy<sup>*</sup></span><input name="school" required placeholder="School or academy name" /></label>
                <label className="field"><span>Parent / coach contact<sup>*</sup></span><input name="contact" type="tel" inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength="10" required placeholder="10-digit mobile number" /></label>
                <label className="field"><span>Email address<sup>*</sup></span><input name="email" type="email" required placeholder="name@example.com" /></label>
                <label className="field"><span>Aadhaar / passport number<sup>*</sup></span><input name="id_number" required placeholder="Participant ID number" /></label>
                <label className="field"><span>Age group<sup>*</sup></span><select name="age_group" required defaultValue=""><option value="" disabled>Select age group</option>{AGE_GROUPS.map((group) => <option key={group}>{group}</option>)}</select></label>
                <label className="field"><span>Gender<sup>*</sup></span><select name="gender" required defaultValue=""><option value="" disabled>Select gender</option><option>Boys</option><option>Girls</option></select></label>
                <label className="field field-full"><span>Residential address<sup>*</sup></span><textarea name="address" required rows="3" placeholder="House / flat, street, locality, city and PIN code" /></label>
              </div>
              <div className="sport-fields">
                <div className="form-heading"><span>{sport.title} selection</span><strong>₹100 per billable selection</strong></div>
                <div className="form-grid">
                  {sport.fields.map((field) => (
                    <Field
                      field={field}
                      error={groupErrors[field.name]}
                      onMaxError={(text) => setStatus({ type: "error", text })}
                      key={field.name}
                    />
                  ))}
                </div>
              </div>
              <div className="payment-panel">
                <div>
                  <span className="payment-label">Your selection</span>
                  {cart.length ? (
                    <ol>{cart.map((item) => <li key={item.label}>{item.label}</li>)}</ol>
                  ) : (
                    <p>Choose your sport category to calculate the total.</p>
                  )}
                </div>
                <div className="payment-total">
                  <small>Total</small>
                  <strong>₹{cart.length * 100}</strong>
                </div>
              </div>
              {status.text && <p className={`form-status ${status.type}`} role="status">{status.text}</p>}
              <button className="pay-button" type="submit" disabled={busy}>
                <span>{busy ? "Please wait…" : "Pay securely & register"}</span>
                <span className="action-icon"><Arrow /></span>
              </button>
              <p className="secure-note">Payment is processed by Razorpay. Registration is confirmed after server-side payment verification.</p>
            </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function ClosingQuote() {
  return (
    <section className="closing-quote">
      <p>
        <span aria-hidden="true">“</span>Every champion was once a child who simply needed a stage.<span aria-hidden="true">”</span>
      </p>
    </section>
  );
}

function Footer() {
  return (
    <footer>
      <div className="section-frame footer-grid">
        <div>
          <BrandMark />
          <h2>Noida’s next sporting story begins here.</h2>
        </div>
        <div className="footer-meta">
          <p>Presented by Gauri Shiksha Foundation · in association with Prometheus School</p>
          <a href="/organiser.html">Organiser portal</a>
          <a href="mailto:info@gaurishiksha.com">info@gaurishiksha.com</a>
          <a href="tel:+919953659468">+91 99536 59468</a>
          <a href="https://www.instagram.com/prometheussportsacademy/" target="_blank" rel="noreferrer">
            @prometheussportsacademy
          </a>
          <span>October 2026 · Dates tentative</span>
        </div>
      </div>
    </footer>
  );
}

export default function App() {
  const rootRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedSport, setSelectedSport] = useState(null);
  const [ready, setReady] = useState(false);
  const sport = useMemo(() => selectedSport && SPORTS[selectedSport], [selectedSport]);
  useSiteMotion(rootRef, ready);

  useEffect(() => {
    document.body.classList.toggle("menu-open", menuOpen);
    return () => document.body.classList.remove("menu-open");
  }, [menuOpen]);

  const selectSport = (slug) => {
    setSelectedSport(slug);
    window.history.replaceState(null, "", `#register-${slug}`);
  };

  useEffect(() => {
    const match = window.location.hash.match(/^#register-(.+)$/);
    if (match && SPORTS[match[1]]) setSelectedSport(match[1]);
  }, []);

  return (
    <div className="site-root" ref={rootRef}>
      {!ready && <Preloader onDone={() => setReady(true)} />}
      <Navigation menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
      <main>
        <Hero />
        <JulyEdition />
        <ArchiveSequence />
        <SportsGrid selectSport={selectSport} />
        <OpportunitySplit />
        {sport && <Registration slug={selectedSport} onClose={() => { setSelectedSport(null); window.history.replaceState(null, "", "#sports"); }} />}
        <ClosingQuote />
      </main>
      <Footer />
    </div>
  );
}
