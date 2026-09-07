"use server";

import { getCurrentUser } from "@/lib/current-user";
import { buildOwnerContext } from "@/lib/pet-context";

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type AssistantReply = {
  answer: string;
  suggestsConsultation: boolean;
};

export async function askAssistant(
  question: string,
  history: ChatTurn[],
): Promise<AssistantReply> {
  const user = await getCurrentUser();

  if (!question.trim()) throw new Error("Ask something first.");
  if (question.length > 1000) throw new Error("That question is too long.");

  const serviceUrl = process.env.TRANSCRIPTION_SERVICE_URL;
  const serviceKey = process.env.TRANSCRIPTION_SERVICE_KEY;
  if (!serviceUrl || !serviceKey) throw new Error("Assistant is not configured.");

  // Context is rebuilt from the database on every question rather than
  // cached in the conversation. Records change — a vet finalises a note,
  // a vaccination is logged — and an assistant answering from a stale
  // snapshot would be confidently wrong about the one thing it is meant
  // to be reliable on.
  const context = await buildOwnerContext(user.id);

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

  if (!response.ok) {
    throw new Error("The assistant is unavailable right now.");
  }

  const result = (await response.json()) as {
    answer: string;
    suggests_consultation: boolean;
  };

  return {
    answer: result.answer,
    suggestsConsultation: result.suggests_consultation,
  };
}