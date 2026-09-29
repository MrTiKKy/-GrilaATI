import { NextResponse } from "next/server";
import {
  createSessionToken,
  sessionCookieOptions,
  SESSION_COOKIE,
} from "@/lib/auth";
import { authenticateUser } from "@/lib/password";
import { writeAudit } from "@/lib/audit";
import { clientKey, rateLimitDb } from "@/lib/rateLimit";
import { readJsonLimited } from "@/lib/readJsonLimited";

const WINDOW_MS = 15 * 60_000;
const LIMIT = 5;

export async function POST(request: Request) {
  const ip = clientKey(request);

  try {
    // Rate limit IP pe orice încercare
    const limitIp = await rateLimitDb(`login:ip:${ip}`, LIMIT, WINDOW_MS);
    if (!limitIp.ok) {
      return NextResponse.json(
        { error: "Prea multe încercări de login" },
        {
          status: 429,
          headers: { "Retry-After": String(limitIp.retryAfterSec) },
        },
      );
    }

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

    const emailNorm = email.trim().toLowerCase();
    const limitEmail = await rateLimitDb(
      `login:email:${emailNorm}`,
      LIMIT,
      WINDOW_MS,
    );
    if (!limitEmail.ok) {
      return NextResponse.json(
        { error: "Prea multe încercări de login pentru acest email" },
        {
          status: 429,
          headers: { "Retry-After": String(limitEmail.retryAfterSec) },
        },
      );
    }

    const user = await authenticateUser(email, password);
    if (!user) {
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

    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
    });
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    await writeAudit({
      action: "login_ok",
      resource: user.id,
      ip,
      detail: { email: user.email },
      userId: user.id,
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
