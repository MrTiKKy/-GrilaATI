import { GeneralSettingsForm } from "@/components/setari/GeneralSettingsForm";

export default async function SetariPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const sp = await searchParams;
  const welcome = sp.welcome === "1";

  return (
    <div className="space-y-4">
      {welcome && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
          <p className="text-sm font-medium text-sky-900">
            Configurează categoriile, codurile și orele, apoi adaugă angajații.
          </p>
        </div>
      )}
      <GeneralSettingsForm />
    </div>
  );
}
