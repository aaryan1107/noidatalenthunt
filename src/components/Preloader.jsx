import { useEffect, useRef, useState } from "react";
import "./Preloader.css";

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
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const startedAt = performance.now();
    let frame = 0;
    let doneTimer = 0;
    let released = false;

    const tick = (now) => {
      if (released) return;
      const progress = Math.min(1, (now - startedAt) / 900);
      setPercent(Math.round(progress * 100));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const leaveTimer = window.setTimeout(() => {
      released = true;
      cancelAnimationFrame(frame);
      setPercent(100);
      setLeaving(true);
      doneTimer = window.setTimeout(() => doneRef.current?.(), 360);
    }, 900);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(leaveTimer);
      window.clearTimeout(doneTimer);
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
