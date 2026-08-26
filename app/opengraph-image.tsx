import { ImageResponse } from "next/og";

export const alt = "Aletheia — review-first writing for professional outreach";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        background:
          "radial-gradient(circle at 12% 108%, #285D49 0%, #091814 28%, #020403 62%)",
        color: "#f7faf9",
        display: "flex",
        height: "100%",
        width: "100%",
        padding: "72px",
        position: "relative",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div
        style={{
          display: "flex",
          color: "#78b49b",
          fontSize: 26,
          letterSpacing: 4,
        }}
      >
        ALETHEIA
      </div>
      <div style={{ display: "flex", flexDirection: "column", maxWidth: 800 }}>
        <div
          style={{
            display: "flex",
            color: "#78b49b",
            fontSize: 22,
            letterSpacing: 2,
          }}
        >
          REVIEW-FIRST PROFESSIONAL OUTREACH
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 66,
            lineHeight: 1.05,
            marginTop: 22,
            fontWeight: 700,
          }}
        >
          Bring the right context to every introduction.
        </div>
      </div>
      <div style={{ display: "flex", gap: 14 }}>
        {["Choose context", "Refine draft", "You decide"].map((step) => (
          <div
            key={step}
            style={{
              display: "flex",
              border: "1px solid #285d49",
              padding: "15px 20px",
              color: "#f7faf9",
              fontSize: 21,
            }}
          >
            {step}
          </div>
        ))}
      </div>
    </div>,
    size,
  );
}
