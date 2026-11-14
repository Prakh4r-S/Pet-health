/**
 * How much of a conversation travels with each question.
 *
 * The assistant answers from the records, which are rebuilt and sent in
 * full every time; earlier turns only help it follow "and what about
 * the other one?". A few are enough for that. Without a cap, a long chat
 * resends itself whole on every question — slower and costlier each
 * time, and eventually larger than the model will accept.
 */
export const MAX_HISTORY_TURNS = 6;

/** A single earlier turn is cut to this before being resent. */
export const MAX_TURN_CHARS = 2_000;

export const MAX_QUESTION_CHARS = 1_000;
