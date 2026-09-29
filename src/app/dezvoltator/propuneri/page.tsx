import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { SESSION_COOKIE, readSessionPayload } from "@/lib/auth";
import { isDevEmail } from "@/lib/devAccess";
import { PropuneriDevClient } from "@/components/PropuneriDevClient";

export default async function DezvoltatorPropuneriPage() {
  const jar = await cookies();
  const user = await readSessionPayload(jar.get(SESSION_COOKIE)?.value);
  if (!user || !isDevEmail(user.email)) {
    notFound();
  }

  return (
    <main className="min-h-full flex-1 bg-slate-100">
      <PropuneriDevClient />
    </main>
  );
}
