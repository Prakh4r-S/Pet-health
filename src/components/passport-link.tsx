"use client";

import { useState, useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * The share link, with a button to copy it.
 *
 * The address includes this site's origin, which the server rendering
 * the page does not reliably know behind a proxy but the browser always
 * does — so the full URL is assembled here. Until the browser has taken
 * over, the path alone is shown.
 */
export default function PassportLink({ path }: { path: string }) {
  const origin = useSyncExternalStore(
    subscribe,
    () => window.location.origin,
    () => "",
  );
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");
  const url = `${origin}${path}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied("copied");
    } catch {
      // Clipboard access can be refused (permissions, an insecure
      // origin). The field is selectable, so say so rather than fail
      // silently.
      setCopied("failed");
    }
    setTimeout(() => setCopied("idle"), 2500);
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <input
          readOnly
          value={url}
          aria-label="Share link"
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-md border border-mist-deep bg-aqua-50 px-3 py-2 font-mono text-xs"
        />
        <button
          type="button"
          onClick={() => void copy()}
          className="rounded-md bg-navy-900 px-4 py-2 text-sm text-white hover:bg-navy-700"
        >
          {copied === "copied" ? "Copied" : "Copy link"}
        </button>
        <a
          href={path}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-mist px-4 py-2 text-sm text-navy-900 hover:bg-aqua-50"
        >
          Preview
        </a>
      </div>
      <p role="status" className="mt-1 min-h-4 text-xs text-ink-soft">
        {copied === "failed" && "Couldn't copy automatically — select the link and copy it."}
      </p>
    </div>
  );
}
