import { AccessToken } from "livekit-server-sdk";

/**
 * Mints a join token for one participant in one room.
 *
 * LiveKit has no "create room" call — a room springs into existence when
 * the first participant joins, and disappears when the last one leaves.
 * So the token carries everything: which room, who you are, and what you
 * are permitted to do. There is no room object to secure separately,
 * which means the token is the entire access decision.
 *
 * The secret never leaves the server. A client that could mint its own
 * tokens could join any room it liked.
 */
export async function createJoinToken(params: {
  roomName: string;
  identity: string;
  displayName: string;
  expiresAt: Date;
}): Promise<string> {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error("LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set");
  }

  const ttlSeconds = Math.max(
    60,
    Math.floor((params.expiresAt.getTime() - Date.now()) / 1000),
  );

  const token = new AccessToken(apiKey, apiSecret, {
    // Identity is the stable user id, not the display name. LiveKit
    // treats identity as unique per room — two participants sharing one
    // would evict each other.
    identity: params.identity,
    name: params.displayName,
    ttl: ttlSeconds,
  });

  token.addGrant({
    roomJoin: true,
    room: params.roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  return token.toJwt();
}

/** Deterministic room name for an appointment. */
export function roomNameFor(appointmentId: string) {
  return `appt-${appointmentId}`;
}