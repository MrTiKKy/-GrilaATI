import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";

/** Hash dummy — folosit când userul nu există, ca timing-ul să fie similar */
const DUMMY_HASH =
  "$2b$12$ltqXATbdc9I.bEa.hkVilunGbyycXBzLDVEj2w6Zmk17eoxoOqH8y";

const BCRYPT_ROUNDS = 12;

export const MIN_PASSWORD_LENGTH = 8;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function comparePassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export type AuthUser = {
  id: string;
  email: string;
};

/**
 * Verifică email + parolă față de tabelul `users`.
 * Returnează userul sau null. Compară mereu un hash (dummy dacă lipsește).
 */
export async function authenticateUser(
  email: string,
  password: string,
): Promise<AuthUser | null> {
  const emailNorm = email.trim().toLowerCase();
  const sql = getDb();

  const rows = await sql`
    SELECT id, email, password_hash
    FROM users
    WHERE email = ${emailNorm}
      AND activ = true
    LIMIT 1
  `;

  const row = rows[0];
  const hash =
    row && typeof row.password_hash === "string"
      ? String(row.password_hash)
      : DUMMY_HASH;

  const ok = await bcrypt.compare(password, hash);
  if (!row || !ok) return null;

  return {
    id: String(row.id),
    email: String(row.email).toLowerCase(),
  };
}

/** @deprecated — folosește authenticateUser */
export async function verifyCredentials(
  email: string,
  password: string,
): Promise<boolean> {
  return (await authenticateUser(email, password)) !== null;
}
