import { NextResponse } from "next/server";

export async function readJsonLimited<T>(
  request: Request,
  maxBytes: number,
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const n = Number(contentLength);
    if (Number.isFinite(n) && n > maxBytes) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Payload prea mare" },
          { status: 413 },
        ),
      };
    }
  }

  const buf = await request.arrayBuffer();
  if (buf.byteLength > maxBytes) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Payload prea mare" },
        { status: 413 },
      ),
    };
  }

  try {
    const text = new TextDecoder("utf-8").decode(buf);
    if (!text.trim()) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Body lipsă" }, { status: 400 }),
      };
    }
    return { ok: true, data: JSON.parse(text) as T };
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "JSON invalid" }, { status: 400 }),
    };
  }
}
