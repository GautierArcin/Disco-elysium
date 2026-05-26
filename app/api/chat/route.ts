import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { SKILLS, DEFAULT_SKILL, SKILL_FILE_MAP } from "@/core/skills";
import { readFileSync } from "fs";
import { join } from "path";

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
  try {
    const data = JSON.parse(
      readFileSync(join(process.cwd(), "skills", `${filename}.json`), "utf-8"),
    );
    const lines = data.lines
      .map((l: { text: string }) => `- ${l.text}`)
      .join("\n");
    return `\n\nACTUAL IN-GAME DIALOGUE (study this voice, do not repeat verbatim):\n${lines}`;
  } catch {
    return "";
  }
}

export async function POST(req: NextRequest) {
  const { messages, skillId } = await req.json();
  const skill = SKILLS.find((s) => s.id === skillId) ?? DEFAULT_SKILL;
  const lastMsg = messages[messages.length - 1]?.content ?? "";
  console.log(
    `[chat] skill=${skill.id} model=${ACTIVE_MODEL} msgs=${messages.length} last="${lastMsg.slice(0, 80)}"`,
  );
  const systemInstruction = skill.prompt + getDialogueExamples(skill.id);

  const model = genAI.getGenerativeModel({
    model: ACTIVE_MODEL,
    systemInstruction,
  });

  const history = messages
    .slice(0, -1)
    .map((m: { role: string; content: string }) => ({
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
