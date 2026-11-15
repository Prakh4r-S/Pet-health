/**
 * Small line icons, drawn inline so they take the colour of the text
 * around them and need no network request.
 *
 * Always decorative: an icon here sits beside words that say the same
 * thing, and is hidden from screen readers so it is not announced twice.
 * A control that shows only an icon must carry its own aria-label.
 */
const PATHS = {
  alert: "M12 9v4m0 4h.01M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0Z",
  clock: "M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  check: "m5 13 4 4L19 7",
  checkCircle: "m8.5 12.5 2.5 2.5 4.5-5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  dash: "M8 12h8m5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  cross: "m9 9 6 6m0-6-6 6m12-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  info: "M12 11v5m0-8h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  live: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm6.4-9.4a9 9 0 0 1 0 12.8M5.6 18.4a9 9 0 0 1 0-12.8",
  lock: "M7 11V8a5 5 0 0 1 10 0v3m-11 0h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z",
  pencil: "m4 20 1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1Zm10.5-13.5 3 3",
  pill: "m10.5 20.5 10-10a4.95 4.95 0 0 0-7-7l-10 10a4.95 4.95 0 0 0 7 7Zm-2-12 7 7",
  syringe: "m18 2 4 4m-5 1 3-3m-1 5L9.7 19.3a1 1 0 0 1-1.4 0l-2.6-2.6a1 1 0 0 1 0-1.4L16 5m-7 6 2 2m-6 6-3 3m12-13 2 2",
  mic: "M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm7-3a7 7 0 0 1-14 0m7 7v3",
  micOff: "M3 3l18 18M9 9v3a3 3 0 0 0 5.1 2.1M15 10.5V6a3 3 0 0 0-5.7-1.3M19 12a7 7 0 0 1-.9 3.4M5 12a7 7 0 0 0 11 5.7M12 19v3",
  camera: "M15 10.5 21 7v10l-6-3.5M4 6h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z",
  cameraOff: "M3 3l18 18M15 10.5 21 7v10l-3.2-1.9M7 6h7a1 1 0 0 1 1 1v6M15 15v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1",
  paperclip: "m20.5 11.5-8.6 8.6a5 5 0 0 1-7-7l8.5-8.6a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.3l7.9-7.9",
  message: "M21 12a8 8 0 0 1-11.8 7L4 20l1.1-4.6A8 8 0 1 1 21 12Z",
} as const;

export type IconName = keyof typeof PATHS;

export default function Icon({
  name,
  className = "h-3.5 w-3.5",
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${className}`}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
