"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/icon";
import LocalTime from "@/components/local-time";
import SubmitButton from "@/components/submit-button";
import { uploadDirect } from "@/lib/client-upload";
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/lib/upload-rules";
import { postFollowUp } from "@/app/appointments/follow-up-actions";
import {
  FOLLOW_UP_WINDOW_HOURS,
  MAX_FOLLOW_UP_CHARS,
  type FollowUpThread as Thread,
} from "@/lib/follow-up-rules";

type State =
  | { phase: "idle" }
  | { phase: "uploading"; percentage: number }
  | { phase: "sending" }
  | { phase: "sent" }
  | { phase: "error"; message: string };

/**
 * The follow-up thread for one completed consultation: what has been
 * said, and — while it is open — a box to say more.
 *
 * The same component serves both sides. `viewer` only changes the
 * wording: an owner is asking, a vet is answering.
 */
export default function FollowUpThread({
  thread,
  petId,
  viewer,
  otherName,
}: {
  thread: Thread;
  /** Where an attached photo is filed. */
  petId: string;
  viewer: "owner" | "vet";
  /** Who is on the other end, for the prompt. */
  otherName: string;
}) {
  const id = useId();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<State>({ phase: "idle" });
  const busy = state.phase === "uploading" || state.phase === "sending";

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;

    const data = new FormData(event.currentTarget);
    const body = String(data.get("body") ?? "").trim();
    const file = data.get("photo");
    const photo = file instanceof File && file.size > 0 ? file : null;

    if (!body && !photo) {
      setState({ phase: "error", message: "Write a message or attach a photo." });
      return;
    }
    // Checked here so a wrong file fails before it is sent. The server
    // enforces the same limits regardless.
    if (photo && !ALLOWED_IMAGE_TYPES.includes(photo.type)) {
      setState({ phase: "error", message: "Attach a JPEG, PNG or WebP photo." });
      return;
    }
    if (photo && photo.size > MAX_UPLOAD_BYTES) {
      setState({ phase: "error", message: "Photo must be under 10 MB." });
      return;
    }

    try {
      let photoPathname: string | null = null;
      if (photo) {
        setState({ phase: "uploading", percentage: 0 });
        photoPathname = await uploadDirect({
          file: photo,
          filename: photo.name,
          contentType: photo.type,
          request: { kind: "document", petId },
          onProgress: (percentage) =>
            setState((s) => (s.phase === "uploading" ? { phase: "uploading", percentage } : s)),
        });
      }

      setState({ phase: "sending" });
      const result = await postFollowUp({
        appointmentId: thread.appointmentId,
        body,
        photoPathname,
        photoName: photo?.name ?? null,
      });
      if (result.error) {
        setState({ phase: "error", message: result.error });
        return;
      }

      formRef.current?.reset();
      setState({ phase: "sent" });
      router.refresh();
    } catch {
      setState({
        phase: "error",
        message: "The message could not be sent. Check your connection and try again.",
      });
    }
  };

  return (
    <div>
      {thread.messages.length === 0 ? (
        <p className="text-sm text-ink-soft">
          {viewer === "owner"
            ? `No messages yet. Ask ${otherName} a quick question about the treatment — a dose, a side effect, whether something looks normal.`
            : "The owner has not sent a follow-up question."}
        </p>
      ) : (
        // A log: new entries are announced as they arrive, without
        // re-reading the ones already there. The role sits on a wrapper
        // because on the list itself it would replace the list's own.
        <div role="log" aria-label="Follow-up messages">
        <ol className="grid gap-3">
          {thread.messages.map((m) => (
            <li
              key={m.id}
              className={`rounded-lg border p-3 text-sm ${
                m.mine ? "border-aqua-100 bg-aqua-50 sm:ml-8" : "border-mist bg-white sm:mr-8"
              }`}
            >
              <p className="mb-1 text-xs text-ink-soft">
                <span className="font-medium text-ink">{m.mine ? "You" : m.authorName}</span>
                {" · "}
                {m.fromVet ? "Vet" : "Owner"}
                {" · "}
                <LocalTime date={m.createdAt} format="dayTime" />
              </p>
              {m.body && <p className="whitespace-pre-wrap">{m.body}</p>}
              {m.photo && (
                <a
                  href={`/api/documents/${m.photo.documentId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 inline-flex min-h-6 items-center gap-1.5 text-navy-700 underline"
                >
                  <Icon name="paperclip" />
                  Photo: {m.photo.title}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              )}
            </li>
          ))}
        </ol>
        </div>
      )}

      {thread.open ? (
        <form ref={formRef} onSubmit={onSubmit} className="mt-4 grid gap-3">
          <div>
            <label htmlFor={`${id}-body`} className="mb-1 block text-sm font-medium">
              {viewer === "owner" ? `Message to ${otherName}` : `Reply to ${otherName}`}
            </label>
            <textarea
              id={`${id}-body`}
              name="body"
              rows={3}
              maxLength={MAX_FOLLOW_UP_CHARS}
              disabled={busy}
              aria-describedby={`${id}-hint`}
              className="w-full rounded-md border border-mist-deep px-3 py-2 text-sm"
              placeholder={
                viewer === "owner"
                  ? "e.g. Should the second dose still go in if he vomited the first?"
                  : undefined
              }
            />
          </div>

          <div>
            <label htmlFor={`${id}-photo`} className="mb-1 block text-sm font-medium">
              Photo <span className="font-normal text-ink-soft">(optional — JPEG, PNG or WebP, max 10 MB)</span>
            </label>
            <input
              id={`${id}-photo`}
              name="photo"
              type="file"
              accept={ALLOWED_IMAGE_TYPES.join(",")}
              disabled={busy}
              className="w-full text-sm file:mr-3 file:min-h-11 file:rounded-md file:border file:border-mist-deep file:bg-white file:px-3 file:text-sm"
            />
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <SubmitButton
              pending={busy}
              pendingLabel={
                state.phase === "uploading"
                  ? `Uploading ${Math.round(state.percentage)}%`
                  : "Sending..."
              }
              className="min-h-11 rounded-md bg-navy-900 px-4 text-sm text-white hover:bg-navy-700"
            >
              Send
            </SubmitButton>
            <p id={`${id}-hint`} className="text-xs text-ink-soft">
              {thread.closesAt && (
                <>
                  Open until <LocalTime date={thread.closesAt} format="dayTime" />.{" "}
                </>
              )}
              {viewer === "owner" &&
                "Not for emergencies: if your pet is getting worse, book a consultation or go to a clinic."}
            </p>
          </div>

          {/* One polite region for progress and success, one assertive
              one for failure; both always present so that screen readers
              are already watching them when the text arrives. */}
          <div>
            <p role="status" className="text-sm text-navy-900">
              {state.phase === "sent" && "Message sent."}
            </p>
            <p role="alert" className="text-sm text-red-900">
              {state.phase === "error" && state.message}
            </p>
          </div>
        </form>
      ) : (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-ink-soft">
          <Icon name="lock" className="mt-0.5 h-3.5 w-3.5" />
          <span>
            This thread closed {FOLLOW_UP_WINDOW_HOURS} hours after the consultation
            {thread.closesAt && (
              <>
                {" "}
                (<LocalTime date={thread.closesAt} format="dayTime" />)
              </>
            )}
            .{viewer === "owner" && " Book a new consultation if you need to carry on."}
          </span>
        </p>
      )}
    </div>
  );
}
