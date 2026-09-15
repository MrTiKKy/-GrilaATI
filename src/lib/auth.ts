import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "grila_session";
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7 zile

export type SessionPayload = {
  userId: string;
  email: string;
  role: string;
};

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "SESSION_SECRET lipsește sau e prea scurt (min. 16 caractere)",
    );
  }
  return new TextEncoder().encode(secret);
}

function tryGetSecretKey(): Uint8Array | null {
  try {
    return getSecretKey();
  } catch {
    return null;
  }
}

export async function createSessionToken(user: {
  userId: string;
  email: string;
}): Promise<string> {
  return new SignJWT({
    role: "editor",
    userId: user.userId,
    email: user.email.trim().toLowerCase(),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SEC}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(
  token: string | undefined | null,
): Promise<boolean> {
  if (!token) return false;
  const key = tryGetSecretKey();
  if (!key) return false;
  try {
    await jwtVerify(token, key);
    return true;
  } catch {
    return false;
  }
}

export async function readSessionPayload(
  token: string | undefined | null,
): Promise<SessionPayload | null> {
  if (!token) return null;
  const key = tryGetSecretKey();
  if (!key) return null;
  try {
    const { payload } = await jwtVerify(token, key);
    const userId = payload.userId;
    const email = payload.email;
    if (typeof userId !== "string" || typeof email !== "string") return null;
    if (!userId || !email) return null;
    return {
      userId,
      email: email.toLowerCase(),
      role: typeof payload.role === "string" ? payload.role : "editor",
    };
  } catch {
    return null;
  }
}

export function sessionCookieOptions(maxAge = SESSION_MAX_AGE_SEC) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
