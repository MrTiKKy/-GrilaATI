import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { requireSessionUser, enforceRateLimit } from "@/lib/apiGuard";
import { getDb } from "@/lib/db";
import { clientKey } from "@/lib/rateLimit";
import { readJsonLimited } from "@/lib/readJsonLimited";
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/password";
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
      SELECT id, email, created_at, activ
      FROM users
      ORDER BY created_at ASC
    `;

    return NextResponse.json({
      items: rows.map((row) => ({
        id: String(row.id),
        email: String(row.email),
        activ: Boolean(row.activ),
        createdAt:
          row.created_at instanceof Date
            ? row.created_at.toISOString()
            : String(row.created_at),
        isMe: String(row.id) === session.user.userId,
      })),
    });
  } catch (error) {
    console.error("GET /api/conturi", error);
    return NextResponse.json(
      { error: "Nu s-au putut încărca conturile" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, {
    bucket: "write",
    limit: 20,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const session = await requireSessionUser();
  if ("error" in session) return session.error;

  try {
    const parsed = await readJsonLimited<{
      email?: string;
      password?: string;
    }>(request, 4_096);
    if (!parsed.ok) return parsed.response;

    const emailRaw = clampString(parsed.data.email, 254);
    const password =
      typeof parsed.data.password === "string" ? parsed.data.password : "";

    if (!emailRaw) {
      return NextResponse.json({ error: "Email obligatoriu" }, { status: 400 });
    }
    const email = emailRaw.toLowerCase();
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Email invalid" }, { status: 400 });
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        {
          error: `Parola trebuie să aibă cel puțin ${MIN_PASSWORD_LENGTH} caractere`,
        },
        { status: 400 },
      );
    }
    if (password.length > 256) {
      return NextResponse.json(
        { error: "Parola este prea lungă" },
        { status: 400 },
      );
    }

    const sql = getDb();
    const existing = await sql`
      SELECT id FROM users WHERE email = ${email} LIMIT 1
    `;
    if (existing[0]) {
      return NextResponse.json(
        { error: "Există deja un cont cu acest email" },
        { status: 409 },
      );
    }

    const passwordHash = await hashPassword(password);
    const inserted = await sql`
      INSERT INTO users (email, password_hash, activ)
      VALUES (${email}, ${passwordHash}, true)
      RETURNING id, email, created_at, activ
    `;
    const row = inserted[0];
    if (!row) {
      return NextResponse.json({ error: "Creare eșuată" }, { status: 500 });
    }

    await writeAudit({
      action: "user_create",
      resource: String(row.id),
      detail: {
        email,
        createdBy: session.user.userId,
      },
      ip: clientKey(request),
    });

    return NextResponse.json(
      {
        item: {
          id: String(row.id),
          email: String(row.email),
          activ: Boolean(row.activ),
          createdAt:
            row.created_at instanceof Date
              ? row.created_at.toISOString()
              : String(row.created_at),
          isMe: false,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/conturi", error);
    return NextResponse.json(
      { error: "Nu s-a putut crea contul" },
      { status: 500 },
    );
  }
}
