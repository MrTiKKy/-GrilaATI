import { createHash, timingSafeEqual } from "crypto";

function getAppPassword(): string {
  const password = process.env.APP_PASSWORD;
  if (!password) {
    throw new Error("APP_PASSWORD lipsește din .env");
  }
  return password;
}

/** Comparație timing-safe pentru parola de secție (doar pe Node / API routes) */
export function verifyPassword(input: string): boolean {
  const expected = getAppPassword();
  const hashA = createHash("sha256").update(input.normalize("NFKC")).digest();
  const hashB = createHash("sha256")
    .update(expected.normalize("NFKC"))
    .digest();
  return timingSafeEqual(hashA, hashB);
}
