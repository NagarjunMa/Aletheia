import { ImageResponse } from "next/og";

export const alt = "Aletheia — review-first writing for professional outreach";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        background: "#050806",
        color: "#d1f2eb",
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
          color: "#50c878",
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
            color: "#50c878",
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
              border: "1px solid #1f4d39",
              padding: "15px 20px",
              color: "#d1f2eb",
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
