"use client";

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { type Skill, GROUP_COLORS, pickMultiSkills } from "@/core/skills";
import { useAudio, type TTSHandle } from "@/context/AudioContext";

interface Message {
  role: "user" | "assistant";
  content: string;
  speakerName?: string;
  speakerGroup?: string;
}

async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  delayMs = 600,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts) {
        console.warn(
          `[retry] attempt ${attempt}/${maxAttempts} failed, retrying in ${delayMs}ms…`,
          err,
        );
        await new Promise((r) => setTimeout(r, delayMs * attempt));
      }
    }
  }
  throw lastErr;
}

function playGroupSound(group: string) {
  const audio = new Audio(`/audio/${group}.wav`);
  audio.volume = 0.6;
  audio.play().catch(() => {});
}

async function streamSkillResponse(
  apiMessages: { role: string; content: string }[],
  skillId: string,
  onChunk: (full: string) => void,
): Promise<string> {
  const res = await withRetry(() =>
    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: apiMessages, skillId }),
    }).then((r) => {
      if (!r.ok) throw new Error(`Chat HTTP ${r.status}`);
      return r;
    }),
  );

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

// Collapse consecutive assistant messages — Gemini requires alternating user/model
function toApiHistory(msgs: Message[]): { role: string; content: string }[] {
  const result: { role: string; content: string }[] = [];
  for (const msg of msgs) {
    const line =
      msg.role === "assistant" && msg.speakerName
        ? `${msg.speakerName.toUpperCase()}: ${msg.content}`
        : msg.content;
    const last = result[result.length - 1];
    if (msg.role === "assistant" && last?.role === "assistant") {
      last.content += "\n" + line;
    } else {
      result.push({ role: msg.role, content: line });
    }
  }
  return result;
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
  onSpeakingSkill,
  onStreamingSkill,
}: {
  skill: Skill;
  multiMode: boolean;
  onSpeakingSkill?: (skillId: string | null) => void;
  onStreamingSkill?: (skillId: string | null) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [streamingSkill, setStreamingSkill] = useState<{
    name: string;
    group: string;
  } | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  // Placeholder appear-animation: mount bright (0.8) then settle (0.4) so the
  // color transition fires when input is cleared.
  const [phBright, setPhBright] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { prepareTTS, muted } = useAudio();

  useLayoutEffect(() => {
    if (input) return;
    setPhBright(true);
    const id = requestAnimationFrame(() => setPhBright(false));
    return () => cancelAnimationFrame(id);
  }, [input]);

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
        const apiMessages = toApiHistory(newMessages);
        const full = await streamSkillResponse(
          apiMessages,
          skill.id,
          setStreamingText,
        );

        // Prepare TTS while cursor stays visible
        const tts = await prepareTTS(full);

        // TTS received → reveal message, hide cursor
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

        if (tts) {
          setAudioPlaying(true);
          if (!muted) {
            playGroupSound(skill.group);
            await new Promise((r) => setTimeout(r, 1000));
          }
          await tts.play();
          setAudioPlaying(false);
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
    [messages, skill, prepareTTS, muted],
  );

  const sendMultiMessage = useCallback(
    async (text: string) => {
      const userMsg: Message = { role: "user", content: text };
      const baseMessages: Message[] = [...messages, userMsg];
      setMessages(baseMessages);
      setInput("");
      setBusy(true);

      const chosenSkills = pickMultiSkills();
      // Texts collected as chats complete — used for history of subsequent chats
      const collectedTexts: string[] = [];
      // Live (progressive) text per skill, updated as bytes arrive
      const liveTexts: string[] = chosenSkills.map(() => "");
      // text-stream-done flag per skill
      const doneFlags: boolean[] = chosenSkills.map(() => false);
      // TTS handle promise per skill
      const audioPromises: Array<Promise<TTSHandle | null>> = [];
      // Displayed messages buffer (grows as messages are revealed)
      const displayBuffer = [...baseMessages];

      // Which skill the displayChain is currently showing — only this skill's
      // live stream is allowed to touch the cursor UI. -1 = none.
      let activeDisplayIndex = -1;

      // fetchSkill: NO UI side effects (except live text for the active display
      // skill). Runs ahead in chatChain so TTS overlaps next chat request.
      async function fetchSkill(i: number): Promise<void> {
        const s = chosenSkills[i];

        const prevResps = chosenSkills.slice(0, i).map((sk, j) => ({
          name: sk.name,
          content: collectedTexts[j],
        }));
        const prevSkillMsgs: Message[] = chosenSkills
          .slice(0, i)
          .map((sk, j) => ({
            role: "assistant" as const,
            content: collectedTexts[j],
            speakerName: sk.name,
            speakerGroup: sk.group,
          }));
        const apiMessages = [
          ...toApiHistory(messages),
          ...toApiHistory(prevSkillMsgs),
          { role: "user", content: buildMultiUserMsg(text, prevResps) },
        ];

        const full = await streamSkillResponse(apiMessages, s.id, (t) => {
          liveTexts[i] = t;
          if (i === activeDisplayIndex) setStreamingText(t);
        });
        collectedTexts[i] = full;
        doneFlags[i] = true;
        audioPromises[i] = prepareTTS(full);
      }

      // displaySkill: SOLE owner of cursor + message UI. Runs strictly
      // sequentially, so the next skill's cursor never appears until the
      // previous skill is fully revealed and its audio has finished.
      async function displaySkill(i: number): Promise<void> {
        const s = chosenSkills[i];

        // Show cursor for this skill
        activeDisplayIndex = i;
        setStreamingSkill({ name: s.name, group: s.group });
        onStreamingSkill?.(s.id);
        setStreamingText(liveTexts[i]);

        // Wait for this skill's text to finish streaming (live updates flow via
        // the fetchSkill callback because activeDisplayIndex === i now)
        while (!doneFlags[i]) await new Promise((r) => setTimeout(r, 20));
        setStreamingText(collectedTexts[i]);

        const tts = await audioPromises[i];

        // Reveal message, hide cursor
        displayBuffer.push({
          role: "assistant",
          content: collectedTexts[i],
          speakerName: s.name,
          speakerGroup: s.group,
        });
        setMessages([...displayBuffer]);
        activeDisplayIndex = -1;
        setStreamingSkill(null);
        onStreamingSkill?.(null);

        if (tts) {
          onSpeakingSkill?.(s.id); // portrait → this skill
          setAudioPlaying(true);
          if (!muted) {
            playGroupSound(s.group);
            await new Promise((r) => setTimeout(r, 1000));
          }
          await tts.play();
          setAudioPlaying(false);
        }
      }

      try {
        // chatChain: fetch sequentially (each needs prev text for history)
        let chatChain = fetchSkill(0);
        for (let i = 1; i < chosenSkills.length; i++) {
          const idx = i;
          chatChain = chatChain.then(() => fetchSkill(idx));
        }

        // displayChain: reveal + play sequentially, owns all cursor UI
        let displayChain = displaySkill(0);
        for (let i = 1; i < chosenSkills.length; i++) {
          const idx = i;
          displayChain = displayChain.then(() => displaySkill(idx));
        }

        await chatChain; // all chat streams done
        await displayChain; // all display+audio done
      } catch (err) {
        console.error(err);
        displayBuffer.push({
          role: "assistant",
          content: "...the signal is lost. Try again.",
        });
        setMessages([...displayBuffer]);
      } finally {
        setStreamingText("");
        setStreamingSkill(null);
        onSpeakingSkill?.(null); // revert portrait → "multi"
        onStreamingSkill?.(null);
        setBusy(false);
      }
    },
    [messages, onSpeakingSkill, onStreamingSkill, prepareTTS, muted],
  );

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;
    if (multiMode) await sendMultiMessage(text);
    else await sendSingleMessage(text);
  }, [input, busy, multiMode, sendSingleMessage, sendMultiMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const userMsgCount = messages.filter((m) => m.role === "user").length;

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
      <div className="chat-scroll flex-1 overflow-y-auto px-6 pt-5 pb-2">
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

        {streamingSkill && !audioPlaying && (
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
              {streamingText || (
                <span
                  style={{
                    color: `${GROUP_COLORS[streamingSkill.group as keyof typeof GROUP_COLORS]}44`,
                  }}
                >
                  ...
                </span>
              )}
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
            style={{
              fontSize: "17px",
              opacity: input ? 0.8 : 0.4,
              transition: "opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            {userMsgCount + 1}. -{" "}
          </span>
          <div className="flex-1 relative ml-1">
            <span
              aria-hidden
              className="absolute top-0 left-0 pointer-events-none select-none"
              style={{
                fontSize: "17px",
                fontFamily: "inherit",
                color: phBright ? "rgba(200,124,64,0.8)" : "rgba(200,124,64,0.4)",
                display: input ? "none" : "block",
                transition: "color 0.5s cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            >
              speak your mind...
            </span>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={busy}
              rows={2}
              className="chat-input w-full resize-none focus:outline-none bg-transparent leading-snug"
              style={{
                fontSize: "17px",
                fontFamily: "inherit",
                color: input ? "rgba(200,124,64,0.8)" : "rgba(200,124,64,0.4)",
                caretColor: "#c87c40",
                transition: "color 0.5s cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            />
          </div>
        </div>
        <p
          className="mt-2 uppercase"
          style={{ fontSize: "9px", letterSpacing: "0.22em", color: "#4a3870" }}
        >
          Enter · send &nbsp;|&nbsp; Shift+Enter · newline
          {multiMode && <span> &nbsp;|&nbsp; MULTI ACTIVE</span>}
        </p>
      </div>
    </div>
  );
}
