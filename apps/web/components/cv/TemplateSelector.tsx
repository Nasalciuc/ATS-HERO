"use client";
// Template picker — reads the registry, shows real thumbnails, writes the choice to the
// builder store. Tailwind classes (your stack). Write-only here (no DOM in the build
// sandbox); the templates it renders ARE render-validated.
import { TEMPLATES } from "@/components/cv/templates";
import { useBuilderStore } from "@/stores/cv-builder-store";

export function TemplateSelector() {
  const templateId = useBuilderStore((s) => s.templateId);
  const setTemplate = useBuilderStore((s) => s.setTemplate);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {TEMPLATES.map((t) => {
        const selected = t.id === templateId;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => setTemplate(t.id)}
            aria-pressed={selected}
            className={`rounded-xl border p-2 text-left transition ${
              selected ? "border-violet-500 ring-2 ring-violet-300" : "border-zinc-200 hover:border-zinc-300"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={t.thumbnail} alt={`${t.name} template preview`} className="aspect-[210/297] w-full rounded-lg border border-zinc-100 object-cover" />
            <div className="mt-2 text-sm font-medium text-zinc-900">{t.name}</div>
            <div className="text-xs text-zinc-500">{t.description}</div>
          </button>
        );
      })}
    </div>
  );
}
