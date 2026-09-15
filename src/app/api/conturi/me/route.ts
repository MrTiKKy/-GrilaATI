import { NextResponse } from "next/server";
import {
  createSessionToken,
  sessionCookieOptions,
  SESSION_COOKIE,
} from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { requireSessionUser, enforceRateLimit } from "@/lib/apiGuard";
import { getDb } from "@/lib/db";
import { clientKey } from "@/lib/rateLimit";
import { readJsonLimited } from "@/lib/readJsonLimited";
import {
  comparePassword,
  hashPassword,
  MIN_PASSWORD_LENGTH,
} from "@/lib/password";
import { clampString } from "@/lib/validate";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(request: Request) {
  const limited = enforceRateLimit(request, {
    bucket: "read",
    limit: 180,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const session = await requireSessionUser();
  if ("error" in session) return session.error;

  try {
    const sql = getDb();
    const rows = await sql`
      SELECT id, email, created_at
      FROM users
      WHERE id = ${session.user.userId}::uuid
        AND activ = true
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) {
      return NextResponse.json(
        { error: "Cont negăsit — te rugăm să te autentifici din nou" },
        { status: 401 },
      );
    }

    return NextResponse.json({
      user: {
        id: String(row.id),
        email: String(row.email),
        createdAt:
          row.created_at instanceof Date
            ? row.created_at.toISOString()
            : String(row.created_at),
      },
    });
  } catch (error) {
    console.error("GET /api/conturi/me", error);
    return NextResponse.json(
      { error: "Nu s-a putut încărca profilul" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const limited = enforceRateLimit(request, {
    bucket: "write",
    limit: 30,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const session = await requireSessionUser();
  if ("error" in session) return session.error;

  try {
    const parsed = await readJsonLimited<{
      currentPassword?: string;
      email?: string;
      newPassword?: string;
    }>(request, 8_192);
    if (!parsed.ok) return parsed.response;

    const currentPassword =
      typeof parsed.data.currentPassword === "string"
        ? parsed.data.currentPassword
        : "";
    if (!currentPassword) {
      return NextResponse.json(
        { error: "Parola curentă este obligatorie" },
        { status: 400 },
      );
    }

    const emailRaw = clampString(parsed.data.email, 254);
    const newPassword =
      typeof parsed.data.newPassword === "string"
        ? parsed.data.newPassword
        : "";

    const wantsEmail = emailRaw !== null;
    const wantsPassword = newPassword.length > 0;

    if (!wantsEmail && !wantsPassword) {
      return NextResponse.json(
        { error: "Nimic de actualizat (email sau parolă nouă)" },
        { status: 400 },
      );
    }

    if (wantsPassword && newPassword.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        {
          error: `Parola nouă trebuie să aibă cel puțin ${MIN_PASSWORD_LENGTH} caractere`,
        },
        { status: 400 },
      );
    }
    if (wantsPassword && newPassword.length > 256) {
      return NextResponse.json(
        { error: "Parola nouă este prea lungă" },
        { status: 400 },
      );
    }

    let nextEmail: string | null = null;
    if (wantsEmail && emailRaw) {
      nextEmail = emailRaw.toLowerCase();
      if (!EMAIL_RE.test(nextEmail)) {
        return NextResponse.json({ error: "Email invalid" }, { status: 400 });
      }
    }

    const sql = getDb();
    const rows = await sql`
      SELECT id, email, password_hash
      FROM users
      WHERE id = ${session.user.userId}::uuid
        AND activ = true
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) {
      return NextResponse.json({ error: "Cont negăsit" }, { status: 404 });
    }

    const hashOk = await comparePassword(
      currentPassword,
      String(row.password_hash),
    );
    if (!hashOk) {
      return NextResponse.json(
        { error: "Parola curentă este greșită" },
        { status: 401 },
      );
    }

    const currentEmail = String(row.email).toLowerCase();
    if (nextEmail && nextEmail !== currentEmail) {
      const clash = await sql`
        SELECT id FROM users
        WHERE email = ${nextEmail} AND id <> ${session.user.userId}::uuid
        LIMIT 1
      `;
      if (clash[0]) {
        return NextResponse.json(
          { error: "Emailul este deja folosit" },
          { status: 409 },
        );
      }
    }

    const emailToSave = nextEmail ?? currentEmail;
    const passwordHash = wantsPassword
      ? await hashPassword(newPassword)
      : String(row.password_hash);

    const updated = await sql`
      UPDATE users
      SET
        email = ${emailToSave},
        password_hash = ${passwordHash}
      WHERE id = ${session.user.userId}::uuid
        AND activ = true
      RETURNING id, email, created_at
    `;
    const u = updated[0];
    if (!u) {
      return NextResponse.json({ error: "Actualizare eșuată" }, { status: 500 });
    }

    if (nextEmail && nextEmail !== currentEmail) {
      await writeAudit({
        action: "user_email_change",
        resource: session.user.userId,
        detail: { from: currentEmail, to: nextEmail },
        ip: clientKey(request),
      });
    }
    if (wantsPassword) {
      await writeAudit({
        action: "user_password_change",
        resource: session.user.userId,
        ip: clientKey(request),
      });
    }

    const token = await createSessionToken({
      userId: String(u.id),
      email: String(u.email),
    });
    const response = NextResponse.json({
      user: {
        id: String(u.id),
        email: String(u.email),
        createdAt:
          u.created_at instanceof Date
            ? u.created_at.toISOString()
            : String(u.created_at),
      },
    });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  } catch (error) {
    console.error("PATCH /api/conturi/me", error);
    return NextResponse.json(
      { error: "Nu s-a putut actualiza contul" },
      { status: 500 },
    );
  }
}
