import VideoBackground from "@/components/VideoBackground";
import ChatBox from "@/components/ChatBox";
import Image from "next/image";

// Panel width as CSS variable so portrait can reference it
const PANEL_WIDTH = "480px";
const PORTRAIT_W = 140;
const PORTRAIT_H = 170;

export default function Home() {
  return (
    <main
      className="w-screen h-screen overflow-hidden relative"
      style={
        { "--panel-width": PANEL_WIDTH } as React.CSSProperties
      }
    >
      {/* Full-screen background */}
      <VideoBackground />

      {/* ── Portrait frame — floats LEFT of dialog panel ── */}
      {/* Positioned so its right edge overlaps the panel's left edge by ~10px */}
      <div
        className="fixed z-30"
        style={{
          right: `calc(${PANEL_WIDTH} - 10px)`,
          top: "52px",
          width: `${PORTRAIT_W}px`,
          height: `${PORTRAIT_H}px`,
        }}
      >
        {/* Outer grungy frame */}
        <div
          className="absolute inset-0"
          style={{
            background: "#0a0814",
            border: "1px solid #2a2040",
            boxShadow: "0 4px 24px rgba(0,0,0,0.8), inset 0 0 0 1px #0d0a18",
          }}
        />
        {/* The actual image */}
        <div className="absolute inset-[3px] overflow-hidden">
          <Image
            src="/volition-portrait.png"
            alt="Volition"
            fill
            className="object-cover object-top"
            priority
          />
          {/* Inner vignette — dark edges to blend into frame */}
          <div
            className="absolute inset-0"
            style={{
              boxShadow:
                "inset 0 0 18px 6px rgba(4, 2, 12, 0.75)",
            }}
          />
        </div>
        {/* Bottom label strip */}
        <div
          className="absolute bottom-0 left-0 right-0 flex items-center justify-center"
          style={{
            height: "18px",
            background: "rgba(6, 4, 14, 0.9)",
            borderTop: "1px solid #1e1830",
          }}
        >
          <span
            className="text-[#3d3060] uppercase tracking-widest"
            style={{ fontSize: "7px", letterSpacing: "0.3em" }}
          >
            Volition
          </span>
        </div>
      </div>

      {/* ── Vertical DE-style nav tabs (right of portrait, left of panel) ── */}
      <div
        className="fixed z-20 flex flex-col items-center pointer-events-none"
        style={{
          right: `calc(${PANEL_WIDTH} + 2px)`,
          top: "260px",
          gap: "2px",
        }}
      >
        {["HAUNT", "PLAYER", "TASK", "MAP"].map((tab) => (
          <div
            key={tab}
            className="text-[#18142a]"
            style={{
              fontSize: "7px",
              letterSpacing: "0.22em",
              writingMode: "vertical-rl",
              transform: "rotate(180deg)",
              padding: "3px 1px",
            }}
          >
            {tab}
          </div>
        ))}
      </div>

      {/* ── The dialog panel ── */}
      <ChatBox />
    </main>
  );
}
