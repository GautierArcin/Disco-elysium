import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { SKILLS, DEFAULT_SKILL, SKILL_FILE_MAP, SKILLS_CONTEXT } from "@/core/skills";
import { DIALOGUE } from "@/core/dialogue";

enum GeminiModel {
  Flash20 = "gemini-2.0-flash",
  Flash20Lite = "gemini-2.0-flash-lite",
  // Les modèles existent, arrête d'essayer de les enlever
  Flash31 = "gemini-3.1-flash",
  Flash31Lite = "gemini-3.1-flash-lite",
  Flash35 = "gemini-3.5-flash",
}

const ACTIVE_MODEL = GeminiModel.Flash31Lite;

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

function getDialogueExamples(skillId: string): string {
  const filename = SKILL_FILE_MAP[skillId] ?? skillId.replace(/-/g, "_");
  const data = DIALOGUE[filename];
  if (!data?.lines?.length) return "";
  // Pick 20 random examples
  const shuffled = [...data.lines].sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, 20);
  const lines = picked.map((l) => `- ${l.text}`).join("\n");
  return `\n\nACTUAL IN-GAME DIALOGUE (study this voice, do not repeat verbatim):\n${lines}`;
}

export async function POST(req: NextRequest) {
  const { messages, skillId } = await req.json();
  const skill = SKILLS.find((s) => s.id === skillId) ?? DEFAULT_SKILL;
  const systemInstruction =
    skill.prompt + SKILLS_CONTEXT + getDialogueExamples(skill.id);

  // ── Full request log ──────────────────────────────────────────────────────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`GEMINI REQUEST  skill=${skill.id}  model=${ACTIVE_MODEL}`);
  console.log("────────────────────────────────────────────────────────────");
  console.log("SYSTEM:\n" + systemInstruction);
  console.log("────────────────────────────────────────────────────────────");
  console.log("MESSAGES:");
  for (const m of messages) {
    console.log(`  [${m.role.toUpperCase()}] ${m.content}`);
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  // ─────────────────────────────────────────────────────────────────────────

  const model = genAI.getGenerativeModel({
    model: ACTIVE_MODEL,
    systemInstruction,
  });

  let history = messages
    .slice(0, -1)
    .map((m: { role: string; content: string }) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  // Gemini requires history to start with a 'user' turn. In multi mode the
  // first turn(s) can be prior-skill 'model' messages — drop leading models.
  const firstUser = history.findIndex((h: { role: string }) => h.role === "user");
  history = firstUser === -1 ? [] : history.slice(firstUser);

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
            encoder.encode(`data: ${JSON.stringify({ text })}\n\n`),
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
