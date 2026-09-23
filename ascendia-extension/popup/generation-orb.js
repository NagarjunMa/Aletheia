// Use the renderer-only ESM build, vendored as a browser-resolvable asset.
// Source ZIPs load this relative module; unpacked esbuild builds inline it.
export async function startGenerationOrb(canvas, initialState) {
  const { MODE_FRAMES, paintFrame, resolvePreset } =
    await import("../assets/thinking-orbs-engine.js");
  const context = canvas.getContext("2d");
  if (!context) return { setState() {}, stop() {} };

  const size = 48;
  const presetSize = 64; // Thinking Orbs tunes only 20, 32, and 64px presets.
  const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(size * pixelRatio);
  canvas.height = Math.round(size * pixelRatio);

  const motionPreference = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  );
  const tint = { r: 120, g: 180, b: 155 }; // #78B49B, the extension focus/accent token.
  let state = initialState;
  let frameId = 0;
  let stopped = false;

  function draw(seconds) {
    const preset = resolvePreset(state, presetSize);
    const frame = MODE_FRAMES[preset.mode](
      presetSize,
      seconds * preset.speed,
      preset.opts,
    );
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, size, size);
    context.setTransform(
      (pixelRatio * size) / presetSize,
      0,
      0,
      (pixelRatio * size) / presetSize,
      0,
      0,
    );
    paintFrame(context, frame, true, tint);
  }

  function animate() {
    if (stopped || motionPreference.matches || document.hidden) return;
    draw(performance.now() / 1000);
    frameId = requestAnimationFrame(animate);
  }

  function syncMotion() {
    cancelAnimationFrame(frameId);
    frameId = 0;
    if (stopped) return;
    if (motionPreference.matches || document.hidden) {
      draw(0.6);
    } else {
      frameId = requestAnimationFrame(animate);
    }
  }

  motionPreference.addEventListener("change", syncMotion);
  document.addEventListener("visibilitychange", syncMotion);
  syncMotion();

  return {
    setState(nextState) {
      if (stopped || nextState === state) return;
      state = nextState;
      syncMotion();
    },
    stop() {
      stopped = true;
      cancelAnimationFrame(frameId);
      motionPreference.removeEventListener("change", syncMotion);
      document.removeEventListener("visibilitychange", syncMotion);
      context.clearRect(0, 0, size, size);
    },
  };
}
