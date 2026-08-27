"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import "@livekit/components-styles";
import PatientPanel from "@/components/patient-panel";
import type { PatientSummary } from "@/lib/patient-summary";

/**
 * Holds the call and the records panel in one mounted tree.
 *
 * The panel opens and closes with local state rather than by navigating.
 * That is the whole point: routing to /pets/[id] unmounts LiveKitRoom,
 * which tears down the peer connection and drops the vet out of the
 * consultation. Anything the vet needs mid-call has to live inside this
 * component.
 */
export default function ConsultationWorkspace({
  token,
  serverUrl,
  onLeaveHref,
  patient,
}: {
  token: string;
  serverUrl: string;
  onLeaveHref: string;
  patient: PatientSummary | null;
}) {
  const router = useRouter();
  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <div className="relative">
      {patient && (
        <button
          type="button"
          onClick={() => setPanelOpen((v) => !v)}
          className="absolute right-3 top-3 z-20 rounded-md bg-white/90 px-3 py-1.5 text-sm font-medium shadow hover:bg-white"
        >
          {panelOpen ? "Hide records" : "Patient records"}
        </button>
      )}

      <div className="flex gap-3">
        <div className="min-w-0 flex-1">
          <LiveKitRoom
            token={token}
            serverUrl={serverUrl}
            connect
            video
            audio
            onDisconnected={() => router.push(onLeaveHref)}
            data-lk-theme="default"
            style={{ height: "580px", borderRadius: "8px", overflow: "hidden" }}
          >
            <VideoConference />
          </LiveKitRoom>
        </div>

        {patient && panelOpen && (
          <aside className="h-[580px] w-80 shrink-0 overflow-hidden rounded-lg border border-gray-200">
            <PatientPanel patient={patient} />
          </aside>
        )}
      </div>
    </div>
  );
}
