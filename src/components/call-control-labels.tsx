"use client";

import { useEffect, useRef } from "react";

/**
 * What each of LiveKit's call controls is called.
 *
 * The control bar drops its text and shows icons alone when the video is
 * narrow — on a phone, always — and an icon-only button with no name is
 * announced as just "button". LiveKit does not label them, and replacing
 * its control bar would mean re-implementing the device menus, chat and
 * screen sharing that come with it. So the names are added to its
 * buttons here, and kept current: a toggle's name says what pressing it
 * will do, which changes each time it is pressed.
 */
function nameFor(button: Element): string | null {
  const source = button.getAttribute("data-lk-source");
  const on = button.getAttribute("data-lk-enabled") === "true";

  if (button.classList.contains("lk-disconnect-button")) return "End call";
  if (button.classList.contains("lk-chat-toggle")) return "Chat";
  if (button.classList.contains("lk-settings-toggle")) return "Call settings";
  if (button.classList.contains("lk-close-button")) return "Close";
  if (button.classList.contains("lk-focus-toggle-button")) return "Enlarge or shrink this video";
  if (button.classList.contains("lk-start-audio-button")) return "Allow sound";

  if (button.classList.contains("lk-button-menu")) {
    const kind = button.parentElement?.parentElement
      ?.querySelector("[data-lk-source]")
      ?.getAttribute("data-lk-source");
    return kind === "camera" ? "Choose camera" : "Choose microphone";
  }

  if (source === "microphone") return on ? "Mute microphone" : "Unmute microphone";
  if (source === "camera") return on ? "Turn camera off" : "Turn camera on";
  if (source === "screen_share") return on ? "Stop sharing screen" : "Share screen";
  return null;
}

function label(root: HTMLElement) {
  for (const button of root.querySelectorAll("button")) {
    const name = nameFor(button);
    if (name && button.getAttribute("aria-label") !== name) {
      button.setAttribute("aria-label", name);
    }
  }
}

/** Wraps the call and keeps its controls named. Renders no markup of its own beyond a div. */
export default function CallControlLabels({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    label(root);

    // Buttons come and go with the layout, and a toggle's state is an
    // attribute — both need watching.
    const observer = new MutationObserver(() => label(root));
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-lk-enabled", "class"],
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} data-lk-theme="default" className={className}>
      {children}
    </div>
  );
}
