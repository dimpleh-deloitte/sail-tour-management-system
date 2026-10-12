// Ported from the legacy prototype's AppShell: gradient/blueprint header,
// icon nav with active indicator, avatar initials, backdrop blur. Rewired
// to the SSoT's actual route inventory (§4) and real session data instead
// of localStorage demo state. The sidebar itself is collapsible (persisted
// per-browser) so it doesn't permanently take up screen space.
import { useState } from "react";
import { NavLink } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutDashboard, Plane, ClipboardList, ClipboardCheck, ShieldCheck, Users, UserCheck, Receipt, LogOut, ChevronsLeft, ChevronsRight } from "lucide-react";
import { SailLogo } from "../shared/sail-logo.js";
import { useSession } from "../../hooks/use-session.js";

const NAV_ITEMS = [
  { to: "/", label: "Overview", subtitle: "Dashboard", icon: LayoutDashboard },
  { to: "/add-tour", label: "Add Tour", subtitle: "Tour Advance", icon: Plane, roles: ["EMPLOYEE"] },
  { to: "/my-tours", label: "My Tours", subtitle: "Requests", icon: ClipboardList },
  // Bill settlement (§11). No role filter: an employee submits bills and an
  // Approving Authority decides them, so everyone has a reason to open it.
  { to: "/settlements", label: "Bill Settlement", subtitle: "Claims", icon: Receipt },
  { to: "/worklists/forwarding", label: "Tour Forwarded", subtitle: "Worklist", icon: ClipboardCheck, roles: ["FORWARDING"] },
  { to: "/worklists/recommendation", label: "Recommendation", subtitle: "Worklist", icon: ClipboardCheck, roles: ["RECOMMENDING"] },
  { to: "/worklists/approval", label: "Tour Approval", subtitle: "Worklist", icon: ClipboardCheck, roles: ["APPROVING"] },
  // Self-service acting-authority delegation — visible to anyone who holds
  // an approval role and can therefore delegate it.
  {
    to: "/delegations",
    label: "Acting Authority",
    subtitle: "Delegation",
    icon: UserCheck,
    roles: ["FORWARDING", "RECOMMENDING", "APPROVING"],
  },
  { to: "/admin", label: "HR Admin", subtitle: "Monitoring", icon: Users, roles: ["HR_ADMIN"] },
];

const SIDEBAR_COLLAPSE_KEY = "sail-tour.sidebar-collapsed";

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("");
}

function readCollapsedPref(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useSession();
  const visibleItems = NAV_ITEMS.filter((item) => !item.roles || item.roles.some((r) => user?.roles.includes(r as never)));
  const [collapsed, setCollapsed] = useState(readCollapsedPref);

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        // best-effort only — collapse still works for this page view
      }
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-steel-50 to-white blueprint-bg">
      <header className="sticky top-0 z-40 border-b border-steel-200/80 bg-white/90 backdrop-blur-md">
        <div className="flex h-16 items-center justify-between px-4 lg:px-6">
          <SailLogo variant="full" />
          {user && (
            <div className="flex items-center gap-3 border-l border-steel-200 pl-4">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium text-steel-800">{user.name}</p>
                <p className="text-xs text-steel-500">
                  SAIL PNo. {user.staffNo} · {user.gradeCode}
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sail-500 text-sm font-semibold text-white shadow-sm">
                {initials(user.name)}
              </div>
              <button
                onClick={() => logout().then(() => window.location.assign("/login"))}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-steel-500 transition-colors hover:bg-steel-100 hover:text-steel-800"
                aria-label="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="flex">
        <motion.aside
          animate={{ width: collapsed ? 76 : 256 }}
          transition={{ type: "spring", damping: 26, stiffness: 260 }}
          className="sticky top-16 hidden h-[calc(100vh-4rem)] shrink-0 flex-col border-r border-steel-200/80 bg-white/95 backdrop-blur-md lg:flex"
        >
          <div className={`flex items-center border-b border-steel-100 py-2 ${collapsed ? "justify-center px-0" : "justify-end px-2"}`}>
            <button
              onClick={toggleCollapsed}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-steel-400 transition-colors hover:bg-steel-100 hover:text-steel-700"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
            </button>
          </div>

          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden p-3">
            {visibleItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `group relative flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200 ${
                    collapsed ? "justify-center px-0" : ""
                  } ${isActive ? "bg-sail-500 text-white shadow-md shadow-sail-200" : "text-steel-600 hover:bg-steel-50"}`
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon className="h-5 w-5 shrink-0" />
                    {!collapsed && (
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-tight">{item.label}</p>
                        <p className={`text-[11px] leading-tight ${isActive ? "text-white/80" : "text-steel-400"}`}>{item.subtitle}</p>
                      </div>
                    )}
                    <AnimatePresence>
                      {isActive && !collapsed && (
                        <motion.div
                          layoutId="nav-indicator"
                          className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-white/40"
                        />
                      )}
                    </AnimatePresence>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
          {!collapsed && (
            <div className="p-3">
              <div className="rounded-xl bg-sail-50 p-3">
                <p className="text-xs font-semibold text-sail-700">Digital Transformation</p>
                <p className="mt-1 text-[11px] leading-relaxed text-steel-500">Modern tour management for SAIL employees</p>
              </div>
            </div>
          )}
        </motion.aside>

        <main className="min-w-0 flex-1 p-4 lg:p-8">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
