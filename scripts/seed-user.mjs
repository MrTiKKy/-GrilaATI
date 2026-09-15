/**
 * Seed / update user în Neon.
 * Usage:
 *   node --env-file=.env scripts/seed-user.mjs email@domeniu.ro 'ParolaTa'
 */
import { createHash } from "crypto";
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

const email = process.argv[2]?.trim().toLowerCase();
const password = process.argv[3];

if (!email || !password) {
  console.error("Usage: node --env-file=.env scripts/seed-user.mjs <email> <password>");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL lipsește");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const hash = await bcrypt.hash(password, 12);

await sql`
  CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL,
    password_hash text NOT NULL,
    activ boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT users_email_lower CHECK (email = lower(email)),
    CONSTRAINT users_email_unique UNIQUE (email)
  )
`;

await sql`
  INSERT INTO users (email, password_hash, activ)
  VALUES (${email}, ${hash}, true)
  ON CONFLICT (email)
  DO UPDATE SET password_hash = EXCLUDED.password_hash, activ = true
`;

// Nu logăm parola; confirmăm doar email + fingerprint scurt al hash-ului
const fp = createHash("sha256").update(hash).digest("hex").slice(0, 8);
console.log(`OK — user ${email} (hash …${fp})`);
