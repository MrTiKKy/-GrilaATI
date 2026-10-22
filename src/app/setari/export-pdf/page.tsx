import { Suspense } from "react";
import { ExportPdfSettingsForm } from "@/components/setari/ExportPdfSettingsForm";

export default function SetariExportPdfPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[70vh] items-center justify-center text-sm text-slate-500">
          Se încarcă editorul PDF…
        </div>
      }
    >
      <ExportPdfSettingsForm />
    </Suspense>
  );
}
