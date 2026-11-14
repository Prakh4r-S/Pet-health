"use client";

import { createContext, useContext } from "react";
import { useFormStatus } from "react-dom";

/**
 * Set by ActionForm, which submits through a transition rather than the
 * form's own action and so is invisible to useFormStatus.
 */
export const FormPendingContext = createContext(false);

export const primaryButton =
  "rounded-md bg-navy-900 px-4 py-2 text-sm text-white hover:bg-navy-700";

/**
 * A submit button that knows when its form is busy.
 *
 * While the submission is in flight it disables itself and changes its
 * label. That is what stops a second click from logging a vaccination
 * twice — the server cannot tell an impatient double-click from two
 * genuine entries.
 */
export default function SubmitButton({
  children,
  pendingLabel = "Working...",
  className = primaryButton,
  disabled = false,
  pending: pendingOverride,
  title,
}: {
  children: React.ReactNode;
  pendingLabel?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  /** For forms that manage their own submission, such as direct uploads. */
  pending?: boolean;
  title?: string;
}) {
  const status = useFormStatus();
  const inActionForm = useContext(FormPendingContext);
  const pending = pendingOverride ?? (status.pending || inActionForm);

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending}
      title={title}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
