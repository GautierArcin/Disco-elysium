"use client";

import { useRef, useEffect } from "react";

export default function VideoBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.play().catch(() => {
      const unlock = () => {
        video.play();
        window.removeEventListener("click", unlock);
        window.removeEventListener("keydown", unlock);
      };
      window.addEventListener("click", unlock);
      window.addEventListener("keydown", unlock);
    });
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ zIndex: 0 }}>
      <div className="absolute inset-0" style={{ background: "#0a0816" }} />
      <video
        ref={videoRef}
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      >
        <source src="/video/bg.mp4" type="video/mp4" />
      </video>
    </div>
  );
}
