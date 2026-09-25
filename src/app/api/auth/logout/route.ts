import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  readSessionPayload,
} from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { clientKey } from "@/lib/rateLimit";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  const payload = await readSessionPayload(token);

  if (!payload) {
    return NextResponse.json({ error: "Neautentificat" }, { status: 401 });
  }

  await writeAudit({
    action: "logout",
    ip: clientKey(request),
    userId: payload.userId,
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", {
    ...sessionCookieOptions(0),
    maxAge: 0,
  });
  return response;
}
