import VideoBackground from "@/components/VideoBackground";
import AppShell from "@/components/AppShell";
import { PANEL_WIDTH } from "@/core/layout";

export default function Home() {
  return (
    <main
      className="w-screen h-[100dvh] overflow-hidden relative"
      style={{ "--panel-width": PANEL_WIDTH } as React.CSSProperties}
    >
      <VideoBackground />
      <AppShell />
    </main>
  );
}
