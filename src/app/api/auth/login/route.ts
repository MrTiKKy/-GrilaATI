import { NextResponse } from "next/server";
import {
  createSessionToken,
  sessionCookieOptions,
  SESSION_COOKIE,
} from "@/lib/auth";
import { verifyCredentials } from "@/lib/password";
import { writeAudit } from "@/lib/audit";
import { clientKey, rateLimit } from "@/lib/rateLimit";
import { readJsonLimited } from "@/lib/readJsonLimited";

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
    const parsed = await readJsonLimited<{
      email?: string;
      password?: string;
    }>(request, 4_096);
    if (!parsed.ok) return parsed.response;

    const email =
      typeof parsed.data.email === "string" ? parsed.data.email : "";
    const password =
      typeof parsed.data.password === "string" ? parsed.data.password : "";

    if (!email || !password || email.length > 254 || password.length > 256) {
      await writeAudit({
        action: "login_fail",
        ip,
        detail: { reason: "invalid_input" },
      });
      return NextResponse.json(
        { error: "Email sau parolă invalide" },
        { status: 401 },
      );
    }

    if (!verifyCredentials(email, password)) {
      await writeAudit({
        action: "login_fail",
        ip,
        detail: { reason: "bad_credentials" },
      });
      return NextResponse.json(
        { error: "Email sau parolă invalide" },
        { status: 401 },
      );
    }

    const token = await createSessionToken();
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    await writeAudit({
      action: "login_ok",
      ip,
      detail: { email: email.trim().toLowerCase() },
    });
    return response;
  } catch (error) {
    console.error("POST /api/auth/login", error);
    return NextResponse.json(
      { error: "Autentificare temporar indisponibilă" },
      { status: 500 },
    );
  }
}
