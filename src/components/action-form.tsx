"use client";

import { useActionState, useEffect, useRef, startTransition } from "react";
import {
  initialActionState,
  type ActionState,
  type FormAction,
} from "@/lib/action-result";
import { FormPendingContext } from "@/components/submit-button";

/**
 * A form bound to a server action that reports back.
 *
 * Three things every mutation form here needs, in one place: the action's
 * error shown inline next to what caused it, a pending state its submit
 * button can read, and optionally a confirmation before anything
 * irreversible is sent.
 *
 * The submission is dispatched by hand rather than left to the form's
 * `action`, because React clears every field once an action returns —
 * including when what it returned was "that weight is out of range".
 * Retyping a whole form to fix one field is a worse outcome than the
 * error. Fields are cleared here only on success. `action` is still set,
 * so the form works before JavaScript has loaded.
 */
export default function ActionForm({
  action,
  children,
  className,
  confirm,
  successMessage,
  resetOnSuccess = true,
}: {
  action: FormAction;
  children: React.ReactNode;
  className?: string;
  /** If set, the user is asked this before the form is sent. */
  confirm?: string;
  /** Shown after a successful submission, for forms with no other visible effect. */
  successMessage?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    action,
    initialActionState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success && resetOnSuccess) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    if (confirm && !window.confirm(confirm)) return;

    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  };

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} className={className}>
      <FormPendingContext.Provider value={pending}>{children}</FormPendingContext.Provider>

      {/* basis-full / col-span-full: the banner takes its own row whether
          the form is laid out as a wrapping flex row or a grid. */}
      {state.error && !pending && (
        <p
          role="alert"
          className="col-span-full mt-2 basis-full rounded-md border border-red-200 bg-red-50 px-3 py-2 text-left text-sm text-red-900"
        >
          {state.error}
        </p>
      )}
      {state.success && successMessage && !pending && (
        <p role="status" className="col-span-full mt-2 basis-full text-left text-sm text-pine-900">
          {successMessage}
        </p>
      )}
    </form>
  );
}
