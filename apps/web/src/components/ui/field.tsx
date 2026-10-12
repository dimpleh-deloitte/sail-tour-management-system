export function Field({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-steel-600">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-steel-200 bg-white px-3 py-2 text-sm text-steel-800 focus:border-sail-500 focus:outline-none focus:ring-1 focus:ring-sail-500";
export const inputReadOnlyClass =
  "w-full rounded-lg border border-steel-100 bg-steel-50 px-3 py-2 text-sm text-steel-600";
