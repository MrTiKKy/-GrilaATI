import { NextResponse } from "next/server";
import { requireSessionUser, enforceRateLimit } from "@/lib/apiGuard";
import { getDb } from "@/lib/db";

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
      WHERE id = ${session.user.userId}::uuid
      LIMIT 1
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
        isMe: true,
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

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Crearea conturilor este dezactivată. Funcționalitatea de invitații în workspace va fi disponibilă în curând.",
    },
    { status: 403 },
  );
}
