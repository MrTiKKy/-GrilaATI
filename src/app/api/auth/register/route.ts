import { NextResponse } from "next/server";
import {
  createSessionToken,
  sessionCookieOptions,
  SESSION_COOKIE,
} from "@/lib/auth";
import { hashPassword, validatePasswordForNewAccount } from "@/lib/password";
import { writeAudit } from "@/lib/audit";
import { clientKey, rateLimit } from "@/lib/rateLimit";
import { readJsonLimited } from "@/lib/readJsonLimited";
import { getDb } from "@/lib/db";
import { clampString } from "@/lib/validate";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const ip = clientKey(request);

  try {
    const parsed = await readJsonLimited<{
      nume?: unknown;
      email?: unknown;
      password?: unknown;
      confirmPassword?: unknown;
    }>(request, 4_096);
    if (!parsed.ok) return parsed.response;

    const nume = clampString(parsed.data.nume, 80);
    if (!nume || nume.length < 1) {
      return NextResponse.json(
        { error: "Numele este obligatoriu (1–80 caractere)" },
        { status: 400 },
      );
    }

    const emailRaw =
      typeof parsed.data.email === "string" ? parsed.data.email.trim() : "";
    const emailNorm = emailRaw.toLowerCase();
    if (!emailNorm || emailNorm.length > 254 || !EMAIL_RE.test(emailNorm)) {
      return NextResponse.json(
        { error: "Adresă de email invalidă" },
        { status: 400 },
      );
    }

    const password =
      typeof parsed.data.password === "string" ? parsed.data.password : "";
    const confirmPassword =
      typeof parsed.data.confirmPassword === "string"
        ? parsed.data.confirmPassword
        : "";

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: "Parolele nu coincid" },
        { status: 400 },
      );
    }

    const pwError = validatePasswordForNewAccount(password, emailNorm);
    if (pwError) {
      return NextResponse.json({ error: pwError }, { status: 400 });
    }

    // Rate limit after validation: 5 / 15 min per IP and per email
    const limitIp = rateLimit(`register:ip:${ip}`, 5, 15 * 60_000);
    if (!limitIp.ok) {
      return NextResponse.json(
        { error: "Prea multe cereri. Încearcă din nou mai târziu." },
        {
          status: 429,
          headers: { "Retry-After": String(limitIp.retryAfterSec) },
        },
      );
    }

    const limitEmail = rateLimit(
      `register:email:${emailNorm}`,
      5,
      15 * 60_000,
    );
    if (!limitEmail.ok) {
      return NextResponse.json(
        { error: "Prea multe cereri. Încearcă din nou mai târziu." },
        {
          status: 429,
          headers: { "Retry-After": String(limitEmail.retryAfterSec) },
        },
      );
    }

    const sql = getDb();

    // Check if email already exists — neutral message
    const existing = await sql`
      SELECT id FROM users WHERE email = ${emailNorm} LIMIT 1
    `;
    if (existing[0]) {
      return NextResponse.json({ ok: true });
    }

    const passwordHash = await hashPassword(password);

    const inserted = await sql`
      INSERT INTO users (email, password_hash, nume, activ)
      VALUES (${emailNorm}, ${passwordHash}, ${nume}, true)
      RETURNING id::text AS id, email
    `;

    const row = inserted[0];
    if (!row) {
      return NextResponse.json(
        { error: "Eroare la crearea contului" },
        { status: 500 },
      );
    }

    const userId = String(row.id);

    await writeAudit({
      action: "cont_creat",
      resource: userId,
      ip,
      detail: { email: emailNorm, nume },
      userId,
    });

    const token = await createSessionToken({
      userId,
      email: emailNorm,
    });
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  } catch (error) {
    console.error("POST /api/auth/register", error);
    return NextResponse.json(
      { error: "Eroare la crearea contului" },
      { status: 500 },
    );
  }
}
