import { createHash, timingSafeEqual } from "crypto";

function sha256(value: string): Buffer {
  return createHash("sha256").update(value.normalize("NFKC")).digest();
}

function safeEqualStr(a: string, b: string): boolean {
  return timingSafeEqual(sha256(a), sha256(b));
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} lipsește din .env`);
  }
  return value;
}

/**
 * Verifică email + parolă din env (AUTH_EMAIL / AUTH_PASSWORD).
 * Compară ambele mereu (timing-safe), ca să nu se vadă care e greșit.
 */
export function verifyCredentials(email: string, password: string): boolean {
  const expectedEmail = requireEnv("AUTH_EMAIL").trim().toLowerCase();
  const expectedPassword = requireEnv("AUTH_PASSWORD");

  const emailNorm = email.trim().toLowerCase();
  const emailOk = safeEqualStr(emailNorm, expectedEmail);
  const passOk = safeEqualStr(password, expectedPassword);

  return emailOk && passOk;
}
