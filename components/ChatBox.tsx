"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { type Skill, GROUP_COLORS, pickMultiSkills } from "@/core/skills";

interface Message {
  role: "user" | "assistant";
  content: string;
  speakerName?: string;
  speakerGroup?: string;
}

type SkillTurn = { user: string; assistant: string };

function playGroupSound(group: string) {
  const audio = new Audio(`/audio/${group}.wav`);
  audio.volume = 0.6;
  audio.play().catch(() => {});
}

async function fetchTTSAudio(text: string): Promise<HTMLAudioElement | null> {
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Audio(URL.createObjectURL(blob));
  } catch {
    return null;
  }
}

async function playAudioElement(audio: HTMLAudioElement): Promise<void> {
  return new Promise((resolve) => {
    audio.onended = () => {
      URL.revokeObjectURL(audio.src);
      resolve();
    };
    audio.onerror = () => {
      URL.revokeObjectURL(audio.src);
      resolve();
    };
    audio.play().catch(resolve);
  });
}

async function streamSkillResponse(
  apiMessages: { role: string; content: string }[],
  skillId: string,
  onChunk: (full: string) => void,
): Promise<string> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: apiMessages, skillId }),
  });
  if (!res.ok) throw new Error("API error");

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    for (const line of chunk.split("\n")) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") break;
        try {
          const parsed = JSON.parse(data);
          if (parsed.text) {
            full += parsed.text;
            onChunk(full);
          }
        } catch {}
      }
    }
  }
  return full;
}

function buildMultiUserMsg(
  userText: string,
  prevResponses: Array<{ name: string; content: string }>,
): string {
  if (prevResponses.length === 0) return userText;
  const context = prevResponses
    .map((r) => `${r.name.toUpperCase()}: "${r.content}"`)
    .join("\n");
  return `${userText}\n\n[Other skills have already spoken:\n${context}\n\nReact to both the user's message and the previous skill responses. Lean slightly more toward engaging with the most recent skill's response than with the user's words directly.]`;
}

export default function ChatBox({
  skill,
  multiMode,
}: {
  skill: Skill;
  multiMode: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false); // streaming or playing
  const [streamingText, setStreamingText] = useState("");
  const [streamingSkill, setStreamingSkill] = useState<{
    name: string;
    group: string;
  } | null>(null);
  const skillHistoriesRef = useRef<Record<string, SkillTurn[]>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevSkillId = useRef(skill.id);
  const prevMultiMode = useRef(multiMode);

  useEffect(() => {
    if (
      prevSkillId.current !== skill.id ||
      prevMultiMode.current !== multiMode
    ) {
      setMessages([]);
      setStreamingText("");
      setStreamingSkill(null);
      prevSkillId.current = skill.id;
      prevMultiMode.current = multiMode;
    }
  }, [skill.id, multiMode]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const sendSingleMessage = useCallback(
    async (text: string) => {
      const userMsg: Message = { role: "user", content: text };
      const newMessages: Message[] = [...messages, userMsg];
      setMessages(newMessages);
      setInput("");
      setBusy(true);
      setStreamingSkill({ name: skill.name, group: skill.group });
      setStreamingText("");

      try {
        const apiMessages = newMessages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        // 1. Stream → cursor shows text
        const full = await streamSkillResponse(
          apiMessages,
          skill.id,
          setStreamingText,
        );

        // 2. Fetch TTS — cursor stays visible with full text + blink
        const audio = await fetchTTSAudio(full);

        // 3. TTS received → reveal message, hide cursor
        setMessages([
          ...newMessages,
          {
            role: "assistant",
            content: full,
            speakerName: skill.name,
            speakerGroup: skill.group,
          },
        ]);
        setStreamingText("");
        setStreamingSkill(null);

        // 4. Group sound → 1s → TTS
        if (audio) {
          playGroupSound(skill.group);
          await new Promise((r) => setTimeout(r, 1000));
          await playAudioElement(audio);
        }
      } catch (err) {
        console.error(err);
        setMessages([
          ...newMessages,
          {
            role: "assistant",
            content: "...the signal is lost. Try again.",
            speakerName: skill.name,
            speakerGroup: skill.group,
          },
        ]);
        setStreamingText("");
        setStreamingSkill(null);
      } finally {
        setBusy(false);
      }
    },
    [messages, skill],
  );

  const sendMultiMessage = useCallback(
    async (text: string) => {
      const userMsg: Message = { role: "user", content: text };
      const displayMessages: Message[] = [...messages, userMsg];
      setMessages(displayMessages);
      setInput("");
      setBusy(true);

      const chosenSkills = pickMultiSkills();
      const prevResponses: Array<{ name: string; content: string }> = [];
      const currentMessages = [...displayMessages];

      try {
        for (const s of chosenSkills) {
          // 1. Show cursor for this skill
          setStreamingSkill({ name: s.name, group: s.group });
          setStreamingText("");

          const history = skillHistoriesRef.current[s.id] ?? [];
          const apiHistory = history.flatMap<{ role: string; content: string }>(
            (t) => [
              { role: "user", content: t.user },
              { role: "assistant", content: t.assistant },
            ],
          );
          const apiMessages = [
            ...apiHistory,
            { role: "user", content: buildMultiUserMsg(text, prevResponses) },
          ];

          // 2. Stream → cursor shows text
          const full = await streamSkillResponse(
            apiMessages,
            s.id,
            setStreamingText,
          );

          // 3. Fetch TTS — cursor stays visible with full text + blink
          const audio = await fetchTTSAudio(full);

          // 4. TTS received → reveal message, hide cursor
          skillHistoriesRef.current[s.id] = [
            ...history,
            { user: text, assistant: full },
          ];
          prevResponses.push({ name: s.name, content: full });
          currentMessages.push({
            role: "assistant",
            content: full,
            speakerName: s.name,
            speakerGroup: s.group,
          });
          setMessages([...currentMessages]);
          setStreamingText("");
          setStreamingSkill(null);

          // 5. Group sound → 1s → TTS
          if (audio) {
            playGroupSound(s.group);
            await new Promise((r) => setTimeout(r, 1000));
            await playAudioElement(audio);
          }
        }
      } catch (err) {
        console.error(err);
        currentMessages.push({
          role: "assistant",
          content: "...the signal is lost. Try again.",
        });
        setMessages([...currentMessages]);
        setStreamingText("");
        setStreamingSkill(null);
      } finally {
        setBusy(false);
      }
    },
    [messages],
  );

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;
    if (multiMode) {
      await sendMultiMessage(text);
    } else {
      await sendSingleMessage(text);
    }
  }, [input, busy, multiMode, sendSingleMessage, sendMultiMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const userMsgCount = messages.filter((m) => m.role === "user").length;
  const activeColor = GROUP_COLORS[skill.group];

  return (
    <div
      className="fixed right-0 top-0 h-screen flex flex-col"
      style={{
        zIndex: 10,
        width: "var(--panel-width)",
        background: "rgba(10, 8, 18, 0.80)",
        backdropFilter: "blur(0px)",
        borderLeft: "4px solid #2a2245",
        boxShadow: "-1px 0 0 #18122e",
      }}
    >
      <div
        className="flex-1 overflow-y-auto px-6 pt-5 pb-2"
        style={{ scrollbarWidth: "none" }}
      >
        {messages.length === 0 && !streamingSkill && (
          <p
            className="text-[#2e2848] leading-relaxed mt-4"
            style={{ fontSize: "17px", fontStyle: "italic" }}
          >
            {multiMode
              ? "Multiple voices. One mind. Speak."
              : "You are still here. That means something."}
          </p>
        )}

        {messages.map((msg, i) => {
          if (msg.role === "assistant") {
            const speakerName = msg.speakerName ?? skill.name;
            const speakerGroup = (msg.speakerGroup ??
              skill.group) as keyof typeof GROUP_COLORS;
            const speakerColor = GROUP_COLORS[speakerGroup];
            return (
              <div key={i} className="mb-5 leading-snug">
                <span
                  className="font-bold uppercase"
                  style={{
                    fontSize: "15px",
                    letterSpacing: "0.08em",
                    fontFamily: "inherit",
                    color: speakerColor,
                  }}
                >
                  {speakerName.toUpperCase()}
                </span>
                <span className="text-[#ddd8cc]" style={{ fontSize: "17px" }}>
                  {" – "}
                  {msg.content}
                </span>
              </div>
            );
          } else {
            const idx =
              messages.slice(0, i).filter((m) => m.role === "user").length + 1;
            return (
              <div key={i} className="mb-4 leading-snug">
                <span className="text-[#c87c40]" style={{ fontSize: "17px" }}>
                  {idx}.{" "}
                </span>
                <span className="text-[#c87c40]" style={{ fontSize: "17px" }}>
                  - {msg.content}
                </span>
              </div>
            );
          }
        })}

        {streamingSkill && (
          <div className="mb-5 leading-snug">
            <span
              className="font-bold uppercase"
              style={{
                fontSize: "15px",
                letterSpacing: "0.08em",
                color:
                  GROUP_COLORS[
                    streamingSkill.group as keyof typeof GROUP_COLORS
                  ],
              }}
            >
              {streamingSkill.name.toUpperCase()}
            </span>
            <span className="text-[#ddd8cc]" style={{ fontSize: "17px" }}>
              {" – "}
              {streamingText}

              {/* <span style={{ color: `${GROUP_COLORS[streamingSkill.group as keyof typeof GROUP_COLORS]}44` }}>...</span> */}

              <span
                className="animate-pulse"
                style={{
                  fontSize: "15px",
                  color:
                    GROUP_COLORS[
                      streamingSkill.group as keyof typeof GROUP_COLORS
                    ],
                }}
              >
                ▋
              </span>
            </span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="mx-6" style={{ height: "1px", background: "#1c1628" }} />

      <div className="flex-shrink-0 px-6 py-4">
        <div className="flex items-start gap-0 leading-snug">
          <span
            className="text-[#c87c40] flex-shrink-0"
            style={{ fontSize: "17px" }}
          >
            {userMsgCount + 1}. -{" "}
          </span>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="speak your mind..."
            disabled={busy}
            rows={2}
            className="flex-1 resize-none focus:outline-none bg-transparent leading-snug ml-1"
            style={{
              fontSize: "17px",
              fontFamily: "inherit",
              color: "#c87c40",
              caretColor: "#c87c40",
            }}
          />
        </div>
        <p
          className="mt-2 text-[#1e1830] uppercase"
          style={{ fontSize: "9px", letterSpacing: "0.22em" }}
        >
          Enter · send &nbsp;|&nbsp; Shift+Enter · newline
          {multiMode && (
            <span style={{ color: "#4a3870" }}>
              {" "}
              &nbsp;|&nbsp; MULTI ACTIVE
            </span>
          )}
        </p>
      </div>

      <div
        className="absolute right-0 top-0 bottom-0"
        style={{ width: "3px", background: "#100d1c" }}
      />
      <div
        className="absolute right-[1px]"
        style={{
          top: "50%",
          transform: "translateY(-50%)",
          width: "5px",
          height: "5px",
          borderRadius: "50%",
          background: activeColor + "88",
        }}
      />
    </div>
  );
}
