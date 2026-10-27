import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export const alt =
  "La Patte Dorée — Garde familiale de chiens & chats près de Disneyland Paris";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#FAF6F0",
          backgroundImage:
            "radial-gradient(circle at 88% 18%, rgba(197, 155, 39, 0.18), transparent 42%), radial-gradient(circle at 12% 85%, rgba(197, 155, 39, 0.12), transparent 38%)",
          padding: "56px 64px",
          color: "#1F2933",
          fontFamily: "sans-serif",
          border: "12px solid #FBF3D5",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              backgroundColor: "#FBF3D5",
              border: "2px solid #C59B27",
              borderRadius: "9999px",
              padding: "10px 22px",
              fontSize: "22px",
              fontWeight: 700,
              color: "#1F2933",
            }}
          >
            <span style={{ color: "#C59B27" }}>●</span>
            <span>À 10 min de Disneyland Paris · Bussy-Saint-Georges (77)</span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#1F2933",
              color: "#FBF3D5",
              borderRadius: "18px",
              padding: "12px 22px",
              fontSize: "20px",
              fontWeight: 700,
              letterSpacing: "0.04em",
            }}
          >
            www.lapatte-doree.fr
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            maxWidth: "980px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "18px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "76px",
                height: "76px",
                borderRadius: "22px",
                backgroundColor: "#C59B27",
                color: "#FFFFFF",
                fontSize: "40px",
                fontWeight: 800,
              }}
            >
              🐾
            </div>
            <div
              style={{
                fontSize: "76px",
                fontWeight: 900,
                color: "#1F2933",
                letterSpacing: "-0.02em",
                lineHeight: 1.05,
              }}
            >
              La Patte Dorée
            </div>
          </div>

          <div
            style={{
              fontSize: "36px",
              fontWeight: 600,
              color: "#334155",
              lineHeight: 1.32,
            }}
          >
            Garde familiale de chiens &amp; chats — en maison avec jardin clos,
            sans box ni chenil
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "18px",
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              backgroundColor: "#1F2933",
              color: "#FAF6F0",
              borderRadius: "16px",
              padding: "16px 26px",
              fontSize: "24px",
              fontWeight: 700,
            }}
          >
            <span style={{ color: "#C59B27", marginRight: "10px" }}>★</span>
            <span>5,0 / 5 Avis vérifiés</span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              backgroundColor: "#FFFFFF",
              color: "#1F2933",
              border: "2px solid #E2D9C5",
              borderRadius: "16px",
              padding: "16px 26px",
              fontSize: "24px",
              fontWeight: 700,
            }}
          >
            Diplômé ACACED
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              backgroundColor: "#FBF3D5",
              color: "#1F2933",
              border: "2px solid #C59B27",
              borderRadius: "16px",
              padding: "16px 26px",
              fontSize: "24px",
              fontWeight: 800,
            }}
          >
            Dès 35 € / jour
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
