"use client";

import { useCallback, useRef, useState } from "react";
import { Track } from "livekit-client";
import { useTracks } from "@livekit/components-react";
import { registerRecording } from "@/app/appointments/[id]/recording-actions";
import { uploadDirect } from "@/lib/client-upload";
import { MAX_RECORDING_BYTES, baseContentType } from "@/lib/upload-rules";

type State = "idle" | "recording" | "uploading" | "done" | "error";

/** webm/opus on Chromium and Firefox; Safari only offers mp4. */
const RECORDING_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

function pickRecordingType() {
  if (typeof MediaRecorder === "undefined") return null;
  return RECORDING_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? null;
}

/**
 * Records the consultation audio for later transcription.
 *
 * Both participants have to be captured, and each arrives as a separate
 * MediaStreamTrack. MediaRecorder takes one stream, so the two are mixed
 * through a Web Audio graph first: each track becomes a source node,
 * both connect to a single destination, and that destination's stream is
 * what gets recorded.
 *
 * The finished file is uploaded from the browser directly to the blob
 * store. A consultation of any real length is larger than a request body
 * through the application is allowed to be.
 */
export default function CallRecorder({ appointmentId }: { appointmentId: string }) {
  const micTracks = useTracks([Track.Source.Microphone], { onlySubscribed: false });

  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [progress, setProgress] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef<number>(0);
  const typeRef = useRef<string>("audio/webm");

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

    const mimeType = pickRecordingType();
    if (!mimeType) {
      setMessage("This browser cannot record audio.");
      return;
    }

    const context = new AudioContext();
    const destination = context.createMediaStreamDestination();
    for (const stream of streams) {
      context.createMediaStreamSource(stream).connect(destination);
    }
    contextRef.current = context;

    // Low bitrate is plenty for speech and keeps the file small enough to
    // upload over a slow connection. Whisper handles either container via
    // ffmpeg server-side.
    const recorder = new MediaRecorder(destination.stream, {
      mimeType,
      audioBitsPerSecond: 32_000,
    });
    typeRef.current = baseContentType(mimeType);

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
  }, [micTracks]);

  const stop = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder) return;

    if (tickRef.current) clearInterval(tickRef.current);

    const finished = new Promise<Blob>((resolve) => {
      recorder.onstop = () =>
        resolve(new Blob(chunksRef.current, { type: typeRef.current }));
    });

    recorder.stop();
    const blob = await finished;
    contextRef.current?.close();

    const durationSeconds = Math.floor((Date.now() - startedAt.current) / 1000);

    if (blob.size === 0) {
      setState("error");
      setMessage("No audio was captured.");
      return;
    }
    if (blob.size > MAX_RECORDING_BYTES) {
      setState("error");
      setMessage("Recording too large to save.");
      return;
    }

    setState("uploading");
    setProgress(0);

    try {
      const extension = typeRef.current === "audio/mp4" ? "m4a" : "webm";
      const pathname = await uploadDirect({
        file: blob,
        filename: `consultation-${appointmentId}.${extension}`,
        contentType: typeRef.current,
        request: { kind: "recording", appointmentId },
        onProgress: setProgress,
      });

      const result = await registerRecording({ appointmentId, pathname, durationSeconds });
      if (!result.ok) {
        setState("error");
        setMessage(result.error);
        return;
      }

      setState("done");
      setMessage("Recording saved. You can transcribe it from the review page.");
    } catch {
      setState("error");
      setMessage("Upload failed. Check your connection.");
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
            {state === "uploading" ? `Uploading ${Math.round(progress)}%` : "Saved"}
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
