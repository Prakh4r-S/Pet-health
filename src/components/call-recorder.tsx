"use client";

import { useCallback, useRef, useState } from "react";
import { Track } from "livekit-client";
import { useTracks, useLocalParticipant } from "@livekit/components-react";
import { uploadRecording } from "@/app/appointments/[id]/recording-actions";

type State = "idle" | "recording" | "uploading" | "done" | "error";

/**
 * Records the consultation audio for later transcription.
 *
 * Both participants have to be captured, and each arrives as a separate
 * MediaStreamTrack. MediaRecorder takes one stream, so the two are mixed
 * through a Web Audio graph first: each track becomes a source node,
 * both connect to a single destination, and that destination's stream is
 * what gets recorded. python3 -m venv .venvexport SERVICE_API_KEY="pick-any-long-random-string"
 */
export default function CallRecorder({ appointmentId }: { appointmentId: string }) {
  const { localParticipant } = useLocalParticipant();
  const micTracks = useTracks([Track.Source.Microphone], { onlySubscribed: false });

  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef<number>(0);

  const start = useCallback(async () => {
    const streams: MediaStream[] = [];

    for (const t of micTracks) {
      const mediaTrack = t.publication?.track?.mediaStreamTrack;
      if (mediaTrack) streams.push(new MediaStream([mediaTrack]));
    }

    if (streams.length === 0) {
      setMessage("No audio available to record.");
      return;
    }

    const context = new AudioContext();
    const destination = context.createMediaStreamDestination();
    for (const stream of streams) {
      context.createMediaStreamSource(stream).connect(destination);
    }
    contextRef.current = context;

    // webm/opus is what browsers agree on and is small enough to upload
    // over a slow connection. Whisper handles it via ffmpeg server-side.
    const recorder = new MediaRecorder(destination.stream, {
      mimeType: "audio/webm;codecs=opus",
      audioBitsPerSecond: 32_000,
    });

    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.start(5000); // flush every 5s so a crash loses little
    recorderRef.current = recorder;
    startedAt.current = Date.now();
    setSeconds(0);
    setState("recording");
    setMessage(null);

    tickRef.current = setInterval(() => {
      setSeconds(Math.floor((Date.now() - startedAt.current) / 1000));
    }, 1000);
  }, [micTracks, localParticipant]);

  const stop = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder) return;

    if (tickRef.current) clearInterval(tickRef.current);

    const finished = new Promise<Blob>((resolve) => {
      recorder.onstop = () =>
        resolve(new Blob(chunksRef.current, { type: "audio/webm" }));
    });

    recorder.stop();
    const blob = await finished;
    contextRef.current?.close();

    setState("uploading");

    try {
      const form = new FormData();
      form.append("appointmentId", appointmentId);
      form.append("durationSeconds", String(Math.floor((Date.now() - startedAt.current) / 1000)));
      form.append("file", blob, `consultation-${appointmentId}.webm`);

      await uploadRecording(form);
      setState("done");
      setMessage("Recording saved. A draft note will appear on the review page.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    }
  }, [appointmentId]);

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(
    seconds % 60,
  ).padStart(2, "0")}`;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-3">
        {state === "idle" || state === "error" ? (
          <button
            type="button"
            onClick={() => void start()}
            className="rounded-md bg-pine-900 px-3 py-1.5 text-sm text-white hover:bg-pine-700"
          >
            Record for notes
          </button>
        ) : state === "recording" ? (
          <>
            <span className="flex items-center gap-2 text-sm">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              Recording {mmss}
            </span>
            <button
              type="button"
              onClick={() => void stop()}
              className="rounded-md bg-gray-100 px-3 py-1.5 text-sm hover:bg-gray-200"
            >
              Stop and save
            </button>
          </>
        ) : (
          <span className="text-sm text-gray-600">
            {state === "uploading" ? "Uploading..." : "Saved"}
          </span>
        )}

        {state === "idle" && (
          <span className="text-xs text-gray-500">
            Tell the owner before you start.
          </span>
        )}
      </div>

      {message && <p className="mt-2 text-xs text-gray-600">{message}</p>}
    </div>
  );
}
