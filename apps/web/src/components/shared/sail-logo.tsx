// The official SAIL (Steel Authority of India Limited) logo, supplied
// directly by the client — used as-is, never redrawn/recolored/distorted.
export function SailLogo({ variant = "compact" }: { variant?: "compact" | "full" }) {
  return (
    <div className="flex items-center gap-2">
      <img src="/sail-logo.png" alt="SAIL — Steel Authority of India Limited" className="h-14 w-auto object-contain" />
      {variant === "full" && (
        <div className="leading-tight">
          <p className="text-sm font-semibold text-steel-900">SAIL</p>
          <p className="text-[11px] text-steel-500">Tour Management System</p>
        </div>
      )}
    </div>
  );
}
