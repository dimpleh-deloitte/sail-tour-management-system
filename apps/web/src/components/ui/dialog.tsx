// Lightweight modal dialog — no Radix dependency in this build, so this is a
// small hand-built implementation: fixed backdrop + centered card, animated
// with framer-motion (already a dependency). Used for the Submit
// confirmation / success flow on Add Tour so it's unambiguous whether a
// tour request actually went through.
import { motion, AnimatePresence } from "framer-motion";
import { LucideIcon } from "lucide-react";

export function Dialog({
  open,
  onClose,
  icon: Icon,
  iconTone = "sail",
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose?: () => void;
  icon?: LucideIcon;
  iconTone?: "sail" | "emerald" | "amber";
  title: string;
  children?: React.ReactNode;
  footer: React.ReactNode;
}) {
  const iconBg = { sail: "bg-sail-50 text-sail-500", emerald: "bg-emerald-50 text-emerald-500", amber: "bg-amber-50 text-amber-500" }[iconTone];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-steel-900/50 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: "spring", damping: 22, stiffness: 300 }}
            className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-premium"
            onClick={(e) => e.stopPropagation()}
          >
            {Icon && (
              <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${iconBg}`}>
                <Icon className="h-7 w-7" />
              </div>
            )}
            <h2 className="text-lg font-semibold text-steel-800">{title}</h2>
            {children && <div className="mt-2 text-sm text-steel-500">{children}</div>}
            <div className="mt-6 flex justify-center gap-3">{footer}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
