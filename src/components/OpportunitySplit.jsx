import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "./OpportunitySplit.css";

gsap.registerPlugin(ScrollTrigger);

const OUTCOMES = [
  {
    number: "01",
    title: "Sports scholarship consideration",
    body: "October's reward is a shot at a scholarship into high-performance training, subject to eligibility.",
    tone: "green",
  },
  {
    number: "02",
    title: "High-performance training",
    body: "A potential pathway to structured coaching, technical development and athlete growth.",
    tone: "blue",
  },
  {
    number: "03",
    title: "Competition exposure",
    body: "A serious city stage for young athletes to test themselves in their chosen sport.",
    tone: "coral",
  },
];

export default function OpportunitySplit() {
  const rootRef = useRef(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const media = gsap.matchMedia();
    const context = gsap.context(() => {
      media.add("(min-width: 901px) and (prefers-reduced-motion: no-preference)", () => {
        const cards = gsap.utils.toArray(".opportunity-card");
        const distance = () => Math.min(56, Math.max(28, window.innerWidth * 0.04));
        const timeline = gsap.timeline({
          scrollTrigger: {
            trigger: root,
            start: "top top",
            end: "bottom bottom",
            scrub: 0.65,
            invalidateOnRefresh: true,
          },
        });

        timeline
          .to(cards, { scale: 0.94, borderRadius: 28, duration: 0.23, ease: "power2.inOut" }, 0.25)
          .to(cards[0], { x: () => -distance(), duration: 0.23, ease: "power2.inOut" }, 0.25)
          .to(cards[2], { x: () => distance(), duration: 0.23, ease: "power2.inOut" }, 0.25)
          .to(cards, { rotationY: 180, duration: 0.3, ease: "power3.inOut" }, 0.48)
          .to(cards[0], { rotationZ: -3, duration: 0.3, ease: "power3.inOut" }, 0.48)
          .to(cards[2], { rotationZ: 3, duration: 0.3, ease: "power3.inOut" }, 0.48)
          .fromTo(".opportunity-heading", { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: 0.22, ease: "power3.out" }, 0.78);

        return () => timeline.kill();
      });
    }, root);

    return () => {
      media.revert();
      context.revert();
    };
  }, []);

  return (
    <section className="opportunity-split" id="pathway" ref={rootRef}>
      <div className="opportunity-sticky">
        <div className="opportunity-heading">
          <span className="eyebrow">Beyond the podium</span>
          <h2>One performance.<br />Three possible doors.</h2>
        </div>
        <div className="opportunity-panels" role="list" aria-label="Potential athlete opportunities">
          {OUTCOMES.map((outcome, index) => (
            <article className="opportunity-panel" role="listitem" key={outcome.title}>
              <div className="opportunity-card">
                <div className={`opportunity-face opportunity-front opportunity-image-${index + 1}`} aria-hidden="true" />
                <div className={`opportunity-face opportunity-back opportunity-${outcome.tone}`}>
                  <span>{outcome.number}</span>
                  <h3>{outcome.title}</h3>
                  <p>{outcome.body}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
        <div className="opportunity-mobile">
          <img src="/archive/swimming-wide.webp" alt="Athletes competing at the July edition" width="1800" height="1200" loading="lazy" />
          <div className="opportunity-mobile-list">
            {OUTCOMES.map((outcome) => (
              <article key={outcome.title}>
                <span>{outcome.number}</span>
                <div><h3>{outcome.title}</h3><p>{outcome.body}</p></div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
