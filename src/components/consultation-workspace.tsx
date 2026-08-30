"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import "@livekit/components-styles";
import PatientPanel from "@/components/patient-panel";
import SnapshotTool from "@/components/snapshot-tool";
import type { PatientSummary } from "@/lib/patient-summary";

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
        data-lk-theme="default"
      >
        <div className="flex gap-3">
          <div className="min-w-0 flex-1">
            <div
              className="overflow-hidden rounded-lg"
              style={{ height: "560px" }}
            >
              <VideoConference />
            </div>

            {isVet && patient && (
              <div className="mt-3">
                <SnapshotTool appointmentId={appointmentId} petId={patient.id} />
              </div>
            )}
          </div>

          {patient && (
            <aside className="hidden w-80 shrink-0 lg:block">
              <button
                type="button"
                onClick={() => setPanelOpen((v) => !v)}
                className="mb-2 w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium hover:bg-gray-50"
              >
                {panelOpen ? "Hide records" : "Patient records"}
              </button>
              {panelOpen && (
                <div className="h-[512px] overflow-hidden rounded-lg border border-gray-200">
                  <PatientPanel patient={patient} />
                </div>
              )}
            </aside>
          )}
        </div>
      </LiveKitRoom>
    </div>
  );
}
