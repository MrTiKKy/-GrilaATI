import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";

/** Hash dummy — folosit când userul nu există, ca timing-ul să fie similar */
const DUMMY_HASH =
  "$2b$12$ltqXATbdc9I.bEa.hkVilunGbyycXBzLDVEj2w6Zmk17eoxoOqH8y";

const BCRYPT_ROUNDS = 12;

export const MIN_PASSWORD_LENGTH = 8;
export const NEW_ACCOUNT_MIN_PASSWORD = 10;

const COMMON_PASSWORDS = new Set([
  "password", "123456789", "1234567890", "parola123", "qwerty123",
  "password123", "admin12345", "letmein123", "welcome123", "monkey1234",
  "iloveyou12", "changeme12", "trustno123",
]);

/**
 * Validate password for new accounts (stricter rules).
 * Returns error message or null if valid.
 */
export function validatePasswordForNewAccount(
  password: string,
  email: string,
): string | null {
  if (password.length < NEW_ACCOUNT_MIN_PASSWORD) {
    return `Parola trebuie să aibă cel puțin ${NEW_ACCOUNT_MIN_PASSWORD} caractere`;
  }
  if (password.length > 256) {
    return "Parola este prea lungă";
  }
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) {
    return "Parola este prea comună — alege una mai sigură";
  }
  const localPart = email.split("@")[0]?.toLowerCase();
  if (localPart && localPart.length >= 3 && lower.includes(localPart)) {
    return "Parola nu poate conține adresa de email";
  }
  return null;
}

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
