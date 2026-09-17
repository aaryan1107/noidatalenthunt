import { useLayoutEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function useSiteMotion(rootRef, ready = true) {
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !ready) return undefined;

    const media = gsap.matchMedia();
    const context = gsap.context(() => {
      media.add(
        {
          desktop: "(min-width: 901px) and (hover: hover) and (pointer: fine)",
          reduceMotion: "(prefers-reduced-motion: reduce)",
        },
        ({ conditions }) => {
          const { desktop, reduceMotion } = conditions;
          if (reduceMotion) {
            gsap.set([".hero-line-text", ".sports-word", ".hero-support"], {
              autoAlpha: 1,
              clearProps: "transform,clipPath",
            });
            gsap.set(".sports-wipe", { scaleX: 0 });
            return undefined;
          }

          if (!desktop) return undefined;

          const lines = gsap.utils.toArray(".hero-line-text");
          const intro = gsap.timeline();
          gsap.set(".sports-word", { autoAlpha: 0 });
          gsap.set(".sports-wipe", { scaleX: 0, transformOrigin: "left center" });

          intro
            .from(lines[0], { yPercent: 110, rotation: 1.5, duration: 0.78, ease: "power4.out" }, 0)
            .from(lines[1], { yPercent: -115, duration: 0.9, ease: "power4.out" }, 0.26)
            .from(lines[2], { yPercent: 110, duration: 0.82, ease: "power4.out" }, 0.54)
            .to(".sports-wipe", { scaleX: 1, duration: 0.34, ease: "power3.inOut" }, 0.5)
            .set(".sports-word", { autoAlpha: 1 }, 0.83)
            .set(".sports-wipe", { transformOrigin: "right center" }, 0.84)
            .to(".sports-wipe", { scaleX: 0, duration: 0.38, ease: "power3.inOut" }, 0.84)
            .fromTo(
              ".hero-support",
              { clipPath: "inset(0 100% 0 0)" },
              { clipPath: "inset(0 0% 0 0)", duration: 0.62, stagger: 0.08, ease: "power3.out" },
              0.82,
            );

          const cleanup = [() => intro.kill()];

          if (desktop) {
            const depth = gsap.timeline({
              scrollTrigger: {
                trigger: ".hero",
                start: "top top",
                end: "bottom top",
                scrub: 0.6,
              },
            });
            depth
              .to(".hero-field", { yPercent: -8, ease: "none" }, 0)
              .to(".hero-chips", { y: -18, ease: "none" }, 0);
            cleanup.push(() => depth.kill());

            // Section copy that isn't part of a bespoke timeline still gets a reveal.
            // These sit mid-page with plenty of scroll room below them, so the
            // reveal can be tied to scroll distance (scrub) without risk of
            // running out of page to scroll through.
            const revealTargets = gsap.utils.toArray(
              ".sports-section .section-heading > *, .sport-shell, .archive-note",
            );
            revealTargets.forEach((target) => {
              const tween = gsap.fromTo(
                target,
                { autoAlpha: 0, y: 46 },
                {
                  autoAlpha: 1,
                  y: 0,
                  ease: "none",
                  scrollTrigger: { trigger: target, start: "top 95%", end: "top 55%", scrub: 0.6 },
                },
              );
              cleanup.push(() => tween.kill());
            });

            // The closing quote and footer are the last things on the page, so
            // there isn't always enough scroll room below them to finish a
            // scrubbed (distance-based) reveal — it can get stuck mid-transition
            // once the page hits its max scroll. Use a normal timed reveal here
            // instead, just triggered a beat after the element enters view.
            const tailTargets = gsap.utils.toArray(
              ".closing-quote p, footer h2, footer .footer-meta > *",
            );
            tailTargets.forEach((target) => {
              const tween = gsap.fromTo(
                target,
                { autoAlpha: 0, y: 36 },
                {
                  autoAlpha: 1,
                  y: 0,
                  duration: 0.9,
                  ease: "power2.out",
                  scrollTrigger: { trigger: target, start: "top 90%", once: true },
                },
              );
              cleanup.push(() => tween.kill());
            });

            const july = root.querySelector(".july-section");
            if (july) {
              const heading = july.querySelector(".july-heading h2");
              const lead = july.querySelector(".july-story .lead");
              const typeChars = gsap.utils.toArray(".july-story .body-copy .type-char");
              const rows = gsap.utils.toArray(".fact-row");

              const reveal = gsap.timeline({
                scrollTrigger: { trigger: july, start: "top 88%", end: "top -20%", scrub: 0.6 },
              });
              // Three consecutive beats, not simultaneous: heading wipes in,
              // then the lead line slides in from the right, then — once
              // that's settled — the body copy types itself out.
              if (heading) {
                reveal.fromTo(
                  heading,
                  { clipPath: "inset(0 100% 0 0)" },
                  { clipPath: "inset(0 0% 0 0)", duration: 1, ease: "power3.out" },
                  0,
                );
              }
              if (lead) {
                reveal.fromTo(
                  lead,
                  { autoAlpha: 0, x: 140 },
                  { autoAlpha: 1, x: 0, duration: 1, ease: "power3.out" },
                  1.1,
                );
              }
              if (typeChars.length) {
                reveal.fromTo(
                  typeChars,
                  { autoAlpha: 0 },
                  { autoAlpha: 1, duration: 0.01, stagger: 0.035, ease: "none" },
                  2.3,
                );
              }

              // The stats arrive as one stacked deck, then separate into the list.
              const deck = gsap.timeline({
                scrollTrigger: { trigger: ".fact-list", start: "top 95%", end: "top 25%", scrub: 0.7 },
              });
              deck.fromTo(
                rows,
                {
                  autoAlpha: 0,
                  yPercent: (index) => 40 - index * 12,
                  scale: (index) => 0.9 - index * 0.015,
                  rotationX: 14,
                  transformPerspective: 900,
                  transformOrigin: "50% 100%",
                },
                {
                  autoAlpha: 1,
                  yPercent: 0,
                  scale: 1,
                  rotationX: 0,
                  stagger: 0.14,
                  ease: "power3.out",
                },
              );
              cleanup.push(() => {
                reveal.kill();
                deck.kill();
              });
            }

            root.querySelectorAll(".sport-card").forEach((card) => {
              const glyph = card.querySelector(".sport-glyph");
              if (!glyph) return;
              const xTo = gsap.quickTo(glyph, "x", { duration: 0.18, ease: "power3.out" });
              const yTo = gsap.quickTo(glyph, "y", { duration: 0.18, ease: "power3.out" });
              const onMove = (event) => {
                const bounds = card.getBoundingClientRect();
                xTo((((event.clientX - bounds.left) / bounds.width) - 0.5) * 16);
                yTo((((event.clientY - bounds.top) / bounds.height) - 0.5) * 16);
              };
              const onLeave = () => { xTo(0); yTo(0); };
              card.addEventListener("pointermove", onMove);
              card.addEventListener("pointerleave", onLeave);
              cleanup.push(() => {
                card.removeEventListener("pointermove", onMove);
                card.removeEventListener("pointerleave", onLeave);
                xTo.tween.kill();
                yTo.tween.kill();
              });
            });
          }

          return () => cleanup.forEach((dispose) => dispose());
        },
      );
    }, root);

    return () => {
      media.revert();
      context.revert();
    };
  }, [rootRef, ready]);
}
