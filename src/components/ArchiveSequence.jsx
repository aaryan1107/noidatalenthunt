import { useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import FisheyeInfiniteGrid from "./FisheyeInfiniteGrid";
import "./ArchiveSequence.css";

gsap.registerPlugin(ScrollTrigger);

const GALLERY_ITEMS = [
  { image: "/archive/chess-wide.webp", title: "Chess", meta: "July 2026" },
  { image: "/archive/badminton-wide.webp", title: "Badminton", meta: "July 2026" },
  {
    image: "/archive/instagram/daxrbuqvcao-cover.jpg",
    title: "Title reveal",
    meta: "Reel",
    instagramId: "DaxrBuQvCAo",
    caption: "The Noida Talent Hunt title reveal, powered by Mukesh Sharma.",
  },
  { image: "/archive/swimming-wide.webp", title: "Swimming", meta: "July 2026" },
  { image: "/archive/shooting-wide.webp", title: "Shooting", meta: "July 2026" },
  {
    image: "/archive/instagram/daf2a7opwws-cover.jpg",
    title: "Winners",
    meta: "Reel",
    instagramId: "Daf2A7oPWwS",
    caption: "Trophies from the July edition, handed to the athletes who earned them.",
  },
  { image: "/archive/gymnastics-jump.webp", title: "Gymnastics", meta: "In motion" },
  { image: "/archive/gymnastics-beam.webp", title: "Gymnastics", meta: "On beam" },
  {
    image: "/archive/instagram/dz2pxtkd5he-cover.jpg",
    title: "The 2026 story",
    meta: "Carousel",
    instagramId: "DZ2PxtkD5He",
    caption: "Swipe to slide 2 — that is where the July 2026 edition is explained in full.",
  },
];

const THEATRE_POST_ID = "Dao2439PcVd";

function FounderVision() {
  const sectionRef = useRef(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      section.classList.add("is-visible");
      observer.disconnect();
    }, { threshold: 0 });
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="founder-vision" id="why" ref={sectionRef}>
      <div className="founder-vision-wrap">
        <aside className="founder-portrait-column">
          <div className="founder-portrait-stage">
            <img src="/archive/mukesh-sharma-founder.png" alt="Mukesh Sharma, Chairperson of Prometheus School" />
          </div>
          <div className="founder-thought">
            <svg className="founder-thought-thread" viewBox="0 0 118 86" aria-hidden="true">
              <path d="M17 3C28 37 82 34 102 82" />
              <circle cx="17" cy="3" r="2.5" />
            </svg>
            <strong>Noida’s next Olympian could be closer than you think.</strong>
            <span>Give them the stage.</span>
          </div>
        </aside>
        <div className="founder-vision-content">
          <div className="founder-why-copy">
            <span className="eyebrow">Founder’s vision</span>
            <blockquote className="founder-quote-card">
              <h2>India’s champions came from somewhere.</h2>
              <cite className="founder-quote-attribution">Mukesh Sharma · Chairperson, Prometheus School</cite>
            </blockquote>
            <p className="founder-why-lead">Every Olympic medal, every standing ovation, every World Championship — it started with a child who got a chance.</p>
            <p>Noida has over 6 lakh families. Our children are brilliant, driven, and full of potential. What they have lacked is one unified, professional platform. <strong>Noida Talent Hunt is that platform</strong> — in association with Prometheus School.</p>
          </div>
          <div className="founder-champion-grid" aria-label="Athletes who started on local stages">
            <article className="founder-champion founder-champion-featured">
              <span>Badminton · Paris 2024 Olympian</span>
              <h3>Lakshya Sen</h3>
              <p>BWF World No. 12 · World Championships bronze · Commonwealth Games gold · Started training at age 8 in Almora</p>
            </article>
            <article className="founder-champion">
              <span>Cricket</span>
              <h3>Virat Kohli</h3>
              <p>First spotted playing in Delhi’s local circuits at age 9</p>
            </article>
            <article className="founder-champion">
              <span>Shooting · Olympic medallist</span>
              <h3>Manu Bhaker</h3>
              <p>Paris 2024 double medallist · First pistol at 14 in Jhajjar</p>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}

function InstagramLightbox({ item, onClose }) {
  const panelRef = useRef(null);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const onKey = (event) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = panelRef.current?.querySelectorAll(
        'a[href], button, iframe, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.body.classList.add("menu-open");
    window.addEventListener("keydown", onKey);
    panelRef.current?.querySelector("button")?.focus();
    return () => {
      document.body.classList.remove("menu-open");
      window.removeEventListener("keydown", onKey);
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [onClose]);

  return (
    <div className="ig-lightbox" role="dialog" aria-modal="true" aria-label={item.title}>
      <button className="ig-lightbox-scrim" type="button" aria-label="Close" onClick={onClose} />
      <div className="ig-lightbox-panel" ref={panelRef}>
        <div className="ig-lightbox-head">
          <div>
            <span>@prometheussportsacademy</span>
            <strong>{item.title}</strong>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="ig-lightbox-media" style={{ backgroundImage: `url(${item.image})` }}>
          <iframe
            title={`Instagram post ${item.instagramId}`}
            src={`https://www.instagram.com/p/${item.instagramId}/embed/`}
            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
        <div className="ig-lightbox-foot">
          {item.caption && <p>{item.caption}</p>}
          <a
            href={`https://www.instagram.com/p/${item.instagramId}/`}
            target="_blank"
            rel="noreferrer"
          >
            Open on Instagram ↗
          </a>
        </div>
      </div>
    </div>
  );
}

export default function ArchiveSequence() {
  const theatreRef = useRef(null);
  const videoRef = useRef(null);
  const [active, setActive] = useState(null);
  const [theatreReady, setTheatreReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      video.pause();
      setPlaying(false);
    }
  };

  useEffect(() => {
    const theatre = theatreRef.current;
    if (!theatre) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTheatreReady(true);
          observer.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(theatre);
    return () => observer.disconnect();
  }, []);

  // React's muted prop doesn't always reach the element; keep it in sync directly.
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  // Don't let the film keep running once the theatre is scrolled past.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting && !video.paused) {
          video.pause();
          setPlaying(false);
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [theatreReady]);

  useLayoutEffect(() => {
    const theatre = theatreRef.current;
    if (!theatre) return undefined;
    const media = gsap.matchMedia();

    media.add("(min-width: 901px) and (prefers-reduced-motion: no-preference)", () => {
      const layer = theatre.querySelector(".archive-theatre-layer");
      const veil = theatre.querySelector(".archive-stage-veil");
      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: theatre,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.7,
          invalidateOnRefresh: true,
        },
      });

      timeline
        .fromTo(
          layer,
          { scale: 0.62, autoAlpha: 0, yPercent: 8 },
          { scale: 1, autoAlpha: 1, yPercent: 0, ease: "power3.out" },
          0,
        )
        .fromTo(
          veil,
          { autoAlpha: 0 },
          { autoAlpha: 1, ease: "none" },
          0,
        );

      return () => timeline.kill();
    });

    return () => media.revert();
  }, []);

  const onSelect = (item) => {
    if (item.instagramId) setActive(item);
  };

  return (
    <>
      <section className="archive-sequence" id="gallery">
        <div className="archive-gallery-shell">
          <div className="archive-gallery-layer">
            <div className="archive-layer-head">
              <span className="eyebrow">The July 2026 floor</span>
              <h2>Drag through the first edition.</h2>
              <p>
                Photographs from the July arenas mixed with clips straight from
                @prometheussportsacademy. Drag anywhere, then open a clip to watch it.
              </p>
            </div>
            <div className="archive-stage">
              <FisheyeInfiniteGrid items={GALLERY_ITEMS} onSelect={onSelect} />
            </div>
          </div>
        </div>
      </section>

      <FounderVision />

      <section className="archive-theatre-section" ref={theatreRef}>
        <div className="archive-sticky">
          <div className="archive-stage-veil" aria-hidden="true" />
          <div className="archive-theatre-layer">
            <div className="archive-theatre-copy">
              <span className="eyebrow">The vision in motion</span>
              <h2>Why Noida Talent Hunt exists.</h2>
              <p>
                A founder’s note on the stage we are building for the next generation.
              </p>
            </div>
            <div className="archive-theatre-frame">
              <video
                ref={videoRef}
                poster="/archive/founder-vision-poster.jpg"
                preload="none"
                playsInline
                loop
                muted={muted}
                onClick={togglePlay}
              >
                {theatreReady && <source src="/archive/founder-vision.mp4" type="video/mp4" />}
              </video>
              <button
                className={`theatre-play ${playing ? "is-playing" : ""}`}
                type="button"
                onClick={togglePlay}
                aria-label={playing ? "Pause the film" : "Play the film"}
              >
                <span aria-hidden="true">{playing ? "❚❚" : "▶"}</span>
              </button>
              <button
                className="theatre-sound"
                type="button"
                onClick={() => setMuted((value) => !value)}
                aria-label={muted ? "Unmute" : "Mute"}
              >
                {muted ? "Sound off" : "Sound on"}
              </button>
            </div>
            <a
              className="archive-theatre-link"
              href={`https://www.instagram.com/p/${THEATRE_POST_ID}/`}
              target="_blank"
              rel="noreferrer"
            >
              Watch the original on Instagram ↗
            </a>
          </div>
        </div>
      </section>

      {active && <InstagramLightbox item={active} onClose={() => setActive(null)} />}
    </>
  );
}
