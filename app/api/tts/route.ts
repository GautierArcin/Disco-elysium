import { NextRequest, NextResponse } from "next/server";

// Health check — verifies the ElevenLabs key works without spending TTS credits.
export async function GET() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!apiKey || !voiceId) {
    return NextResponse.json({ ok: false, reason: "not configured" });
  }
  try {
    // Query the configured voice — uses the same scope the TTS POST needs.
    // (/v1/user requires user_read, which scoped TTS keys often lack.)
    const res = await fetch(
      `https://api.elevenlabs.io/v1/voices/${voiceId}`,
      { headers: { "xi-api-key": apiKey } },
    );
    if (res.ok) return NextResponse.json({ ok: true });
    const body = await res.text().catch(() => "");
    return NextResponse.json({ ok: false, reason: `HTTP ${res.status}`, body });
  } catch {
    return NextResponse.json({ ok: false, reason: "unreachable" });
  }
}

export async function POST(req: NextRequest) {
  const { text } = await req.json();

  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey || !voiceId) {
    return NextResponse.json({ error: "ElevenLabs not configured" }, { status: 500 });
  }

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.75,
        style: 0.3,
        use_speaker_boost: true,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: res.status });
  }

  const audioBuffer = await res.arrayBuffer();

  return new NextResponse(audioBuffer, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}
