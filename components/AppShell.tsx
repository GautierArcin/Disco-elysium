"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import ChatBox from "@/components/ChatBox";
import {
  SKILLS,
  DEFAULT_SKILL,
  GROUP_COLORS,
  GROUP_LABELS,
  GROUPS,
  type Skill,
} from "@/core/skills";
import {
  PANEL_WIDTH,
  PORTRAIT_W,
  PORTRAIT_H,
  SIDEBAR_W,
  SIDEBAR_OVERLAP,
  MOBILE_HEADER_H,
} from "@/core/layout";
import { ChatProvider } from "@/context/ChatContext";
import { AudioProvider, useAudio } from "@/context/AudioContext";

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [breakpoint]);
  return isMobile;
}

export default function AppShell() {
  return (
    <ChatProvider>
      <AudioProvider>
        <AppShellInner />
      </AudioProvider>
    </ChatProvider>
  );
}

function AppShellInner() {
  const [activeSkill, setActiveSkill] = useState<Skill>(DEFAULT_SKILL);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [multiMode, setMultiMode] = useState(false);
  const [speakingSkillId, setSpeakingSkillId] = useState<string | null>(null);
  const [streamingSkillId, setStreamingSkillId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const { muted, toggleMute, provider, setProvider, elevenLabsAvailable } =
    useAudio();

  const onSpeakingSkill = useCallback(
    (id: string | null) => setSpeakingSkillId(id),
    [],
  );
  const onStreamingSkill = useCallback(
    (id: string | null) => setStreamingSkillId(id),
    [],
  );

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selectSkill = useCallback((skill: Skill) => {
    setActiveSkill(skill);
    setDropdownOpen(false);
  }, []);

  // In multi mode: speaking (audio) > streaming (waiting) > "multi" fallback
  const speakingSkill =
    multiMode && speakingSkillId
      ? (SKILLS.find((s) => s.id === speakingSkillId) ?? null)
      : null;
  const streamingSkillObj =
    multiMode && streamingSkillId
      ? (SKILLS.find((s) => s.id === streamingSkillId) ?? null)
      : null;
  const portraitSkill = multiMode
    ? (speakingSkill ?? streamingSkillObj)
    : activeSkill;
  const color = portraitSkill
    ? GROUP_COLORS[portraitSkill.group]
    : GROUP_COLORS[activeSkill.group];

  // Shared skill list — used by desktop dropdown and mobile sheet.
  const skillList = (itemH: number, fontPx: number, labelPx: number) =>
    GROUPS.map((group) => (
      <div key={group}>
        <div
          className="px-3 uppercase"
          style={{
            fontSize: `${labelPx}px`,
            letterSpacing: "0.25em",
            color: `${GROUP_COLORS[group]}77`,
            paddingTop: "10px",
            paddingBottom: "5px",
            borderTop: "1px solid #12101e",
          }}
        >
          {GROUP_LABELS[group]}
        </div>
        {SKILLS.filter((s) => s.group === group).map((skill) => {
          const gc = GROUP_COLORS[group];
          const isActive = skill.id === activeSkill.id;
          return (
            <button
              key={skill.id}
              onClick={() => selectSkill(skill)}
              className="w-full text-left px-3"
              style={{
                height: `${itemH}px`,
                fontSize: `${fontPx}px`,
                letterSpacing: "0.12em",
                fontFamily: "inherit",
                cursor: "pointer",
                background: isActive ? `${gc}18` : "transparent",
                color: isActive ? gc : `${gc}88`,
                borderLeft: isActive
                  ? `3px solid ${gc}`
                  : "3px solid transparent",
              }}
            >
              {skill.name.toUpperCase()}
            </button>
          );
        })}
      </div>
    ));

  return (
    <>
      {/* Preload all portraits — offscreen-but-rendered so next/image fetches
          the same optimized URLs the portrait uses, warming the browser cache. */}
      <div
        aria-hidden
        className="fixed pointer-events-none"
        style={{
          top: 0,
          left: 0,
          width: `${PORTRAIT_W}px`,
          height: `${PORTRAIT_H}px`,
          opacity: 0,
          zIndex: -1,
        }}
      >
        {[...SKILLS.map((s) => s.image), "/skills/multi.jpeg"].map((src) => (
          <Image
            key={src}
            src={src}
            alt=""
            fill
            sizes={`${PORTRAIT_W}px`}
            className="object-cover object-top"
          />
        ))}
      </div>

      {isMobile ? (
        <MobileChrome
          color={color}
          portraitSkill={portraitSkill}
          activeSkill={activeSkill}
          multiMode={multiMode}
          setMultiMode={setMultiMode}
          muted={muted}
          toggleMute={toggleMute}
          provider={provider}
          setProvider={setProvider}
          elevenLabsAvailable={elevenLabsAvailable}
          dropdownOpen={dropdownOpen}
          setDropdownOpen={setDropdownOpen}
          dropdownRef={dropdownRef}
          skillList={skillList}
        />
      ) : (
        /* Desktop sidebar — unified column flush against the chat panel */
        <aside
          ref={dropdownRef}
          className="fixed z-30 flex flex-col"
          style={{
            top: 0,
            bottom: 0,
            right: `calc(${PANEL_WIDTH} - ${SIDEBAR_OVERLAP}px)`,
            width: `${SIDEBAR_W}px`,
            padding: "24px 20px 24px 24px",
          }}
        >
          {/* Portrait */}
          <div
            className="relative w-full"
            style={{ aspectRatio: `${PORTRAIT_W} / ${PORTRAIT_H}` }}
          >
            <div
              className="absolute inset-0"
              style={{
                background: "#0a0814",
                border: `1px solid ${color}44`,
                boxShadow: `0 4px 24px rgba(0,0,0,0.8), inset 0 0 0 1px #0d0a18`,
              }}
            />
            <div className="absolute inset-[3px] overflow-hidden">
              <Image
                src={portraitSkill ? portraitSkill.image : "/skills/multi.jpeg"}
                alt={portraitSkill ? portraitSkill.name : "Multi"}
                fill
                sizes={`${SIDEBAR_W}px`}
                className="object-cover object-top"
                priority
              />
              <div
                className="absolute inset-0"
                style={{ boxShadow: "inset 0 0 18px 6px rgba(4, 2, 12, 0.75)" }}
              />
            </div>
            <div
              className="absolute bottom-0 left-0 right-0 flex items-center justify-center"
              style={{
                height: "26px",
                background: "rgba(6, 4, 14, 0.9)",
                borderTop: `1px solid ${color}33`,
              }}
            >
              <span
                className="uppercase tracking-widest truncate px-2"
                style={{
                  fontSize: "10px",
                  letterSpacing: "0.28em",
                  color: `${color}cc`,
                }}
              >
                {portraitSkill
                  ? portraitSkill.name
                  : multiMode
                    ? "MULTI"
                    : activeSkill.name}
              </span>
            </div>
          </div>

          {/* Multi toggle */}
          <button
            onClick={() => {
              setMultiMode((m) => !m);
              setDropdownOpen(false);
            }}
            className="w-full flex items-center justify-center gap-2 flex-shrink-0"
            style={{
              height: "50px",
              marginTop: "18px",
              background: multiMode ? "#12092a" : "#0a0814",
              border: `1px solid ${multiMode ? "#6040a066" : "#2e285066"}`,
              color: multiMode ? "#a07ad8" : "#6a5f8a",
              fontSize: "14px",
              letterSpacing: "0.22em",
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: "18px" }}>{multiMode ? "▣" : "□"}</span>
            <span className="uppercase">Multi</span>
          </button>

          {/* Skill dropdown — invisible when multi active (keeps layout) */}
          <div className="relative flex-shrink-0" style={{ marginTop: "10px" }}>
            <button
              onClick={() => setDropdownOpen((o) => !o)}
              className="w-full flex items-center justify-between px-3"
              style={{
                height: "52px",
                background: "#0a0814",
                border: `1px solid ${color}66`,
                color: `${color}cc`,
                fontSize: "14px",
                letterSpacing: "0.2em",
                fontFamily: "inherit",
                cursor: "pointer",
                visibility: multiMode ? "hidden" : "visible",
              }}
            >
              <span className="uppercase truncate">{activeSkill.name}</span>
              <span style={{ fontSize: "13px", opacity: 0.6 }}>
                {dropdownOpen ? "▲" : "▼"}
              </span>
            </button>

            {dropdownOpen && (
              <div
                className="absolute left-0 right-0 overflow-y-auto z-40"
                style={{
                  top: "53px",
                  background: "#08060f",
                  border: `1px solid #1e1830`,
                  borderTop: "none",
                  maxHeight: "min(460px, calc(100vh - 360px))",
                  scrollbarWidth: "none",
                }}
              >
                {skillList(46, 14, 12)}
              </div>
            )}
          </div>

          {/* Audio controls — pinned to bottom */}
          <div className="w-full flex flex-col gap-[6px] mt-auto flex-shrink-0">
            <button
              onClick={toggleMute}
              className="w-full flex items-center justify-center gap-2"
              style={{
                height: "50px",
                background: !muted ? "#12092a" : "#0a0814",
                border: `1px solid ${!muted ? "#6040a066" : "#2e285066"}`,
                color: !muted ? "#a07ad8" : "#6a5f8a",
                fontSize: "14px",
                letterSpacing: "0.22em",
                fontFamily: "inherit",
                cursor: "pointer",
              }}
            >
              <span style={{ fontSize: "18px" }}>{!muted ? "▣" : "□"}</span>
              <span className="uppercase">Sound</span>
            </button>

            <div className="w-full flex gap-[6px]" style={{ height: "44px" }}>
              {(["elevenlabs", "browser"] as const).map((p) => {
                const isActive = provider === p;
                const unavailable =
                  p === "elevenlabs" && elevenLabsAvailable === false;
                const label =
                  p === "elevenlabs" ? "Narrator voice" : "Browser generated";
                return (
                  <button
                    key={p}
                    onClick={() => setProvider(p)}
                    disabled={unavailable}
                    className="flex-1 uppercase leading-tight flex items-center justify-center text-center px-2"
                    style={{
                      background: isActive ? "#12092a" : "#0a0814",
                      border: `1px solid ${isActive ? "#6040a066" : "#2e285066"}`,
                      color: unavailable
                        ? "#2a2438"
                        : isActive
                          ? "#a07ad8"
                          : "#6a5f8a",
                      fontSize: "10px",
                      letterSpacing: "0.12em",
                      fontFamily: "inherit",
                      cursor: unavailable ? "not-allowed" : "pointer",
                    }}
                    title={
                      unavailable
                        ? "Not enough token for the API, dev is poor :("
                        : ""
                    }
                  >
                    {label}
                    {unavailable ? " ✕" : ""}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>
      )}

      {/* Chat panel */}
      <ChatBox
        skill={activeSkill}
        multiMode={multiMode}
        isMobile={isMobile}
        onSpeakingSkill={onSpeakingSkill}
        onStreamingSkill={onStreamingSkill}
      />
    </>
  );
}

function MobileChrome({
  color,
  portraitSkill,
  activeSkill,
  multiMode,
  setMultiMode,
  muted,
  toggleMute,
  provider,
  setProvider,
  elevenLabsAvailable,
  dropdownOpen,
  setDropdownOpen,
  dropdownRef,
  skillList,
}: {
  color: string;
  portraitSkill: Skill | null;
  activeSkill: Skill;
  multiMode: boolean;
  setMultiMode: React.Dispatch<React.SetStateAction<boolean>>;
  muted: boolean;
  toggleMute: () => void;
  provider: "elevenlabs" | "browser";
  setProvider: (p: "elevenlabs" | "browser") => void;
  elevenLabsAvailable: boolean | null;
  dropdownOpen: boolean;
  setDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  dropdownRef: React.RefObject<HTMLDivElement | null>;
  skillList: (
    itemH: number,
    fontPx: number,
    labelPx: number,
  ) => React.ReactNode;
}) {
  const portraitName = portraitSkill
    ? portraitSkill.name
    : multiMode
      ? "MULTI"
      : activeSkill.name;
  const thumbSrc = portraitSkill ? portraitSkill.image : "/skills/multi.jpeg";

  return (
    <div
      ref={dropdownRef}
      className="fixed top-0 left-0 right-0 z-40"
      style={{ height: `${MOBILE_HEADER_H}px` }}
    >
      {/* Top bar */}
      <div
        className="flex items-center gap-3 px-3 h-full"
        style={{
          background: "rgba(8, 6, 14, 0.62)",
          backdropFilter: "blur(7px)",
          WebkitBackdropFilter: "blur(7px)",
          borderBottom: `1px solid ${color}33`,
        }}
      >
        {/* Portrait thumbnail */}
        <div
          className="relative flex-shrink-0 overflow-hidden"
          style={{
            width: "58px",
            height: "74px",
            border: `1px solid ${color}55`,
          }}
        >
          <Image
            src={thumbSrc}
            alt={portraitName}
            fill
            sizes="44px"
            className="object-cover object-top"
            priority
          />
        </div>

        <span
          className="uppercase truncate flex-1 min-w-0"
          style={{
            fontSize: "13px",
            letterSpacing: "0.06em",
            color: `${color}cc`,
          }}
        >
          {portraitName}
        </span>

        {/* Multi toggle */}
        <button
          onClick={() => {
            setMultiMode((m) => !m);
            setDropdownOpen(false);
          }}
          className="flex items-center justify-center gap-2 px-5"
          style={{
            height: "62px",
            background: multiMode ? "#12092a" : "#0a0814",
            border: `1px solid ${multiMode ? "#6040a066" : "#2e285066"}`,
            color: multiMode ? "#8060c0" : "#7a6f9a",
            fontSize: "14px",
            letterSpacing: "0.12em",
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          <span style={{ fontSize: "18px" }}>{multiMode ? "▣" : "□"}</span>
          <span className="uppercase">Multi</span>
        </button>

        {/* Sound toggle */}
        <button
          onClick={toggleMute}
          className="flex items-center justify-center px-3"
          style={{
            height: "62px",
            minWidth: "62px",
            background: !muted ? "#12092a" : "#0a0814",
            border: `1px solid ${!muted ? "#6040a066" : "#2e285066"}`,
            color: !muted ? "#8060c0" : "#5a4f7a",
            fontSize: "24px",
            fontFamily: "inherit",
            cursor: "pointer",
          }}
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? "♪̸" : "♪"}
        </button>

        {/* Skills menu toggle */}
        <button
          onClick={() => setDropdownOpen((o) => !o)}
          className="flex items-center justify-center gap-2 px-5"
          style={{
            height: "62px",
            background: "#0a0814",
            border: `1px solid ${color}66`,
            color: `${color}cc`,
            fontSize: "14px",
            letterSpacing: "0.12em",
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          <span className="uppercase">Skills</span>
          <span style={{ fontSize: "13px", opacity: 0.7 }}>
            {dropdownOpen ? "▲" : "▼"}
          </span>
        </button>
      </div>

      {/* Slide-down sheet: skill list + provider toggle */}
      {dropdownOpen && (
        <div
          className="overflow-y-auto"
          style={{
            background: "rgba(6, 4, 12, 0.82)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            borderBottom: "1px solid #1e1830",
            maxHeight: `calc(100dvh - ${MOBILE_HEADER_H}px)`,
            scrollbarWidth: "none",
          }}
        >
          {/* Provider toggle */}
          <div
            className="flex gap-[6px] px-3 pt-3 pb-1"
            style={{ height: "58px" }}
          >
            {(["elevenlabs", "browser"] as const).map((p) => {
              const isActive = provider === p;
              const unavailable =
                p === "elevenlabs" && elevenLabsAvailable === false;
              const label =
                p === "elevenlabs" ? "Narrator voice" : "Browser generated";
              return (
                <button
                  key={p}
                  onClick={() => setProvider(p)}
                  disabled={unavailable}
                  className="flex-1 uppercase leading-tight flex items-center justify-center text-center px-2"
                  style={{
                    background: isActive ? "#12092a" : "#0a0814",
                    border: `1px solid ${isActive ? "#6040a066" : "#2e285066"}`,
                    color: unavailable
                      ? "#2a2438"
                      : isActive
                        ? "#8060c0"
                        : "#7a6f9a",
                    fontSize: "11px",
                    letterSpacing: "0.12em",
                    fontFamily: "inherit",
                    cursor: unavailable ? "not-allowed" : "pointer",
                  }}
                  title={
                    unavailable
                      ? "Not enough token for the API, dev is poor :("
                      : ""
                  }
                >
                  {label}
                  {unavailable ? " ✕" : ""}
                </button>
              );
            })}
          </div>
          {skillList(46, 13, 12)}
        </div>
      )}
    </div>
  );
}
