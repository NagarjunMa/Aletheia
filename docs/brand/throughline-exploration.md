# Throughline — approved Aletheia mark

## Meaning

Several short strokes stand for the selected context a person brings to Aletheia. They converge into one clear line: a draft to review and edit. The three strokes are symbolic, not a claim that the product always requires exactly three inputs. The mark does not depict a recipient, a message being sent, or AI acting independently.

## What we tested

- **Original:** The cleanest expression of convergence, but visually small in a 16 px toolbar slot.
- **Pause and review-marker experiments:** Made the mark read more like a send or process control. Discarded.
- **Refined standalone:** Wider, taller, and heavier paths retain the same idea with a clearer small-size silhouette.
- **Dark badge:** A high-contrast treatment for the dark web and extension surfaces.
- **Offset joins:** The upper and lower inputs meet the draft line at different positions. This removes the single pointed convergence that suggested a send arrow while retaining the Throughline idea. A matching dark badge has been rendered at 16, 32, 48, and 128 px.

## Approved direction

The offset-joins mark is the primary symbol. The matching evergreen badge is the deployed small-icon treatment, paired with the existing Flaviotte Aletheia wordmark on the site and extension. The earlier concepts remain exploration references only.

The web uses `public/Aletheia.svg` for its shared mark and favicon and `public/aletheia-apple-touch.png` for Apple touch icons. The extension uses the same badge rasterized at 16, 32, 48, and 128 pixels in `ascendia-extension/icons/`. Its popup, settings, toolbar, and packaged manifest use those files. The Chrome Web Store listing icon and screenshots are managed in the Store dashboard; source changes do not update them automatically.

## Constraints

- Use a single color: `#285D49` on light surfaces; light ink on `#091814` for dark applications.
- Preserve square-ended source lines, asymmetrical joins, and a flat terminal; do not add an arrowhead, paper plane, sparkle, or automatic-send cue.
- Keep enough clear space that the three inputs remain distinct at small sizes.
- Do not recolor the mark with the earlier blue identity or stretch it to fill a rectangular wordmark slot.
- Check the 16 px toolbar silhouette, dark-background contrast, favicon, auth/landing wordmark pairing, and packaged extension before publishing a new version.

## Local verification — 2026-09-23

Risk tier: **Standard**. This is a visual asset and source-version change; it adds no permission, remote request, data processing, or authentication behavior. The compact acceptance contract is that every in-app logo surface uses the approved offset-joins mark, the raster icons match the SVG, and the extension version policy passes.

- The web SVG matches the approved badge byte-for-byte. Fresh rasterization from it matches the 16/32/48/128 px extension icons and 180 px Apple icon byte-for-byte; desktop landing and auth pairings and the enlarged 16 px silhouette were visually inspected.
- The fresh local pre-merge checks passed on Node 24: `make ci`, `npm run test:coverage -- --run` (91 files/1,094 tests), `make extension-ci` (21 files/214 tests), `make e2e-smoke` with the canonical app URL (27 tests), the extension version policy, and changed-file formatting/diff checks. Root and extension dependency audits found zero vulnerabilities. The existing refund-admin lint warning and three pre-existing warnings in the E2E fixture are non-blocking.
- An installed-extension toolbar check, real-device Apple icon check, Vercel deployment, and Chrome Web Store listing/screenshot review were **not run**. The Store-published version remains unchanged. No clean-commit upload ZIP exists; the evaluation ZIP carried `-dirty` metadata and was later cleared by extension CI.

Rollout: merge and deploy the web assets, then build the 1.0.18 extension ZIP from a clean commit before a separately authorized Store upload. Before Store publication, revert the source changes if needed. After publishing 1.0.18, a Store rollback requires the previous artwork in a **higher** extension version; web assets can be reverted and redeployed independently.
