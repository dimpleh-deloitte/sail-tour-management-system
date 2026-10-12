import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Plane, ClipboardList, ClipboardCheck, Users, ArrowRight } from "lucide-react";
import { useSession } from "../hooks/use-session.js";
import { Card, CardBody } from "../components/ui/card.js";

const TILES: { to: string; label: string; desc: string; role?: string; icon: typeof Plane }[] = [
  { to: "/add-tour", label: "Add Tour", desc: "Create a new tour request / travel advance.", role: "EMPLOYEE", icon: Plane },
  { to: "/my-tours", label: "My Tours", desc: "View and track your own tour requests.", icon: ClipboardList },
  { to: "/worklists/forwarding", label: "Manage Tour Forwarded", desc: "Requests awaiting your forwarding.", role: "FORWARDING", icon: ClipboardCheck },
  { to: "/worklists/recommendation", label: "Recommendation Worklist", desc: "Requests awaiting your recommendation.", role: "RECOMMENDING", icon: ClipboardCheck },
  { to: "/worklists/approval", label: "Manage Tour Approval", desc: "Requests awaiting your approval.", role: "APPROVING", icon: ClipboardCheck },
  { to: "/admin", label: "HR Admin", desc: "Cross-request monitoring.", role: "HR_ADMIN", icon: Users },
];

export function HomePage() {
  const { user } = useSession();
  const visible = TILES.filter((t) => !t.role || user?.roles.includes(t.role as never));

  return (
    <div>
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-sail-700 via-sail-600 to-sail-500 px-6 py-8 text-white shadow-card sm:px-8">
        <p className="text-xs font-medium uppercase tracking-wider text-sail-100">Steel Authority of India Limited</p>
        <h1 className="mt-1 text-2xl font-semibold">Welcome, {user?.name}</h1>
        <p className="mt-1 text-sm text-sail-100">
          {user?.gradeCode} · {user?.department} · {user?.headquarter}
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((tile, i) => (
          <motion.div key={tile.to} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Link to={tile.to}>
              <Card hover className="group h-full">
                <CardBody>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sail-50 text-sail-600">
                    <tile.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-steel-800">{tile.label}</h3>
                  <p className="mt-1 text-xs text-steel-500">{tile.desc}</p>
                  <div className="mt-3 flex items-center gap-1 text-xs font-medium text-sail-600 opacity-0 transition-opacity group-hover:opacity-100">
                    Open <ArrowRight className="h-3 w-3" />
                  </div>
                </CardBody>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
