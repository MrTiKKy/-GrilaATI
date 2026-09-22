import { getDb } from "@/lib/db";

export type AuditAction =
  | "login_ok"
  | "login_fail"
  | "logout"
  | "angajat_create"
  | "angajat_delete"
  | "angajat_rename"
  | "angajat_ordine"
  | "concediu_update"
  | "programare_upsert"
  | "programare_delete"
  | "grafic_save"
  | "grafic_delete"
  | "user_create"
  | "user_email_change"
  | "user_password_change"
  | "ore_osd_update"
  | "grafic_footer_update";

export async function writeAudit(params: {
  action: AuditAction;
  resource?: string | null;
  detail?: Record<string, unknown> | null;
  ip?: string | null;
}): Promise<void> {
  try {
    const sql = getDb();
    await sql`
      INSERT INTO audit_log (action, resource, detail, ip)
      VALUES (
        ${params.action},
        ${params.resource ?? null},
        ${JSON.stringify(params.detail ?? {})}::jsonb,
        ${params.ip ?? null}
      )
    `;
  } catch (error) {
    // Nu blocăm request-ul dacă lipsește tabelul / eșuează auditul
    console.error("audit_log", error);
  }
}
