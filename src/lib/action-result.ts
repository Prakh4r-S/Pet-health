/**
 * What a server action hands back to the form that called it.
 *
 * Anything the user is meant to read comes back as a value. A thrown
 * error's message is replaced with a generic one in production, so
 * "someone just booked that slot" would arrive as "an error occurred".
 * Throwing is kept for what really is exceptional: the caller is not
 * allowed to do this at all, or something broke.
 */
export type ActionState = { error?: string; success?: boolean };

export const initialActionState: ActionState = {};

export function fail(error: string): ActionState {
  return { error };
}

export const ok: ActionState = { success: true };

/** A server action in the shape useActionState expects. */
export type FormAction = (
  previous: ActionState,
  formData: FormData,
) => Promise<ActionState>;

/** Prisma's unique-violation error, which several actions turn into a message. */
export function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" && error !== null && "code" in error && error.code === "P2002"
  );
}
