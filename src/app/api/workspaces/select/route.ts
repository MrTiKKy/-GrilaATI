import { NextResponse } from "next/server";
import { requireSessionUser, enforceRateLimit } from "@/lib/apiGuard";
import { getDb } from "@/lib/db";
import { readJsonLimited } from "@/lib/readJsonLimited";
import { parseUuid } from "@/lib/validate";
import { setWorkspaceCookie } from "@/lib/workspace";

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, {
    bucket: "write",
    limit: 60,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const session = await requireSessionUser();
  if ("error" in session) return session.error;

  try {
    const parsed = await readJsonLimited<{ workspaceId?: unknown }>(
      request,
      2_048,
    );
    if (!parsed.ok) return parsed.response;

    const workspaceId = parseUuid(parsed.data.workspaceId);
    if (!workspaceId) {
      return NextResponse.json(
        { error: "workspaceId invalid" },
        { status: 400 },
      );
    }

    const sql = getDb();
    const membership = await sql`
      SELECT 1 FROM workspace_members
      WHERE user_id = ${session.user.userId}::uuid
        AND workspace_id = ${workspaceId}::uuid
      LIMIT 1
    `;
    if (!membership[0]) {
      return NextResponse.json(
        { error: "Nu ești membru al acestui workspace" },
        { status: 403 },
      );
    }

    const response = NextResponse.json({ ok: true });
    setWorkspaceCookie(response, workspaceId);
    return response;
  } catch (error) {
    console.error("POST /api/workspaces/select", error);
    return NextResponse.json(
      { error: "Eroare la selectarea workspace-ului" },
      { status: 500 },
    );
  }
}
