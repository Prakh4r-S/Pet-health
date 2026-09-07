"use client";

import { useCallback, useRef, useState } from "react";
import { Track } from "livekit-client";
import { useTracks, useLocalParticipant } from "@livekit/components-react";
import { saveSnapshot } from "@/app/appointments/[id]/snapshot-actions";

type Stroke = { x: number; y: number }[];

export default function SnapshotTool({
  appointmentId,
  petId,
}: {
  appointmentId: string;
  petId: string;
}) {
  const { localParticipant } = useLocalParticipant();
  const cameraTracks = useTracks([Track.Source.Camera], { onlySubscribed: true });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [captured, setCaptured] = useState<string | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // The owner's camera, not the vet's own preview.
  const remote = cameraTracks.find(
    (t) => t.participant.identity !== localParticipant?.identity,
  );

    const capture = useCallback(async () => {
    const track = remote?.publication?.track;
    if (!track) {
      setMessage("No video from the other participant yet.");
      return;
    }

    // Prefer an element LiveKit has already attached and is playing —
    // it has real dimensions. A freshly attached element has not loaded
    // metadata yet, so videoWidth reads as zero.
    let video = track.attachedElements.find(
      (el): el is HTMLVideoElement =>
        el instanceof HTMLVideoElement && el.videoWidth > 0,
    );

    let temporary = false;

    if (!video) {
      const el = track.attach() as HTMLVideoElement;
      temporary = true;
      // Wait for metadata rather than assuming it is there.
      if (!el.videoWidth) {
        await new Promise<void>((resolve) => {
          const done = () => resolve();
          el.addEventListener("loadedmetadata", done, { once: true });
          setTimeout(done, 1500);
        });
      }
      video = el;
    }

    if (!video.videoWidth || !video.videoHeight) {
      if (temporary) track.detach(video);
      setMessage("Video isn't ready yet. Try again in a moment.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);

    if (temporary) track.detach(video);

    setCaptured(canvas.toDataURL("image/jpeg", 0.85));
    setStrokes([]);
    setMessage(null);
  }, [remote]);

  const pointFrom = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    // Convert from displayed size to the canvas's own coordinate space —
    // the element is scaled by CSS, so client coordinates are not canvas
    // coordinates.
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const redraw = useCallback((allStrokes: Stroke[]) => {
    const canvas = canvasRef.current;
    if (!canvas || !captured) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = Math.max(3, img.width / 300);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const stroke of allStrokes) {
        if (stroke.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(stroke[0].x, stroke[0].y);
        for (const p of stroke.slice(1)) ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
    };
    img.src = captured;
  }, [captured]);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setDrawing(true);
    setStrokes((s) => [...s, [pointFrom(e)]]);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    const point = pointFrom(e);
    setStrokes((s) => {
      const next = [...s];
      next[next.length - 1] = [...next[next.length - 1], point];
      redraw(next);
      return next;
    });
  };

  const save = async (note: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    try {
      await saveSnapshot({
        appointmentId,
        petId,
        dataUrl: canvas.toDataURL("image/jpeg", 0.85),
        note: note.trim() || null,
      });
      setCaptured(null);
      setStrokes([]);
      setMessage("Saved to the patient's record.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  if (!captured) {
    return (
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void capture()}
          className="rounded-md bg-white/90 px-3 py-1.5 text-sm font-medium shadow hover:bg-white"
        >
          Take snapshot
        </button>
        {message && <span className="text-xs text-gray-600">{message}</span>}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <p className="mb-2 text-xs text-gray-600">
        Draw on the image to mark anything worth noting.
      </p>
      <canvas
        ref={(node) => {
          canvasRef.current = node;
          if (node && strokes.length === 0) redraw([]);
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => setDrawing(false)}
        onPointerLeave={() => setDrawing(false)}
        className="w-full cursor-crosshair rounded-md border border-gray-200 touch-none"
      />
      <SnapshotControls
        saving={saving}
        onUndo={() => {
          const next = strokes.slice(0, -1);
          setStrokes(next);
          redraw(next);
        }}
        onDiscard={() => {
          setCaptured(null);
          setStrokes([]);
        }}
        onSave={save}
      />
      {message && <p className="mt-2 text-xs text-gray-600">{message}</p>}
    </div>
  );
}

function SnapshotControls({
  saving,
  onUndo,
  onDiscard,
  onSave,
}: {
  saving: boolean;
  onUndo: () => void;
  onDiscard: () => void;
  onSave: (note: string) => void;
}) {
  const [note, setNote] = useState("");

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="What does this show?"
        className="min-w-40 flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
      />
      <button
        type="button"
        onClick={onUndo}
        className="rounded-md bg-gray-100 px-3 py-1.5 text-sm hover:bg-gray-200"
      >
        Undo
      </button>
      <button
        type="button"
        onClick={onDiscard}
        className="rounded-md bg-gray-100 px-3 py-1.5 text-sm hover:bg-gray-200"
      >
        Discard
      </button>
      <button
        type="button"
        disabled={saving}
        onClick={() => onSave(note)}
        className="rounded-md bg-pine-900 px-3 py-1.5 text-sm text-white hover:bg-pine-700 disabled:bg-gray-300"
      >
        {saving ? "Saving..." : "Save to record"}
      </button>
    </div>
  );
}
