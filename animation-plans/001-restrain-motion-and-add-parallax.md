# 001 — Give each story beat its own motion language

- **Status**: DONE
- **Commit**: f40563c
- **Severity**: HIGH
- **Category**: Choreography, scroll interaction, media, accessibility
- **Estimated scope**: 8–12 files plus optimized archive media

## Problem

The current `Reveal` wrapper applies the same delayed fade-up to nearly every heading, card, statistic, and section. The repetition makes the site feel generated and hides factual content until an observer fires. The filled eyebrow pill also reads as a generic chip rather than editorial hierarchy.

The July 2026 edition is represented only by text and figures even though the repository contains strong original event media. The scholarship and training pathway is static, so it lacks a visual metaphor for one event opening into several outcomes.

## Creative direction

Assign one motion vocabulary to each kind of content:

1. **Hero — split type and directional wipes.** The three headline lines enter from different vertical directions inside overflow-hidden masks. A green wipe crosses only the word “Sports”, then clears to reveal the word. Supporting copy and CTAs use a short lateral wipe, not another fade-up. The paper-cut athletes get shallow pointer parallax and scroll depth.
2. **July archive — direct manipulation.** Replace the static July proof area with a bounded infinite media plane inspired by Skiper 73. Original July sports photos and one short clip form an editorial collage that can be dragged with pointer/touch and nudged by wheel input. The page itself must retain native vertical scrolling.
3. **Pathway — one image becomes three outcomes.** A single sports image begins as three contiguous slices. During native scroll the slices separate, rotate in 3D, and reveal “Sports scholarship consideration”, “High-performance training”, and “Competition exposure”. This is the only pinned/sticky narrative sequence.
4. **Interactive surfaces — responsive hover/tap.** Sport cards use distinct hover responses: image/glyph parallax, underline wipe, and arrow travel. Navigation gets a line wipe. Buttons compress on press. Form controls keep functional color/opacity feedback.
5. **Factual content — immediately readable.** Registration prices, dates, statistics, labels, and form copy remain visible. Do not animate evidence numbers or apply generic reveal wrappers.

Use GSAP and ScrollTrigger throughout. The supplied Framer Motion examples are behavioral references; do not add a second animation runtime and do not copy Next.js-only `"use client"` or `@/lib/utils` imports into this Vite app.

## Archive media

Use only sports media from `private/`; do not ship arts/skills images:

- `DSC08766.JPG` → chess-wide.webp
- `badminton.JPG` → badminton-wide.webp
- `swimming.JPG` → swimming-wide.webp
- `shooting.jpg` → shooting-wide.webp
- `IMG_3626.JPG.jpeg` → gymnastics-jump.webp
- `IMG_3627.JPG.jpeg` → gymnastics-beam.webp
- `hess.mp4` → chess-vertical.mp4

Create optimized derivatives under `public/archive/`. Resize photos to a maximum 1800px long edge, preserve aspect ratio, and encode WebP around quality 80–84. Transcode the HEVC source to browser-safe H.264, muted playback, yuv420p, faststart, at most 1080px tall. Do not rename or modify originals.

## Detailed motion spec

### Hero

- Scope all selectors to an app root and create animations in `gsap.context()`.
- Split headline into authored line spans; retain one accessible full headline via an sr-only element or an aria-label.
- Load timeline:
  - line 1 from yPercent 110, rotation 1.5, duration 0.78, ease `power4.out`
  - line 2 from yPercent -115, duration 0.9, ease `power4.out`, overlap 0.52
  - line 3 from yPercent 110, duration 0.82, ease `power4.out`, overlap 0.62
  - green sports wipe scaleX 0→1 from left, then transformOrigin moves right and scaleX 1→0; reveal “Sports” between passes
  - supporting copy/CTA clipPath `inset(0 100% 0 0)` → `inset(0)`, duration 0.62
- Desktop pointer movement adjusts athlete layers no more than ±12px x and ±8px y using `gsap.quickTo`; return to rest on pointerleave.
- Native scroll depth: athlete group yPercent 7, sticker y -22 and rotate toward 0, note y -14. No hero pin.

### Infinite July media canvas

- Build a reusable `PreviousEditionCanvas` React component.
- Use a fixed-height, clipped stage (desktop about 720px, mobile about 600px) with a plane larger than the stage. Arrange mixed landscape/portrait tiles with generous negative space and short captions.
- Duplicate the layout around the origin and wrap x/y coordinates using `gsap.utils.wrap` so dragging is seamless. Use `quickTo` or `quickSetter` for transforms.
- Pointer drag: pointer capture, cursor grab/grabbing, velocity-aware settle kept subtle. Touch uses `touch-action: pan-y`; horizontal drag moves the plane while vertical gestures continue page scrolling.
- Wheel: observe without `preventDefault`; use deltas to nudge the plane while normal page scroll continues.
- The video is muted, looped, playsInline, and uses a poster. Pause when the canvas is offscreen.
- Include a plain typographic instruction such as “Drag through July 2026” with a hairline/arrow, not a filled pill.
- Media tiles may have modest radius but should not become repeated white cards. No shadows, glass, or gradients.

### Three-panel pathway

- Build `OpportunitySplit` as a 280–340vh section with a `position: sticky` viewport on desktop.
- Start with one image visually continuous across three equal panels using shared background sizing/position.
- Scroll stages:
  - 0–0.25: contiguous image, scale 1
  - 0.25–0.48: outer panels move x ±clamp(28px, 4vw, 56px), all scale to 0.94, radii separate
  - 0.48–0.78: panels rotateY 0→180; outer panels rotateZ ±5deg
  - 0.78–1: settle to three outcome faces; heading wipes into view below/above without another fade
- Avoid drop shadows. Back faces use flat green, blue, and coral surfaces with cream text/ink as contrast permits.
- Mobile and reduced-motion: no pinning or 3D transform. Render the three outcomes as an accessible vertical editorial list with the source image above.

### Hover and local feedback

- Navigation underline wipe: 180ms ease-out.
- Sport card: glyph/image translate ≤8px, arrow translate 6px, title underline scaleX; 180–220ms.
- Buttons: press scale 0.97 over 120–140ms; hover affordance under 200ms.
- Gate hover transforms with `@media (hover: hover) and (pointer: fine)`.
- Registration section may use a single response-driven wipe/slide when a sport is selected: x 18→0 and clipPath right→open, 320ms `power3.out`.

## Implementation steps

1. Keep the existing `gsap` dependency and ensure `ScrollTrigger` is registered once.
2. Optimize and copy the approved archive media to `public/archive/`.
3. Add `src/components/PreviousEditionCanvas.jsx` and its scoped styles.
4. Add `src/components/OpportunitySplit.jsx` and its scoped styles.
5. Add or revise `src/useSiteMotion.js` for the hero timeline, pointer parallax, navigation/sport-card hover behavior, and cleanup.
6. Refactor `src/App.jsx`: remove the generic `Reveal` observer; add authored hero masks/wipe elements; place the archive in the July section; place the split pathway before registration; preserve all registration/data code.
7. Replace the filled eyebrow style with an unboxed caption and hairline.
8. Add a targeted `prefers-reduced-motion` path that skips split/3D/parallax motion while keeping opacity/color feedback and every content block visible.
9. Add `.gitignore` entries for `node_modules/` and `dist/` if absent.

## Boundaries

- Do not alter registration field names, API payloads, sports/category options, cart logic, ₹100 pricing, October Supabase table, archived July data, or Razorpay behavior.
- Do not reintroduce PSL language.
- Superseded 2026-09-10: the July edition's ₹10L prize pool and its 12 arts/skills
  disciplines are now stated deliberately as historical facts about July, alongside
  copy making clear October's reward is a scholarship into high-performance training,
  not cash. Keep that distinction; do not re-delete the July facts.
- Do not use stock imagery or remote Instagram embeds until actual Instagram URLs are supplied.
- Do not hijack scroll, add smooth-scroll libraries, snap the page, or call `preventDefault` on wheel.
- Do not animate July registration counts, fee values, tentative dates, or scholarship claims.
- Do not hide core content behind JavaScript; reduced-motion and no-JS layouts remain readable.

## Verification

- Run `npm run build`.
- Run `rg -n -i 'PSL|₹700|70000|registrations closed' src index.html public/archive`; expect no visible-copy matches and no PSL-named shipped asset.
- Run `node --check` on payment/registration API files.
- At 1440×1000:
  - reload and confirm the three hero lines use visibly different split/wipe directions;
  - hover nav, CTAs, and each sport card and confirm local response under 220ms;
  - drag the July archive in all directions, wheel through it, and confirm the page continues scrolling normally;
  - confirm the video loops silently and pauses offscreen;
  - scroll forward/back through the three-panel pathway without jumps or stale transforms.
- At 390×844:
  - confirm hero lines fit without clipping;
  - swipe horizontally on the archive and vertically through the page;
  - confirm the pathway is an unpinned vertical list;
  - open every sport form, verify address exists, and verify totals increase by ₹100.
- Emulate `prefers-reduced-motion: reduce`; confirm no parallax, infinite drift, pinning, or 3D flip, while all content and controls remain visible.
- Check browser console for errors and inspect that no horizontal page overflow occurs.

## Done when

The site no longer repeats one reveal animation. The hero uses split/wipe choreography, the July edition is a tactile infinite archive using real sports media, the opportunity pathway transforms one image into three outcomes, hover behavior is crisp, the rejected pill labels are gone, and every registration flow still works.
