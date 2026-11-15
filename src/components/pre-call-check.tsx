"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Icon from "@/components/icon";

export type CallMediaChoice = {
  /** False to join muted; otherwise which microphone to use. */
  audio: false | { deviceId?: string };
  /** False to join with the camera off; otherwise which camera to use. */
  video: false | { deviceId?: string };
};

type Problem = "blocked" | "missing" | "busy" | "unsupported" | null;

const PROBLEMS: Record<Exclude<Problem, null>, string> = {
  blocked:
    "This browser has blocked the camera and microphone for this site. Allow them from the address bar, then choose Try again. You can also join without them and listen.",
  missing:
    "No camera or microphone was found. Plug one in and choose Try again, or join without them and listen.",
  busy: "The camera or microphone is being used by another app. Close it and choose Try again.",
  unsupported:
    "This browser cannot use a camera or microphone here. You can still join and listen.",
};

/** A toggle the size of a thumb: 44 CSS pixels each way at minimum (WCAG 2.5.8). */
const toggle =
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium";
const field = "min-h-11 w-full rounded-md border border-mist-deep bg-white px-3 text-sm";

/**
 * A look in the mirror before the consultation: is the camera pointing
 * at the right thing, and can the microphone hear you.
 *
 * Nothing here is connected to the call. The preview is the browser's
 * own camera and microphone, released the moment "Join Consultation" is
 * pressed, and what is handed on is only the choice — which devices,
 * and whether each starts on. Joining is never blocked: someone whose
 * camera is broken can still hear the vet.
 *
 * The input level is shown three ways — a moving bar, a number for
 * assistive technology, and a sentence that says whether anything was
 * heard — because a bar that only moves is invisible to a screen reader
 * and a bar that does not move is ambiguous to everyone.
 */
export default function PreCallCheck({
  onJoin,
  joinLabel = "Join Consultation",
}: {
  onJoin: (choice: CallMediaChoice) => void;
  joinLabel?: string;
}) {
  const id = useId();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const meterTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [micId, setMicId] = useState("");
  const [camId, setCamId] = useState("");
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [cams, setCams] = useState<MediaDeviceInfo[]>([]);
  const [problem, setProblem] = useState<Problem>(null);
  const [starting, setStarting] = useState(true);
  const [level, setLevel] = useState(0);
  const [heard, setHeard] = useState(false);

  const release = useCallback(() => {
    if (meterTimerRef.current) clearInterval(meterTimerRef.current);
    meterTimerRef.current = null;
    void audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const startMeter = useCallback((stream: MediaStream) => {
    if (stream.getAudioTracks().length === 0) return;
    const Context =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return;

    const context = new Context();
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    context.createMediaStreamSource(stream).connect(analyser);
    audioContextRef.current = context;

    const samples = new Uint8Array(analyser.fftSize);
    // Ten times a second: smooth enough to watch, slow enough that a
    // screen reader asked for the value is not handed a blur.
    meterTimerRef.current = setInterval(() => {
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) {
        const centred = (sample - 128) / 128;
        sum += centred * centred;
      }
      // RMS of speech sits around 0.05–0.3; scaled so talking fills
      // most of the bar.
      const next = Math.min(100, Math.round(Math.sqrt(sum / samples.length) * 400));
      setLevel(next);
      if (next >= 8) setHeard(true);
    }, 100);
  }, []);

  /** (Re)opens the preview with the current choices. */
  const open = useCallback(
    async (want: { mic: boolean; cam: boolean; micId: string; camId: string }) => {
      release();
      setLevel(0);
      setHeard(false);

      if (!navigator.mediaDevices?.getUserMedia) {
        setProblem("unsupported");
        setStarting(false);
        return;
      }
      if (!want.mic && !want.cam) {
        setProblem(null);
        setStarting(false);
        return;
      }

      setStarting(true);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: want.mic ? (want.micId ? { deviceId: { exact: want.micId } } : true) : false,
          video: want.cam ? (want.camId ? { deviceId: { exact: want.camId } } : true) : false,
        });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        startMeter(stream);
        setProblem(null);

        // Device names are only given out once permission is.
        const devices = await navigator.mediaDevices.enumerateDevices();
        setMics(devices.filter((d) => d.kind === "audioinput" && d.deviceId));
        setCams(devices.filter((d) => d.kind === "videoinput" && d.deviceId));
      } catch (error) {
        const name = error instanceof DOMException ? error.name : "";
        setProblem(
          name === "NotAllowedError" || name === "SecurityError"
            ? "blocked"
            : name === "NotFoundError" || name === "OverconstrainedError"
              ? "missing"
              : "busy",
        );
      } finally {
        setStarting(false);
      }
    },
    [release, startMeter],
  );

  // Open once on arrival; every later change goes through `change`.
  const openedRef = useRef(false);
  useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    void open({ mic: true, cam: true, micId: "", camId: "" });
  }, [open]);
  useEffect(() => release, [release]);

  const change = (patch: Partial<{ mic: boolean; cam: boolean; micId: string; camId: string }>) => {
    const next = { mic: micOn, cam: camOn, micId, camId, ...patch };
    setMicOn(next.mic);
    setCamOn(next.cam);
    setMicId(next.micId);
    setCamId(next.camId);
    void open(next);
  };

  const join = () => {
    // Let go of the devices first: some cameras refuse a second opener.
    release();
    const usable = problem === null;
    onJoin({
      audio: micOn && usable ? (micId ? { deviceId: micId } : {}) : false,
      video: camOn && usable ? (camId ? { deviceId: camId } : {}) : false,
    });
  };

  const micLive = micOn && problem === null && !starting;
  const camLive = camOn && problem === null && !starting;

  const micStatus = !micOn
    ? "Microphone is off. You will join muted."
    : problem
      ? "Microphone is not available."
      : starting
        ? "Starting the microphone..."
        : heard
          ? "Your microphone is working — we can hear you."
          : "Say something to test your microphone. Nothing heard yet.";

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="mx-auto max-w-xl rounded-lg border border-mist bg-white p-5"
    >
      <h2 id={`${id}-title`} className="text-lg text-navy-900">
        Check Audio &amp; Camera
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        Only you can see and hear this. Nothing is shared until you join.
      </p>

      <div className="relative mt-4 aspect-video overflow-hidden rounded-md bg-navy-900">
        {/* Muted, or the preview would feed the speakers back into the mic. */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          aria-label="Preview of your camera"
          className={`h-full w-full -scale-x-100 object-cover ${camLive ? "" : "invisible"}`}
        />
        {!camLive && (
          <p className="absolute inset-0 flex items-center justify-center gap-2 px-4 text-center text-sm text-white">
            <Icon name="cameraOff" className="h-5 w-5" />
            {starting ? "Starting the camera..." : camOn ? "Camera is not available" : "Camera is off"}
          </p>
        )}
      </div>

      {problem && (
        <div role="alert" className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="flex gap-2">
            <Icon name="alert" className="mt-0.5 h-4 w-4" />
            <span>{PROBLEMS[problem]}</span>
          </p>
          {problem !== "unsupported" && (
            <button
              type="button"
              onClick={() => change({})}
              className="mt-2 min-h-11 rounded-md border border-amber-900 px-3 text-sm font-medium"
            >
              Try again
            </button>
          )}
        </div>
      )}

      <div className="mt-4">
        <div className="flex items-center justify-between gap-3">
          <span id={`${id}-level`} className="text-sm font-medium">
            Microphone level
          </span>
          <span aria-hidden="true" className="text-xs tabular-nums text-ink-soft">
            {micLive ? `${level}%` : "—"}
          </span>
        </div>
        <div
          role="meter"
          aria-labelledby={`${id}-level`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={micLive ? level : 0}
          aria-valuetext={micLive ? `${level} percent` : "Microphone off"}
          className="mt-1 h-3 overflow-hidden rounded-full border border-mist-deep bg-mist"
        >
          <div
            className="h-full rounded-full bg-aqua-600 transition-[width] duration-100"
            style={{ width: `${micLive ? level : 0}%` }}
          />
        </div>
        {/* Changes a handful of times, not ten times a second, so it is
            safe to announce. */}
        <p role="status" className="mt-1.5 flex items-center gap-1.5 text-sm text-ink-soft">
          <Icon
            name={!micOn || problem ? "micOff" : heard ? "checkCircle" : "mic"}
            className="h-4 w-4"
          />
          {micStatus}
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-mic`} className="mb-1 block text-sm font-medium">
            Microphone
          </label>
          <select
            id={`${id}-mic`}
            className={field}
            value={micId}
            disabled={!micOn || mics.length === 0}
            onChange={(e) => change({ micId: e.target.value })}
          >
            {mics.length === 0 && <option value="">Default microphone</option>}
            {mics.map((d, i) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Microphone ${i + 1}`}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-cam`} className="mb-1 block text-sm font-medium">
            Camera
          </label>
          <select
            id={`${id}-cam`}
            className={field}
            value={camId}
            disabled={!camOn || cams.length === 0}
            onChange={(e) => change({ camId: e.target.value })}
          >
            {cams.length === 0 && <option value="">Default camera</option>}
            {cams.map((d, i) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Camera ${i + 1}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {/* The label states what the button will do, and aria-pressed
            carries the current state — not the other way round, which
            reads as "Muted, pressed" and leaves everyone guessing. */}
        <button
          type="button"
          aria-pressed={micOn}
          onClick={() => change({ mic: !micOn })}
          className={`${toggle} ${micOn ? "border-navy-900 bg-aqua-50 text-navy-900" : "border-mist-deep bg-white text-ink"}`}
        >
          <Icon name={micOn ? "mic" : "micOff"} className="h-4 w-4" />
          Microphone {micOn ? "on" : "off"}
        </button>
        <button
          type="button"
          aria-pressed={camOn}
          onClick={() => change({ cam: !camOn })}
          className={`${toggle} ${camOn ? "border-navy-900 bg-aqua-50 text-navy-900" : "border-mist-deep bg-white text-ink"}`}
        >
          <Icon name={camOn ? "camera" : "cameraOff"} className="h-4 w-4" />
          Camera {camOn ? "on" : "off"}
        </button>

        <button
          type="button"
          onClick={join}
          className="ml-auto min-h-11 rounded-md bg-navy-900 px-5 text-sm font-medium text-white hover:bg-navy-700"
        >
          {joinLabel}
        </button>
      </div>
    </section>
  );
}
