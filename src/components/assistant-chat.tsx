"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { askAssistant, type ChatTurn } from "@/app/assistant/actions";

type Message = ChatTurn & { suggestsConsultation?: boolean };

const SUGGESTIONS = [
  "When is my dog's next vaccination due?",
  "What did the vet say at the last consultation?",
  "Has there been any change in weight?",
  "What medication was prescribed and when?",
];

export default function AssistantChat({ hasPets }: { hasPets: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const send = async (question: string) => {
    if (!question.trim() || busy) return;

    const history = messages.map(({ role, content }) => ({ role, content }));
    setMessages((m) => [...m, { role: "user", content: question }]);
    setInput("");
    setBusy(true);
    setError(null);

    try {
      const reply = await askAssistant(question, history);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: reply.answer,
          suggestsConsultation: reply.suggestsConsultation,
        },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
      requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth" }));
    }
  };

  return (
    <div className="grid gap-4">
      <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
        This assistant reads your pets&apos; records and answers questions about
        them. It can&apos;t diagnose, interpret symptoms, or advise on treatment
        — that needs a vet.
      </div>

      {messages.length === 0 && (
        <div className="grid gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Try asking
          </p>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              disabled={!hasPets}
              onClick={() => void send(s)}
              className="rounded-md border border-gray-200 px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {s}
            </button>
          ))}
          {!hasPets && (
            <p className="text-sm text-gray-500">
              Add a pet first — there&apos;s nothing to answer questions about yet.
            </p>
          )}
        </div>
      )}

      {messages.length > 0 && (
        <div className="grid gap-3">
          {messages.map((m, i) => (
            <div key={i}>
              <div
                className={
                  m.role === "user"
                    ? "ml-auto max-w-[80%] rounded-lg bg-pine-900 px-3 py-2 text-sm text-white"
                    : "max-w-[85%] rounded-lg bg-gray-100 px-3 py-2 text-sm"
                }
              >
                {m.content}
              </div>
              {m.suggestsConsultation && (
                /* A refusal with no way forward is a dead end. When the
                   question needs a vet, offer the vet. */
                <Link
                  href="/vets"
                  className="mt-2 inline-block rounded-md bg-pine-900 px-3 py-1.5 text-sm text-white hover:bg-pine-700"
                >
                  Book a consultation
                </Link>
              )}
            </div>
          ))}
          {busy && <p className="text-sm text-gray-400">Reading the records...</p>}
          <div ref={endRef} />
        </div>
      )}

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void send(input);
          }}
          disabled={!hasPets || busy}
          placeholder="Ask about your pets' records"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50"
        />
        <button
          type="button"
          onClick={() => void send(input)}
          disabled={!hasPets || busy || !input.trim()}
          className="rounded-md bg-pine-900 px-4 py-2 text-sm text-white hover:bg-pine-700 disabled:bg-gray-300"
        >
          Ask
        </button>
      </div>
    </div>
  );
}
