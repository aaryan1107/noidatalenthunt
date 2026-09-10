import { useEffect, useRef, useState } from "react";
import "./Preloader.css";

const CRITICAL_ASSETS = [
  "/archive/chess-wide.webp",
  "/archive/badminton-wide.webp",
  "/archive/swimming-wide.webp",
  "/archive/shooting-wide.webp",
  "/archive/gymnastics-jump.webp",
  "/archive/gymnastics-beam.webp",
  "/archive/instagram/daxrbuqvcao-cover.jpg",
  "/archive/instagram/daf2a7opwws-cover.jpg",
  "/archive/instagram/dz2pxtkd5he-cover.jpg",
];

function BadmintonLoop() {
  return (
    <svg viewBox="0 0 120 120" className="loader-figure loader-badminton" aria-hidden="true">
      <g className="loader-body">
        <circle cx="50" cy="34" r="8" />
        <path d="M50 42v32" />
        <path d="M50 74 38 101" />
        <path d="M50 74 66 99" />
        <path d="M49 51 33 63" />
      </g>
      <g className="loader-swing">
        <path d="M50 50h22" />
        <ellipse cx="82" cy="49" rx="11" ry="8" transform="rotate(-18 82 49)" />
      </g>
      <g className="loader-shuttle">
        <circle cx="0" cy="0" r="2.6" className="loader-fill" />
        <path d="M-3.4 -2.6 -7 -8M0 -3.4 0 -9M3.4 -2.6 7 -8" />
      </g>
    </svg>
  );
}

function SwimmingLoop() {
  return (
    <svg viewBox="0 0 120 120" className="loader-figure loader-swimming" aria-hidden="true">
      <g className="loader-body">
        <circle cx="26" cy="54" r="9" />
        <path d="M35 57h50" />
        <path d="M85 57 106 47" />
        <path d="M85 57 106 63" className="loader-kick" />
      </g>
      <g className="loader-stroke-a">
        <path d="M0 0h27" />
      </g>
      <g className="loader-stroke-b">
        <path d="M0 0h27" />
      </g>
      <g className="loader-water">
        <path d="M2 82q11-7 22 0t22 0 22 0 22 0 22 0" />
        <path d="M2 96q11-7 22 0t22 0 22 0 22 0 22 0" />
      </g>
    </svg>
  );
}

function ShootingLoop() {
  return (
    <svg viewBox="0 0 120 120" className="loader-figure loader-shooting" aria-hidden="true">
      <g className="loader-recoil">
        <g className="loader-body">
          <circle cx="34" cy="40" r="8" />
          <path d="M34 48v28" />
          <path d="M34 76 22 101" />
          <path d="M34 76 48 99" />
          <path d="M34 56h26" />
          <path d="M60 52h9v7h-9z" />
        </g>
      </g>
      <g className="loader-target">
        <circle cx="92" cy="55" r="17" />
        <circle cx="92" cy="55" r="10" />
        <circle cx="92" cy="55" r="3.4" className="loader-fill" />
      </g>
      <path d="M72 55h12" className="loader-shot" />
    </svg>
  );
}

const LOOPS = [
  { id: "badminton", label: "Badminton", Figure: BadmintonLoop },
  { id: "swimming", label: "Swimming", Figure: SwimmingLoop },
  { id: "shooting", label: "Shooting", Figure: ShootingLoop },
];

export default function Preloader({ onDone }) {
  const [loop] = useState(() => LOOPS[Math.floor(Math.random() * LOOPS.length)]);
  const [percent, setPercent] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const targetRef = useRef(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    let frame = 0;
    let shown = 0;
    let finished = 0;
    let released = false;

    const bump = () => {
      finished += 1;
      targetRef.current = Math.max(
        targetRef.current,
        Math.round((finished / CRITICAL_ASSETS.length) * 82),
      );
    };

    CRITICAL_ASSETS.forEach((src) => {
      const image = new Image();
      image.onload = bump;
      image.onerror = bump;
      image.src = src;
    });

    const onWindowLoad = () => {
      targetRef.current = 100;
    };
    if (document.readyState === "complete") targetRef.current = Math.max(targetRef.current, 100);
    else window.addEventListener("load", onWindowLoad);

    // Never strand a visitor behind the overlay if an asset hangs.
    const failsafe = window.setTimeout(() => {
      targetRef.current = 100;
    }, 6000);

    const tick = () => {
      shown += Math.max(0.4, (targetRef.current - shown) * 0.08);
      if (shown > targetRef.current) shown = targetRef.current;
      setPercent(Math.min(100, Math.round(shown)));

      if (shown >= 100 && !released) {
        released = true;
        setLeaving(true);
        window.setTimeout(() => doneRef.current && doneRef.current(), 620);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(failsafe);
      window.removeEventListener("load", onWindowLoad);
    };
  }, []);

  const { Figure } = loop;

  return (
    <div
      className={`preloader preloader-${loop.id} ${leaving ? "is-leaving" : ""}`}
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <div className="preloader-core">
        <Figure />
        <div className="preloader-readout" aria-hidden="true">
          <span>{loop.label}</span>
          <strong>{percent}%</strong>
        </div>
        <div className="preloader-track" aria-hidden="true">
          <i style={{ width: `${percent}%` }} />
        </div>
      </div>
    </div>
  );
}
