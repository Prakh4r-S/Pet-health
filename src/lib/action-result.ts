/**
 * What an action called from a client component returns.
 *
 * A thrown error's message is replaced with a generic one in production,
 * so anything the user is meant to read has to come back as a value.
 */
export type ActionResult = { ok: true } | { ok: false; error: string };

export function fail(error: string): ActionResult {
  return { ok: false, error };
}
