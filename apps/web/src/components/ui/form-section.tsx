// Ported from the legacy prototype's FormSection: numbered icon header +
// staggered fade/slide-in reveal per section.
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { Card, CardBody } from "./card.js";

export function FormSection({
  icon: Icon,
  title,
  subtitle,
  number,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  number: number;
  children: React.ReactNode;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: number * 0.05 }}>
      <Card>
        <div className="flex items-center gap-3 rounded-t-2xl border-b border-steel-100 bg-steel-50/50 px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sail-500 text-sm font-bold text-white">
            {number}
          </div>
          <Icon className="h-5 w-5 shrink-0 text-sail-500" />
          <div>
            <h2 className="text-sm font-semibold text-steel-800">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-steel-500">{subtitle}</p>}
          </div>
        </div>
        <CardBody>{children}</CardBody>
      </Card>
    </motion.div>
  );
}
