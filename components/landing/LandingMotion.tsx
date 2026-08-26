"use client";

import { useRef, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

gsap.registerPlugin(useGSAP);

type LandingMotionProps = {
  children: ReactNode;
};

export default function LandingMotion({ children }: LandingMotionProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return;

      const media = gsap.matchMedia();

      media.add(
        {
          reduceMotion: "(prefers-reduced-motion: reduce)",
          desktop: "(min-width: 900px)",
        },
        (context) => {
          const { reduceMotion, desktop } = context.conditions as {
            reduceMotion: boolean;
            desktop: boolean;
          };
          const heroItems = gsap.utils.toArray<HTMLElement>(
            "[data-landing-hero-item]",
            root,
          );
          const sectionItems = gsap.utils.toArray<HTMLElement>(
            ".landing-section-reveal",
            root,
          );
          const aurora = root.querySelector<HTMLElement>("[data-hero-aurora]");

          if (reduceMotion) {
            gsap.set([...heroItems, ...sectionItems], {
              autoAlpha: 1,
              x: 0,
              y: 0,
              clearProps: "transform,opacity,visibility",
            });
            return;
          }

          gsap.fromTo(
            heroItems,
            {
              autoAlpha: 0,
              y: desktop ? 28 : 18,
            },
            {
              autoAlpha: 1,
              y: 0,
              duration: 0.82,
              ease: "power3.out",
              stagger: 0.09,
              clearProps: "transform,opacity,visibility",
            },
          );

          if (aurora) {
            gsap.fromTo(
              aurora,
              { autoAlpha: 0.45, xPercent: -3, yPercent: 2, scale: 0.96 },
              {
                autoAlpha: 1,
                xPercent: 0,
                yPercent: 0,
                scale: 1,
                duration: 4.2,
                ease: "power1.out",
                clearProps: "transform,opacity,visibility",
              },
            );
          }

          gsap.set(sectionItems, {
            y: desktop ? 30 : 20,
          });

          const observer = new IntersectionObserver(
            (entries) => {
              for (const entry of entries) {
                if (!entry.isIntersecting) continue;

                gsap.to(entry.target, {
                  y: 0,
                  duration: 0.72,
                  ease: "power2.out",
                  overwrite: "auto",
                  clearProps: "transform,opacity,visibility",
                });
                observer.unobserve(entry.target);
              }
            },
            { rootMargin: "0px 0px -10% 0px", threshold: 0.12 },
          );

          sectionItems.forEach((item) => observer.observe(item));
          return () => observer.disconnect();
        },
      );

      return () => media.revert();
    },
    { scope: rootRef },
  );

  return (
    <div ref={rootRef} className="landing landing-marketing">
      {children}
    </div>
  );
}
