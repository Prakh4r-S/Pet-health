"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import "@livekit/components-styles";
import PatientPanel from "@/components/patient-panel";
import SnapshotTool from "@/components/snapshot-tool";
import type { PatientSummary } from "@/lib/patient-summary";
import NotesPanel from "@/components/notes-panel";
import CallRecorder from "@/components/call-recorder";

/**
 * Holds the call, the records panel and the snapshot tool in one mounted
 * tree.
 *
 * Panels open and close with local state rather than by navigating.
 * Routing away unmounts LiveKitRoom, which tears down the peer
 * connection and drops the vet out of the consultation — so anything
 * needed mid-call has to live inside this component. The snapshot tool
 * in particular must be a child of LiveKitRoom, because it reads the
 * remote video track from LiveKit's room context.
 */
export default function ConsultationWorkspace({
  token,
  serverUrl,
  onLeaveHref,
  patient,
  appointmentId,
  isVet,
}: {
  token: string;
  serverUrl: string;
  onLeaveHref: string;
  patient: PatientSummary | null;
  appointmentId: string;
  isVet: boolean;
}) {
  const router = useRouter();
  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <div>
      <LiveKitRoom
        token={token}
        serverUrl={serverUrl}
        connect
        video
        audio
        onDisconnected={() => router.push(onLeaveHref)}
      >
        {/* One column on phones and tablets, two from 1024px.
            Source order is video, records, tools: stacked, that puts the
            patient's records directly under the call rather than below
            the notepad. On wide screens the grid lifts the records into
            a side column spanning both rows. */}
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
          {/* LiveKit's theme is dark and sets a light text colour on
              everything beneath it. Scoped to the video alone: applied
              to the whole room it turned the records panel and the
              tools below into white text on white cards. */}
          <div
            data-lk-theme="default"
            className="h-[60vh] min-h-80 overflow-hidden rounded-lg lg:col-start-1 lg:h-[560px]"
          >
            <VideoConference />
          </div>

          {patient && (
            <aside className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
              <button
                type="button"
                onClick={() => setPanelOpen((v) => !v)}
                aria-expanded={panelOpen}
                aria-controls="patient-records"
                className="flex w-full items-center justify-between rounded-md border border-mist bg-white px-3 py-2 text-sm font-medium hover:bg-pine-50"
              >
                <span>Patient records · {patient.name}</span>
                <span className="text-bark-soft">{panelOpen ? "Hide" : "Show"}</span>
              </button>
              {panelOpen && (
                <div
                  id="patient-records"
                  className="mt-2 max-h-[70vh] overflow-y-auto rounded-lg border border-mist lg:h-[512px] lg:max-h-none"
                >
                  <PatientPanel patient={patient} />
                </div>
              )}
            </aside>
          )}

          {isVet && patient && (
            <div className="grid gap-3 lg:col-start-1">
              <SnapshotTool appointmentId={appointmentId} petId={patient.id} />
              <CallRecorder appointmentId={appointmentId} />
              <NotesPanel appointmentId={appointmentId} />
            </div>
          )}
        </div>
      </LiveKitRoom>
    </div>
  );
}
