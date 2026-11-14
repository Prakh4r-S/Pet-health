"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
 *
 * Until it is uploaded the recording exists only in this tab's memory,
 * so the two ways of losing it are both covered: closing or reloading
 * the tab asks first, and leaving the call — which unmounts this
 * component — stops the recording and saves it on the way out.
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

  const start = useCallback(() => {
    const streams: MediaStream[] = [];

    for (const t of micTracks) {
      const mediaTrack = t.publication?.track?.mediaStreamTrack;
      if (mediaTrack) streams.push(new MediaStream([mediaTrack]));
    }

    if (streams.length === 0) {
      setState("error");
      setMessage("No audio available to record yet. Check that microphones are on.");
      return;
    }

    // Asked of the browser rather than assumed: Safari has no webm
    // encoder, and constructing a MediaRecorder with a type it cannot
    // produce throws.
    const mimeType = pickRecordingType();
    if (!mimeType) {
      setState("error");
      setMessage("This browser can't record audio. Try Chrome, Edge, Firefox or Safari 14.1+.");
      return;
    }

    let context: AudioContext | null = null;

    try {
      context = new AudioContext();
      const destination = context.createMediaStreamDestination();
      for (const stream of streams) {
        context.createMediaStreamSource(stream).connect(destination);
      }

      // Low bitrate is plenty for speech and keeps the file small enough
      // to upload over a slow connection. Whisper handles either
      // container via ffmpeg server-side.
      const recorder = new MediaRecorder(destination.stream, {
        mimeType,
        audioBitsPerSecond: 32_000,
      });

      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(5000); // flush every 5s so a crash loses little

      typeRef.current = baseContentType(mimeType);
      contextRef.current = context;
      recorderRef.current = recorder;
    } catch (error) {
      // A supported type is not a guarantee: the constructor or start()
      // can still refuse (a track ended, the device is busy, a policy
      // blocks capture). Say so rather than leave a dead button.
      console.error(error);
      void context?.close();
      recorderRef.current = null;
      setState("error");
      setMessage("Recording couldn't start in this browser. You can still take notes by hand.");
      return;
    }

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
    recorderRef.current = null;

    if (tickRef.current) clearInterval(tickRef.current);

    const finished = new Promise<Blob>((resolve) => {
      recorder.onstop = () =>
        resolve(new Blob(chunksRef.current, { type: typeRef.current }));
    });

    try {
      recorder.stop();
    } catch {
      // Already inactive — its tracks ended when the call did. Whatever
      // was flushed before that is still in chunksRef.
      recorder.onstop?.(new Event("stop"));
    }
    const blob = await finished;
    void contextRef.current?.close();

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
      if (result.error) {
        setState("error");
        setMessage(result.error);
        return;
      }

      setState("done");
      setMessage(
        "Recording saved. On the review page, press Transcribe to turn it into a draft note.",
      );
    } catch {
      setState("error");
      setMessage("The recording couldn't be uploaded. Check your connection.");
    }
  }, [appointmentId]);

  // Closing or reloading the tab mid-recording, or mid-upload, discards
  // audio that exists nowhere else. The browser shows its own wording;
  // all a page can do is ask for the prompt.
  const unsaved = state === "recording" || state === "uploading";
  useEffect(() => {
    if (!unsaved) return;

    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = ""; // still required by some browsers
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  // Leaving the call navigates to the review page and unmounts this
  // component. That is a client-side navigation, so the page's scripts
  // keep running: stop the recorder and let the upload finish in the
  // background rather than silently dropping the consultation.
  const stopRef = useRef(stop);
  useEffect(() => {
    stopRef.current = stop;
  }, [stop]);
  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (recorderRef.current) void stopRef.current();
    };
  }, []);

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(
    seconds % 60,
  ).padStart(2, "0")}`;

  return (
    <div className="rounded-lg border border-mist bg-white p-3">
      <div className="flex flex-wrap items-center gap-3">
        {state === "idle" || state === "error" ? (
          <button
            type="button"
            onClick={start}
            className="rounded-md bg-navy-900 px-3 py-1.5 text-sm text-white hover:bg-navy-700"
          >
            {state === "error" ? "Try recording again" : "Record for notes"}
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
              className="rounded-md bg-mist px-3 py-1.5 text-sm hover:bg-aqua-100"
            >
              Stop and save
            </button>
          </>
        ) : (
          <span className="text-sm text-ink-soft">
            {state === "uploading" ? `Uploading ${Math.round(progress)}%` : "Saved"}
          </span>
        )}

        {state === "idle" && (
          <span className="text-xs text-ink-soft">
            Tell the owner before you start.
          </span>
        )}
        {state === "recording" && (
          <span className="text-xs text-ink-soft">
            Saved when you stop or leave the call. Keep this tab open until then.
          </span>
        )}
      </div>

      {message && (
        <p
          role={state === "error" ? "alert" : "status"}
          className={`mt-2 text-xs ${state === "error" ? "text-red-700" : "text-ink-soft"}`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
