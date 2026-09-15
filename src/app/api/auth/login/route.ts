import { NextResponse } from "next/server";
import {
  createSessionToken,
  sessionCookieOptions,
  SESSION_COOKIE,
} from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { writeAudit } from "@/lib/audit";
import { clientKey, rateLimit } from "@/lib/rateLimit";

export async function POST(request: Request) {
  const ip = clientKey(request);
  const limited = rateLimit(`login:${ip}`, 10, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Prea multe încercări de login" },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      },
    );
  }

  try {
    const body = (await request.json()) as { password?: string };
    const password = typeof body.password === "string" ? body.password : "";

    if (!verifyPassword(password)) {
      await writeAudit({
        action: "login_fail",
        ip,
        detail: { reason: "bad_password" },
      });
      return NextResponse.json(
        { error: "Parolă incorrectă" },
        { status: 401 },
      );
    }

    const token = await createSessionToken();
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    await writeAudit({ action: "login_ok", ip });
    return response;
  } catch (error) {
    console.error("POST /api/auth/login", error);
    return NextResponse.json(
      { error: "Autentificare eșuată (verifică SESSION_SECRET / APP_PASSWORD)" },
      { status: 500 },
    );
  }
}
