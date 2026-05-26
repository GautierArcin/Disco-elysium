"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

async function speakText(text: string) {
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    audio.play();
  } catch {}
}

export default function ChatBox() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;

    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: text },
    ];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);
    setStreamingText("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
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
                setStreamingText(full);
              }
            } catch {}
          }
        }
      }

      setMessages([...newMessages, { role: "assistant", content: full }]);
      setStreamingText("");
      speakText(full);
    } catch (err) {
      console.error(err);
      setMessages([
        ...newMessages,
        { role: "assistant", content: "...the signal is lost. Try again." },
      ]);
      setStreamingText("");
    } finally {
      setStreaming(false);
    }
  }, [input, messages, streaming]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const userMsgCount = messages.filter((m) => m.role === "user").length;

  return (
    /* Pure dialog panel — no portrait, full height right side */
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
      {/* Scrollable dialog area */}
      <div
        className="flex-1 overflow-y-auto px-6 pt-5 pb-2"
        style={{ scrollbarWidth: "none" }}
      >
        {messages.length === 0 && !streaming && (
          <p
            className="text-[#2e2848] leading-relaxed mt-4"
            style={{ fontSize: "17px", fontStyle: "italic" }}
          >
            You are still here. That means something.
          </p>
        )}

        {messages.map((msg, i) => {
          if (msg.role === "assistant") {
            return (
              <div key={i} className="mb-5 leading-snug">
                <span
                  className="font-bold uppercase text-[#7b5cbf]"
                  style={{
                    fontSize: "15px",
                    letterSpacing: "0.08em",
                    fontFamily: "inherit",
                  }}
                >
                  VOLITION
                </span>
                <span
                  className="text-[#ddd8cc]"
                  style={{ fontSize: "17px" }}
                >
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
                <span
                  className="text-[#c87c40]"
                  style={{ fontSize: "17px" }}
                >
                  {idx}.{" "}
                </span>
                <span className="text-[#c87c40]" style={{ fontSize: "17px" }}>
                  - {msg.content}
                </span>
              </div>
            );
          }
        })}

        {streaming && (
          <div className="mb-5 leading-snug">
            <span
              className="font-bold uppercase text-[#7b5cbf]"
              style={{ fontSize: "15px", letterSpacing: "0.08em" }}
            >
              VOLITION
            </span>
            <span className="text-[#ddd8cc]" style={{ fontSize: "17px" }}>
              {" – "}
              {streamingText || (
                <span className="text-[#3a2f55]">...</span>
              )}
              <span
                className="animate-pulse text-[#7b5cbf]"
                style={{ fontSize: "15px" }}
              >
                ▋
              </span>
            </span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Thin separator */}
      <div className="mx-6" style={{ height: "1px", background: "#1c1628" }} />

      {/* Choice input at bottom — numbered like DE choices */}
      <div className="flex-shrink-0 px-6 py-4">
        <div className="flex items-start gap-0 leading-snug">
          <span className="text-[#c87c40] flex-shrink-0" style={{ fontSize: "17px" }}>
            {userMsgCount + 1}.{" "}-{" "}
          </span>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="speak your mind..."
            disabled={streaming}
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
        </p>
      </div>

      {/* Right edge scroll indicator — the dot from DE */}
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
          background: "#4a3870",
        }}
      />
    </div>
  );
}
