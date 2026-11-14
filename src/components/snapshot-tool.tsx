"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Track } from "livekit-client";
import { useTracks, useLocalParticipant } from "@livekit/components-react";
import { listSnapshots, saveSnapshot } from "@/app/appointments/[id]/snapshot-actions";

type Stroke = { x: number; y: number }[];
type SavedSnapshot = { id: string; title: string; takenAt: string };

/**
 * The snapshots already saved from this consultation.
 *
 * Without this, a saved snapshot simply vanishes from the vet's view —
 * the only confirmation is a line of text, and there is no way to look
 * at one again until the call is over. Each opens in a new tab, because
 * navigating this one would end the call.
 */
function SnapshotStrip({ snapshots }: { snapshots: SavedSnapshot[] }) {
  if (snapshots.length === 0) return null;

  return (
    <div className="mt-2">
      <p className="text-xs text-ink-soft">
        Saved this consultation ({snapshots.length})
      </p>
      <ul className="mt-1 flex flex-wrap gap-2">
        {snapshots.map((s) => (
          <li key={s.id}>
            <a
              href={`/api/documents/${s.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block max-w-48 truncate rounded-md border border-mist bg-white px-2.5 py-1 text-xs hover:border-aqua-600"
              title={s.title}
            >
              {s.title}
              <span className="ml-1.5 text-ink-faint">
                {new Date(s.takenAt).toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

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
  const [saved, setSaved] = useState<SavedSnapshot[]>([]);

  // Loaded on mount so a vet who rejoins a call sees what they had
  // already captured, and again after each save. A failure is ignored:
  // the strip is a convenience, and the snapshots are saved regardless.
  useEffect(() => {
    let current = true;
    listSnapshots(appointmentId).then(
      (snapshots) => {
        if (current) setSaved(snapshots);
      },
      () => {},
    );
    return () => {
      current = false;
    };
  }, [appointmentId]);

  const refreshSaved = async () => {
    try {
      setSaved(await listSnapshots(appointmentId));
    } catch {
      // as above
    }
  };

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
      const result = await saveSnapshot({
        appointmentId,
        petId,
        dataUrl: canvas.toDataURL("image/jpeg", 0.85),
        note: note.trim() || null,
      });
      if (result.error) {
        setMessage(result.error);
        return;
      }
      setCaptured(null);
      setStrokes([]);
      setMessage("Saved to the patient's record.");
      void refreshSaved();
    } catch {
      setMessage("Could not save the snapshot. Try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!captured) {
    return (
      // A card in the row of call tools beneath the video, matching the
      // recorder and the notepad — not a control floating over the feed.
      <div className="rounded-lg border border-mist bg-white p-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void capture()}
            className="rounded-md bg-navy-900 px-3 py-1.5 text-sm text-white hover:bg-navy-700"
          >
            Take snapshot
          </button>
          <span className="text-xs text-ink-soft">
            {message ?? "Captures the owner's camera so you can mark it up."}
          </span>
        </div>
        <SnapshotStrip snapshots={saved} />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-mist bg-white p-3">
      <p className="mb-2 text-xs text-ink-soft">
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
        className="w-full cursor-crosshair rounded-md border border-mist touch-none"
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
      {message && <p className="mt-2 text-xs text-ink-soft">{message}</p>}
      <SnapshotStrip snapshots={saved} />
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
        className="min-w-40 flex-1 rounded-md border border-mist-deep px-3 py-1.5 text-sm"
      />
      <button
        type="button"
        onClick={onUndo}
        className="rounded-md bg-mist px-3 py-1.5 text-sm hover:bg-aqua-100"
      >
        Undo
      </button>
      <button
        type="button"
        onClick={onDiscard}
        className="rounded-md bg-mist px-3 py-1.5 text-sm hover:bg-aqua-100"
      >
        Discard
      </button>
      <button
        type="button"
        disabled={saving}
        onClick={() => onSave(note)}
        className="rounded-md bg-navy-900 px-3 py-1.5 text-sm text-white hover:bg-navy-700 disabled:opacity-60"
      >
        {saving ? "Saving..." : "Save to record"}
      </button>
    </div>
  );
}
