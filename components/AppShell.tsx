"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import ChatBox from "@/components/ChatBox";
import { SKILLS, DEFAULT_SKILL, GROUP_COLORS, GROUP_LABELS, GROUPS, type Skill } from "@/core/skills";
import { PANEL_WIDTH, PORTRAIT_W, PORTRAIT_H } from "@/core/layout";
import { ChatProvider } from "@/context/ChatContext";
import { AudioProvider, useAudio } from "@/context/AudioContext";


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

  const { muted, toggleMute, provider, setProvider, isLocalhost, elevenLabsAvailable } = useAudio();

  const onSpeakingSkill = useCallback((id: string | null) => setSpeakingSkillId(id), []);
  const onStreamingSkill = useCallback((id: string | null) => setStreamingSkillId(id), []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
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
  const speakingSkill = multiMode && speakingSkillId
    ? (SKILLS.find((s) => s.id === speakingSkillId) ?? null)
    : null;
  const streamingSkillObj = multiMode && streamingSkillId
    ? (SKILLS.find((s) => s.id === streamingSkillId) ?? null)
    : null;
  const portraitSkill = multiMode ? (speakingSkill ?? streamingSkillObj) : activeSkill;
  const color = portraitSkill
    ? GROUP_COLORS[portraitSkill.group]
    : GROUP_COLORS[activeSkill.group];

  return (
    <>
      {/* Portrait */}
      <div
        className="fixed z-30"
        style={{
          right: `calc(${PANEL_WIDTH} - 10px)`,
          top: "52px",
          width: `${PORTRAIT_W}px`,
          height: `${PORTRAIT_H}px`,
        }}
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
            height: "18px",
            background: "rgba(6, 4, 14, 0.9)",
            borderTop: `1px solid ${color}33`,
          }}
        >
          <span
            className="uppercase tracking-widest"
            style={{ fontSize: "7px", letterSpacing: "0.3em", color: `${color}aa` }}
          >
            {portraitSkill ? portraitSkill.name : multiMode ? "MULTI" : activeSkill.name}
          </span>
        </div>
      </div>

      {/* Skill dropdown — below portrait */}
      <div
        ref={dropdownRef}
        className="fixed z-30"
        style={{
          right: `calc(${PANEL_WIDTH} - 10px)`,
          top: `${52 + PORTRAIT_H + 6}px`,
          width: `${PORTRAIT_W}px`,
        }}
      >
        {/* Multi toggle */}
        <button
          onClick={() => { setMultiMode((m) => !m); setDropdownOpen(false); }}
          className="w-full flex items-center justify-center gap-1"
          style={{
            height: "20px",
            background: multiMode ? "#12092a" : "#0a0814",
            border: `1px solid ${multiMode ? "#6040a044" : "#2e285066"}`,
            color: multiMode ? "#8060c0" : "#5a4f7a",
            fontSize: "7px",
            letterSpacing: "0.22em",
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          <span style={{ fontSize: "9px" }}>{multiMode ? "▣" : "□"}</span>
          <span className="uppercase">Multi</span>
        </button>

        {/* Skill dropdown — invisible when multi active (keeps multi toggle position) */}
        <button
          onClick={() => setDropdownOpen((o) => !o)}
          className="w-full flex items-center justify-between px-2"
          style={{
            height: "22px",
            marginTop: "3px",
            background: "#0a0814",
            border: `1px solid ${color}66`,
            color: `${color}aa`,
            fontSize: "7px",
            letterSpacing: "0.2em",
            fontFamily: "inherit",
            cursor: "pointer",
            visibility: multiMode ? "hidden" : "visible",
          }}
        >
          <span className="uppercase truncate">{activeSkill.name}</span>
          <span style={{ fontSize: "8px", opacity: 0.6 }}>{dropdownOpen ? "▲" : "▼"}</span>
        </button>

        {dropdownOpen && (
          <div
            className="absolute left-0 right-0 overflow-y-auto"
            style={{
              top: "23px",
              background: "#08060f",
              border: `1px solid #1e1830`,
              borderTop: "none",
              maxHeight: "320px",
              scrollbarWidth: "none",
            }}
          >
            {GROUPS.map((group) => (
              <div key={group}>
                <div
                  className="px-2 uppercase"
                  style={{
                    fontSize: "9px",
                    letterSpacing: "0.25em",
                    color: `${GROUP_COLORS[group]}77`,
                    paddingTop: "8px",
                    paddingBottom: "4px",
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
                      className="w-full text-left px-2"
                      style={{
                        height: "22px",
                        fontSize: "8px",
                        letterSpacing: "0.12em",
                        fontFamily: "inherit",
                        cursor: "pointer",
                        background: isActive ? `${gc}18` : "transparent",
                        color: isActive ? gc : `${gc}88`,
                        borderLeft: isActive ? `2px solid ${gc}` : "2px solid transparent",
                      }}
                    >
                      {skill.name.toUpperCase()}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Audio controls — mute + (localhost) TTS provider toggle */}
      <div
        className="fixed z-30 flex flex-col gap-[3px]"
        style={{
          right: `calc(${PANEL_WIDTH} - 10px)`,
          bottom: "16px",
          width: `${PORTRAIT_W}px`,
        }}
      >
        <button
          onClick={toggleMute}
          className="w-full flex items-center justify-center gap-1"
          style={{
            height: "20px",
            background: !muted ? "#12092a" : "#0a0814",
            border: `1px solid ${!muted ? "#6040a044" : "#2e285066"}`,
            color: !muted ? "#8060c0" : "#5a4f7a",
            fontSize: "7px",
            letterSpacing: "0.22em",
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          <span style={{ fontSize: "9px" }}>{!muted ? "▣" : "□"}</span>
          <span className="uppercase">Sound</span>
        </button>

        {isLocalhost && (
          <div className="w-full flex" style={{ height: "18px" }}>
            {(["elevenlabs", "browser"] as const).map((p) => {
              const isActive = provider === p;
              const unavailable = p === "elevenlabs" && elevenLabsAvailable === false;
              return (
                <button
                  key={p}
                  onClick={() => setProvider(p)}
                  disabled={unavailable}
                  className="flex-1 uppercase"
                  style={{
                    background: isActive ? "#12092a" : "#0a0814",
                    border: `1px solid ${isActive ? "#6040a044" : "#2e285066"}`,
                    color: unavailable ? "#2a2438" : isActive ? "#8060c0" : "#5a4f7a",
                    fontSize: "6px",
                    letterSpacing: "0.16em",
                    fontFamily: "inherit",
                    cursor: unavailable ? "not-allowed" : "pointer",
                  }}
                  title={unavailable ? "ElevenLabs unavailable" : ""}
                >
                  {p === "elevenlabs" ? "11Labs" : "Browser"}
                  {unavailable ? " ✕" : ""}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Chat panel */}
      <ChatBox skill={activeSkill} multiMode={multiMode} onSpeakingSkill={onSpeakingSkill} onStreamingSkill={onStreamingSkill} />
    </>
  );
}
