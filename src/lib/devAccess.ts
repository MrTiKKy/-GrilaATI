/** Acces dezvoltator pe baza DEV_EMAILS (virgulă, lowercase). */
export function parseDevEmails(): string[] {
  const raw = process.env.DEV_EMAILS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0 && s.includes("@"));
}

export function isDevEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = parseDevEmails();
  if (list.length === 0) return false;
  return list.includes(email.trim().toLowerCase());
}

/** Strip HTML tags / control chars — text simplu. */
export function toPlainText(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim();
}
