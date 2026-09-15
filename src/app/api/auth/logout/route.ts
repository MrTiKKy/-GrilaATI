import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { clientKey } from "@/lib/rateLimit";
import { requireSession } from "@/lib/apiGuard";

export async function POST(request: Request) {
  const authError = await requireSession();
  if (authError) return authError;

  await writeAudit({
    action: "logout",
    ip: clientKey(request),
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", {
    ...sessionCookieOptions(0),
    maxAge: 0,
  });
  return response;
}
