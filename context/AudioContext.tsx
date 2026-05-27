"use client";

import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

export type TTSProvider = "elevenlabs" | "browser";

// A prepared, ready-to-play utterance. play() resolves when audio finishes
// (or immediately if muted). Lets the chat prefetch TTS in parallel while
// displaying skills sequentially.
export interface TTSHandle {
  play: () => Promise<void>;
  cancel: () => void;
}

interface AudioContextValue {
  provider: TTSProvider;
  setProvider: (p: TTSProvider) => void;
  elevenLabsAvailable: boolean | null; // null = still probing
  muted: boolean;
  toggleMute: () => void;
  isLocalhost: boolean;
  prepareTTS: (text: string) => Promise<TTSHandle | null>;
}

const AudioCtx = createContext<AudioContextValue | null>(null);

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
        await new Promise((r) => setTimeout(r, delayMs * attempt));
      }
    }
  }
  throw lastErr;
}

async function fetchElevenLabsAudio(
  text: string,
): Promise<HTMLAudioElement | null> {
  try {
    return await withRetry(async () => {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);
      const blob = await res.blob();
      if (blob.size === 0) throw new Error("TTS empty blob");
      return new Audio(URL.createObjectURL(blob));
    });
  } catch (err) {
    console.error("[tts] elevenlabs failed:", err);
    return null;
  }
}

export function AudioProvider({ children }: { children: ReactNode }) {
  const [provider, setProviderState] = useState<TTSProvider>("elevenlabs");
  const [elevenLabsAvailable, setElevenLabsAvailable] = useState<
    boolean | null
  >(null);
  const [muted, setMuted] = useState(false);
  const [isLocalhost, setIsLocalhost] = useState(false);

  // Refs mirror state so the async prepareTTS/play closures read live values.
  const providerRef = useRef<TTSProvider>(provider);
  const mutedRef = useRef(muted);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  const setProvider = useCallback((p: TTSProvider) => {
    providerRef.current = p;
    setProviderState(p);
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      mutedRef.current = next;
      if (next) {
        // Stop anything currently playing
        currentAudioRef.current?.pause();
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
        }
      }
      return next;
    });
  }, []);

  // Detect localhost + probe ElevenLabs once on mount.
  useEffect(() => {
    const host = window.location.hostname;
    // Browser-only value set post-hydration to avoid SSR mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLocalhost(host === "localhost" || host === "127.0.0.1");

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/tts");
        const data = await res.json();
        if (cancelled) return;
        const ok = !!data.ok;
        setElevenLabsAvailable(ok);
        if (!ok) setProvider("browser");
      } catch {
        if (cancelled) return;
        setElevenLabsAvailable(false);
        setProvider("browser");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setProvider]);

  const makeAudioHandle = useCallback(
    (audio: HTMLAudioElement): TTSHandle => ({
      play: () => {
        if (mutedRef.current) {
          URL.revokeObjectURL(audio.src);
          return Promise.resolve();
        }
        currentAudioRef.current = audio;
        return new Promise<void>((resolve) => {
          const cleanup = () => {
            URL.revokeObjectURL(audio.src);
            if (currentAudioRef.current === audio)
              currentAudioRef.current = null;
            resolve();
          };
          audio.onended = cleanup;
          audio.onerror = cleanup;
          audio.play().catch(cleanup);
        });
      },
      cancel: () => {
        audio.pause();
        URL.revokeObjectURL(audio.src);
      },
    }),
    [],
  );

  const makeBrowserHandle = useCallback(
    (text: string): TTSHandle => ({
      play: () => {
        if (mutedRef.current) return Promise.resolve();
        if (typeof window === "undefined" || !("speechSynthesis" in window)) {
          return Promise.resolve();
        }
        return new Promise<void>((resolve) => {
          const u = new SpeechSynthesisUtterance(text);
          u.onend = () => resolve();
          u.onerror = () => resolve();
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(u);
        });
      },
      cancel: () => {
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
        }
      },
    }),
    [],
  );

  const prepareTTS = useCallback(
    async (text: string): Promise<TTSHandle | null> => {
      if (providerRef.current === "elevenlabs") {
        const audio = await fetchElevenLabsAudio(text);
        if (audio) return makeAudioHandle(audio);
        // ElevenLabs failed at request time → fall back to browser voice
      }
      return makeBrowserHandle(text);
    },
    [makeAudioHandle, makeBrowserHandle],
  );

  return (
    <AudioCtx.Provider
      value={{
        provider,
        setProvider,
        elevenLabsAvailable,
        muted,
        toggleMute,
        isLocalhost,
        prepareTTS,
      }}
    >
      {children}
    </AudioCtx.Provider>
  );
}

export function useAudio() {
  const ctx = useContext(AudioCtx);
  if (!ctx) throw new Error("useAudio must be used within AudioProvider");
  return ctx;
}
