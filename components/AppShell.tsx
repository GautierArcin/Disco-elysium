"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import ChatBox from "@/components/ChatBox";
import { SKILLS, DEFAULT_SKILL, GROUP_COLORS, GROUP_LABELS, GROUPS, type Skill } from "@/core/skills";
import { PANEL_WIDTH, PORTRAIT_W, PORTRAIT_H } from "@/core/layout";


export default function AppShell() {
  const [activeSkill, setActiveSkill] = useState<Skill>(DEFAULT_SKILL);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [multiMode, setMultiMode] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const color = GROUP_COLORS[activeSkill.group];

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
              src={multiMode ? "/skills/multi.jpeg" : activeSkill.image}
              alt={multiMode ? "Multi" : activeSkill.name}
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
            style={{ fontSize: "7px", letterSpacing: "0.3em", color: `${color}99` }}
          >
            {multiMode ? "MULTI" : activeSkill.name}
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
        <button
          onClick={() => setDropdownOpen((o) => !o)}
          className="w-full flex items-center justify-between px-2"
          style={{
            height: "22px",
            background: "#0a0814",
            border: `1px solid ${color}44`,
            color: `${color}bb`,
            fontSize: "7px",
            letterSpacing: "0.2em",
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          <span className="uppercase truncate">{activeSkill.name}</span>
          <span style={{ fontSize: "8px", opacity: 0.6 }}>{dropdownOpen ? "▲" : "▼"}</span>
        </button>

        {/* Multi toggle */}
        <button
          onClick={() => setMultiMode((m) => !m)}
          className="w-full flex items-center justify-center gap-1"
          style={{
            height: "20px",
            marginTop: "3px",
            background: multiMode ? "#12092a" : "#0a0814",
            border: `1px solid ${multiMode ? "#6040a044" : "#1e183044"}`,
            color: multiMode ? "#8060c0" : "#2e2848",
            fontSize: "7px",
            letterSpacing: "0.22em",
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          <span style={{ fontSize: "9px" }}>{multiMode ? "▣" : "□"}</span>
          <span className="uppercase">Multi</span>
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
                        color: isActive ? gc : `${gc}55`,
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

      {/* Nav tabs */}
      <div
        className="fixed z-20 flex flex-col items-center pointer-events-none"
        style={{ right: `calc(${PANEL_WIDTH} + 2px)`, top: "260px", gap: "2px" }}
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

      {/* Chat panel */}
      <ChatBox skill={activeSkill} multiMode={multiMode} />
    </>
  );
}
