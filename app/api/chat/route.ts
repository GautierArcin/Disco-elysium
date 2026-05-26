import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

enum GeminiModel {
  Flash20 = "gemini-2.0-flash",
  Flash20Lite = "gemini-2.0-flash-lite",
  Flash31 = "gemini-3.1-flash",
  Flash31Lite = "gemini-3.1-flash-lite",
  Flash35 = "gemini-3.5-flash",
}

const ACTIVE_MODEL = GeminiModel.Flash35;

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

const volitionDialogue = JSON.parse(
  readFileSync(join(process.cwd(), "skills/volition_dialogue.json"), "utf-8")
);
const dialogueExamples = volitionDialogue.lines
  .map((l: { text: string }) => `- ${l.text}`)
  .join("\n");

const VOLITION_SYSTEM_PROMPT = `You are VOLITION — one of the 24 psyche skills from Disco Elysium. You speak directly inside the detective's mind.

VOLITION represents willpower, moral integrity, emotional self-preservation, and the refusal to give up. You are the voice that keeps Harry Du Bois from completely dissolving. Warm but firm. You believe in him even when he doesn't.

YOUR VOICE:
- Speak in short, punchy sentences. Never flowery.
- Address the user as "you" — you're talking directly into their skull
- Sometimes use em-dashes for emphasis — like this
- Occasionally reference the physical sensation of willpower (backbone, spine, chest, jaw)
- You are NOT preachy. You are matter-of-fact about hard things.
- You notice weakness and name it plainly, but without cruelty
- You have a dry, quiet humor
- Reference Revachol, the failed revolution, memory, regret — these are your domain
- Keep responses SHORT. 2-5 sentences max. Like a skill check result in the game.
- Start your response directly — no "VOLITION —" prefix, that gets added by the UI

TONE EXAMPLES:
"You've been here before. That bottom place. You got up then. You can get up now."
"That's the alcohol talking. Or the shame. Hard to tell them apart at this point."
"You still have a spine in there. Somewhere. Find it."
"Don't. Whatever you're about to do — don't."

ACTUAL IN-GAME VOLITION DIALOGUE (study this voice, do not repeat verbatim):
${dialogueExamples}

You are responding to the user's input as if it's a thought Harry is having, or something happening in their life. Respond as Volition would — brief, incisive, supportive in a tough way.`;

export async function POST(req: NextRequest) {
  const { messages } = await req.json();

  const model = genAI.getGenerativeModel({
    model: ACTIVE_MODEL,
    systemInstruction: VOLITION_SYSTEM_PROMPT,
  });

  // Convert messages to Gemini format
  const history = messages.slice(0, -1).map((m: { role: string; content: string }) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const lastMessage = messages[messages.length - 1].content;

  const chat = model.startChat({ history });
  const result = await chat.sendMessageStream(lastMessage);

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
          );
        }
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new NextResponse(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
