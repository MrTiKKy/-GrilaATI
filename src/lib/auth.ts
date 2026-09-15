import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "grila_session";
export const SESSION_MAX_AGE_SEC = 60 * 60 * 12; // 12h

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

export async function createSessionToken(): Promise<string> {
  return new SignJWT({ role: "editor" })
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

export function sessionCookieOptions(maxAge = SESSION_MAX_AGE_SEC) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
