'use client'

/**
 * AuroraBackground — Full-viewport spectral aurora + film grain overlay.
 *
 * Usage:
 *   <AuroraBackground />   inside any layout / page as a sibling above content.
 *
 * The component renders:
 *  • 4 animated aurora "shards" using radial-gradient + blur, drift-animated
 *  • Film-grain pseudo-element via the .aurora-grain global class (see globals.css)
 *
 * Palette (Aurora Forest, ref: Stitch screen #17907855579365939357):
 *   #000000  — base black
 *   #1E4D4A  — deep teal (primary aurora)
 *   #163351  — navy blue (secondary aurora)
 *   #2D1B4E  — deep violet (tertiary aurora)
 *   #0D3D2E  — forest green (quaternary aurora)
 *   #DAF1DE  — mint (accent / highlight)
 */
export default function AuroraBackground() {
  return (
    <div
      aria-hidden
      className="aurora-master"
    >
      {/* Shard 1 — deep teal, upper-left, slow drift */}
      <div className="aurora-shard shard-1" />
      {/* Shard 2 — navy blue, lower-right, medium drift */}
      <div className="aurora-shard shard-2" />
      {/* Shard 3 — deep violet, centre, fast drift */}
      <div className="aurora-shard shard-3" />
      {/* Shard 4 — forest green, upper-right, slow reverse */}
      <div className="aurora-shard shard-4" />
    </div>
  )
}
