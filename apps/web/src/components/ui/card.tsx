// Ported from the legacy prototype's Card (rounded-2xl, soft layered
// shadow, hover elevation) — see Phase1 plan §2/§4.
export function Card({ children, className = "", hover = false }: { children: React.ReactNode; className?: string; hover?: boolean }) {
  return (
    <div
      className={`rounded-2xl border border-steel-200/80 bg-white shadow-card transition-shadow duration-300 ${
        hover ? "hover:shadow-card-hover" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, icon: Icon, number }: { title: string; subtitle?: string; icon?: React.ComponentType<{ className?: string }>; number?: number }) {
  return (
    <div className="flex items-center gap-3 rounded-t-2xl border-b border-steel-100 bg-steel-50/50 px-5 py-4">
      {number !== undefined && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sail-500 text-xs font-bold text-white">
          {number}
        </div>
      )}
      {Icon && <Icon className="h-5 w-5 shrink-0 text-sail-500" />}
      <div>
        <h2 className="text-sm font-semibold text-steel-800">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-steel-500">{subtitle}</p>}
      </div>
    </div>
  );
}

export function CardBody({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`p-5 ${className}`}>{children}</div>;
}
