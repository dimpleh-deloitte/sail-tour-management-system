import { LucideIcon } from "lucide-react";

export function EmptyState({ icon: Icon, title, subtitle }: { icon: LucideIcon; title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-steel-100">
        <Icon className="h-6 w-6 text-steel-400" />
      </div>
      <p className="text-sm font-medium text-steel-700">{title}</p>
      {subtitle && <p className="mt-1 text-xs text-steel-500">{subtitle}</p>}
    </div>
  );
}
