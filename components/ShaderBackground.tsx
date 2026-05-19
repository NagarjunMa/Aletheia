"use client";

import { MeshGradient } from "@paper-design/shaders-react";

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
