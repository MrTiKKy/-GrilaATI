import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";

/** Hash dummy — folosit când userul nu există, ca timing-ul să fie similar */
const DUMMY_HASH =
  "$2b$12$ltqXATbdc9I.bEa.hkVilunGbyycXBzLDVEj2w6Zmk17eoxoOqH8y";

const BCRYPT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verifică email + parolă față de tabelul `users`.
 * Compară mereu un hash (dummy dacă lipsește userul) — mitigare timing / user enumeration.
 */
export async function verifyCredentials(
  email: string,
  password: string,
): Promise<boolean> {
  const emailNorm = email.trim().toLowerCase();
  const sql = getDb();

  const rows = await sql`
    SELECT password_hash
    FROM users
    WHERE email = ${emailNorm}
      AND activ = true
    LIMIT 1
  `;

  const hash =
    rows[0] && typeof rows[0].password_hash === "string"
      ? String(rows[0].password_hash)
      : DUMMY_HASH;

  const ok = await bcrypt.compare(password, hash);
  return Boolean(rows[0]) && ok;
}
