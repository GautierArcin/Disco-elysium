"use client";

import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  type ReactNode,
  type MutableRefObject,
} from "react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  speakerName?: string;
  speakerGroup?: string;
}

export type SkillTurn = { user: string; assistant: string };

interface ChatContextValue {
  messages: ChatMessage[];
  addMessage: (msg: Omit<ChatMessage, "id">) => string;
  skillApiHistories: MutableRefObject<Record<string, SkillTurn[]>>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const skillApiHistories = useRef<Record<string, SkillTurn[]>>({});

  const addMessage = useCallback((msg: Omit<ChatMessage, "id">): string => {
    const id = crypto.randomUUID();
    setMessages((prev) => [...prev, { ...msg, id }]);
    return id;
  }, []);

  return (
    <ChatContext.Provider value={{ messages, addMessage, skillApiHistories }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be used within ChatProvider");
  return ctx;
}
