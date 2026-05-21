"use client";

import { useEffect, useState } from "react";
import { MeshGradient } from "@paper-design/shaders-react";

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

const fill: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
};

const wrapper: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: -1,
  pointerEvents: "none",
  background: "#0a1a22",
  overflow: "hidden",
};

export default function ShaderBackground() {
  const reduced = useReducedMotion();

  if (reduced) {
    return (
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          zIndex: -1,
          background:
            "linear-gradient(135deg, #182830 0%, #204050 25%, #285868 45%, #308890 65%, #5888a0 85%, #70b8c8 100%)",
        }}
      />
    );
  }

  return (
    <div aria-hidden style={wrapper}>
      <MeshGradient
        style={fill}
        colors={["#204050", "#285868", "#308890", "#5888a0", "#70b8c8"]}
        distortion={0.85}
        swirl={0.25}
        speed={0.35}
        grainMixer={0.05}
        grainOverlay={0.05}
      />
    </div>
  );
}
