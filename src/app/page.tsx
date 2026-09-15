import { prisma } from "@/lib/prisma";

export default async function Home() {
  let staff: { id: string; nume: string; zileCoRamase: number }[] = [];
  let dbError: string | null = null;

  try {
    staff = await prisma.staff.findMany({
      orderBy: { nume: "asc" },
      select: { id: true, nume: true, zileCoRamase: true },
    });
  } catch {
    dbError =
      "Baza de date nu este conectată. Setează DATABASE_URL în .env și rulează migrările.";
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
        Grila ATI
      </h1>
      <p className="mt-1 text-sm text-zinc-600">
        Programare lunară — secție ATI / anestezie
      </p>

      <section className="mt-10">
        <h2 className="text-lg font-medium text-zinc-900">Staff</h2>
        {dbError ? (
          <p className="mt-3 text-sm text-amber-800">{dbError}</p>
        ) : staff.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">Niciun membru în staff încă.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-200 border border-zinc-200">
            {staff.map((person) => (
              <li
                key={person.id}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <span className="font-medium text-zinc-900">{person.nume}</span>
                <span className="text-zinc-500">
                  CO rămase: {person.zileCoRamase}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium text-zinc-900">Grilă lunară</h2>
        <p className="mt-3 rounded border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500">
          Grilă lunară (coming)
        </p>
      </section>
    </main>
  );
}
