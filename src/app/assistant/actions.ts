"use server";

import { getCurrentUser } from "@/lib/current-user";
import { buildOwnerContext } from "@/lib/pet-context";

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type AssistantReply = {
  answer: string;
  suggestsConsultation: boolean;
};

/** Either a reply or a message explaining why there isn't one. */
export type AssistantResult = { reply: AssistantReply } | { error: string };

export async function askAssistant(
  question: string,
  history: ChatTurn[],
): Promise<AssistantResult> {
  const user = await getCurrentUser();

  if (!question.trim()) return { error: "Ask something first." };
  if (question.length > 1000) return { error: "That question is too long." };

  const serviceUrl = process.env.TRANSCRIPTION_SERVICE_URL;
  const serviceKey = process.env.TRANSCRIPTION_SERVICE_KEY;
  if (!serviceUrl || !serviceKey) {
    return { error: "The assistant isn't set up on this deployment." };
  }

  // Context is rebuilt from the database on every question rather than
  // cached in the conversation. Records change — a vet finalises a note,
  // a vaccination is logged — and an assistant answering from a stale
  // snapshot would be confidently wrong about the one thing it is meant
  // to be reliable on.
  const context = await buildOwnerContext(user.id);

  const unavailable = { error: "The assistant is unavailable right now. Please try again." };

  // The service is a separate deployment that sleeps when idle. Being
  // unreachable, slow to wake, or returning something unexpected are all
  // ordinary outcomes for the person asking, not exceptions.
  try {
    const response = await fetch(`${serviceUrl}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        question,
        context,
        history: history.slice(-6),
      }),
    });

    if (!response.ok) return unavailable;

    const result = (await response.json()) as {
      answer?: unknown;
      suggests_consultation?: unknown;
    };
    if (typeof result.answer !== "string") return unavailable;

    return {
      reply: {
        answer: result.answer,
        suggestsConsultation: result.suggests_consultation === true,
      },
    };
  } catch {
    return unavailable;
  }
}
